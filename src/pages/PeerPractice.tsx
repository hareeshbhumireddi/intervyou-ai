import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Clock,
  Inbox,
  MessageSquare,
  Search,
  Send,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { Alert, Button, Card } from '../components/ui';
import QuestionFocusTimer from '../components/QuestionFocusTimer';
import {
  acceptPeerRequest,
  cancelPeerRequest,
  completePeerPractice,
  declinePeerRequest,
  ensurePeerSessionForRequest,
  sendPeerMessage,
  sendPeerRequest,
  subscribeAvailablePeers,
  subscribeMyPeerProfile,
  subscribeMyPeerRequests,
  subscribePeerMessages,
  subscribePeerSession,
  updatePeerSessionState,
  upsertPeerProfile,
} from '../services/peerService';
import type {
  Difficulty,
  PeerMessage,
  PeerProfile,
  PeerRequest,
  PeerSession,
  Sector,
} from '../types';

type ActiveTab = 'discover' | 'requests' | 'room';

const CURATED_PROMPTS: { category: string; text: string }[] = [
  {
    category: 'Warm-up',
    text: 'Walk me through your background and the most impactful problem you solved recently.',
  },
  {
    category: 'Behavioral (STAR)',
    text: 'Tell me about a time you disagreed with a teammate or stakeholder. How did you align and move forward?',
  },
  {
    category: 'Technical Depth',
    text: 'Describe a production bottleneck or tricky bug you debugged. How did you isolate root cause and verify the fix?',
  },
  {
    category: 'System Design',
    text: 'Design a real-time notification and activity feed service that handles bursty traffic with low latency.',
  },
  {
    category: 'Government / Public Policy',
    text: 'How do you balance speed, transparency, and citizen accessibility when implementing a public digital service?',
  },
];

function formatRelativeTime(iso?: string): string {
  if (!iso) return 'Just now';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 'Just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(ms).toLocaleDateString();
}

