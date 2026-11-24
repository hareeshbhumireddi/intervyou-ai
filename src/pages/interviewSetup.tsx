
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, 
  ChevronRight, 
  Upload, 
  FileText, 
  CheckCircle2, 
  Search,
  Code,
  Layout,
  Database,
  Users,
  Smartphone,
  Globe,
  Monitor,
  Zap,
  Building2,
  Landmark,
  ShieldCheck,
  ArrowLeft
} from 'lucide-react';
import { Difficulty, JobRole, Sector } from '../types';
import { api } from '../utils/api';
import PomodoroTimer from '../components/PomodoroTimer';

const privateRoles: JobRole[] = [
  { id: '1', title: 'Software Developer', description: 'General software engineering roles', icon: 'Code' },
  { id: '2', title: 'Frontend Developer', description: 'UI/UX and frontend engineering', icon: 'Layout' },
  { id: '3', title: 'Backend Developer', description: 'Server-side and database architecture', icon: 'Database' },
  { id: '4', title: 'Full Stack Developer', description: 'End-to-end web applications', icon: 'Globe' },
  { id: '5', title: 'Mobile Developer', description: 'iOS and Android app development', icon: 'Smartphone' },
  { id: '6', title: 'Data Scientist', description: 'Machine learning and data analysis', icon: 'Zap' },
  { id: '7', title: 'HR Manager', description: 'Human resources and recruitment', icon: 'Users' },
  { id: '8', title: 'Product Manager', description: 'Product lifecycle and strategy', icon: 'Monitor' },
];

const governmentRoles: JobRole[] = [
  { id: 'g1', title: 'UPSC Civil Services', description: 'IAS, IPS, IFS and other central services', icon: 'Landmark' },
  { id: 'g2', title: 'APPSC/TSPSC', description: 'State public service commissions', icon: 'Building2' },
  { id: 'g3', title: 'SSC CGL', description: 'Staff Selection Commission - Combined Graduate Level', icon: 'Briefcase' },
  { id: 'g4', title: 'SSC CHSL', description: 'Staff Selection Commission - Combined Higher Secondary Level', icon: 'FileText' },
  { id: 'g5', title: 'Banking (IBPS/SBI/RBI)', description: 'PO, Clerk and Specialist Officer roles', icon: 'Building2' },
  { id: 'g6', title: 'Railway (RRB)', description: 'NTPC, Group D and technical roles', icon: 'Globe' },
  { id: 'g7', title: 'Police', description: 'SI, Constable and administrative roles', icon: 'ShieldCheck' },
  { id: 'g8', title: 'Defence', description: 'Army, Navy, Air Force, Agniveer', icon: 'ShieldCheck' },
  { id: 'g9', title: 'Postal (GDS/Postman)', description: 'Department of Posts roles', icon: 'FileText' },
  { id: 'g10', title: 'Teaching (TET/DSC)', description: 'Teacher Eligibility Test and District Selection Committee', icon: 'Users' },
  { id: 'g11', title: 'Forest Department', description: 'Range Officer, Guard and technical roles', icon: 'Zap' },
  { id: 'g12', title: 'Revenue Department', description: 'VRO, VRA and administrative roles', icon: 'FileText' },
  { id: 'g13', title: 'Group 1', description: 'Gazetted officer roles in state government', icon: 'Landmark' },
  { id: 'g14', title: 'Group 2', description: 'Non-gazetted executive and non-executive roles', icon: 'Briefcase' },
  { id: 'g15', title: 'Group 3', description: 'Village level administrative and technical roles', icon: 'Users' },
  { id: 'g16', title: 'Group 4', description: 'Junior assistant and clerical roles', icon: 'FileText' },
];

export const INTERVIEW_ROUNDS = [
  { key: 'Mixed', label: 'Mixed', description: 'A balanced mix of technical, behavioural and situational questions.' },
  { key: 'HR', label: 'HR Round', description: 'Motivation, strengths, career goals and culture fit.' },
  { key: 'Technical', label: 'Technical Round', description: 'Core concepts and problem-solving for your role.' },
  { key: 'Behavioral', label: 'Behavioural Round', description: 'STAR-style questions on teamwork, conflict and leadership.' },
  { key: 'Coding', label: 'Coding Round', description: 'Solve real problems in a code editor; scored on approach, complexity and edge cases.' },
  { key: 'Resume', label: 'Resume-based Round', description: 'Questions drawn from your own resume. Needs an uploaded resume.' },
] as const;

