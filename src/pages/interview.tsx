import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Send, 
  ChevronRight, 
  AlertCircle,
  Clock,
  RotateCcw,
  StopCircle,
  MessageSquare,
  CheckCircle2,
  BrainCircuit,
  Building2,
  Briefcase
} from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { Question, EvaluationResult, VoiceInputTelemetry } from '../types';
import { api } from '../utils/api';
import { saveLocalAudioReplay } from '../utils/audioReplayStorage';
import QuestionFocusTimer from '../components/QuestionFocusTimer';
import PitchDeliveryAnalyzer, { PitchAnalyzerTelemetry } from '../components/PitchDeliveryAnalyzer';
import InterviewScratchpad from '../components/InterviewScratchpad';
import {
  SUBMIT_INTERVIEW_ANSWER_EVENT,
  TOGGLE_INTERVIEW_MIC_EVENT,
} from '../utils/keyboardShortcuts';

export default function InterviewRoom() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { addSession, updateSession, refreshSessions, sessions, aiMode } = useAppState();

  // Find session if ID is provided
  const session = sessions.find(s => s.id === id);

  const { 
    role, 
    sector, 
    difficulty, 
    examName,
    department,
    preferredLanguage,
    numQuestions,
    companyName,
    experience,
    category,
    qualification
  } = session || location.state || { 
    role: 'Software Developer', 
    sector: 'Private', 
    difficulty: 'Beginner' 
  };

  const [questions, setQuestions] = useState<Question[]>([]);
  const [interviewId, setInterviewId] = useState<string | null>(id || null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState((session?.round ?? location.state?.round) !== 'Coding');
  const [isMicOn, setIsMicOn] = useState(true);
  const [round, setRound] = useState<string | null>((session?.round ?? location.state?.round) || null);
  const isCoding = round === 'Coding';
  const [codeLanguage, setCodeLanguage] = useState('Python');
  const [timeLeft, setTimeLeft] = useState(round === 'Coding' ? 1800 : 600); // 10 minutes, 30 for coding
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluations, setEvaluations] = useState<Record<string, EvaluationResult>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [grammarStatus, setGrammarStatus] = useState<'Excellent' | 'Good' | 'Average' | 'Poor'>('Excellent');
  const [interimWordCount, setInterimWordCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const hasLoadedInterview = useRef(false);
  const usedVoiceInputRef = useRef(false);
  const usedTypedInputRef = useRef(false);
  const voiceTelemetryRef = useRef<PitchAnalyzerTelemetry>({});

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioMimeTypeRef = useRef<string>('audio/webm');
  const recordingStartedAtRef = useRef<number | null>(null);
  const accumulatedAudioMsRef = useRef<number>(0);
  const [recordedSeconds, setRecordedSeconds] = useState(0);

  const handleTelemetryChange = useCallback((telemetry: PitchAnalyzerTelemetry) => {
    voiceTelemetryRef.current = telemetry;
  }, []);

  const pickSupportedAudioMimeType = (): string => {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    }
    return '';
  };

  const startAudioChunkRecorder = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      const mimeType = pickSupportedAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioMimeTypeRef.current = recorder.mimeType || mimeType || 'audio/webm';
      audioStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
          setRecordedSeconds((prev) => prev + 1);
        }
      };

      recorder.start(1000);
    } catch (recErr) {
      console.warn('Audio chunk recorder could not start:', recErr);
    }
  };

  const stopActiveRecorderStream = async (): Promise<void> => {
    if (recordingStartedAtRef.current) {
      accumulatedAudioMsRef.current += Date.now() - recordingStartedAtRef.current;
      recordingStartedAtRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        const prevOnStop = recorder.onstop;
        recorder.onstop = (ev) => {
          if (typeof prevOnStop === 'function') {
            prevOnStop.call(recorder, ev);
          }
          resolve();
        };
        try {
          recorder.stop();
        } catch {
          resolve();
        }
      });
    }
    mediaRecorderRef.current = null;
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
  };

  const collectAndResetAudioBundle = async (): Promise<{
    blob: Blob;
    mimeType: string;
    durationSec: number;
    chunkCount: number;
  } | null> => {
    await stopActiveRecorderStream();
    const chunks = audioChunksRef.current;
    const totalMs = accumulatedAudioMsRef.current;
    audioChunksRef.current = [];
    accumulatedAudioMsRef.current = 0;
    setRecordedSeconds(0);

    if (!chunks.length) return null;
    const mimeType = audioMimeTypeRef.current || 'audio/webm';
    const blob = new Blob(chunks, { type: mimeType });
    if (blob.size < 256) return null;

    const durationSec = Math.max(1, Math.round(totalMs / 1000) || chunks.length);
    return {
      blob,
      mimeType,
      durationSec,
      chunkCount: chunks.length,
    };
  };

  const persistAudioReplayBundle = async (
    targetInterviewId: string,
    questionId: string,
    bundle: { blob: Blob; mimeType: string; durationSec: number; chunkCount: number } | null,
    evaluation: EvaluationResult
  ): Promise<EvaluationResult> => {
    if (!bundle) return evaluation;
    await saveLocalAudioReplay({
      interviewId: targetInterviewId,
      questionId,
      blob: bundle.blob,
      mimeType: bundle.mimeType,
      durationSec: bundle.durationSec,
      chunkCount: bundle.chunkCount,
    });
    try {
      const { audioReplay } = await api.uploadQuestionAudio(
        targetInterviewId,
        questionId,
        bundle.blob,
        bundle.durationSec,
        bundle.chunkCount
      );
      return { ...evaluation, audioReplay };
    } catch {
      return {
        ...evaluation,
        audioReplay: {
          hasAudio: true,
          mimeType: bundle.mimeType,
          durationSec: bundle.durationSec,
          chunkCount: bundle.chunkCount,
          recordedAt: new Date().toISOString(),
        },
      };
    }
  };

  const buildCurrentVoiceMetrics = (): VoiceInputTelemetry | undefined => {
    if (isCoding) return undefined;
    const usedVoice = usedVoiceInputRef.current || Boolean(voiceTelemetryRef.current.voicedFrames && voiceTelemetryRef.current.voicedFrames > 0);
    const usedText = usedTypedInputRef.current;
    const inputMode: VoiceInputTelemetry['inputMode'] =
      usedVoice && usedText ? 'mixed' : usedVoice ? 'voice' : 'text';
    return {
      inputMode,
      ...voiceTelemetryRef.current,
    };
  };

  // Monitor Grammar (Simulated based on filler words in transcript)
  useEffect(() => {
    if (!transcript) return;
    const fillerWords = ['um', 'uh', 'ah', 'like', 'basically', 'actually', 'you know'];
    const words = transcript.toLowerCase().split(/\s+/);
    const fillerCount = words.filter(w => fillerWords.some(f => w.includes(f))).length;
    const ratio = fillerCount / Math.max(words.length, 1);

    if (ratio > 0.15) setGrammarStatus('Poor');
    else if (ratio > 0.08) setGrammarStatus('Average');
    else if (ratio > 0.03) setGrammarStatus('Good');
    else setGrammarStatus('Excellent');
  }, [transcript]);

  // Text to Speech Function
  const speak = (text: string) => {
    if (isCoding || !window.speechSynthesis) return;
    
    // Stop any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsAISpeaking(true);
    utterance.onend = () => setIsAISpeaking(false);
    utterance.onerror = () => setIsAISpeaking(false);
    
    // Set language
    if (preferredLanguage === 'Hindi') utterance.lang = 'hi-IN';
    else if (preferredLanguage === 'Telugu') utterance.lang = 'te-IN';
    else utterance.lang = 'en-GB';

    // Pick a professional sounding voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.startsWith(utterance.lang.split('-')[0]) && 
      (v.name.includes('Google') || v.name.includes('Female'))
    );
    if (preferredVoice) utterance.voice = preferredVoice;
    
    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      // Set recognition language
      if (preferredLanguage === 'Hindi') recognition.lang = 'hi-IN';
      else if (preferredLanguage === 'Telugu') recognition.lang = 'te-IN';
      else recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript || interimTranscript.trim()) {
          usedVoiceInputRef.current = true;
        }
        if (finalTranscript) {
          setTranscript(prev => prev + ' ' + finalTranscript);
        }
        const trimmedInterim = interimTranscript.trim();
        setInterimWordCount(trimmedInterim ? trimmedInterim.split(/\s+/).length : 0);
      };

      recognition.onend = () => {
        setInterimWordCount(0);
      };

      recognitionRef.current = recognition;
    }

    // Clean up speech and active audio recording on unmount
    return () => {
      window.speechSynthesis?.cancel();
      void stopActiveRecorderStream();
    };
  }, [preferredLanguage]);

  const fetchQuestions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = id
        ? await api.getInterview(id)
        : await api.startInterview({
          role,
          sector,
          difficulty,
          experience: experience || '3',
          examName,
          department,
          preferredLanguage,
          numQuestions: numQuestions || 5,
          companyName,
          category,
          qualification,
          jobId: session?.jobId,
          round: location.state?.round,
        });
      const interview = result.interview;
      setInterviewId(interview.id);
      setRound(interview.round || null);
      if (interview.round === 'Coding') { setTimeLeft(1800); setIsCameraOn(false); }
      setQuestions(interview.questions);
      setAnswers(interview.answers || {});
      setEvaluations(interview.evaluations || {});
      if (!sessions.some((item) => item.id === interview.id)) {
        await addSession(interview);
      }
      setIsLoading(false);
      if (interview.questions.length > 0 && interview.round !== 'Coding') setTimeout(() => speak(interview.questions[0].question), 1000);
    } catch (err) {
      console.error('Failed to fetch questions:', err);
      setError(err instanceof Error ? err.message : 'Could not load interview questions.');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasLoadedInterview.current) return;
    hasLoadedInterview.current = true;
    fetchQuestions();
  }, []);

  // Speak when question changes
  useEffect(() => {
  if (!isLoading && questions[currentIdx]) {
    setIsSubmitted(false);
    setTranscript('');
    setInterimWordCount(0);
    usedVoiceInputRef.current = false;
    usedTypedInputRef.current = false;
    voiceTelemetryRef.current = {};
    speak(questions[currentIdx].question);
  }
}, [currentIdx, isLoading, questions]);
  // Handle Camera
  useEffect(() => {
    if (isCameraOn) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(err => console.error('Error accessing media devices:', err));
    } else {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
    }
  }, [isCameraOn]);

  // Timer
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const toggleRecording = () => {
    const hasRecognition = Boolean(recognitionRef.current);
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined';

    if (!hasRecognition && !hasMediaRecorder) {
      setError('Audio recording is not supported in this browser. You can type your answer directly below.');
      return;
    }

    try {
      if (isRecording) {
        if (hasRecognition) {
          try { recognitionRef.current.stop(); } catch {}
        }
        void stopActiveRecorderStream();
        setIsRecording(false);
        setInterimWordCount(0);
      } else {
        setError(null);
        usedVoiceInputRef.current = true;
        if (hasRecognition) {
          recognitionRef.current.start();
        } else {
          setError('Live speech-to-text is unavailable in this browser; recording audio replay while you type.');
        }
        if (hasMediaRecorder && !isCoding) {
          void startAudioChunkRecorder();
        }
        setIsRecording(true);
      }
    } catch (speechErr) {
      setIsRecording(false);
      void stopActiveRecorderStream();
      setError(speechErr instanceof Error ? speechErr.message : 'Could not toggle microphone recording.');
    }
  };

  const handleRepeat = async () => {
    if (!currentQuestion) return;
    setError(null);
    if (!interviewId) {
      speak(currentQuestion.question);
      return;
    }
    try {
      const { question } = await api.repeatQuestion(interviewId, currentQuestion.id);
      speak(question.question);
    } catch (repeatError) {
      setError(repeatError instanceof Error ? repeatError.message : 'Could not repeat this question.');
    }
  };

  const handleSkip = async () => {
    if (!questions || questions.length === 0) {
      navigate('/dashboard');
      return;
    }
    if (!interviewId) {
      setError('This interview is not connected to the server. Please restart it.');
      return;
    }
    const currentQuestion = questions[currentIdx];
    setIsEvaluating(true);
    setError(null);
    try {
      if (isRecording) {
        try { recognitionRef.current?.stop(); } catch {}
        setIsRecording(false);
      }
      await collectAndResetAudioBundle();
      const { answer } = await api.skipQuestion(interviewId, currentQuestion.id);
      const newEvaluations = { ...evaluations, [currentQuestion.id]: answer.evaluation };
      const newAnswers = { ...answers, [currentQuestion.id]: 'SKIPPED' };
      setEvaluations(newEvaluations);
      setAnswers(newAnswers);
      setTranscript('');

      const activeSnapshot = sessions.find((item) => item.id === interviewId);
      if (activeSnapshot) {
        await updateSession({ ...activeSnapshot, answers: newAnswers, evaluations: newEvaluations });
      }

      if (currentIdx < questions.length - 1) setCurrentIdx(currentIdx + 1);
      else await finishInterview(newEvaluations, newAnswers);
    } catch (skipError) {
      setError(skipError instanceof Error ? skipError.message : 'Could not save the skipped question.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleNext = async () => {
    if (transcript.trim() && questions[currentIdx]) {
      if (!interviewId) {
        setError('This interview is not connected to the server. Please restart it.');
        return;
      }
      setIsEvaluating(true);
      setError(null);
      const currentQuestion = questions[currentIdx];
      
      try {
        if (isRecording) {
          try { recognitionRef.current?.stop(); } catch {}
          setIsRecording(false);
        }
        const audioBundle = await collectAndResetAudioBundle();
        const voiceMetrics = buildCurrentVoiceMetrics();
        const { answer } = await api.submitAnswer(
          interviewId,
          currentQuestion.id,
          isCoding ? `# language: ${codeLanguage}\n${transcript}` : transcript,
          voiceMetrics
        );
        const evaluationWithReplay = await persistAudioReplayBundle(
          interviewId,
          currentQuestion.id,
          audioBundle,
          answer.evaluation
        );
        
        const newEvaluations = { ...evaluations, [currentQuestion.id]: evaluationWithReplay };
        const newAnswers = { ...answers, [currentQuestion.id]: transcript };
        
        setEvaluations(newEvaluations);
        setAnswers(newAnswers);
        setTranscript('');
        usedVoiceInputRef.current = false;
        usedTypedInputRef.current = false;
        voiceTelemetryRef.current = {};

        const activeSnapshot = sessions.find((item) => item.id === interviewId);
        if (activeSnapshot) {
          await updateSession({ ...activeSnapshot, answers: newAnswers, evaluations: newEvaluations });
        }
        
        if (currentIdx < questions.length - 1) {
          setCurrentIdx(currentIdx + 1);
        } else {
          await finishInterview(newEvaluations, newAnswers);
        }
      } catch (error) {
        console.error('Evaluation failed:', error);
        setError(error instanceof Error ? error.message : 'Answer evaluation failed. Your answer is still here; please retry.');
      } finally {
        setIsEvaluating(false);
      }
    }
  };

  const toggleRecordingRef = useRef<() => void>(() => {});
  toggleRecordingRef.current = toggleRecording;
  const handleNextRef = useRef<() => Promise<void>>(async () => {});
  handleNextRef.current = handleNext;

  useEffect(() => {
    const onToggleMic = () => {
      if (isCoding || isLoading) return;
      toggleRecordingRef.current();
    };
    const onSubmitAnswer = () => {
      if (isLoading || isEvaluating || !transcript.trim()) return;
      void handleNextRef.current();
    };
    window.addEventListener(TOGGLE_INTERVIEW_MIC_EVENT, onToggleMic);
    window.addEventListener(SUBMIT_INTERVIEW_ANSWER_EVENT, onSubmitAnswer);
    return () => {
      window.removeEventListener(TOGGLE_INTERVIEW_MIC_EVENT, onToggleMic);
      window.removeEventListener(SUBMIT_INTERVIEW_ANSWER_EVENT, onSubmitAnswer);
    };
  }, [isCoding, isLoading, isEvaluating, transcript]);

  const finishInterview = async (finalEvals: Record<string, EvaluationResult>, finalAnswers: Record<string, string>) => {
    if (!interviewId) {
      setError('This interview is not connected to the server, so its result could not be saved.');
      return;
    }
    setError(null);
    setIsEvaluating(true);
    try {
      let updatedEvals = finalEvals;
      let updatedAnswers = finalAnswers;

      // Save any typed-but-unsubmitted answer & recorded audio before completing the session
      const currentQ = questions[currentIdx];
      if (isRecording) {
        try { recognitionRef.current?.stop(); } catch {}
        setIsRecording(false);
      }
      if (transcript.trim() && currentQ && !updatedAnswers[currentQ.id]) {
        try {
          const audioBundle = await collectAndResetAudioBundle();
          const voiceMetrics = buildCurrentVoiceMetrics();
          const { answer } = await api.submitAnswer(
            interviewId,
            currentQ.id,
            isCoding ? `# language: ${codeLanguage}\n${transcript}` : transcript,
            voiceMetrics
          );
          const evaluationWithReplay = await persistAudioReplayBundle(
            interviewId,
            currentQ.id,
            audioBundle,
            answer.evaluation
          );
          updatedEvals = { ...updatedEvals, [currentQ.id]: evaluationWithReplay };
          updatedAnswers = { ...updatedAnswers, [currentQ.id]: transcript };
        } catch {
          // Proceed with completion even if inline submit failed
        }
      } else {
        await collectAndResetAudioBundle();
      }

      const { interview } = await api.completeInterview(interviewId);
      const totalAllowedSeconds = isCoding ? 1800 : 600;
      const completedSession = {
        ...interview,
        status: 'completed' as const,
        answers: updatedAnswers,
        evaluations: updatedEvals,
        duration: formatTime(Math.max(0, totalAllowedSeconds - timeLeft)),
      };
      if (sessions.some((item) => item.id === interviewId)) {
        await updateSession(completedSession);
      } else {
        await addSession(completedSession);
      }
      await refreshSessions().catch((refreshError) => console.error('Could not refresh interview history:', refreshError));

      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      window.speechSynthesis?.cancel();
      navigate(`/report/${interviewId}`);
    } catch (completionError) {
      setError(completionError instanceof Error ? completionError.message : 'Interview results could not be saved. Please retry.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center space-y-8 p-12 text-center">
        <div className="relative">
          <div className="w-32 h-32 border-4 border-blue-600/10 border-t-blue-600 rounded-[40px] animate-spin" />
          <BrainCircuit className="w-16 h-16 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="space-y-4 max-w-md">
          <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            Generating AI Interview Questions...
          </h2>
          <p className="text-slate-500 font-medium">
            We're tailoring a unique set of challenges based on your {role} role and {sector} sector preferences.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-4">
            {['Context Analysis', 'Role Matching', 'Skill Alignment'].map((tag, i) => (
              <span key={i} className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-bold border border-blue-100 dark:border-blue-800/30">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && questions.length === 0) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-24 h-24 bg-red-50 dark:bg-red-900/10 rounded-[32px] flex items-center justify-center border border-red-100 dark:border-red-900/20 shadow-xl shadow-red-500/10">
          <AlertCircle className="w-12 h-12 text-red-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black">Initialization Failed</h2>
          <p className="text-slate-500 max-w-sm font-medium">We couldn't connect to the AI engine or load fallback questions.</p>
        </div>
        <button 
          onClick={fetchQuestions}
          className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 hover:scale-105 transition-all flex items-center space-x-2"
        >
          <RotateCcw className="w-5 h-5" />
          <span>Retry Loading</span>
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];
  const formattedRoundLabel = round
    ? (round === 'Resume'
        ? 'Resume-based Round'
        : /round$/i.test(round.trim())
        ? round.trim()
        : `${round.trim()} Round`)
    : 'Standard Interview';

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Job Context Header */}
      {(companyName || role) && (
        <motion.div 
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black truncate">{role}</h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${sector === 'Private' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'} dark:bg-slate-800`}>
                  {sector}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-bold flex items-center gap-1 truncate">
                <Building2 className="w-3 h-3 shrink-0" />
                <span className="truncate">{companyName || formattedRoundLabel}</span>
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center space-x-2 px-3.5 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl shrink-0">
             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{aiMode === 'mock' ? 'Simulated interview (dev mock)' : 'AI interview'}</span>
          </div>
        </motion.div>
      )}

      {error && questions.length > 0 && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      <div className={`grid grid-cols-1 ${isCoding ? 'lg:grid-cols-[3fr_2fr]' : 'lg:grid-cols-2'} gap-5 items-start`}>
      {/* Left Column: AI & Question */}
      <div className="flex flex-col gap-4 min-w-0">
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full pointer-events-none" />
          
          <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
            <div className="flex items-center space-x-3">
               <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold uppercase tracking-wider">
                 Question {currentIdx + 1} of {questions.length}
               </div>
               <div className="flex items-center space-x-1.5 text-slate-500 text-sm font-semibold tabular-nums">
                 <Clock className="w-4 h-4" />
                 <span>{formatTime(timeLeft)}</span>
               </div>
            </div>
            <div className="w-28 sm:w-1/3 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-blue-600 rounded-full" 
                initial={{ width: 0 }}
                animate={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start space-x-4">
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center relative overflow-hidden shadow-lg shadow-blue-500/20">
                  <BrainCircuit className="w-6 h-6 sm:w-7 sm:h-7 text-white relative z-10" />
                  {isAISpeaking && (
                    <motion.div 
                      className="absolute inset-0 bg-white/20"
                      animate={{ 
                        opacity: [0.1, 0.4, 0.1],
                        scale: [1, 1.2, 1]
                      }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                </div>
                {isAISpeaking && (
                  <div className="absolute -bottom-1 -right-1 flex space-x-0.5 bg-blue-600 p-1 rounded-lg shadow-lg">
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 bg-white rounded-full"
                        animate={{ height: [4, 12, 4] }}
                        transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center">
                  <span>Interview Assistant</span>
                  {isAISpeaking && <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
                </p>
                <motion.h3 
                  key={currentIdx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-lg sm:text-xl font-bold leading-snug"
                >
                  {currentQuestion?.question}
                </motion.h3>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button 
                onClick={handleRepeat}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs sm:text-sm font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Repeat Question</span>
              </button>
              <button 
                onClick={handleSkip}
                disabled={isEvaluating}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors text-xs sm:text-sm font-semibold disabled:opacity-60"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                <span>Skip Question</span>
              </button>
              <div className="px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs sm:text-sm font-semibold">
                Category: {currentQuestion?.category}
              </div>
            </div>
          </div>
        </div>

        {/* Live Transcript */}
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
          <div className="flex items-center space-x-2 text-slate-500 font-semibold text-xs sm:text-sm">
            <MessageSquare className="w-4 h-4" />
            <span>{isCoding ? 'Your solution' : 'Your Response (Live Transcript)'}</span>
          </div>
          <div className={`${isCoding ? 'hidden ' : ''}min-h-[56px] max-h-36 overflow-y-auto rounded-xl bg-white/60 dark:bg-slate-950/40 px-3.5 py-2.5 border border-slate-200/70 dark:border-slate-800/70`}>
            {transcript ? (
              <p className="text-sm sm:text-base leading-relaxed text-slate-800 dark:text-slate-200 italic">
                "{transcript}"
              </p>
            ) : (
              <p className="text-sm text-slate-400 italic">Start speaking or type your answer below...</p>
            )}
          </div>
          
          <div className="flex items-stretch gap-3">
             {isCoding ? (
               <div className="flex-1 space-y-2">
                 <div className="flex items-center justify-between text-xs text-slate-500">
                   <label htmlFor="code-language" className="font-bold uppercase tracking-wider">Language</label>
                   <select
                     id="code-language"
                     value={codeLanguage}
                     onChange={(e) => setCodeLanguage(e.target.value)}
                     className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                   >
                     {['Python', 'JavaScript', 'Java', 'C++', 'Other'].map((l) => <option key={l}>{l}</option>)}
                   </select>
                 </div>
                 <textarea
                   aria-label="Code editor"
                   spellCheck={false}
                   autoCapitalize="off"
                   autoCorrect="off"
                   value={transcript}
                   onChange={(e) => { usedTypedInputRef.current = true; setTranscript(e.target.value); }}
                   onKeyDown={(e) => {
                     if (e.key === 'Tab') {
                       e.preventDefault();
                       const el = e.currentTarget;
                       const { selectionStart, selectionEnd } = el;
                       setTranscript(transcript.slice(0, selectionStart) + '    ' + transcript.slice(selectionEnd));
                       requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = selectionStart + 4; });
                     }
                   }}
                   placeholder="Write your solution here. Add a comment with your time and space complexity."
                   className="h-64 w-full resize-y rounded-2xl border border-slate-700 bg-slate-950 p-4 font-mono text-sm leading-relaxed text-slate-100 outline-none focus:border-blue-500"
                 />
                 <p className="text-xs text-slate-500">Your code is read and scored against a rubric (approach, complexity, edge cases, quality). It is not executed.</p>
               </div>
             ) : (
             <textarea 
               value={transcript}
               onChange={(e) => { usedTypedInputRef.current = true; setTranscript(e.target.value); }}
               placeholder="Click microphone to speak or type here..."
               className="flex-1 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none focus:border-blue-500 transition-all resize-none h-20 text-sm"
             />
             )}
             <button
               onClick={handleNext}
               aria-label="Submit answer"
               aria-keyshortcuts="Control+Enter"
               title="Submit answer (Ctrl+Enter)"
               disabled={!transcript.trim() || isEvaluating}
               className={`px-5 rounded-2xl flex items-center justify-center transition-all shrink-0 ${
                 !transcript.trim() || isEvaluating ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20'
               }`}
             >
               {isEvaluating ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <ChevronRight className="w-7 h-7" />}
             </button>
          </div>
        </div>
      </div>

      {/* Right Column: Focus Timer, Video Feed & Controls */}
      <div className="flex flex-col gap-4 min-w-0">
        <QuestionFocusTimer
          questionKey={currentQuestion?.id || String(currentIdx)}
          defaultDurationSeconds={isCoding ? 300 : 120}
          isExternallyPaused={isEvaluating}
          contextLabel={
            session
              ? `Question ${currentIdx + 1} of ${session.questions.length} · ${session.role}`
              : undefined
          }
          onTimeExpired={() => {
            if (isEvaluating) return;
            if (transcript.trim()) {
              void handleNext();
            } else {
              void handleSkip();
            }
          }}
        />
        {!isCoding && (
          <PitchDeliveryAnalyzer
            questionKey={currentQuestion?.id || String(currentIdx)}
            transcript={transcript}
            interimWordCount={interimWordCount}
            isRecording={isRecording}
            isMicOn={isMicOn}
            onTelemetryChange={handleTelemetryChange}
          />
        )}
        {isCoding && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-lg font-bold">Coding round tips</h3>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
              <li>Explain your approach in a comment before the code.</li>
              <li>Handle empty input, single elements and duplicates explicitly.</li>
              <li>State the time and space complexity, for example <code># Time O(n), Space O(1)</code>.</li>
              <li>Use clear names and keep the function small.</li>
            </ul>
          </div>
        )}
        <div className={`${isCoding ? 'hidden ' : ''}relative rounded-2xl overflow-hidden bg-slate-900 h-[210px] sm:h-[235px] w-full shadow-lg border-2 border-white dark:border-slate-800`}>
          {!isCameraOn && (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 space-y-2.5">
               <div className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center">
                 <VideoOff className="w-7 h-7" />
               </div>
               <p className="text-sm font-semibold">Camera is Turned Off</p>
             </div>
          )}
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-500 ${isCameraOn ? 'opacity-100' : 'opacity-0'}`} 
          />
          
          {/* Overlay Stats */}
          <div className="absolute top-4 left-4 flex items-center space-x-3">
            <div className={`px-3.5 py-1.5 rounded-full backdrop-blur-md border flex items-center space-x-2 ${isRecording ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-slate-950/40 border-white/20 text-white'}`}>
              <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
              <span className="text-[11px] font-bold uppercase tracking-wider">{isRecording ? 'Recording Answer' : 'Listening...'}</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className={`${isCoding ? 'hidden ' : ''}p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center space-y-4`}>
          <div className="flex items-center space-x-6">
            <button 
              onClick={() => setIsCameraOn(!isCameraOn)}
              aria-label={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isCameraOn ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200' : 'bg-red-500 text-white hover:bg-red-600'}`}
            >
              {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <button 
              onClick={toggleRecording}
              aria-label={isRecording ? 'Stop voice recording' : 'Start voice recording'}
              aria-keyshortcuts="m"
              title={isRecording ? 'Stop recording (M)' : 'Start recording (M)'}
              className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all relative ${isRecording ? 'bg-red-500 text-white shadow-xl shadow-red-500/40 scale-105' : 'bg-blue-600 text-white shadow-xl shadow-blue-500/40 hover:scale-105'}`}
            >
              {isRecording && (
                <div className="absolute -inset-2 border-2 border-red-500 rounded-3xl animate-ping opacity-25" />
              )}
              {isRecording ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
            </button>
            <button 
              onClick={() => setIsMicOn(!isMicOn)}
              aria-label={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isMicOn ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200' : 'bg-red-500 text-white hover:bg-red-600'}`}
            >
              {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center space-x-3">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl shrink-0">
                <AlertCircle className="w-4 h-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Words in answer</p>
                <p className="text-sm font-bold">{transcript.trim() ? transcript.trim().split(/\s+/).length : 0}</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center space-x-3">
              <div className={`p-2.5 rounded-xl shrink-0 transition-colors duration-500 ${
                grammarStatus === 'Excellent' ? 'bg-green-100 dark:bg-green-900/30' :
                grammarStatus === 'Good' ? 'bg-blue-100 dark:bg-blue-900/30' :
                grammarStatus === 'Average' ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-red-100 dark:bg-red-900/30'
              }`}>
                <CheckCircle2 className={`w-4 h-4 transition-colors duration-500 ${
                  grammarStatus === 'Excellent' ? 'text-green-600' :
                  grammarStatus === 'Good' ? 'text-blue-600' :
                  grammarStatus === 'Average' ? 'text-yellow-600' : 'text-red-600'
                }`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Filler words</p>
                <p className="text-sm font-bold">{transcript.trim() ? grammarStatus : '—'}</p>
              </div>
            </div>
          </div>
          {(isRecording || recordedSeconds > 0) && (
            <p className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
              {isRecording
                ? `Recording audio replay · ${recordedSeconds}s captured`
                : `Audio replay ready · ${recordedSeconds}s buffered`}
            </p>
          )}

          <button 
            onClick={() => finishInterview(evaluations, answers)}
            disabled={isEvaluating}
            className="w-full py-3 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-sm flex items-center justify-center space-x-2 hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors border border-white/10 disabled:opacity-60"
          >
            <StopCircle className="w-4 h-4 text-red-500" />
            <span>End Interview Session</span>
          </button>
        </div>
      </div>
    </div>

    <InterviewScratchpad sessionKey={interviewId || id || 'active'} />
  </div>
  );
}
