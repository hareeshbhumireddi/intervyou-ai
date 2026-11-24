import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  X,
  Zap,
  FileText,
  CheckCircle2,
  Sparkles,
  Building2,
  MapPin,
  Send,
  Loader2,
  ExternalLink,
  AlertCircle,
  User,
  Mail,
  Phone,
  Clock,
  DollarSign,
  PlayCircle,
  Upload
} from 'lucide-react';
import { JobApplication, JobNotification, ResumeFileMetadata, UserProfile } from '../types';
import { api } from '../utils/api';
import { getJobSalaryEstimate } from '../utils/salaryDataset';

interface QuickApplyModalProps {
  job: JobNotification | null;
  user: UserProfile;
  existingApplication?: JobApplication;
  onClose: () => void;
  onSubmitted: (application: JobApplication) => void;
  onPracticeInterview?: (job: JobNotification) => void;
}

/**
 * Extracts matching skills and a concise background highlight from the candidate's uploaded resume text
 */
function analyzeResumeForJob(
  resumeText: string,
  user: UserProfile,
  job: JobNotification
): {
  matchedSkills: string[];
  extractedPhone: string;
  resumeHighlight: string;
} {
  const lowerResume = (resumeText || '').toLowerCase();
  const profileSkills = Array.isArray(user.skills) ? user.skills : [];
  const jobSkills = Array.isArray(job.skills) ? job.skills : [];

  const matchedSkills: string[] = [];
  for (const skill of jobSkills) {
    const sLower = skill.toLowerCase();
    const inProfile = profileSkills.some(
      (ps) => ps.toLowerCase().includes(sLower) || sLower.includes(ps.toLowerCase())
    );
    const inResume = lowerResume.includes(sLower);
    if (inProfile || inResume) {
      matchedSkills.push(skill);
    }
  }

  // Extract phone number from resume text if profile mobile is missing
  const phoneMatch = resumeText.match(/(?:\+?\d{1,3}[\s-]?)?\(?\d{3,5}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  const extractedPhone = user.mobile || (phoneMatch ? phoneMatch[0].trim() : '');

  // Extract meaningful summary / project / experience lines from resume text
  const cleanLines = resumeText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 35 &&
        l.length < 220 &&
        !l.includes('@') &&
        !/^https?:\/\//i.test(l) &&
        !/^(resume|curriculum vitae|education|skills|contact|phone|email)$/i.test(l)
    );

  const keywordHit = cleanLines.find((line) =>
    jobSkills.some((sk) => line.toLowerCase().includes(sk.toLowerCase()))
  );
  const resumeHighlight = keywordHit || cleanLines[0] || '';

  return { matchedSkills, extractedPhone, resumeHighlight };
}

function buildAutoIntentSummary(
  job: JobNotification,
  user: UserProfile,
  resumeMeta: ResumeFileMetadata | null,
  resumeText: string,
  matchedSkills: string[],
  resumeHighlight: string
): string {
  const name = user.fullName || 'Candidate';
  const eduStr = user.education?.degree
    ? `${user.education.degree}${user.education.specialization ? ` (${user.education.specialization})` : ''}${user.education.college ? ` from ${user.education.college}` : ''}`
    : user.qualification || 'relevant engineering & domain background';

  const skillsStr =
    matchedSkills.length > 0
      ? matchedSkills.join(', ')
      : (user.skills && user.skills.length > 0 ? user.skills.slice(0, 4).join(', ') : (job.skills || []).slice(0, 3).join(', '));

  const lines: string[] = [
    `Application Intent — ${job.title} at ${job.company} (${job.location})`,
    '',
    `Dear ${job.company} Hiring Team,`,
    '',
    `I am ${name}, applying for the ${job.jobType || 'Full-time'} ${job.title} opportunity via Quick Apply. Backed by my ${eduStr} and hands-on proficiency in ${skillsStr || 'modern software and analytical workflows'}, I am eager to contribute immediately to your ${job.industry || job.category} team.`,
  ];

  if (resumeHighlight) {
    lines.push('', `From my uploaded resume (${resumeMeta?.name || 'Verified Resume'}): "${resumeHighlight.replace(/^[-•*]\s*/, '')}"`);
  } else if (resumeText.trim().length > 0) {
    lines.push('', `My attached resume (${resumeMeta?.name || 'Verified Resume'}) outlines my project execution, problem-solving depth, and alignment with ${job.company}'s requirements.`);
  }

  lines.push(
    '',
    `I welcome the opportunity to discuss how my skills align with ${job.company}'s roadmap.`,
    '',
    `Regards,`,
    name
  );

  return lines.join('\n');
}

export default function QuickApplyModal({
  job,
  user,
  existingApplication,
  onClose,
  onSubmitted,
  onPracticeInterview,
}: QuickApplyModalProps) {
  const [resumeMeta, setResumeMeta] = useState<ResumeFileMetadata | null>(user.resumeFile || null);
  const [resumeText, setResumeText] = useState<string>(user.resumeText || '');
  const [isLoadingResume, setIsLoadingResume] = useState(false);

  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');
  const [availability, setAvailability] = useState('Immediate');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [intentSummary, setIntentSummary] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedApp, setSubmittedApp] = useState<JobApplication | null>(existingApplication || null);

  // Load latest resume metadata & extracted text from server when modal opens
  useEffect(() => {
    if (!job) return;
    let active = true;
    setSubmitError('');
    setSubmittedApp(existingApplication || null);

    const loadAndPopulate = async () => {
      let currentMeta = user.resumeFile || null;
      let currentText = user.resumeText || '';

      if (!currentMeta || !currentText) {
        setIsLoadingResume(true);
        try {
          const data = await api.getResume();
          if (active) {
            currentMeta = data.resume || currentMeta;
            currentText = data.text || currentText;
            setResumeMeta(currentMeta);
            setResumeText(currentText);
          }
        } catch {
          // 404 when no uploaded resume exists yet is handled gracefully in UI
        } finally {
          if (active) setIsLoadingResume(false);
        }
      } else {
        setResumeMeta(currentMeta);
        setResumeText(currentText);
      }

      if (!active) return;

      if (existingApplication) {
        setCandidateName(existingApplication.candidateName);
        setCandidateEmail(existingApplication.candidateEmail);
        setCandidatePhone(existingApplication.candidatePhone);
        setAvailability(existingApplication.availability || 'Immediate');
        setExpectedSalary(existingApplication.expectedSalary || '');
        setIntentSummary(existingApplication.intentSummary);
        return;
      }

      const { matchedSkills, extractedPhone, resumeHighlight } = analyzeResumeForJob(
        currentText,
        user,
        job
      );
      const salaryBenchmark = getJobSalaryEstimate(job);

      setCandidateName(user.fullName || '');
      setCandidateEmail(user.email || '');
      setCandidatePhone(extractedPhone);
      setAvailability(job.jobType === 'Internship' ? 'Immediate / Semester Break' : 'Immediate');
      setExpectedSalary(job.salary || salaryBenchmark.formattedMedian);
      setIntentSummary(
        buildAutoIntentSummary(job, user, currentMeta, currentText, matchedSkills, resumeHighlight)
      );
    };

    void loadAndPopulate();
    return () => {
      active = false;
    };
  }, [job, user, existingApplication]);

  const analysis = useMemo(() => {
    if (!job) return { matchedSkills: [], extractedPhone: '', resumeHighlight: '' };
    return analyzeResumeForJob(resumeText, user, job);
  }, [resumeText, user, job]);

  const handleRegenerateIntent = () => {
    if (!job) return;
    setIntentSummary(
      buildAutoIntentSummary(
        job,
        user,
        resumeMeta,
        resumeText,
        analysis.matchedSkills,
        analysis.resumeHighlight
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    if (!candidateName.trim() || !candidateEmail.trim() || !intentSummary.trim()) {
      setSubmitError('Please ensure your name, email, and application intent are filled.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const { application } = await api.quickApply({
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        location: job.location,
        platform: job.platform || job.sector,
        applyLink: job.applyLink,
        candidateName: candidateName.trim(),
        candidateEmail: candidateEmail.trim(),
        candidatePhone: candidatePhone.trim(),
        resumeName: resumeMeta?.name || (user.resumeUrl ? 'Profile Resume Link' : 'Profile Summary (No file attached)'),
        availability,
        expectedSalary: expectedSalary.trim(),
        intentSummary: intentSummary.trim(),
        matchedSkills: analysis.matchedSkills,
      });

      setSubmittedApp(application);
      onSubmitted(application);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit Quick Apply intent.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!job) return null;

  const hasUploadedResume = Boolean(resumeMeta || user.resumeUrl || resumeText.trim());

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="relative w-full max-w-2xl rounded-[32px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8"
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 text-white relative">
            <button
              onClick={onClose}
              aria-label="Close Quick Apply modal"
              className="absolute top-5 right-5 rounded-full bg-white/15 hover:bg-white/25 p-2 text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[10px] font-black uppercase tracking-wider mb-3">
              <Zap className="h-3.5 w-3.5 text-amber-300" />
              <span>Resume-Powered Quick Apply</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black leading-snug pr-8">
              {job.title}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs font-semibold text-blue-100">
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {job.company}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {job.location}
              </span>
              {job.jobType && (
                <>
                  <span>•</span>
                  <span className="rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-black uppercase">
                    {job.jobType}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            {submitError && (
              <div role="alert" className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Uploaded Resume Auto-Population Status Card */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    hasUploadedResume
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                      : 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                  }`}>
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      {isLoadingResume
                        ? 'Syncing Uploaded Resume...'
                        : resumeMeta?.name || (hasUploadedResume ? 'Profile Resume Linked' : 'No Resume Uploaded Yet')}
                      {hasUploadedResume && !isLoadingResume && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {hasUploadedResume
                        ? 'Auto-populated candidate details, matched skills & application intent from your resume'
                        : 'Upload a PDF/DOCX resume in My Resume for richer automatic tailoring'}
                    </p>
                  </div>
                </div>

                <Link
                  to="/my-resume"
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Upload className="h-3 w-3" />
                  <span>{hasUploadedResume ? 'Update Resume' : 'Upload Resume'}</span>
                </Link>
              </div>

              {/* Matched Resume Skills */}
              {analysis.matchedSkills.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/70 dark:border-slate-700/60">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mr-1">
                    Resume Skill Match ({analysis.matchedSkills.length}/{(job.skills || []).length || analysis.matchedSkills.length}):
                  </span>
                  {analysis.matchedSkills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                    >
                      ✓ {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {submittedApp && !isSubmitting ? (
              /* Confirmation State */
              <div className="rounded-3xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20 p-6 space-y-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/25">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Quick Apply Intent Recorded!
                  </h3>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Your auto-populated application intent for <strong>{job.title}</strong> at <strong>{job.company}</strong> using <strong>{submittedApp.resumeName}</strong> has been saved on {new Date(submittedApp.appliedAt).toLocaleString()}.
                  </p>
                </div>

                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 text-left text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line max-h-40 overflow-y-auto">
                  {submittedApp.intentSummary}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <a
                    href={job.applyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-xs font-black text-white shadow-md transition-all"
                  >
                    <span>Complete Final Step on {job.platform || 'Portal'}</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>

                  {job.officialWebsite &&
                    job.officialWebsite !== job.applyLink &&
                    !/^https?:\/\/(www\.)?(linkedin|naukri)\.com\/?$/i.test(job.officialWebsite) && (
                      <a
                        href={job.officialWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-black text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all"
                      >
                        <span>{job.company} Careers Site</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}

                  {onPracticeInterview && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onPracticeInterview(job);
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 text-xs font-black shadow-md transition-all"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      <span>Practice Interview for Role</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-2xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Auto-Populated Application Intent Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <User className="h-3 w-3 text-blue-600" />
                      <span>Full Name</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                      placeholder="Your Full Name"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Mail className="h-3 w-3 text-blue-600" />
                      <span>Email</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={candidateEmail}
                      onChange={(e) => setCandidateEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Phone className="h-3 w-3 text-blue-600" />
                      <span>Phone</span>
                    </label>
                    <input
                      type="tel"
                      value={candidatePhone}
                      onChange={(e) => setCandidatePhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-purple-600" />
                      <span>Notice Period / Availability</span>
                    </label>
                    <select
                      value={availability}
                      onChange={(e) => setAvailability(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Immediate">Immediate Joiner</option>
                      <option value="Immediate / Semester Break">Immediate / Semester Break</option>
                      <option value="15 Days">15 Days Notice</option>
                      <option value="30 Days">30 Days Notice</option>
                      <option value="60 Days">60 Days Notice</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-emerald-600" />
                      <span>Expected Compensation</span>
                    </label>
                    <input
                      type="text"
                      value={expectedSalary}
                      onChange={(e) => setExpectedSalary(e.target.value)}
                      placeholder="e.g. 18 LPA or Negotiable"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      <span>Auto-Populated Application Intent</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleRegenerateIntent}
                      className="text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Re-populate from Resume
                    </button>
                  </div>
                  <textarea
                    required
                    rows={7}
                    value={intentSummary}
                    onChange={(e) => setIntentSummary(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3.5 text-xs font-medium leading-relaxed text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-60 cursor-pointer"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span>{isSubmitting ? 'Submitting Intent...' : 'Submit Quick Apply Intent'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
