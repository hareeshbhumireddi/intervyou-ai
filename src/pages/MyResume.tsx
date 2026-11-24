import { useEffect, useRef, useState } from 'react';
import AtsScore from '../components/AtsScore';
import AtsOptimizationGuide from '../components/AtsOptimizationGuide';
import QuickResumeTips from '../components/QuickResumeTips';
import ResumeStrengthMeter from '../components/ResumeStrengthMeter';
import { AlertCircle, Download, Eye, FileText, Lightbulb, Loader2, RefreshCw, Save, Trash2, Upload, X } from 'lucide-react';
import * as mammoth from 'mammoth';
import { Link } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import { ResumeFileMetadata } from '../types';
import { api } from '../utils/api';

const MAX_RESUME_SIZE = 10 * 1024 * 1024;
const ACCEPTED_RESUME_TYPES = ['pdf', 'doc', 'docx', 'txt'];

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export default function MyResume() {
  const { user, setUser, syncProfileToCloud } = useAppState();
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [resumeFile, setResumeFile] = useState<ResumeFileMetadata | null>(null);
  const [resumeText, setResumeText] = useState(user.resumeText || '');
  const [saved, setSaved] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isTipsOpen, setIsTipsOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [error, setError] = useState('');
  const [isLoadingResume, setIsLoadingResume] = useState(true);
  const hasResume = Boolean(resumeFile || user.resumeUrl);
  const resumeName = resumeFile?.name || 'Uploaded resume';

  useEffect(() => {
    let isActive = true;
    api.getResume()
      .then((data: any) => {
        if (isActive) {
          setResumeFile(data.resume);
          if (data.text) {
            setResumeText((prev) => prev || data.text);
          }
          setUser((current) => ({
            ...current,
            resumeFile: data.resume,
            resumeText: data.text || current.resumeText,
          }));
        }
      })
      .catch((loadError) => {
        if (loadError.status === 404) {
          if (isActive) setResumeFile(null);
        } else if (isActive) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load your resume.');
        }
      })
      .finally(() => { if (isActive) setIsLoadingResume(false); });
    return () => { isActive = false; };
  }, [setUser]);

  useEffect(() => {
    if (!isPreviewOpen) return;

    let isActive = true;
    let objectUrl = '';
    setIsPreviewLoading(true);
    setPreviewError('');
    setPreviewText('');
    setPreviewUrl('');

    const loadPreview = async () => {
      try {
        if (!resumeFile) {
          if (!user.resumeUrl) throw new Error('The saved resume file could not be found.');
          if (isActive) setPreviewUrl(user.resumeUrl);
          return;
        }

        const file = await api.downloadResume();
        objectUrl = URL.createObjectURL(file);
        if (isActive) setPreviewUrl(objectUrl);
        const extension = resumeFile.name.split('.').pop()?.toLowerCase();

        if (extension === 'docx') {
          const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
          if (isActive) setPreviewText(result.value || 'No readable text was found in this document.');
        } else if (extension === 'txt' || file.type.startsWith('text/')) {
          const text = await file.text();
          if (isActive) setPreviewText(text || 'This text file is empty.');
        } else if (extension === 'doc') {
          if (isActive) setPreviewError('Legacy .doc files cannot be previewed in this browser. Download the file to open it in a document editor.');
        }
      } catch (previewLoadError) {
        if (isActive) setPreviewError(previewLoadError instanceof Error ? previewLoadError.message : 'Could not open this resume.');
      } finally {
        if (isActive) setIsPreviewLoading(false);
      }
    };

    void loadPreview();
    return () => {
      isActive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isPreviewOpen, resumeFile, user.resumeUrl]);

  const handleResumeChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ACCEPTED_RESUME_TYPES.includes(extension)) {
      setError('Choose a PDF, DOC, DOCX, or TXT resume.');
      return;
    }
    if (file.size > MAX_RESUME_SIZE) {
      setError('The resume must be 10 MB or smaller.');
      return;
    }

    setIsUploading(true);
    setError('');
    try {
      const result = await api.uploadResume(file);
      setResumeFile(result.resume);
      const text = (result as any).text || '';
      if (text) {
        setResumeText(text);
      }
      const nextProfile = {
        ...user,
        resumeUrl: undefined,
        resumeFile: result.resume,
        resumeText: text || user.resumeText,
      };
      const stampedProfile = { ...nextProfile, profileUpdatedAt: new Date().toISOString() };
      setUser(stampedProfile);
      await syncProfileToCloud(stampedProfile, 'resume');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not save this resume.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Permanently delete ${resumeName}?`)) return;

    setIsDeleting(true);
    setError('');
    try {
      await api.deleteResume();
      setResumeFile(null);
      const nextProfile = { ...user, resumeFile: undefined, resumeUrl: undefined };
      const stampedProfile = { ...nextProfile, profileUpdatedAt: new Date().toISOString() };
      setUser(stampedProfile);
      setIsPreviewOpen(false);
      await syncProfileToCloud(stampedProfile, 'resume');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete this resume.');
    } finally {
      setIsDeleting(false);
    }
  };

  const saveResumeText = async () => {
    setError('');
    try {
      const payload = {
        ...user,
        resumeFile: resumeFile || user.resumeFile,
        resumeText: resumeText.trim(),
      };
      const { user: updatedUser } = await api.updateProfile(payload);
      const syncedUser = {
        ...updatedUser,
        resumeFile: resumeFile || updatedUser.resumeFile,
        profileUpdatedAt: updatedUser.profileUpdatedAt || new Date().toISOString(),
      };
      setUser(syncedUser);
      setSaved(true);
      await syncProfileToCloud(syncedUser, 'resume');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Resume text could not be saved.');
    }
  };

  const isPdf = resumeFile?.name.toLowerCase().endsWith('.pdf')
    || resumeFile?.type === 'application/pdf'
    || (!resumeFile && Boolean(user.resumeUrl));
  const isDocx = resumeFile?.name.toLowerCase().endsWith('.docx');
  const isTextFile = resumeFile?.name.toLowerCase().endsWith('.txt') || resumeFile?.type.startsWith('text/');

  const handleJumpToEditor = () => {
    textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    textareaRef.current?.focus();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">Candidate documents</p>
          <h1 className="mt-1 text-3xl font-bold">My Resume</h1>
          <p className="mt-2 text-sm text-slate-500">Upload and manage the resume you use for interview preparation.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsTipsOpen(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden="true" />
          <span>Quick Resume Tips</span>
        </button>
      </header>

      <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleResumeChange} disabled={isLoadingResume || isUploading} className="sr-only" aria-label="Choose resume file" />

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><FileText className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0">
                <h2 className="font-semibold">Uploaded resume</h2>
                {isLoadingResume ? (
                  <p className="mt-1 text-sm text-slate-500">Loading resume...</p>
                ) : hasResume ? (
                  <>
                    <p className="mt-1 truncate text-sm font-medium">{resumeName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {resumeFile ? `${resumeFile.type || 'Document'} · ${formatFileSize(resumeFile.size)} · Uploaded ${new Date(resumeFile.uploadedAt).toLocaleDateString()}` : 'Saved in your profile'}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">No resume uploaded yet</p>
                )}
              </div>

              {hasResume ? (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setIsPreviewOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                    <Eye className="h-4 w-4" /> View
                  </button>
                  <button onClick={() => inputRef.current?.click()} disabled={isUploading || isLoadingResume} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800">
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Replace
                  </button>
                  <button onClick={handleDelete} disabled={isDeleting} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/60 dark:hover:bg-red-950/40">
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
                  </button>
                </div>
              ) : (
                <button onClick={() => inputRef.current?.click()} disabled={isUploading || isLoadingResume} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload Resume
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500">PDF, DOC, DOCX, or TXT · Maximum file size 10 MB</p>
        {error && <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><FileText className="h-5 w-5" /></span>
            <div>
              <h2 className="font-semibold">Resume text</h2>
              <p className="mt-1 text-sm text-slate-500">Keep editable resume text with your candidate profile.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsTipsOpen(true)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
          >
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            ATS Quick Tips
          </button>
        </div>
        <textarea
          ref={textareaRef}
          value={resumeText}
          onChange={(event) => { setResumeText(event.target.value); setSaved(false); }}
          rows={8}
          placeholder="Add your experience, skills, education, and achievements..."
          className="mt-5 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950"
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Link to="/profile" className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">Edit profile details</Link>
          <div className="flex items-center gap-3">
            {saved && <span role="status" className="text-sm text-green-600">Resume text saved</span>}
            <button onClick={saveResumeText} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
              <Save className="h-4 w-4" /> Save text
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold">Profile snapshot</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Highest qualification</dt><dd className="mt-1 font-medium">{user.qualification || 'Not added'}</dd></div>
          <div><dt className="text-slate-500">Degree</dt><dd className="mt-1 font-medium">{user.education.degree || 'Not added'}</dd></div>
          <div><dt className="text-slate-500">Specialization</dt><dd className="mt-1 font-medium">{user.education.specialization || 'Not added'}</dd></div>
          <div><dt className="text-slate-500">Institution</dt><dd className="mt-1 font-medium">{user.education.college || 'Not added'}</dd></div>
        </dl>
      </section>

      <ResumeStrengthMeter
        hasResume={hasResume}
        isLoadingResume={isLoadingResume}
        resumeText={resumeText}
        userSkills={user.skills || []}
        initialIndustry="Software Engineering"
      />

      <AtsScore hasResume={hasResume} resumeText={resumeText} initialRole="Python Developer" />

      <div id="ats-optimization-guide">
        <AtsOptimizationGuide resumeText={resumeText} hasResume={hasResume} />
      </div>

      {isPreviewOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" role="presentation" onClick={() => setIsPreviewOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="resume-preview-title" onClick={(event) => event.stopPropagation()} className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5">
              <div className="min-w-0"><h2 id="resume-preview-title" className="truncate font-semibold">{resumeName}</h2><p className="text-xs text-slate-500">Resume preview</p></div>
              <div className="flex shrink-0 items-center gap-2">
                {previewUrl && <a href={previewUrl} download={resumeName} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Download resume"><Download className="h-5 w-5" /></a>}
                <button onClick={() => setIsPreviewOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close resume preview"><X className="h-5 w-5" /></button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-auto bg-slate-100 dark:bg-slate-950">
              {isPreviewLoading ? (
                <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
              ) : previewError ? (
                <div className="mx-auto flex max-w-xl flex-col items-center gap-4 p-10 text-center">
                  <AlertCircle className="h-8 w-8 text-amber-500" />
                  <p className="text-sm text-slate-600 dark:text-slate-300">{previewError}</p>
                  {previewUrl && <a href={previewUrl} download={resumeName} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Download className="h-4 w-4" /> Download resume</a>}
                </div>
              ) : previewText ? (
                <pre className="mx-auto min-h-full max-w-4xl whitespace-pre-wrap bg-white p-6 text-sm leading-7 text-slate-800 dark:bg-slate-900 dark:text-slate-100 sm:p-10">{previewText}</pre>
              ) : isPdf && previewUrl ? (
                <iframe title={`Preview of ${resumeName}`} src={previewUrl} className="h-[75vh] w-full bg-white" />
              ) : isDocx || isTextFile ? (
                <div className="p-8 text-center text-sm text-slate-500">No readable text was found in this resume.</div>
              ) : previewUrl ? (
                <div className="p-8 text-center text-sm text-slate-500">This resume is available to download.</div>
              ) : null}
            </div>
          </section>
        </div>
      )}
      <QuickResumeTips
        isOpen={isTipsOpen}
        onClose={() => setIsTipsOpen(false)}
        resumeText={resumeText}
        resumeFile={resumeFile}
        hasResume={hasResume}
        onJumpToEditor={handleJumpToEditor}
      />
    </div>
  );
}