import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  DollarSign, 
  TrendingUp, 
  MapPin, 
  Briefcase, 
  Building2, 
  Sparkles, 
  CheckCircle2, 
  HelpCircle,
  BarChart3,
  Percent,
  Layers,
  ArrowRight
} from 'lucide-react';
import { estimateSalary, SALARY_BENCHMARK_DATASET, CITY_COMPENSATION_MULTIPLIERS } from '../utils/salaryDataset';

interface SalaryEstimatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: string;
  initialLocation?: string;
  initialExperience?: string;
}

export default function SalaryEstimatorModal({
  isOpen,
  onClose,
  initialRole = 'Full Stack Engineer',
  initialLocation = 'Bengaluru',
  initialExperience = '2-5 Years',
}: SalaryEstimatorModalProps) {
  const [role, setRole] = useState(initialRole);
  const [location, setLocation] = useState(initialLocation);
  const [experience, setExperience] = useState(initialExperience);

  // Sync state if initial props change when opened
  useState(() => {
    if (initialRole) setRole(initialRole);
    if (initialLocation) setLocation(initialLocation);
    if (initialExperience) setExperience(initialExperience);
  });

  const salaryData = useMemo(() => {
    return estimateSalary(role, location, experience);
  }, [role, location, experience]);

  const presetRoles = [
    'Frontend React Developer',
    'Backend Java Developer',
    'Full Stack Engineer',
    'AI & Data Scientist',
    'DevOps & Cloud SRE',
    'Mobile Application Developer',
    'Product Manager',
    'ISRO / PSU Scientist'
  ];

  const presetLocations = [
    'Bengaluru',
    'Hyderabad',
    'Pune',
    'Mumbai',
    'Delhi NCR',
    'Remote',
    'India (Baseline)'
  ];

  const presetExperiences = [
    'Entry Level (0-2 Yrs)',
    'Mid-Level (2-5 Yrs)',
    'Senior Level (5-8 Yrs)',
    'Staff / Tech Lead (8+ Yrs)'
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
      />

      {/* Modal Dialog */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-3xl rounded-[36px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 z-10 my-8 overflow-hidden"
      >
        {/* Glow Accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Header */}
        <div className="flex items-start justify-between pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  Market Salary Estimator
                </h2>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Public Benchmark Dataset
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aggregated tech & public compensation ranges across Indian hubs & experience brackets
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Input Selectors */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Role selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Job Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
            >
              {presetRoles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Location selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              City / Region
            </label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
            >
              {presetLocations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Experience selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Experience Level
            </label>
            <select
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="w-full rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
            >
              {presetExperiences.map((exp) => (
                <option key={exp} value={exp}>{exp}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Compensation Results Display */}
        <div className="mt-6 rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6 sm:p-7 text-white shadow-xl border border-blue-900/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">
                Expected Annual Compensation
              </span>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-3xl sm:text-4xl font-black text-white">
                  {salaryData.formattedRange}
                </span>
                <span className="text-xs font-semibold text-emerald-400">
                  Median: {salaryData.formattedMedian}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Category: <strong className="text-white">{salaryData.roleCategory}</strong> • {salaryData.experienceBracket}
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Market Demand: {salaryData.demandLevel}</span>
              </span>
              <span className="text-[11px] text-slate-400">
                {salaryData.locationAdjustment}
              </span>
            </div>
          </div>

          {/* Visual Distribution Percentile Bar */}
          <div className="pt-6 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span>25th Percentile (Entry): <strong className="text-white">₹{salaryData.minLPA} LPA</strong></span>
              <span>50th (Median): <strong className="text-emerald-400">₹{salaryData.medianLPA} LPA</strong></span>
              <span>75th / 90th (Top Tier): <strong className="text-white">₹{salaryData.maxLPA} - ₹{salaryData.topLPA} LPA</strong></span>
            </div>

            {/* Custom Multi-Segment Bar */}
            <div className="relative h-4 w-full rounded-full bg-slate-800 overflow-hidden p-0.5 border border-white/10 flex">
              <div className="h-full bg-gradient-to-r from-blue-600 to-sky-500 rounded-l-full" style={{ width: '30%' }} title="25th Percentile" />
              <div className="h-full bg-gradient-to-r from-sky-500 to-emerald-400" style={{ width: '40%' }} title="Median / 50th Percentile" />
              <div className="h-full bg-gradient-to-r from-emerald-400 to-amber-400 rounded-r-full" style={{ width: '30%' }} title="75th-90th Percentile" />
            </div>

            <div className="flex justify-between text-[10px] text-slate-400 font-semibold px-1">
              <span>Standard Service Firms</span>
              <span>Mid-Tier Product / Funded Startups</span>
              <span>Big Tech & Unicorns</span>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Cards (Base, Bonus, Equity) */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Fixed Base Salary ({salaryData.breakdown.basePercent}%)
            </p>
            <p className="text-lg font-black text-slate-900 dark:text-white">
              {salaryData.breakdown.baseLPA}
            </p>
            <p className="text-[11px] text-slate-500">Guaranteed annual gross monthly payout</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Variable / Performance Bonus ({salaryData.breakdown.bonusPercent}%)
            </p>
            <p className="text-lg font-black text-blue-600 dark:text-blue-400">
              {salaryData.breakdown.bonusLPA}
            </p>
            <p className="text-[11px] text-slate-500">Annual appraisal and company performance incentive</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Equity / ESOPs ({salaryData.breakdown.equityPercent}%)
            </p>
            <p className="text-lg font-black text-purple-600 dark:text-purple-400">
              {salaryData.breakdown.equityLPA}
            </p>
            <p className="text-[11px] text-slate-500">Stock options with standard 4-year vesting schedule</p>
          </div>
        </div>

        {/* Top Paying Companies */}
        <div className="mt-5 p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Top Paying Companies for this Profile:
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {salaryData.sampleCompanies.map((comp) => (
                <span 
                  key={comp}
                  className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  {comp}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 text-xs font-black shadow-lg shadow-blue-500/20 transition-all"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}
