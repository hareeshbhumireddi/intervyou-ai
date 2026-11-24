import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Download, 
  Share2, 
  ChevronRight, 
  Award, 
  Check,
  CheckCircle2, 
  XCircle, 
  TrendingUp, 
  Star,
  Zap,
  Target,
  BarChart3,
  MessageSquare,
  ArrowRight,
  Clock,
  RotateCcw,
  LayoutDashboard,
  BrainCircuit,
  Eye,
  Activity,
  Award as Trophy,
  FileText,
  AlertCircle,
  HelpCircle,
  BarChart,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  RefreshCcw,
  Home,
  Volume2,
  Square
} from 'lucide-react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer,
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart as RePieChart,
  Pie,
  LineChart as ReLineChart,
  Line,
  Legend
} from 'recharts';
import { useAppState } from '../hooks/useAppState';
import { api } from '../utils/api';
import { exportSessionReportPdf } from '../utils/exportPdf';
import { ToneSentimentWidget, getToneAccent } from '../components/ToneSentimentWidget';
import PerformanceAudioPlayer, { AudioSection } from '../components/PerformanceAudioPlayer';
import { MockInterviewReplay, MockQuestionAudioInline } from '../components/MockInterviewReplay';
import { analyzeAnswerSentimentClient, deriveSessionSentimentAnalysis } from '../utils/sentimentAnalyzer';
import {
  findPreferredVoice,
  getSortedBrowserVoices,
  getVoicePreferences,
  isSpeechSynthesisSupported,
} from '../utils/speechPreferences';