function StatusBadge({ status }: { status: PeerRequest['status'] }) {
  const styles: Record<PeerRequest['status'], string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    declined: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    cancelled: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    completed: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  };
  const labels: Record<PeerRequest['status'], string> = {
    pending: 'Pending',
    accepted: 'Matched',
    declined: 'Declined',
    cancelled: 'Cancelled',
    completed: 'Completed',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function PeerPractice() {
  const { user, firebaseUid, signInWithGoogle } = useAppState();

  const [activeTab, setActiveTab] = useState<ActiveTab>('discover');
  const [myProfile, setMyProfile] = useState<PeerProfile | null>(null);
  const [availablePeers, setAvailablePeers] = useState<PeerProfile[]>([]);
  const [requests, setRequests] = useState<PeerRequest[]>([]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  // Profile editor state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [targetRoleInput, setTargetRoleInput] = useState('Software Engineer');
  const [sectorInput, setSectorInput] = useState<Sector>('Private');
  const [difficultyInput, setDifficultyInput] = useState<Difficulty>('Intermediate');
  const [skillsInput, setSkillsInput] = useState('');
  const [bioInput, setBioInput] = useState('');
  const [expInput, setExpInput] = useState('Fresher / Early Career');

  // Directory filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState<'All' | Sector>('All');
  const [difficultyFilter, setDifficultyFilter] = useState<'All' | Difficulty>('All');

  // Request modal state
  const [targetPeer, setTargetPeer] = useState<PeerProfile | null>(null);
  const [reqTopic, setReqTopic] = useState('');
  const [reqSector, setReqSector] = useState<Sector>('Private');
  const [reqDifficulty, setReqDifficulty] = useState<Difficulty>('Intermediate');
  const [reqTime, setReqTime] = useState('Ready Now');
  const [reqNote, setReqNote] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  // Live Practice Room state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<PeerSession | null>(null);
  const [sessionMessages, setSessionMessages] = useState<PeerMessage[]>([]);
  const [customQuestionDraft, setCustomQuestionDraft] = useState('');
  const [sharedNotesDraft, setSharedNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [composerMode, setComposerMode] = useState<'chat' | 'feedback'>('chat');
  const [composerText, setComposerText] = useState('');
  const [feedbackScore, setFeedbackScore] = useState<number>(80);
  const [sendingMsg, setSendingMsg] = useState(false);

  const feedEndRef = useRef<HTMLDivElement | null>(null);

  // Sync form defaults from user or loaded peer profile
  useEffect(() => {
    if (myProfile) {
      setDisplayNameInput(myProfile.displayName);
      setTargetRoleInput(myProfile.targetRole);
      setSectorInput(myProfile.sector);
      setDifficultyInput(myProfile.difficulty);
      setSkillsInput(myProfile.skills.join(', '));
      setBioInput(myProfile.bio || '');
      setExpInput(myProfile.experienceLevel || 'Fresher / Early Career');
    } else {
      setDisplayNameInput(user.fullName || user.email?.split('@')[0] || 'Candidate');
      setSkillsInput((user.skills || []).slice(0, 10).join(', '));
    }
  }, [myProfile, user.fullName, user.email, user.skills]);

  // Subscribe to Peer Practice Firestore collections when signed into Firebase Auth
  useEffect(() => {
    if (!firebaseUid) {
      setMyProfile(null);
      setAvailablePeers([]);
      setRequests([]);
      return;
    }

    const handleErr = (err: Error) => {
      const msg = err.message.includes('permission-denied')
        ? 'Firestore permission denied. Verify your Google account email and reload.'
        : err.message;
      setErrorMsg(msg);
    };

    const unsubMe = subscribeMyPeerProfile(firebaseUid, setMyProfile, handleErr);
    const unsubPeers = subscribeAvailablePeers(firebaseUid, setAvailablePeers, handleErr);
    const unsubReqs = subscribeMyPeerRequests(firebaseUid, setRequests, handleErr);

    return () => {
      unsubMe();
      unsubPeers();
      unsubReqs();
    };
  }, [firebaseUid]);

  // Subscribe to active Live Practice Room & messages
  useEffect(() => {
    if (!firebaseUid || !activeSessionId) {
      setActiveSession(null);
      setSessionMessages([]);
      return;
    }

    const unsubSession = subscribePeerSession(
      activeSessionId,
      (sess) => {
        setActiveSession(sess);
        if (sess && sess.sharedNotes !== undefined) {
          setSharedNotesDraft(sess.sharedNotes);
        }
      },
      (err) => setErrorMsg(err.message)
    );

    const unsubMsgs = subscribePeerMessages(
      activeSessionId,
      firebaseUid,
      (msgs) => {
        setSessionMessages(msgs);
        window.setTimeout(() => feedEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
      },
      (err) => setErrorMsg(err.message)
    );

    return () => {
      unsubSession();
      unsubMsgs();
    };
  }, [firebaseUid, activeSessionId]);

  const incomingPending = useMemo(
    () => requests.filter((r) => r.receiverId === firebaseUid && r.status === 'pending'),
    [requests, firebaseUid]
  );

  const outgoingPending = useMemo(
    () => requests.filter((r) => r.senderId === firebaseUid && r.status === 'pending'),
    [requests, firebaseUid]
  );

  const activeMatches = useMemo(
    () => requests.filter((r) => r.status === 'accepted'),
    [requests]
  );

  const pastRequests = useMemo(
    () => requests.filter((r) => r.status === 'completed' || r.status === 'declined' || r.status === 'cancelled'),
    [requests]
  );

  const filteredPeers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return availablePeers.filter((peer) => {
      if (sectorFilter !== 'All' && peer.sector !== sectorFilter) return false;
      if (difficultyFilter !== 'All' && peer.difficulty !== difficultyFilter) return false;
      if (!q) return true;
      const haystack = [
        peer.displayName,
        peer.targetRole,
        peer.bio || '',
        ...(peer.skills || []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [availablePeers, searchQuery, sectorFilter, difficultyFilter]);

  const activeRequestForSession = useMemo(
    () => requests.find((r) => (r.sessionId || r.id) === activeSessionId) || null,
    [requests, activeSessionId]
  );

  const handleGoogleConnect = async () => {
    setSigningIn(true);
    setErrorMsg(null);
    try {
      await signInWithGoogle();
      setInfoMsg('Connected to live Peer Practice directory.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not sign in with Google.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSavePeerProfile = async (nextAvailable?: boolean) => {
    if (!firebaseUid) return;
    setSavingProfile(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const parsedSkills = skillsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 15);

      const saved = await upsertPeerProfile(firebaseUid, {
        displayName: displayNameInput.trim() || user.fullName || 'Candidate',
        targetRole: targetRoleInput.trim() || 'Software Engineer',
        sector: sectorInput,
        difficulty: difficultyInput,
        isAvailable: typeof nextAvailable === 'boolean' ? nextAvailable : myProfile?.isAvailable ?? true,
        skills: parsedSkills,
        bio: bioInput.trim(),
        experienceLevel: expInput.trim(),
        preferredLanguage: user.preferredLanguage || 'English',
      });
      setMyProfile(saved);
      setIsEditingProfile(false);
      setInfoMsg(
        saved.isAvailable
          ? 'Your Peer Practice card is live and visible to other candidates.'
          : 'Your Peer Practice availability is paused.'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not update peer profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const openRequestModal = (peer: PeerProfile) => {
    if (!myProfile) {
      setIsEditingProfile(true);
      setInfoMsg('Publish your quick Peer Practice card first so peers know your role before matching.');
      return;
    }
    setTargetPeer(peer);
    setReqTopic(`${peer.targetRole} Mock Interview`);
    setReqSector(peer.sector);
    setReqDifficulty(peer.difficulty);
    setReqTime('Ready Now');
    setReqNote('');
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUid || !targetPeer) return;
    setSendingRequest(true);
    setErrorMsg(null);
    try {
      const profile = myProfile || (await upsertPeerProfile(firebaseUid, {
        displayName: displayNameInput.trim() || user.fullName || 'Candidate',
        targetRole: targetRoleInput.trim() || 'Software Engineer',
        sector: sectorInput,
        difficulty: difficultyInput,
        isAvailable: true,
        skills: skillsInput.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 15),
        bio: bioInput.trim(),
        experienceLevel: expInput.trim(),
        preferredLanguage: user.preferredLanguage || 'English',
      }));

      await sendPeerRequest({
        senderId: firebaseUid,
        senderName: profile.displayName,
        senderRole: profile.targetRole,
        receiver: targetPeer,
        topic: reqTopic.trim() || `${targetPeer.targetRole} Mock Interview`,
        sector: reqSector,
        difficulty: reqDifficulty,
        message: reqNote.trim(),
        scheduledTime: reqTime.trim() || 'Ready Now',
      });

      setInfoMsg(`Practice request sent to ${targetPeer.displayName}. Status: Pending.`);
      setTargetPeer(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not send peer practice request.');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleAcceptRequest = async (req: PeerRequest) => {
    setBusyActionId(req.id);
    setErrorMsg(null);
    try {
      const sessionId = await acceptPeerRequest(req);
      setActiveSessionId(sessionId);
      setActiveTab('room');
      setInfoMsg(`Match accepted with ${req.senderName}. Live practice room is ready.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to accept request.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleDeclineRequest = async (req: PeerRequest) => {
    setBusyActionId(req.id);
    setErrorMsg(null);
    try {
      await declinePeerRequest(req.id);
      setInfoMsg(`Declined request from ${req.senderName}.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to decline request.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleCancelRequest = async (req: PeerRequest) => {
    setBusyActionId(req.id);
    setErrorMsg(null);
    try {
      await cancelPeerRequest(req.id);
      setInfoMsg(`Cancelled invitation to ${req.receiverName}.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to cancel request.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleOpenRoom = async (req: PeerRequest) => {
    setBusyActionId(req.id);
    setErrorMsg(null);
    try {
      const session = await ensurePeerSessionForRequest(req);
      setActiveSessionId(session.id);
      setActiveTab('room');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not open live practice room.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleCompleteMatch = async (req: PeerRequest) => {
    setBusyActionId(req.id);
    setErrorMsg(null);
    try {
      await completePeerPractice(req);
      setInfoMsg('Peer practice session marked completed.');
      if ((req.sessionId || req.id) === activeSessionId) {
        setActiveTab('requests');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not complete session.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleSwapRoles = async () => {
    if (!activeSession || activeSession.status !== 'active') return;
    const nextInterviewerId =
      activeSession.interviewerId === activeSession.hostId
        ? activeSession.guestId
        : activeSession.hostId;
    try {
      await updatePeerSessionState(activeSession.id, { interviewerId: nextInterviewerId });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not swap roles.');
    }
  };

  const handleSetQuestion = async (questionText: string, category: string) => {
    if (!activeSession || !firebaseUid || activeSession.status !== 'active') return;
    const trimmed = questionText.trim();
    if (!trimmed) return;
    try {
      await updatePeerSessionState(activeSession.id, {
        currentQuestion: trimmed,
        currentCategory: category,
      });
      const myName =
        firebaseUid === activeSession.hostId ? activeSession.hostName : activeSession.guestName;
      const myRole =
        firebaseUid === activeSession.interviewerId ? 'Interviewer' : 'Candidate';
      await sendPeerMessage(
        activeSession,
        firebaseUid,
        myName,
        myRole,
        'question',
        `[${category}] ${trimmed}`
      );
      setCustomQuestionDraft('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not update live prompt.');
    }
  };

  const handleSaveNotes = async () => {
    if (!activeSession || activeSession.status !== 'active') return;
    setSavingNotes(true);
    try {
      await updatePeerSessionState(activeSession.id, { sharedNotes: sharedNotesDraft });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not save notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleSendRoomMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !firebaseUid || activeSession.status !== 'active') return;
    const trimmed = composerText.trim();
    if (!trimmed) return;
    setSendingMsg(true);
    try {
      const myName =
        firebaseUid === activeSession.hostId ? activeSession.hostName : activeSession.guestName;
      const myRole =
        firebaseUid === activeSession.interviewerId ? 'Interviewer' : 'Candidate';
      await sendPeerMessage(
        activeSession,
        firebaseUid,
        myName,
        myRole,
        composerMode,
        trimmed,
        composerMode === 'feedback' ? feedbackScore : undefined
      );
      setComposerText('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not send message.');
    } finally {
      setSendingMsg(false);
    }
  };

  const getPeerMatchState = (peerUid: string) => {
    const matched = activeMatches.find(
      (r) => r.senderId === peerUid || r.receiverId === peerUid
    );
    if (matched) return { state: 'matched' as const, request: matched };
    const sent = outgoingPending.find((r) => r.receiverId === peerUid);
    if (sent) return { state: 'sent' as const, request: sent };
    const received = incomingPending.find((r) => r.senderId === peerUid);
    if (received) return { state: 'received' as const, request: received };
    return { state: 'none' as const, request: null };
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Peer Practice
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Discover fellow candidates, send practice requests, and run live mock interviews together.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-900">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Peers Open
            </span>
            <span className="mt-0.5 block text-xl font-bold tabular-nums text-slate-900 dark:text-white">
              {availablePeers.length}
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-900">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Incoming
            </span>
            <span className="mt-0.5 block text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {incomingPending.length}
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-900">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Matched
            </span>
            <span className="mt-0.5 block text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {activeMatches.length}
            </span>
          </div>
        </div>
      </div>

      {errorMsg && <Alert tone="error">{errorMsg}</Alert>}
      {infoMsg && <Alert tone="success">{infoMsg}</Alert>}

      {/* Auth Gate for Live Firestore Directory */}
      {!firebaseUid ? (
        <Card className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Connect Firebase Auth for Live Peer Matching
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Peer Practice matches real users on the platform via Firestore with verified identity rules. Sign in with Google to browse peers, send invitations, and join live rooms.
            </p>
          </div>
          <Button onClick={handleGoogleConnect} loading={signingIn} className="shrink-0 whitespace-nowrap">
            <UserCheck className="h-4 w-4" />
            Sign in with Google
          </Button>
        </Card>
      ) : (
        <>
          {/* Segmented Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'discover'}
                onClick={() => setActiveTab('discover')}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                  activeTab === 'discover'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Find Peers</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'requests'}
                onClick={() => setActiveTab('requests')}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                  activeTab === 'requests'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <Inbox className="h-4 w-4" />
                <span>Requests &amp; Matches</span>
                {(incomingPending.length > 0 || activeMatches.length > 0) && (
                  <span className="ml-0.5 rounded-full bg-blue-600 px-1.5 py-0.5 text-[11px] font-bold leading-none tabular-nums text-white">
                    {incomingPending.length + activeMatches.length}
                  </span>
                )}
              </button>

              {activeSessionId && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'room'}
                  onClick={() => setActiveTab('room')}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                    activeTab === 'room'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Live Practice Room</span>
                </button>
              )}
            </div>

            {/* Quick Availability Toggle Strip */}
            <div className="flex flex-wrap items-center gap-2">
              {myProfile ? (
                <>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        myProfile.isAvailable ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                    {myProfile.isAvailable ? 'Listed as Available' : 'Availability Paused'}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleSavePeerProfile(!myProfile.isAvailable)}
                    loading={savingProfile}
                    className="px-3 py-1.5 text-xs whitespace-nowrap"
                  >
                    {myProfile.isAvailable ? 'Pause Listing' : 'Go Available'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsEditingProfile((prev) => !prev)}
                    className="px-3 py-1.5 text-xs whitespace-nowrap"
                  >
                    {isEditingProfile ? 'Close Card Editor' : 'Edit My Card'}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={() => setIsEditingProfile(true)}
                  className="px-3.5 py-1.5 text-xs whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Join Peer Directory
                </Button>
              )}
            </div>
          </div>

          {/* Collapsible Peer Availability Profile Editor */}
          {(isEditingProfile || (!myProfile && activeTab === 'discover')) && (
            <Card className="border-blue-200/80 dark:border-blue-900/50">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {myProfile ? 'Your Public Peer Practice Card' : 'Create Your Peer Practice Card'}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Only your display name, role focus, and skills are visible to peers. Your email and phone number stay strictly private.
                  </p>
                </div>
                {myProfile && (
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 cursor-pointer"
                    aria-label="Close card editor"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Display Name
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder="e.g. Ananya S."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Target Role
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={targetRoleInput}
                    onChange={(e) => setTargetRoleInput(e.target.value)}
                    placeholder="e.g. Full-Stack Developer"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Sector
                  </label>
                  <select
                    value={sectorInput}
                    onChange={(e) => setSectorInput(e.target.value as Sector)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="Private">Private</option>
                    <option value="Government">Government</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Difficulty
                  </label>
                  <select
                    value={difficultyInput}
                    onChange={(e) => setDifficultyInput(e.target.value as Difficulty)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Practice Skills (comma-separated, max 15)
                  </label>
                  <input
                    type="text"
                    value={skillsInput}
                    onChange={(e) => setSkillsInput(e.target.value)}
                    placeholder="React, TypeScript, System Design, DSA"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Experience Bracket
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={expInput}
                    onChange={(e) => setExpInput(e.target.value)}
                    placeholder="e.g. Final Year Student / 2-4 Years"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Short Practice Focus Note
                </label>
                <input
                  type="text"
                  maxLength={400}
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  placeholder="Looking to swap 30-min Frontend + Behavioral mock rounds this week."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                {myProfile && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleSavePeerProfile(false)}
                    loading={savingProfile}
                    className="text-xs whitespace-nowrap"
                  >
                    Save as Paused
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => handleSavePeerProfile(true)}
                  loading={savingProfile}
                  className="text-xs whitespace-nowrap"
                >
                  <Check className="h-4 w-4" />
                  Save &amp; Go Available
                </Button>
              </div>
            </Card>
          )}

          {/* TAB 1: FIND PEERS DIRECTORY */}
          {activeTab === 'discover' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search peers by name, target role, or skill..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Filter by sector"
                    value={sectorFilter}
                    onChange={(e) => setSectorFilter(e.target.value as 'All' | Sector)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="All">All Sectors</option>
                    <option value="Private">Private</option>
                    <option value="Government">Government</option>
                  </select>

                  <select
                    aria-label="Filter by difficulty"
                    value={difficultyFilter}
                    onChange={(e) => setDifficultyFilter(e.target.value as 'All' | Difficulty)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="All">All Levels</option>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              {/* Peers Grid */}
              {filteredPeers.length === 0 ? (
                <Card className="py-12 text-center">
                  <Users className="mx-auto h-10 w-10 text-slate-400" />
                  <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                    No available peers match your current filters
                  </h3>
                  <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-300">
                    Publish your Peer Practice card as Available so other signed-in members can discover you and exchange practice invites in real time.
                  </p>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredPeers.map((peer) => {
                    const matchInfo = getPeerMatchState(peer.uid);
                    return (
                      <Card key={peer.uid} className="flex flex-col justify-between gap-4 p-5">
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-sm font-extrabold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                                {peer.avatarInitials || 'PR'}
                              </div>
                              <div className="min-w-0">
                                <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">
                                  {peer.displayName}
                                </h3>
                                <p className="truncate text-xs font-semibold text-blue-600 dark:text-blue-400">
                                  {peer.targetRole}
                                </p>
                              </div>
                            </div>

                            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              Available
                            </span>
                          </div>

                          <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                            {peer.sector} · {peer.difficulty}
                            {peer.experienceLevel ? ` · ${peer.experienceLevel}` : ''}
                          </p>

                          {peer.bio && (
                            <p className="mt-2.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                              {peer.bio}
                            </p>
                          )}

                          {peer.skills.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {peer.skills.slice(0, 4).map((skill) => (
                                <span
                                  key={skill}
                                  className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  {skill}
                                </span>
                              ))}
                              {peer.skills.length > 4 && (
                                <span className="px-1 py-0.5 text-xs font-medium text-slate-500">
                                  +{peer.skills.length - 4} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                          {matchInfo.state === 'matched' && matchInfo.request ? (
                            <Button
                              type="button"
                              full
                              onClick={() => handleOpenRoom(matchInfo.request!)}
                              loading={busyActionId === matchInfo.request.id}
                              className="whitespace-nowrap"
                            >
                              <MessageSquare className="h-4 w-4" />
                              Enter Live Room
                            </Button>
                          ) : matchInfo.state === 'sent' ? (
                            <Button
                              type="button"
                              variant="secondary"
                              full
                              onClick={() => setActiveTab('requests')}
                              className="whitespace-nowrap"
                            >
                              <Clock className="h-4 w-4 text-amber-500" />
                              Request Sent (Pending)
                            </Button>
                          ) : matchInfo.state === 'received' ? (
                            <Button
                              type="button"
                              full
                              onClick={() => setActiveTab('requests')}
                              className="whitespace-nowrap"
                            >
                              <Inbox className="h-4 w-4" />
                              Respond to Invite
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              full
                              onClick={() => openRequestModal(peer)}
                              className="whitespace-nowrap"
                            >
                              <UserPlus className="h-4 w-4" />
                              Request Practice
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REQUESTS & MATCHES */}
          {activeTab === 'requests' && (
            <div className="space-y-6">
              {/* Incoming Invitations */}
              <section className="space-y-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Incoming Practice Requests ({incomingPending.length})
                </h2>
                {incomingPending.length === 0 ? (
                  <Card className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    No pending incoming invitations right now.
                  </Card>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {incomingPending.map((req) => (
                      <Card key={req.id} className="space-y-3 p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                              {req.senderName}
                            </h3>
                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                              {req.senderRole}
                            </p>
                          </div>
                          <StatusBadge status={req.status} />
                        </div>

                        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                          <p className="font-semibold">Topic: {req.topic}</p>
                          <p className="mt-1 text-slate-500 dark:text-slate-400">
                            {req.sector} · {req.difficulty} · {req.scheduledTime || 'Ready Now'}
                          </p>
                          {req.message && <p className="mt-2 italic text-slate-600 dark:text-slate-300">“{req.message}”</p>}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            type="button"
                            onClick={() => handleAcceptRequest(req)}
                            loading={busyActionId === req.id}
                            className="flex-1 whitespace-nowrap"
                          >
                            <Check className="h-4 w-4" />
                            Accept &amp; Match
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => handleDeclineRequest(req)}
                            loading={busyActionId === req.id}
                            className="whitespace-nowrap"
                          >
                            <X className="h-4 w-4" />
                            Decline
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </section>

              {/* Active Matched Sessions */}
              <section className="space-y-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Active Peer Matches ({activeMatches.length})
                </h2>
                {activeMatches.length === 0 ? (
                  <Card className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    Accept an incoming request or wait for a peer to accept yours to unlock your live practice room.
                  </Card>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {activeMatches.map((req) => {
                      const isSender = req.senderId === firebaseUid;
                      const partnerName = isSender ? req.receiverName : req.senderName;
                      const partnerRole = isSender ? req.receiverRole : req.senderRole;
                      return (
                        <Card key={req.id} className="space-y-3 border-emerald-200/80 p-5 dark:border-emerald-900/50">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Matched with {partnerName}
                              </h3>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                {partnerRole} · {req.topic}
                              </p>
                            </div>
                            <StatusBadge status={req.status} />
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Button
                              type="button"
                              onClick={() => handleOpenRoom(req)}
                              loading={busyActionId === req.id}
                              className="flex-1 whitespace-nowrap"
                            >
                              <MessageSquare className="h-4 w-4" />
                              Open Live Practice Room
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => handleCompleteMatch(req)}
                              loading={busyActionId === req.id}
                              className="whitespace-nowrap"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Complete
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Outgoing Pending */}
              <section className="space-y-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Sent Requests ({outgoingPending.length})
                </h2>
                {outgoingPending.length === 0 ? (
                  <Card className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    You have no pending outgoing invitations.
                  </Card>
                ) : (
                  <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                    {outgoingPending.map((req) => (
                      <div key={req.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {req.receiverName}
                            </span>
                            <StatusBadge status={req.status} />
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {req.topic} · {req.sector} · {req.difficulty} · Sent {formatRelativeTime(req.createdAt)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => handleCancelRequest(req)}
                          loading={busyActionId === req.id}
                          className="px-3 py-1.5 text-xs whitespace-nowrap"
                        >
                          Cancel Request
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Completed / Declined / Cancelled History */}
              {pastRequests.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Match History ({pastRequests.length})
                  </h2>
                  <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                    {pastRequests.slice(0, 10).map((req) => {
                      const partnerName =
                        req.senderId === firebaseUid ? req.receiverName : req.senderName;
                      return (
                        <div key={req.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {partnerName}
                            </span>
                            <span className="mx-2 text-slate-300 dark:text-slate-700">·</span>
                            <span className="text-slate-600 dark:text-slate-300">{req.topic}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-400">
                              {formatRelativeTime(req.updatedAt || req.createdAt)}
                            </span>
                            <StatusBadge status={req.status} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* TAB 3: LIVE PRACTICE ROOM */}
          {activeTab === 'room' && activeSession && (
            <div className="space-y-4">
              {/* Live Session Header */}
              <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      {activeSession.status === 'active' ? 'Live Match Room' : 'Completed Session'}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {activeSession.hostName} &amp; {activeSession.guestName}
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">
                    {activeSession.topic}
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                    Your current role:{' '}
                    <strong className="text-blue-600 dark:text-blue-400">
                      {activeSession.interviewerId === firebaseUid ? 'Interviewer (Asking & Evaluating)' : 'Candidate (Answering)'}
                    </strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeSession.status === 'active' && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleSwapRoles}
                      className="whitespace-nowrap"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                      Swap Roles
                    </Button>
                  )}
                  {activeRequestForSession && activeSession.status === 'active' && (
                    <Button
                      type="button"
                      onClick={() => handleCompleteMatch(activeRequestForSession)}
                      loading={busyActionId === activeRequestForSession.id}
                      className="whitespace-nowrap"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Finish Practice
                    </Button>
                  )}
                </div>
              </Card>

              <div className="grid gap-4 lg:grid-cols-12">
                {/* Left Column: Active Question, Pacing Timer & Shared Notes */}
                <div className="space-y-4 lg:col-span-5">
                  <Card className="space-y-3 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        Active Prompt · {activeSession.currentCategory || 'Practice'}
                      </span>
                    </div>
                    <p className="text-base font-bold leading-snug text-slate-900 dark:text-white">
                      {activeSession.currentQuestion}
                    </p>

                    {activeSession.status === 'active' && (
                      <div className="space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Switch Prompt:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {CURATED_PROMPTS.map((item) => (
                            <button
                              key={item.category}
                              type="button"
                              onClick={() => handleSetQuestion(item.text, item.category)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              {item.category}
                            </button>
                          ))}
                        </div>

                        <div className="flex gap-2 pt-1">
                          <input
                            type="text"
                            maxLength={600}
                            value={customQuestionDraft}
                            onChange={(e) => setCustomQuestionDraft(e.target.value)}
                            placeholder="Type a custom interview question..."
                            className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => handleSetQuestion(customQuestionDraft, 'Custom')}
                            disabled={!customQuestionDraft.trim()}
                            className="px-3 py-1.5 text-xs whitespace-nowrap"
                          >
                            Set Prompt
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>

                  <QuestionFocusTimer
                    questionKey={`${activeSession.id}_${activeSession.currentQuestion}`}
                    defaultDurationSeconds={120}
                    isExternallyPaused={activeSession.status !== 'active'}
                  />

                  <Card className="space-y-2.5 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Shared Session Notes
                      </h3>
                      {activeSession.status === 'active' && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleSaveNotes}
                          loading={savingNotes}
                          className="px-2.5 py-1 text-xs whitespace-nowrap"
                        >
                          Sync Notes
                        </Button>
                      )}
                    </div>
                    <textarea
                      rows={4}
                      maxLength={4000}
                      disabled={activeSession.status !== 'active'}
                      value={sharedNotesDraft}
                      onChange={(e) => setSharedNotesDraft(e.target.value)}
                      placeholder="Write structured STAR notes, coding hints, or rubric takeaways to share with your peer..."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none focus:border-blue-500 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </Card>
                </div>

                {/* Right Column: Real-Time Conversation & Peer Rubric Feedback */}
                <Card className="flex h-[36rem] flex-col justify-between p-0 lg:col-span-7 overflow-hidden">
                  <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Live Practice Conversation &amp; Peer Feedback
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Synced in real time via Firestore between {activeSession.hostName} and {activeSession.guestName}.
                    </p>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto p-5">
                    {sessionMessages.length === 0 ? (
                      <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
                        Room is live! Say hello, paste your spoken answer summary, or score your partner&apos;s response using Feedback mode below.
                      </div>
                    ) : (
                      sessionMessages.map((msg) => {
                        const isMine = msg.senderId === firebaseUid;
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                          >
                            <div className="mb-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {isMine ? 'You' : msg.senderName}
                              </span>
                              <span>·</span>
                              <span>{msg.senderRole}</span>
                              {msg.type === 'feedback' && typeof msg.score === 'number' && (
                                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  Score {msg.score}/100
                                </span>
                              )}
                            </div>

                            <div
                              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                msg.type === 'question'
                                  ? 'border border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-800/70 dark:bg-blue-950/40 dark:text-blue-100'
                                  : msg.type === 'feedback'
                                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-100'
                                  : isMine
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                              }`}
                            >
                              {msg.text}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={feedEndRef} />
                  </div>

                  {activeSession.status === 'active' && (
                    <form
                      onSubmit={handleSendRoomMessage}
                      className="space-y-2.5 border-t border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/80"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="inline-flex rounded-lg bg-slate-200/70 p-0.5 dark:bg-slate-800">
                          <button
                            type="button"
                            onClick={() => setComposerMode('chat')}
                            className={`rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                              composerMode === 'chat'
                                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            Message / Answer
                          </button>
                          <button
                            type="button"
                            onClick={() => setComposerMode('feedback')}
                            className={`rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                              composerMode === 'feedback'
                                ? 'bg-white text-emerald-700 shadow-xs dark:bg-slate-900 dark:text-emerald-300'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            Rubric Feedback
                          </button>
                        </div>

                        {composerMode === 'feedback' && (
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                            <span>Score:</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={feedbackScore}
                              onChange={(e) =>
                                setFeedbackScore(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
                              }
                              className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-center tabular-nums dark:border-slate-700 dark:bg-slate-950"
                            />
                            <span className="text-slate-400">/ 100</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={2000}
                          value={composerText}
                          onChange={(e) => setComposerText(e.target.value)}
                          placeholder={
                            composerMode === 'feedback'
                              ? 'Share constructive feedback (clarity, STAR structure, edge cases)...'
                              : 'Send a message or key points of your response...'
                          }
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                        <Button
                          type="submit"
                          loading={sendingMsg}
                          disabled={!composerText.trim()}
                          className="whitespace-nowrap"
                        >
                          <Send className="h-4 w-4" />
                          Send
                        </Button>
                      </div>
                    </form>
                  )}
                </Card>
              </div>
            </div>
          )}
        </>
      )}

      {/* Request Practice Modal */}
      {targetPeer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="peer-request-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <Card className="w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="peer-request-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
                  Request Peer Practice with {targetPeer.displayName}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {targetPeer.targetRole} · {targetPeer.sector} · {targetPeer.difficulty}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTargetPeer(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSendRequest} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Session Topic / Round
                </label>
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={reqTopic}
                  onChange={(e) => setReqTopic(e.target.value)}
                  placeholder="e.g. React + System Design Mock Round"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Sector
                  </label>
                  <select
                    value={reqSector}
                    onChange={(e) => setReqSector(e.target.value as Sector)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="Private">Private</option>
                    <option value="Government">Government</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Difficulty
                  </label>
                  <select
                    value={reqDifficulty}
                    onChange={(e) => setReqDifficulty(e.target.value as Difficulty)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    When
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={reqTime}
                    onChange={(e) => setReqTime(e.target.value)}
                    placeholder="Ready Now"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Introductory Note (Optional)
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={reqNote}
                  onChange={(e) => setReqNote(e.target.value)}
                  placeholder="Let them know what format you'd like (e.g. 20 mins behavioral + 20 mins technical)..."
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setTargetPeer(null)}
                  className="whitespace-nowrap"
                >
                  Cancel
                </Button>
                <Button type="submit" loading={sendingRequest} className="whitespace-nowrap">
                  <Send className="h-4 w-4" />
                  Send Practice Request
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
