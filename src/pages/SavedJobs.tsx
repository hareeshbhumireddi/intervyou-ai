import { useEffect, useState } from 'react';
import { Bookmark, BookmarkX, ExternalLink, Loader2, MapPin, Building2, Briefcase, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SavedJob } from '../types';
import { api } from '../utils/api';
import { getCompanyLogo, COMPANY_LOGOS, PLACEHOLDER_AVATARS } from '../utils/assets';
import { useAppState } from '../hooks/useAppState';
import { deleteSavedJobFromFirestore, loadSavedJobsFromFirestore } from '../services/firestoreService';

export default function SavedJobs() {
  const { user, firebaseUid } = useAppState();
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatarUrl]);

  useEffect(() => {
    let isActive = true;
    Promise.all([
      api.savedJobs().catch(() => ({ savedJobs: [] as SavedJob[] })),
      firebaseUid ? loadSavedJobsFromFirestore(firebaseUid).catch(() => [] as SavedJob[]) : Promise.resolve([] as SavedJob[]),
    ])
      .then(([{ savedJobs: serverRecords }, cloudRecords]) => {
        if (!isActive) return;
        const merged = new Map<string, SavedJob>();
        [...cloudRecords, ...serverRecords].forEach((item) => {
          const key = item.jobId || `${item.title}::${item.company}`;
          if (!merged.has(key)) merged.set(key, item);
        });
        setSavedJobs(Array.from(merged.values()));
      })
      .catch((loadError) => { if (isActive) setError(loadError instanceof Error ? loadError.message : 'Could not load saved jobs.'); })
      .finally(() => { if (isActive) setIsLoading(false); });
    return () => { isActive = false; };
  }, [firebaseUid]);

  const removeJob = async (job: SavedJob) => {
    if (!window.confirm(`Remove ${job.title} from saved jobs?`)) return;
    setRemovingId(job.id);
    setError('');
    try {
      await api.deleteSavedJob(job.id).catch(() => undefined);
      if (firebaseUid) {
        await deleteSavedJobFromFirestore(firebaseUid, job.id);
      }
      setSavedJobs((current) => current.filter((saved) => saved.id !== job.id));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove this saved job.');
    } finally {
      setRemovingId(null);
    }
  };

  const avatarSrc = !avatarError && user?.avatarUrl ? user.avatarUrl : PLACEHOLDER_AVATARS.candidateMale;

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner with Candidate Avatar & Job Portfolio Context */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative">
              <img
                key={avatarSrc}
                src={avatarSrc}
                alt={user?.fullName || 'Candidate Profile'}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="h-16 w-16 rounded-2xl object-cover ring-4 ring-blue-500/10 shadow-md"
              />
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
                <Bookmark className="h-3.5 w-3.5 fill-current" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  Target Opportunities
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {savedJobs.length} Bookmarked Position{savedJobs.length === 1 ? '' : 's'}
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">
                Saved Jobs & Applications
              </h1>
              <p className="text-xs text-slate-500 sm:text-sm">
                Track top company listings bookmarked from your customized Job Alerts.
              </p>
            </div>
          </div>

          <Link
            to="/jobs"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition"
          >
            <Briefcase className="h-4 w-4" /> Browse More Jobs
          </Link>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="flex min-h-64 flex-col items-center justify-center text-sm text-slate-500">
          <Loader2 className="h-7 w-7 animate-spin text-blue-600 mb-2" />
          <span>Loading bookmarked opportunities...</span>
        </div>
      ) : savedJobs.length ? (
        <section className="grid gap-5 lg:grid-cols-2">
          {savedJobs.map((job) => {
            const logoUrl = getCompanyLogo(job.company);
            return (
              <article
                key={job.id}
                className="group relative flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-800">
                        <img
                          src={logoUrl}
                          alt={`${job.company} logo`}
                          referrerPolicy="no-referrer"
                          className="h-full w-full rounded-xl object-contain"
                        />
                      </div>
                      <div>
                        <span className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          {job.company}
                        </span>
                        <h2 className="mt-0.5 text-lg font-bold text-slate-900 group-hover:text-blue-600 transition dark:text-white dark:group-hover:text-blue-400">
                          {job.title}
                        </h2>
                      </div>
                    </div>

                    <button
                      onClick={() => void removeJob(job)}
                      disabled={removingId === job.id}
                      aria-label={`Remove ${job.title} from saved jobs`}
                      className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:hover:bg-red-950/30 transition cursor-pointer"
                      title="Remove from saved jobs"
                    >
                      {removingId === job.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <BookmarkX className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      {job.location}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      Verified Listing
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <span className="text-xs text-slate-400">
                    Saved on {new Date(job.savedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <div className="flex items-center gap-3">
                    <Link
                      to="/setup"
                      state={{ role: { title: job.title } }}
                      className="text-xs font-bold text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 transition"
                    >
                      Practice for this role
                    </Link>
                    {job.applyLink && (
                      <a
                        href={job.applyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 transition"
                      >
                        Apply <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <div className="mx-auto mb-4 flex items-center justify-center -space-x-3">
            <img
              src={COMPANY_LOGOS.tech}
              alt="Tech company emblem"
              referrerPolicy="no-referrer"
              className="h-14 w-14 rounded-2xl border-2 border-white object-cover shadow-sm dark:border-slate-900"
            />
            <img
              src={COMPANY_LOGOS.cloud}
              alt="Cloud company emblem"
              referrerPolicy="no-referrer"
              className="h-16 w-16 rounded-2xl border-2 border-white object-cover shadow-md dark:border-slate-900 z-10"
            />
            <img
              src={COMPANY_LOGOS.institution}
              alt="Institution emblem"
              referrerPolicy="no-referrer"
              className="h-14 w-14 rounded-2xl border-2 border-white object-cover shadow-sm dark:border-slate-900"
            />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            No saved jobs yet
          </h2>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            Explore active job notifications across Government and Private sectors, bookmark openings you like, and prepare tailored mock interviews.
          </p>
          <Link
            to="/jobs"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition"
          >
            <Sparkles className="h-4 w-4" /> Browse Job Alerts
          </Link>
        </section>
      )}
    </div>
  );
}