import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  FileSpreadsheet,
  FileText,
  Linkedin,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { UserProfile } from '../types';
import { ApiError, api } from '../utils/api';
import { normalizeUserProfile } from '../services/firestoreService';

interface LinkedInConnectModalProps {
  isOpen: boolean;
  user: UserProfile;
  onClose: () => void;
  onSuccess: (updatedUser: UserProfile, message: string, syncAction?: 'linkedin' | 'profile') => void;
}

export function LinkedInConnectModal({
  isOpen,
  user,
  onClose,
  onSuccess,
}: LinkedInConnectModalProps) {
  const [oauthConfigured, setOauthConfigured] = useState<boolean | null>(null);
  const [redirectUri, setRedirectUri] = useState('');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importTab, setImportTab] = useState<'file' | 'text'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [profileUrl, setProfileUrl] = useState(user.linkedinProfile?.profileUrl || '');
  const [headline, setHeadline] = useState(user.linkedinProfile?.headline || '');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [error, setError] = useState('');
  const [oauthNotice, setOauthNotice] = useState('');
  const [copiedUri, setCopiedUri] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<Window | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setOauthNotice('');
    setSelectedFile(null);
    setProfileUrl(user.linkedinProfile?.profileUrl || '');
    setHeadline(user.linkedinProfile?.headline || '');

    let active = true;
    setIsCheckingStatus(true);
    api
      .linkedinStatus()
      .then((res) => {
        if (!active) return;
        setOauthConfigured(res.oauthConfigured);
        setRedirectUri(res.redirectUri);
      })
      .catch(() => {
        if (!active) return;
        setOauthConfigured(false);
      })
      .finally(() => {
        if (active) setIsCheckingStatus(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, user.linkedinProfile?.headline, user.linkedinProfile?.profileUrl]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOAuthMessage = async (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin &&
        !event.origin.endsWith('.run.app') &&
        !event.origin.startsWith('http://localhost')
      ) {
        return;
      }

      if (event.data?.type === 'LINKEDIN_OAUTH_SUCCESS') {
        setIsAuthorizing(false);
        setError('');
        try {
          const { user: refreshed } = await api.me();
          const clean = normalizeUserProfile(refreshed);
          setOauthNotice('LinkedIn account verified! Now import your LinkedIn PDF or CSV below to pull your work history into your resume.');
          onSuccess(clean, 'LinkedIn account verified and connected.', 'linkedin');
        } catch {
          setOauthNotice('LinkedIn account connected. Import your LinkedIn PDF or CSV below to sync positions.');
        }
      } else if (event.data?.type === 'LINKEDIN_OAUTH_ERROR') {
        setIsAuthorizing(false);
        setError(String(event.data?.error || 'LinkedIn authorization was cancelled or failed.'));
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [isOpen, onSuccess]);

  if (!isOpen) return null;

  const handleContinueWithLinkedIn = async () => {
    setError('');
    setOauthNotice('');
    setIsAuthorizing(true);
    try {
      const { authUrl } = await api.linkedinAuthUrl();
      const width = 560;
      const height = 680;
      const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
      const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
      const popup = window.open(
        authUrl,
        'linkedin_oauth',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );
      if (!popup) {
        setIsAuthorizing(false);
        setError('Popup was blocked by your browser. Allow popups for this site or import your LinkedIn PDF/CSV below.');
        return;
      }
      popupRef.current = popup;
      const closePoll = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(closePoll);
          setIsAuthorizing(false);
        }
      }, 500);
    } catch (err) {
      setIsAuthorizing(false);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Could not launch LinkedIn authorization.');
      }
    }
  };

  const handleCopyRedirectUri = async () => {
    if (!redirectUri) return;
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 2000);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (importTab === 'file' && !selectedFile) {
      setError('Select a LinkedIn Profile PDF (.pdf) or LinkedIn Positions export (.csv).');
      return;
    }
    if (importTab === 'text' && !rawText.trim()) {
      setError('Paste your LinkedIn Experience text before importing.');
      return;
    }

    setIsImporting(true);
    try {
      const result = await api.importLinkedInWorkHistory({
        file: importTab === 'file' ? selectedFile || undefined : undefined,
        rawText: importTab === 'text' ? rawText : undefined,
        profileUrl: profileUrl.trim() || undefined,
        headline: headline.trim() || undefined,
        replaceExisting,
      });

      const cleanUser = normalizeUserProfile(result.user);
      const summaryMsg =
        result.addedEntriesCount > 0
          ? `Imported ${result.addedEntriesCount} work experience role${result.addedEntriesCount === 1 ? '' : 's'}${result.addedSkillsCount > 0 ? ` and ${result.addedSkillsCount} skills` : ''} into your resume profile.`
          : `Synced ${result.importedEntriesCount} LinkedIn role${result.importedEntriesCount === 1 ? '' : 's'} with your resume profile.`;

      onSuccess(cleanUser, summaryMsg, 'linkedin');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import LinkedIn work history.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="linkedin-connect-title"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#0A66C2] text-white flex items-center justify-center shrink-0">
              <Linkedin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="linkedin-connect-title" className="text-lg font-bold text-slate-900 dark:text-white truncate">
                Connect with LinkedIn
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verify your account and import work history directly into your resume profile
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close LinkedIn import modal"
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300 font-medium"
            >
              {error}
            </div>
          )}

          {oauthNotice && (
            <div
              role="status"
              className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-sm text-emerald-700 dark:text-emerald-300 font-medium"
            >
              {oauthNotice}
            </div>
          )}

          {/* Step 1: OAuth Account Verification */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    1. LinkedIn Account OAuth Verification
                  </span>
                  {user.linkedinProfile?.connected && user.linkedinProfile.memberId && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      <Check className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Links your verified LinkedIn identity via OpenID Connect popup.
                </p>
              </div>
              <button
                type="button"
                onClick={handleContinueWithLinkedIn}
                disabled={isCheckingStatus || isAuthorizing || oauthConfigured === false}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A66C2] hover:bg-[#004182] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
              >
                {isAuthorizing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Waiting for LinkedIn...</span>
                  </>
                ) : (
                  <>
                    <Linkedin className="w-4 h-4" />
                    <span>{user.linkedinProfile?.memberId ? 'Reconnect LinkedIn' : 'Continue with LinkedIn'}</span>
                  </>
                )}
              </button>
            </div>

            {oauthConfigured === false && (
              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                <p>
                  Live OAuth requires <code className="font-mono text-slate-800 dark:text-slate-200">LINKEDIN_CLIENT_ID</code> and{' '}
                  <code className="font-mono text-slate-800 dark:text-slate-200">LINKEDIN_CLIENT_SECRET</code> in server environment variables.
                </p>
                {redirectUri && (
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="font-mono text-[11px] truncate text-slate-700 dark:text-slate-300">
                      {redirectUri}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyRedirectUri}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
                    >
                      {copiedUri ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedUri ? 'Copied' : 'Copy Callback URL'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Import Work History -> Resume Profile */}
          <form onSubmit={handleImportSubmit} className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                2. Import Work History into Resume Profile
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                LinkedIn&apos;s public OpenID API omits past job positions, so upload your LinkedIn{' '}
                <strong className="font-semibold text-slate-700 dark:text-slate-300">Save to PDF</strong>,{' '}
                <strong className="font-semibold text-slate-700 dark:text-slate-300">Positions.csv</strong>, or paste your Experience section to sync your Work History, Skills, and Resume Text automatically.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  LinkedIn Profile URL (optional)
                </label>
                <input
                  type="url"
                  value={profileUrl}
                  onChange={(e) => setProfileUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/in/your-handle"
                  className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Professional Headline (optional)
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Senior Full Stack Engineer"
                  className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Source Mode Switch */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setImportTab('file')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  importTab === 'file'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Upload PDF or Positions.csv</span>
              </button>
              <button
                type="button"
                onClick={() => setImportTab('text')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  importTab === 'text'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Paste LinkedIn Experience</span>
              </button>
            </div>

            {importTab === 'file' ? (
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.csv,.txt,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                    setError('');
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/30 transition-colors flex flex-col items-center justify-center gap-2 text-center"
                >
                  <Upload className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                  {selectedFile ? (
                    <>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{selectedFile.name}</span>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {(selectedFile.size / 1024).toFixed(1)} KB — Click to choose a different file
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Select LinkedIn Profile PDF or Positions.csv
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        On LinkedIn: Profile &rarr; More &rarr; Save to PDF, or Data Export &rarr; Positions.csv
                      </span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div>
                <textarea
                  rows={6}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Paste your LinkedIn Experience entries here, for example:\n\nSoftware Engineer at Acme Cloud\nJan 2022 - Present · Bengaluru, India\nBuilt React and Node.js microservices reducing API latency by 35%.\n\nFrontend Intern at StartupLabs\nMay 2021 - Dec 2021\nDeveloped reusable TypeScript UI components and automated Playwright tests.`}
                  className="w-full px-3.5 py-2.5 text-sm rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
                />
              </div>
            )}

            <label className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
              />
              <span>Replace existing work history instead of merging new roles</span>
            </label>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isImporting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importing Work History...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Import to Resume Profile</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
