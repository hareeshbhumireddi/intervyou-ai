import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { History as HistoryIcon, Search, Filter, ChevronRight, Briefcase, Clock, Calendar, Star, Download } from 'lucide-react';
import { useState } from 'react';
import { useAppState } from '../hooks/useAppState';
import { exportSessionReportPdf, exportHistorySummaryPdf } from '../utils/exportPdf';

export default function HistoryPage() {
  const { sessions, user } = useAppState();
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('All');
  const [roundFilter, setRoundFilter] = useState('All');

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDifficulty = difficultyFilter === 'All' || session.difficulty === difficultyFilter;
    const matchesRound = roundFilter === 'All' || session.round === roundFilter;
    return matchesSearch && matchesDifficulty && matchesRound;
  });

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-3">
            <HistoryIcon className="w-8 h-8 text-blue-600" />
            <span>Interview History</span>
          </h1>
          <p className="text-slate-500 mt-1">Review your past performances and track your improvement over time.</p>
        </div>
        {sessions.length > 0 && (
          <button
            onClick={() => exportHistorySummaryPdf(sessions, user?.fullName || 'Candidate')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            title="Download formatted PDF report of all interview sessions"
          >
            <Download className="w-4 h-4" />
            <span>Export History Report (PDF)</span>
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by job role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none focus:border-blue-500 transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select 
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="bg-transparent outline-none font-medium text-sm pr-2"
          >
            <option>All</option>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
        </div>
        <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2">
          <select
            aria-label="Filter by round"
            value={roundFilter}
            onChange={(e) => setRoundFilter(e.target.value)}
            className="bg-transparent outline-none font-medium text-sm pr-2"
          >
            <option value="All">All rounds</option>
            <option value="HR">HR</option>
            <option value="Technical">Technical</option>
            <option value="Behavioral">Behavioural</option>
            <option value="Coding">Coding</option>
            <option value="Resume">Resume-based</option>
            <option value="Mixed">Mixed</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {filteredSessions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Date & Role</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Type</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Sector</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Difficulty</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Score</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Feedback Summary</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSessions.map((session, i) => (
                  <motion.tr 
                    key={session.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                  >
                    <td className="px-8 py-6">
                       <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600">
                             <Briefcase className="w-5 h-5" />
                          </div>
                          <div>
                             <p className="font-bold text-slate-900 dark:text-slate-50">{session.role}</p>
                             <div className="flex items-center space-x-3 text-xs text-slate-500 font-medium">
                                <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> {new Date(session.date).toLocaleDateString()}</span>
                             </div>
                          </div>
                       </div>
                    </td>
                    <td className="px-8 py-6 text-center text-sm text-slate-600 dark:text-slate-400">{session.roundLabel ? <span className="whitespace-nowrap rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{session.roundLabel}</span> : (session.interviewType || session.role)}</td>
                    <td className="px-8 py-6 text-center">
                       <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                         session.sector === 'Government' 
                           ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400' 
                           : 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                       }`}>
                         {session.sector}
                       </span>
                    </td>
                    <td className="px-8 py-6 text-center">
                       <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                         session.difficulty === 'Advanced' ? 'bg-purple-100 text-purple-600' :
                         session.difficulty === 'Intermediate' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                       }`}>
                         {session.difficulty}
                       </span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${session.status === 'completed' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'}`}>
                        {session.status || 'completed'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center">
                       <div className="flex flex-col items-center">
                          <span className={`text-lg font-black ${
                            (session.overallReport?.overallScore || 0) >= 80 ? 'text-green-600' :
                            (session.overallReport?.overallScore || 0) >= 60 ? 'text-orange-500' : 'text-red-500'
                          }`}>
                            {session.overallReport?.overallScore || 0}%
                          </span>
                          <div className="flex space-x-0.5">
                             {[1,2,3,4,5].map(star => (
                               <Star key={star} className={`w-2.5 h-2.5 ${star <= (session.overallReport?.overallScore || 0) / 20 ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`} />
                             ))}
                          </div>
                       </div>
                    </td>
                    <td className="px-8 py-6 max-w-xs">
                       <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 italic">
                         "{session.overallReport?.summary}"
                       </p>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <div className="flex justify-end items-center space-x-2">
                          <button
                            onClick={() => exportSessionReportPdf(session, user?.fullName || 'Candidate', user?.email || '')}
                            title="Export Performance Report (PDF)"
                            aria-label={`Export PDF report for ${session.role}`}
                            className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors cursor-pointer"
                          >
                             <Download className="w-5 h-5" />
                          </button>
                          <Link 
                            to={`/report/${session.id}`}
                            className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </Link>
                       </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-32 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-6">
               <HistoryIcon className="w-10 h-10 text-slate-200" />
            </div>
            <h3 className="text-xl font-bold mb-2">No Records Found</h3>
            <p className="text-slate-500 mb-8 max-w-sm">
              {searchTerm || difficultyFilter !== 'All' || roundFilter !== 'All' 
                ? "We couldn't find any sessions matching your filters." 
                : "Your interview history is currently empty. Start your first session to see records here!"}
            </p>
            <Link to="/setup" className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-blue-500/20">
               Start Mock Interview
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}