import { ArrowRight, Calendar, Plus, Trophy, Award, Clock, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import { PLACEHOLDER_AVATARS, getCandidateAvatar } from '../utils/assets';

export default function MyInterviews() {
  const { sessions, user } = useAppState();

  const completedSessions = sessions.filter(
    (s) => s.status === 'completed' || s.overallReport
  );
  const avgScore = completedSessions.length
    ? Math.round(
        completedSessions.reduce(
          (sum, s) => sum + (s.overallReport?.overallScore || 0),
          0
        ) / completedSessions.length
      )
    : user?.stats?.avgScore || 0;

  const candidatePhoto = user?.avatarUrl || PLACEHOLDER_AVATARS.candidateMale;

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Candidate Profile Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative">
              <img
                src={candidatePhoto}
                alt={user?.fullName || 'Candidate Profile'}
                referrerPolicy="no-referrer"
                className="h-20 w-20 rounded-2xl object-cover ring-4 ring-blue-500/10 shadow-md"
              />
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  Active Candidate
                </span>
                <span className="text-xs text-slate-400">Verified Profile</span>
              </div>
              <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">
                {user?.fullName || 'Candidate Dashboard'}
              </h1>
              <p className="text-xs text-slate-500 sm:text-sm">
                {user?.email || 'Prepare and benchmark your interview readiness.'}
              </p>
            </div>
          </div>

          <Link
            to="/setup"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" /> Start New Interview
          </Link>
        </div>

        {/* Quick Candidate Snapshot */}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-slate-100 pt-6 dark:border-slate-800 sm:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Briefcase className="h-4 w-4 text-blue-600" />
              <span>Total Sessions</span>
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
              {sessions.length}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Trophy className="h-4 w-4 text-emerald-600" />
              <span>Average Score</span>
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-600">
              {avgScore}%
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Award className="h-4 w-4 text-purple-600" />
              <span>Completed</span>
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
              {completedSessions.length}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Clock className="h-4 w-4 text-amber-600" />
              <span>Target Readiness</span>
            </div>
            <p className="mt-2 text-2xl font-black text-blue-600">
              {avgScore >= 75 ? 'Ready' : avgScore >= 50 ? 'Intermediate' : 'Developing'}
            </p>
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Interview History & Practice Sessions
          </h2>
          <span className="text-xs font-semibold text-slate-500">
            {sessions.length} recorded session{sessions.length === 1 ? '' : 's'}
          </span>
        </div>

        {sessions.length ? (
          <div className="grid gap-4">
            {sessions.map((session, index) => {
              const avatar = user?.avatarUrl || getCandidateAvatar(index);
              const score = session.overallReport?.overallScore;
              return (
                <Link
                  key={session.id}
                  to={`/performance/${session.id}`}
                  className="group flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={avatar}
                      alt={user?.fullName || 'Candidate session portrait'}
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_AVATARS.candidateMale; }}
                      className="h-14 w-14 rounded-2xl object-cover ring-2 ring-slate-100 dark:ring-slate-800"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                            session.sector === 'Government'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                          }`}
                        >
                          {session.sector || 'Private'} Sector
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {session.difficulty}
                        </span>
                      </div>
                      <h3 className="mt-1 font-bold text-base text-slate-900 group-hover:text-blue-600 transition dark:text-white dark:group-hover:text-blue-400">
                        {session.role}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(session.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        {session.roundLabel && (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {session.roundLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 border-t border-slate-100 pt-3 dark:border-slate-800 sm:border-0 sm:pt-0">
                    {score !== undefined ? (
                      <div className="text-left sm:text-right">
                        <div className="text-xl font-black tabular-nums text-slate-900 dark:text-white">
                          <span
                            className={
                              score >= 75
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : score >= 50
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }
                          >
                            {score}%
                          </span>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Overall Score
                        </span>
                      </div>
                    ) : (
                      <span className="rounded-xl bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        In Progress
                      </span>
                    )}

                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition dark:bg-slate-800 dark:text-slate-300">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
            <img
              src={PLACEHOLDER_AVATARS.candidateFemale}
              alt="Start Practice"
              referrerPolicy="no-referrer"
              className="mx-auto h-20 w-20 rounded-2xl object-cover ring-4 ring-blue-500/10 shadow-sm mb-4"
            />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              No interview sessions yet
            </h3>
            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
              Simulate real-world technical and behavioral rounds, receive instant AI scoring, and build your confidence.
            </p>
            <Link
              to="/setup"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition"
            >
              Start Your First Mock Interview <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}