const difficultyLevels: { level: Difficulty, duration: string, questions: number, experience: string }[] = [
  { level: 'Beginner', duration: '15-20 min', questions: 5, experience: '0-2 years' },
  { level: 'Intermediate', duration: '25-30 min', questions: 8, experience: '3-5 years' },
  { level: 'Advanced', duration: '40-45 min', questions: 12, experience: '5+ years' },
];

const iconMap: Record<string, any> = { Code, Layout, Database, Globe, Smartphone, Zap, Users, Monitor, Landmark, Building2, Briefcase, FileText, ShieldCheck };

export default function InterviewSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const [selectedRole, setSelectedRole] = useState<JobRole | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [setupError, setSetupError] = useState('');

  // Government specific fields
  const [examName, setExamName] = useState('');
  const [department, setDepartment] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [numQuestions, setNumQuestions] = useState(5);
  const [selectedRound, setSelectedRound] = useState<string>('Mixed');

  useEffect(() => {
    const incomingState = location.state as { sector?: Sector; role?: { title?: string } } | null;
    if (incomingState?.sector) {
      setSelectedSector(incomingState.sector);
      setStep(2);
    }
    const roleTitle = incomingState?.role?.title?.trim();
    if (roleTitle) {
      const govMatch = governmentRoles.find(
        (r) =>
          r.title.toLowerCase() === roleTitle.toLowerCase() ||
          roleTitle.toLowerCase().includes(r.title.toLowerCase())
      );
      const privMatch = privateRoles.find(
        (r) =>
          r.title.toLowerCase() === roleTitle.toLowerCase() ||
          roleTitle.toLowerCase().includes(r.title.toLowerCase())
      );
      if (govMatch || /\b(upsc|ssc|sbi|ibps|rbi|isro|drdo|rrb|ongc|nic|niti|govt|government)\b/i.test(roleTitle)) {
        setSelectedSector('Government');
        setSelectedRole(
          govMatch || { id: 'custom-gov', title: roleTitle, description: `Target role: ${roleTitle}`, icon: 'Briefcase' }
        );
      } else {
        setSelectedSector(incomingState?.sector || 'Private');
        setSelectedRole(
          privMatch || { id: 'custom-priv', title: roleTitle, description: `Target role: ${roleTitle}`, icon: 'Briefcase' }
        );
      }
      setStep(3);
    }
  }, [location.state]);

  const currentRoles = selectedSector === 'Government' ? governmentRoles : privateRoles;

  const filteredRoles = currentRoles.filter(role => 
    role.title.toLowerCase().includes(search.toLowerCase())
  );

  const launchInterview = async () => {
    setIsUploading(true);
    setSetupError('');
    try {
      if (resumeFile) await api.uploadResume(resumeFile);
      if (selectedSector === 'Private' && selectedRound === 'Resume' && !resumeFile) {
        try {
          await api.getResume();
        } catch {
          setSetupError('The Resume-based round needs a resume. Upload one below, or choose another round.');
          setIsUploading(false);
          return;
        }
      }
      navigate('/room', {
        state: {
          role: selectedRole?.title,
          sector: selectedSector,
          difficulty: selectedDifficulty,
          examName,
          department,
          preferredLanguage,
          numQuestions,
          round: selectedSector === 'Private' ? selectedRound : undefined,
          resumeText: '',
        },
      });
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Could not prepare the interview. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleNextStep = async () => {
    if (step === 1 && selectedSector) setStep(2);
    else if (step === 2 && selectedRole) setStep(3);
    else if (step === 3 && selectedDifficulty) {
      if (selectedSector === 'Government') {
        await launchInterview();
      } else {
        setStep(4);
      }
    }
    else if (step === 4) {
      await launchInterview();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Pomodoro Study & Focus Timer */}
      <PomodoroTimer />

      {/* Progress Bar */}
      <div className="mb-12">
        <div className="flex justify-between mb-4">
          {(selectedSector === 'Government' ? ['Sector', 'Role', 'Details'] : ['Sector', 'Role', 'Difficulty', 'Resume']).map((s, i) => (
            <div key={i} className="flex flex-col items-center">
               <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                 step > i + 1 ? 'bg-green-500 text-white' : 
                 step === i + 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
               }`}>
                 {step > i + 1 ? <CheckCircle2 className="w-6 h-6" /> : i + 1}
               </div>
               <span className={`text-xs mt-2 font-medium ${step >= i + 1 ? 'text-blue-600' : 'text-slate-400'}`}>{s}</span>
            </div>
          ))}
        </div>
        <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
           <motion.div 
             className="h-full bg-blue-600" 
             initial={{ width: '0%' }}
             animate={{ width: `${((step - 1) / (selectedSector === 'Government' ? 2 : 3)) * 100}%` }}
           />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">Select Sector</h2>
              <p className="text-slate-600 dark:text-slate-400">Are you preparing for a Government or Private sector interview?</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <button
                onClick={() => setSelectedSector('Government')}
                className={`p-10 rounded-3xl border-2 text-center transition-all group ${
                  selectedSector === 'Government' 
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/10' 
                    : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-200'
                }`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-colors ${
                  selectedSector === 'Government' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 group-hover:bg-blue-100'
                }`}>
                  <Landmark className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-xl mb-2">Government Sector</h3>
                <p className="text-sm text-slate-500">Public service, administrative, and state-owned enterprise roles</p>
              </button>

              <button
                onClick={() => setSelectedSector('Private')}
                className={`p-10 rounded-3xl border-2 text-center transition-all group ${
                  selectedSector === 'Private' 
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/10' 
                    : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-200'
                }`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-colors ${
                  selectedSector === 'Private' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 group-hover:bg-blue-100'
                }`}>
                  <Building2 className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-xl mb-2">Private Sector</h3>
                <p className="text-sm text-slate-500">Corporate, startup, and multinational company positions</p>
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">Choose your Job Role</h2>
              <p className="text-slate-600 dark:text-slate-400">Select the position in the {selectedSector} sector</p>
            </div>

            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search roles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 outline-none transition-all shadow-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredRoles.map((role) => {
                const Icon = iconMap[role.icon];
                return (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(role)}
                    className={`p-6 rounded-3xl border-2 text-left transition-all group ${
                      selectedRole?.id === role.id 
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/10' 
                        : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-200'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
                      selectedRole?.id === role.id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 group-hover:bg-blue-100'
                    }`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-lg mb-1">{role.title}</h3>
                    <p className="text-sm text-slate-500">{role.description}</p>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">
                {selectedSector === 'Government' ? 'Interview Details' : 'Difficulty & Round'}
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                {selectedSector === 'Government' 
                  ? 'Fill in the specific details for your government interview' 
                  : 'Match your experience level and pick the interview round to practise'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Difficulty Selection */}
              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Difficulty Level</label>
                <div className="grid grid-cols-1 gap-4">
                  {difficultyLevels.map((d) => (
                    <button
                      key={d.level}
                      onClick={() => {
                        setSelectedDifficulty(d.level);
                        if (selectedSector === 'Government') setNumQuestions(d.questions);
                      }}
                      className={`p-6 rounded-2xl border-2 text-left transition-all ${
                        selectedDifficulty === d.level 
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/10' 
                          : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-200'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`font-bold ${selectedDifficulty === d.level ? 'text-blue-600' : ''}`}>{d.level}</span>
                        <span className="text-xs text-slate-500">{d.experience} exp.</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Interview round (private sector) */}
              {selectedSector === 'Private' && (
                <div className="space-y-4">
                  <span id="round-label" className="text-sm font-bold text-slate-500 uppercase tracking-wider">Interview Round</span>
                  <div role="radiogroup" aria-labelledby="round-label" className="grid grid-cols-1 gap-3">
                    {INTERVIEW_ROUNDS.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        role="radio"
                        aria-checked={selectedRound === r.key}
                        onClick={() => { setSelectedRound(r.key); setNumQuestions(r.key === 'Coding' ? 2 : 5); }}
                        className={`p-4 rounded-2xl border-2 text-left transition-all ${
                          selectedRound === r.key
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/10'
                            : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-200'
                        }`}
                      >
                        <span className={`block font-bold ${selectedRound === r.key ? 'text-blue-600' : ''}`}>{r.label}</span>
                        <span className="mt-1 block text-xs text-slate-500">{r.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Government Specific Fields */}
              {selectedSector === 'Government' && (
                <div className="space-y-6 bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Exam / Post Name</label>
                    <input 
                      type="text"
                      value={examName}
                      onChange={(e) => setExamName(e.target.value)}
                      placeholder="Ex: IAS Mains, SI Prelims"
                      className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Department</label>
                    <input 
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Ex: Revenue, Police, Education"
                      className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Language</label>
                      <select 
                        value={preferredLanguage}
                        onChange={(e) => setPreferredLanguage(e.target.value)}
                        className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium appearance-none"
                      >
                        <option value="English">English</option>
                        <option value="Telugu">Telugu</option>
                        <option value="Hindi">Hindi</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Questions</label>
                      <input 
                        type="number"
                        value={numQuestions}
                        onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                        className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">Upload Resume</h2>
              <p className="text-slate-600 dark:text-slate-400">AI will generate questions based on your skills</p>
            </div>

            <div 
              className={`max-w-xl mx-auto border-2 border-dashed rounded-3xl p-12 text-center transition-all ${
                resumeFile ? 'border-green-500 bg-green-50/10' : 'border-slate-200 dark:border-slate-800 hover:border-blue-500'
              }`}
            >
              <input 
                type="file" 
                id="resume" 
                className="hidden" 
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                accept=".pdf,.doc,.docx"
              />
              <label htmlFor="resume" className="cursor-pointer">
                {resumeFile ? (
                  <div className="space-y-4">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
                      <FileText className="w-10 h-10 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{resumeFile.name}</p>
                      <p className="text-slate-500 text-sm">{(resumeFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button 
                      onClick={(e) => { e.preventDefault(); setResumeFile(null); }}
                      className="text-red-500 text-sm font-semibold hover:underline"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto">
                      <Upload className="w-10 h-10 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xl font-bold">Drag & drop your resume</p>
                      <p className="text-slate-500 text-sm">Support PDF, DOC, DOCX up to 10MB</p>
                    </div>
                    <span className="inline-block px-6 py-2 bg-slate-100 dark:bg-slate-800 rounded-full font-semibold text-sm">
                      Browse Files
                    </span>
                  </div>
                )}
              </label>
            </div>
            <p className="text-center text-slate-500 text-sm italic">
              * Don't have a resume? You can skip this step, but AI questions won't be personalized.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="mt-12 flex justify-between items-center">
        {step > 1 ? (
          <button 
            onClick={() => setStep(step - 1)}
            className="px-8 py-3 rounded-2xl font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-50 transition-colors"
          >
            Back
          </button>
        ) : (
          <div />
        )}
        
        <button
          onClick={handleNextStep}
          disabled={(step === 1 && !selectedSector) || (step === 2 && !selectedRole) || (step === 3 && !selectedDifficulty) || isUploading}
          className={`px-10 py-3 rounded-2xl font-bold flex items-center space-x-2 shadow-lg shadow-blue-500/20 transition-all ${
            (step === 1 && !selectedSector) || (step === 2 && !selectedRole) || (step === 3 && !selectedDifficulty) || isUploading
              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'
          }`}
        >
          {isUploading ? (
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{selectedSector === 'Government' ? 'Preparing Interview...' : 'Analyzing...'}</span>
            </div>
          ) : (
            <>
              <span>{(step === 4 || (step === 3 && selectedSector === 'Government')) ? 'Start Interview' : 'Continue'}</span>
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
      {setupError && <p role="alert" className="mt-4 text-sm font-medium text-red-600">{setupError}</p>}
    </div>
  );
}