export default function PerformanceReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { sessions, updateSession, refreshSessions, user } = useAppState();
  const session = sessions.find(s => s.id === id);
  
  const [isGenerating, setIsGenerating] = useState(!session?.overallReport);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'downloaded'>('idle');
  const [shareCopied, setShareCopied] = useState(false);
  const [speakingQuestionId, setSpeakingQuestionId] = useState<string | null>(null);
  const questionSpeechSupported = isSpeechSynthesisSupported();
  const questionSpeechRunRef = useRef(0);

  useEffect(() => {
    return () => {
      questionSpeechRunRef.current += 1;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const audioSections = useMemo<AudioSection[]>(() => {
    if (!session?.overallReport) return [];
    const r = session.overallReport;
    const takeawaysText = r.keyTakeaways?.length
      ? `Primary strengths: ${r.keyTakeaways.slice(0, 4).join('. ')}.`
      : '';
    const nextStepsText = r.nextSteps?.length
      ? `Recommended growth steps: ${r.nextSteps.slice(0, 4).join('. ')}.`
      : '';

    const questionScripts = session.questions
      .map((q, idx) => {
        const ev = session.evaluations[q.id];
        if (!ev) return '';
        const topSuggestion = ev.suggestions?.[0] ? ` Suggestion: ${ev.suggestions[0]}.` : '';
        return `Question ${idx + 1}: ${q.question}. Score: ${ev.score} percent. ${ev.feedback}${topSuggestion}`;
      })
      .filter(Boolean)
      .join(' ');

    const sessionSentiment = deriveSessionSentimentAnalysis(session);
    const sentimentSentence = `Dominant emotional tone was ${sessionSentiment.dominantTone}. ${sessionSentiment.emotionalArcSummary}`;

    return [
      {
        id: 'full',
        label: 'Full Summary',
        text: `Interview performance summary for ${session.role}. Overall score: ${r.overallScore} percent, rated ${r.result}. ${r.summary} ${sentimentSentence} ${takeawaysText} ${nextStepsText} Career advice: ${r.careerAdvice}`,
      },
      {
        id: 'strengths-growth',
        label: 'Strengths & Next Steps',
        text: `${takeawaysText} ${nextStepsText}`.trim() || r.summary,
      },
      {
        id: 'questions',
        label: 'Question Feedback',
        text: questionScripts || 'No per-question feedback details available.',
      },
      {
        id: 'career',
        label: 'Career Advice',
        text: `Career advice for ${session.role}: ${r.careerAdvice}`,
      },
    ];
  }, [session]);

  const toggleQuestionSpeech = (questionId: string, questionIndex: number, questionText: string) => {
    if (!questionSpeechSupported || !session) return;

    if (speakingQuestionId === questionId) {
      questionSpeechRunRef.current += 1;
      window.speechSynthesis.cancel();
      setSpeakingQuestionId(null);
      return;
    }

    const ev = session.evaluations[questionId];
    const spokenParts = [
      `Question ${questionIndex + 1}: ${questionText}.`,
      `Your score is ${ev?.score ?? 0} percent.`,
      ev?.feedback || '',
      ev?.strengths?.length ? `Strengths: ${ev.strengths.join(', ')}.` : '',
      ev?.weaknesses?.length ? `Areas to improve: ${ev.weaknesses.join(', ')}.` : '',
      ev?.suggestions?.length ? `Suggestion: ${ev.suggestions[0]}.` : '',
    ]
      .filter(Boolean)
      .join(' ');

    questionSpeechRunRef.current += 1;
    const runId = questionSpeechRunRef.current;
    window.speechSynthesis.cancel();

    const prefs = getVoicePreferences();
    const chosenVoice = findPreferredVoice(getSortedBrowserVoices(), prefs.voiceURI);

    const utterance = new SpeechSynthesisUtterance(spokenParts);
    utterance.rate = prefs.rate;
    utterance.pitch = prefs.pitch;
    if (chosenVoice) {
      utterance.voice = chosenVoice;
      utterance.lang = chosenVoice.lang;
    }
    utterance.onend = () => {
      if (questionSpeechRunRef.current === runId) setSpeakingQuestionId(null);
    };
    utterance.onerror = () => {
      if (questionSpeechRunRef.current === runId) setSpeakingQuestionId(null);
    };

    setSpeakingQuestionId(questionId);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!session) return;

    if (!session.overallReport) {
      generateReport();
    }
  }, [id, session]);

  // Loading progress simulation
  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 95) return prev;
          return prev + Math.random() * 10;
        });
      }, 300);
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

  const generateReport = async () => {
    if (!session) return;
    setIsGenerating(true);
    setError(null);
    setLoadingProgress(0);

    try {
      const { interview } = await api.completeInterview(session.id);
      const report = interview.overallReport;
      if (!report || typeof report.overallScore !== 'number') throw new Error('The backend did not return a completed performance report.');
      await updateSession(interview);
      refreshSessions().catch((refreshError) => console.error('Could not refresh performance history:', refreshError));
      
      setLoadingProgress(100);
      setTimeout(() => {
        setIsGenerating(false);
      }, 800);

    } catch (err) {
      console.error('Critical report generation error:', err);
      setError(err instanceof Error ? err.message : 'Performance report generation failed.');
      setIsGenerating(false);
    }
  };

  if (!session) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20">
          <AlertCircle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold">Report Not Found</h2>
        <Link to="/dashboard" className="text-blue-600 font-bold hover:underline">Return to Dashboard</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center space-y-5 text-center">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <h2 className="text-2xl font-bold">Report unavailable</h2>
        <p role="alert" className="text-sm text-slate-500">{error}</p>
        <button onClick={generateReport} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Retry report</button>
        <Link to="/history" className="text-sm font-semibold text-blue-600 hover:underline">Return to history</Link>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full space-y-10 text-center">
          <div className="relative inline-block">
             <div className="w-32 h-32 rounded-[40px] bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/40 relative z-10">
               <BrainCircuit className="w-16 h-16 text-white animate-pulse" />
             </div>
             <div className="absolute inset-0 bg-blue-400 blur-3xl opacity-20 animate-pulse" />
             <motion.div 
               className="absolute -inset-6 border-2 border-blue-500/10 rounded-[56px]"
               animate={{ rotate: 360 }}
               transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
             />
             <motion.div 
               className="absolute -inset-3 border-2 border-purple-500/20 rounded-[48px]"
               animate={{ rotate: -360 }}
               transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
             />
          </div>
          
          <div className="space-y-4">
            <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              Analyzing your interview, please wait...
            </h2>
            <p className="text-slate-500 font-medium text-lg">
              Gemini AI is processing your responses, evaluating communication metrics, and generating personalized growth insights.
            </p>
          </div>

          <div className="space-y-3">
            <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-1 border border-slate-200 dark:border-slate-700">
              <motion.div 
                className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 rounded-full relative"
                initial={{ width: 0 }}
                animate={{ width: `${loadingProgress}%` }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[progress-stripe_1s_linear_infinite]" />
              </motion.div>
            </div>
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                <span>Synchronizing Neural Weights</span>
              </span>
              <span className="text-sm font-black text-blue-600">{Math.round(loadingProgress)}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4">
            {[
              { label: 'Speech Patterns', icon: Activity },
              { label: 'Technical Depth', icon: Target },
              { label: 'Confidence Score', icon: Star },
              { label: 'Sentiment Logic', icon: Zap }
            ].map((item, i) => (
              <div key={i} className="flex items-center space-x-3 p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
                <item.icon className="w-4 h-4 text-blue-600" />
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const report = session.overallReport!;
  const COLORS = ['#2563EB', '#7C3AED', '#22C55E', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899'];

  const radarData = Object.entries(report.skillGapAnalysis).map(([key, value]) => ({
    subject: key,
    A: value * 10,
    fullMark: 100,
  }));

  const barData = Object.entries(report.detailedMetrics || {}).map(([key, value]) => ({
    name: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
    score: value,
  }));

  const questionScores = session.questions.map((q, i) => ({
    name: `Q${i + 1}`,
    score: session.evaluations[q.id]?.score || 0,
  }));

  const strengthCount = session.questions.reduce((acc, q) => acc + (session.evaluations[q.id]?.strengths.length || 0), 0);
  const weaknessCount = session.questions.reduce((acc, q) => acc + (session.evaluations[q.id]?.weaknesses.length || 0), 0);
  
  const pieData = [
    { name: 'Strengths', value: strengthCount },
    { name: 'Improvement Areas', value: weaknessCount },
  ];

  const getResultColor = (result: string) => {
    switch (result) {
      case 'Excellent': return 'text-green-500';
      case 'Good': return 'text-blue-500';
      case 'Average': return 'text-orange-500';
      case 'Needs Improvement': return 'text-red-500';
      default: return 'text-slate-500';
    }
  };

  const getResultBg = (result: string) => {
    switch (result) {
      case 'Excellent': return 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/20';
      case 'Good': return 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20';
      case 'Average': return 'bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/20';
      case 'Needs Improvement': return 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20';
      default: return 'bg-slate-50 dark:bg-slate-900/10 border-slate-100 dark:border-slate-900/20';
    }
  };

  return (
    <div className="space-y-12 pb-24">
      {/* Header with Navigation Backdrop */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5 blur-3xl rounded-full -z-10" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="flex items-center space-x-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/30 relative">
              <Trophy className="w-10 h-10 text-white" />
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-900 shadow-lg">
                <Star className="w-4 h-4 text-white fill-current" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-3 mb-1">
                <h1 className="text-4xl font-black tracking-tight">AI Analysis Report</h1>
                <span className={`px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest border ${getResultBg(report.result)} ${getResultColor(report.result)}`}>
                  {report.result}
                </span>
              </div>
              <p className="text-slate-500 font-bold flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>Session Completed on {new Date(session.date).toLocaleDateString()} at {new Date(session.date).toLocaleTimeString()}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => {
                const reportUrl = window.location.href;
                if (navigator.share) {
                  navigator.share({
                    title: `${session.role} - Interview Performance Report`,
                    text: `Score: ${report.overallScore}% (${report.result})`,
                    url: reportUrl,
                  }).catch(() => undefined);
                } else {
                  navigator.clipboard?.writeText(reportUrl);
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2500);
                }
              }}
              className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all font-bold text-sm cursor-pointer"
            >
              {shareCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4 text-blue-600" />}
              <span>{shareCopied ? 'Link Copied' : 'Share Report'}</span>
            </button>
            <button 
              type="button"
              onClick={() => {
                exportSessionReportPdf(session, user?.fullName || 'Candidate', user?.email || '');
                setPdfStatus('downloaded');
                setTimeout(() => setPdfStatus('idle'), 2500);
              }}
              className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-sm shadow-xl hover:scale-105 transition-all cursor-pointer"
              title="Download formatted performance report PDF"
            >
              {pdfStatus === 'downloaded' ? <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" /> : <Download className="w-4 h-4" />}
              <span>{pdfStatus === 'downloaded' ? 'PDF Downloaded' : 'Download PDF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Web Speech API Audio Feedback Player */}
      <PerformanceAudioPlayer
        title="Audio Performance Feedback"
        subtitle="Listen to your AI evaluation summary, strengths, question breakdown, or career advice via Web Speech API."
        sections={audioSections}
      />

      {/* Top Performance Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Score Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-4 p-10 rounded-[48px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none flex flex-col items-center justify-center relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full transition-transform group-hover:scale-150" />
          <div className="relative mb-8">
             <svg className="w-56 h-56 transform -rotate-90">
               <circle cx="112" cy="112" r="100" stroke="currentColor" strokeWidth="16" fill="transparent" className="text-slate-100 dark:text-slate-800" />
               <motion.circle 
                 cx="112" cy="112" r="100" stroke="currentColor" strokeWidth="16" fill="transparent" 
                 strokeDasharray={628.3}
                 initial={{ strokeDashoffset: 628.3 }}
                 animate={{ strokeDashoffset: 628.3 - (628.3 * report.overallScore) / 100 }}
                 transition={{ duration: 2, ease: "easeOut" }}
                 className="text-blue-600 drop-shadow-[0_0_8px_rgba(37,99,235,0.4)]" 
               />
             </svg>
             <div className="absolute inset-0 flex flex-col items-center justify-center">
               <span className="text-7xl font-black bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-700 dark:from-white dark:to-slate-400">
                 {report.overallScore}
               </span>
               <span className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px] mt-1">Efficiency Score</span>
             </div>
          </div>
          <div className="text-center space-y-4">
             <div className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl font-bold text-sm">
               <Star className="w-4 h-4 fill-current" />
               <span>{report.result} Performance</span>
             </div>
             <p className="text-slate-500 font-medium text-sm px-4">
               {report.summary}
             </p>
          </div>
        </motion.div>

        {/* Detailed AI Performance Analysis */}
        <div className="lg:col-span-8 space-y-8">
           <div className="p-8 rounded-[40px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black flex items-center space-x-3">
                  <Activity className="w-6 h-6 text-blue-600" />
                  <span>AI Performance Breakdown</span>
                </h3>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{Object.keys(report.detailedMetrics || {}).length} Categories Analyzed</div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                {Object.entries(report.detailedMetrics || {}).map(([key, value], idx) => (
                  <div key={key} className="space-y-2 group">
                    <div className="flex justify-between items-end">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </label>
                      <span className="text-xs font-black text-blue-600">{value}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-50 dark:bg-slate-800/50 rounded-full overflow-hidden border border-slate-100 dark:border-slate-800">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${value}%` }}
                        transition={{ duration: 1, delay: idx * 0.05 }}
                        className={`h-full rounded-full ${value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-blue-600' : 'bg-orange-500'}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
           </div>

           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Attempted', value: session.questions.length, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Answered', value: Object.values(session.answers).filter(a => a !== 'SKIPPED').length, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Completion', value: `${Math.round((Object.values(session.answers).filter(a => a !== 'SKIPPED').length / session.questions.length) * 100)}%`, icon: Target, color: 'text-purple-600', bg: 'bg-purple-50' },
                { label: 'Duration', value: session.duration || 'N/A', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' }
              ].map((stat, i) => (
                <div key={i} className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center space-y-2">
                  <div className={`p-3 rounded-2xl ${stat.bg} dark:bg-slate-800`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
                    <p className="text-lg font-black">{stat.value}</p>
                  </div>
                </div>
              ))}
           </div>
        </div>
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="p-10 rounded-[48px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
           <h3 className="text-2xl font-black mb-8 flex items-center space-x-3">
             <BarChart className="w-6 h-6 text-blue-600" />
             <span>Skill Gap Matrix</span>
           </h3>
           <div className="h-[350px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                 <PolarGrid stroke="#E2E8F0" />
                 <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748B', fontSize: 10, fontWeight: 900 }} />
                 <Radar name="Candidate" dataKey="A" stroke="#2563EB" strokeWidth={3} fill="#2563EB" fillOpacity={0.4} />
                 <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
               </RadarChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="p-10 rounded-[48px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
           <h3 className="text-2xl font-black mb-8 flex items-center space-x-3">
             <LineChartIcon className="w-6 h-6 text-purple-600" />
             <span>Performance Trend</span>
           </h3>
           <div className="h-[350px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <ReLineChart data={questionScores}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12, fontWeight: 700 }} />
                 <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12, fontWeight: 700 }} domain={[0, 100]} />
                 <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                 <Line type="monotone" dataKey="score" stroke="#7C3AED" strokeWidth={5} dot={{ r: 8, fill: '#7C3AED', strokeWidth: 4, stroke: '#fff' }} activeDot={{ r: 10 }} />
               </ReLineChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="p-10 rounded-[48px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
           <h3 className="text-2xl font-black mb-8 flex items-center space-x-3">
             <PieChartIcon className="w-6 h-6 text-green-600" />
             <span>Insight Distribution</span>
           </h3>
           <div className="h-[300px] w-full flex items-center">
             <ResponsiveContainer width="100%" height="100%">
               <RePieChart>
                 <Pie
                   data={pieData}
                   cx="50%"
                   cy="50%"
                   innerRadius={80}
                   outerRadius={120}
                   paddingAngle={10}
                   dataKey="value"
                 >
                   {pieData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={index === 0 ? '#22C55E' : '#F59E0B'} stroke="none" />
                   ))}
                 </Pie>
                 <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                 <Legend verticalAlign="bottom" height={36} iconType="circle" />
               </RePieChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="p-10 rounded-[48px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
           <h3 className="text-2xl font-black mb-8 flex items-center space-x-3">
             <BarChart3 className="w-6 h-6 text-blue-600" />
             <span>Category Metrics</span>
           </h3>
           <div className="h-[300px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <ReBarChart data={barData.slice(0, 6)}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                 <YAxis axisLine={false} tickLine={false} hide />
                 <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none' }} />
                 <Bar dataKey="score" radius={[12, 12, 12, 12]} barSize={32}>
                   {barData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                   ))}
                 </Bar>
               </ReBarChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* Tone & Sentiment Analysis Widget */}
      <ToneSentimentWidget session={session} />

      {/* Mock Interview Audio Replay */}
      <MockInterviewReplay session={session} />

      {/* Question Wise Analysis */}
      <div className="space-y-8">
        <div className="flex items-center justify-between">
           <h3 className="text-3xl font-black flex items-center space-x-4">
             <MessageSquare className="w-8 h-8 text-blue-600" />
             <span>Question-wise deep dive</span>
           </h3>
           <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl text-xs font-bold uppercase tracking-widest border border-blue-100 dark:border-blue-800/30">
             {session.questions.length} Total Questions
           </div>
        </div>
        
        <div className="grid grid-cols-1 gap-8">
          {session.questions.map((q, i) => {
            const result = session.evaluations[q.id];
            const answer = session.answers[q.id];
            const questionSentiment =
              answer && answer !== 'SKIPPED'
                ? analyzeAnswerSentimentClient(answer, result, result?.sentiment?.voiceMetrics)
                : null;
            const toneAccent = questionSentiment ? getToneAccent(questionSentiment.primaryTone) : null;
            return (
              <motion.div 
                key={q.id}
                initial={{ opacity: 0, scale: 0.98 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="p-10 rounded-[48px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative group overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-3xl rounded-full -mr-20 -mt-20 group-hover:bg-blue-500/10 transition-colors" />
                
                <div className="flex flex-col lg:flex-row justify-between items-start gap-8 mb-10">
                  <div className="flex-1 space-y-3">
                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-widest">
                      Question {i + 1} • {q.category}
                    </span>
                    <h4 className="text-2xl font-black leading-tight text-slate-900 dark:text-white">{q.question}</h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-bold">
                      {result?.isRelevant !== undefined && (
                        <div className={`flex items-center space-x-1.5 ${result.isRelevant ? 'text-green-600' : 'text-red-500'}`}>
                          {result.isRelevant ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          <span>{result.isRelevant ? 'Relevant Answer' : 'Irrelevant Answer'}</span>
                        </div>
                      )}
                      {questionSentiment && toneAccent && (
                        <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-300">
                          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${toneAccent.dot}`} aria-hidden="true" />
                            <span>Emotional Tone:</span>
                            <span className={toneAccent.text}>{questionSentiment.primaryTone}</span>
                          </span>
                          {questionSentiment.voiceMetrics?.inputMode && questionSentiment.voiceMetrics.inputMode !== 'text' && (
                            <span className="text-slate-400 font-semibold tabular-nums">
                              ({questionSentiment.voiceMetrics.inputMode === 'voice' ? 'Voice Input' : 'Voice + Text'}
                              {questionSentiment.voiceMetrics.avgWpm ? ` · ${questionSentiment.voiceMetrics.avgWpm} WPM` : ''})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {questionSpeechSupported && (
                      <button
                        type="button"
                        onClick={() => toggleQuestionSpeech(q.id, i, q.question)}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 cursor-pointer"
                        aria-label={speakingQuestionId === q.id ? `Stop audio for question ${i + 1}` : `Listen to feedback for question ${i + 1}`}
                      >
                        {speakingQuestionId === q.id ? (
                          <>
                            <Square className="h-3.5 w-3.5 fill-current text-blue-600" aria-hidden="true" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                            <span>Listen</span>
                          </>
                        )}
                      </button>
                    )}
                    <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[32px] border border-slate-100 dark:border-slate-700 min-w-[120px]">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Score</span>
                      <span className={`text-4xl font-black ${result?.score >= 80 ? 'text-green-500' : result?.score >= 60 ? 'text-blue-600' : 'text-red-500'}`}>
                        {result?.score || 0}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Your Transcript</span>
                      </div>
                      <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50 italic text-slate-700 dark:text-slate-300 leading-relaxed">
                        "{answer === 'SKIPPED' ? 'You skipped this question.' : answer}"
                      </div>
                      {answer !== 'SKIPPED' && (
                        <MockQuestionAudioInline
                          interviewId={session.id}
                          questionId={q.id}
                          questionNumber={i + 1}
                          hasServerAudio={Boolean(result?.audioReplay?.hasAudio)}
                          recordedDurationSec={result?.audioReplay?.durationSec}
                        />
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                        <BrainCircuit className="w-3.5 h-3.5" />
                        <span>AI Analysis & Feedback</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                        {result?.feedback}
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Strengths</p>
                           <ul className="space-y-1.5">
                             {result?.strengths.map((s, idx) => (
                               <li key={idx} className="flex items-start space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                                 <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                                 <span>{s}</span>
                               </li>
                             ))}
                           </ul>
                        </div>
                        <div className="space-y-2">
                           <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Improvements</p>
                           <ul className="space-y-1.5">
                             {result?.weaknesses.map((w, idx) => (
                               <li key={idx} className="flex items-start space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                                 <AlertCircle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                                 <span>{w}</span>
                               </li>
                             ))}
                           </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="p-8 rounded-[40px] bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-100 dark:border-blue-800/30 space-y-4">
                      <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                        <Star className="w-3.5 h-3.5" />
                        <span>Ideal Model Answer</span>
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                        {result?.idealAnswer || result?.improvedAnswer}
                      </p>
                    </div>

                    <div className="space-y-4">
                       <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-[0.2em] text-purple-600">
                        <Zap className="w-3.5 h-3.5" />
                        <span>Missing points & Suggestions</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {result?.missingPoints?.map((p, idx) => (
                          <span key={idx} className="px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-xl text-[10px] font-black border border-orange-100 dark:border-orange-800/30">
                            Missing: {p}
                          </span>
                        ))}
                      </div>
                      <ul className="space-y-2">
                        {result?.suggestions?.map((s, idx) => (
                          <li key={idx} className="flex items-start space-x-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                             <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
                             <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Personalized AI Summary & Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 p-12 rounded-[56px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/30 relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-3xl rounded-full group-hover:bg-purple-500/10 transition-colors" />
           <h3 className="text-3xl font-black mb-8 flex items-center space-x-4">
             <Star className="w-8 h-8 text-yellow-400 fill-current" />
             <span>Personalized AI Evaluation</span>
           </h3>
           <div className="prose prose-slate dark:prose-invert max-w-none">
             <p className="text-xl leading-relaxed text-slate-700 dark:text-slate-300 font-medium italic">
               "{report.summary} Based on your performance, your communication style is highly articulate, although there are moments where technical depth could be enhanced. Your confidence remained stable throughout the session, which is a significant strength in high-pressure interview environments."
             </p>
           </div>
           
           <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex items-center space-x-3 text-blue-600">
                  <TrendingUp className="w-6 h-6" />
                  <h4 className="font-black uppercase tracking-widest text-xs">Primary Strengths</h4>
                </div>
                <div className="space-y-3">
                  {report.keyTakeaways.slice(0, 4).map((item, i) => (
                    <div key={i} className="flex items-center space-x-3 p-4 rounded-2xl bg-green-50/50 dark:bg-green-900/10 border border-green-100/50 dark:border-green-800/20">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-6">
                <div className="flex items-center space-x-3 text-purple-600">
                  <Target className="w-6 h-6" />
                  <h4 className="font-black uppercase tracking-widest text-xs">Growth Roadmap</h4>
                </div>
                <div className="space-y-3">
                  {report.nextSteps.slice(0, 4).map((item, i) => (
                    <div key={i} className="flex items-center space-x-3 p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100/50 dark:border-purple-800/20">
                      <Zap className="w-5 h-5 text-purple-500" />
                      <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
           </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-8">
           <div className="flex-1 p-10 rounded-[48px] bg-gradient-to-br from-blue-600 to-purple-700 text-white shadow-2xl shadow-blue-600/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full" />
              <h3 className="text-xl font-black mb-6 flex items-center space-x-3">
                <BrainCircuit className="w-6 h-6" />
                <span>Career Advice</span>
              </h3>
              <p className="text-blue-50 font-medium leading-relaxed italic mb-8">
                "{report.careerAdvice}"
              </p>
              <button className="w-full py-4 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl font-black text-sm hover:bg-white/30 transition-all">
                View Matched Roles
              </button>
           </div>

           <div className="p-8 rounded-[40px] bg-slate-900 dark:bg-slate-800 border border-white/10 text-white">
              <h4 className="font-black uppercase tracking-widest text-[10px] text-slate-500 mb-6">Session Details</h4>
              <div className="space-y-4">
                {[
                  { label: 'Job Role', value: session.role },
                  { label: 'Sector', value: session.sector },
                  { label: 'Difficulty', value: session.difficulty },
                  { label: 'Interview Type', value: 'AI Mock' },
                  { label: 'Duration', value: session.duration }
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center pb-3 border-b border-white/5 last:border-0">
                    <span className="text-xs font-bold text-slate-400">{item.label}</span>
                    <span className="text-xs font-black">{item.value}</span>
                  </div>
                ))}
              </div>
           </div>
        </div>
      </div>

      {/* Final Call to Action */}
      <div className="p-12 rounded-[56px] bg-gradient-to-r from-blue-500 to-purple-600 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl shadow-blue-500/20">
         <div className="flex items-center space-x-6">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-lg rounded-3xl flex items-center justify-center">
              <RotateCcw className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-3xl font-black">Ready to scale further?</h3>
              <p className="text-blue-50 font-bold">Your journey to perfection starts with a single step.</p>
            </div>
         </div>
         <div className="flex flex-wrap justify-center gap-4">
            <button 
              onClick={() => navigate('/setup')}
              className="px-8 py-4 bg-white text-blue-600 rounded-2xl font-black hover:scale-105 transition-all shadow-xl"
            >
              Retake Interview
            </button>
            <button 
              onClick={() => navigate('/')}
              className="px-8 py-4 bg-white/10 backdrop-blur-md border border-white/30 text-white rounded-2xl font-black hover:bg-white/20 transition-all flex items-center space-x-2"
            >
              <Home className="w-5 h-5" />
              <span>Home</span>
            </button>
            <button 
              onClick={() => navigate('/dashboard')}
              className="px-8 py-4 bg-slate-900/40 backdrop-blur-md border border-white/20 text-white rounded-2xl font-black hover:bg-slate-900/60 transition-all"
            >
              Go to Dashboard
            </button>
         </div>
      </div>
    </div>
  );
}
