import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Settings, 
  Shield, 
  Award, 
  Camera, 
  Edit3, 
  FileText, 
  ExternalLink, 
  Plus, 
  MapPin, 
  Mail, 
  Linkedin, 
  Github,
  ChevronRight,
  Calendar,
  Phone,
  GraduationCap,
  Building2,
  Languages,
  Users,
  Check,
  X,
  BookOpen,
  PlusCircle,
  Briefcase,
  RefreshCw,
  Trash2,
  Unlink,
  Cloud,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { useTheme } from '../components/ThemeProvider';
import { DobField } from '../components/DobField';
import { LinkedInConnectModal } from '../components/LinkedInConnectModal';
import { UserProfile, WorkExperience } from '../types';
import { ApiError, api } from '../utils/api';
import { processAvatarFile } from '../utils/imageUpload';
import { normalizeUserProfile } from '../services/firestoreService';
import { LANGUAGES } from '../utils/validation';

export default function Profile() {
  const {
    user,
    setUser,
    syncProfileToCloud,
    retryCloudSync,
    firebaseUid,
    signInWithGoogle,
    isProfileLoading,
    isSyncingProfile,
    cloudSyncError,
  } = useAppState();
  const [isEditing, setIsEditing] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [saveNotice, setSaveNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isConnectingCloud, setIsConnectingCloud] = useState(false);
  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [editForm, setEditForm] = useState<UserProfile>(() => normalizeUserProfile(user));
  const [previewItem, setPreviewItem] = useState<{ type: 'certificate', data: any } | null>(null);
  const [isLinkedInModalOpen, setIsLinkedInModalOpen] = useState(false);
  const [isDisconnectingLinkedIn, setIsDisconnectingLinkedIn] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const saveInFlightRef = useRef(false);

  // Keep editForm synchronized whenever user profile finishes hydrating or updates externally
  useEffect(() => {
    if (!isEditing) {
      setEditForm(normalizeUserProfile(user));
    }
    setAvatarLoadError(false);
  }, [user, isEditing]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;

    setProfileError('');
    setSaveNotice('');
    setIsUploadingAvatar(true);
    try {
      const compressedAvatar = await processAvatarFile(file);
      setAvatarLoadError(false);
      if (isEditing) {
        setEditForm(prev => ({ ...prev, avatarUrl: compressedAvatar }));
        setSaveNotice('Photo preview updated. Click Save Changes to persist.');
      } else {
        await saveProfile({ ...user, avatarUrl: compressedAvatar }, 'Profile picture updated and saved.');
      }
    } catch (uploadErr) {
      setProfileError(uploadErr instanceof Error ? uploadErr.message : 'Failed to process profile picture.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCertificateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newCert = {
        title: file.name.split('.')[0],
        provider: 'Uploaded Document',
        date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      };
      
      if (isEditing) {
        setEditForm(prev => ({
          ...prev,
          certificates: [...(prev.certificates || []), newCert]
        }));
      } else {
        void saveProfile({
          ...user,
          certificates: [...(user.certificates || []), newCert]
        }, 'Certificate added.');
      }
    }
    if (e.target) e.target.value = '';
  };

  const saveProfile = async (profile: UserProfile, successMsg = 'Profile saved.') => {
    if (saveInFlightRef.current) return;

    const trimmedName = profile.fullName.trim();
    const trimmedEmail = profile.email.trim();
    if (!trimmedName) {
      setProfileError('Full name is required.');
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setProfileError('Enter a valid email address.');
      return;
    }

    saveInFlightRef.current = true;
    setIsSaving(true);
    setProfileError('');
    setSaveNotice('');
    try {
      const mergedStats =
        (user.stats?.totalInterviews || 0) > (profile.stats?.totalInterviews || 0)
          ? user.stats
          : profile.stats || user.stats;

      const normalizedPayload = normalizeUserProfile({
        ...profile,
        fullName: trimmedName,
        email: trimmedEmail,
        mobile: profile.mobile.trim(),
        address: profile.address.trim(),
        qualification: profile.qualification.trim(),
        education: {
          degree: profile.education.degree.trim(),
          college: profile.education.college.trim(),
          specialization: profile.education.specialization.trim(),
          graduationYear: profile.education.graduationYear.trim(),
          cgpa: profile.education.cgpa.trim(),
        },
        resumeFile: profile.resumeFile || user.resumeFile,
        resumeText:
          (profile.resumeText?.length || 0) >= (user.resumeText?.length || 0)
            ? profile.resumeText
            : user.resumeText,
        jobAlertSubscription: profile.jobAlertSubscription || user.jobAlertSubscription,
        stats: mergedStats,
        profileUpdatedAt: new Date().toISOString(),
      });

      const { user: savedUser } = await api.updateProfile(normalizedPayload);
      const cleanUser = normalizeUserProfile({
        ...savedUser,
        avatarUrl: normalizedPayload.avatarUrl ?? savedUser.avatarUrl,
        resumeFile: normalizedPayload.resumeFile || savedUser.resumeFile,
        resumeText:
          (normalizedPayload.resumeText?.length || 0) >= (savedUser.resumeText?.length || 0)
            ? normalizedPayload.resumeText
            : savedUser.resumeText,
        jobAlertSubscription: normalizedPayload.jobAlertSubscription || savedUser.jobAlertSubscription,
        profileUpdatedAt: savedUser.profileUpdatedAt || normalizedPayload.profileUpdatedAt,
      });

      setUser(cleanUser);
      setEditForm(cleanUser);

      const cloudRes = await syncProfileToCloud(cleanUser, 'profile');
      setIsEditing(false);

      if (cloudRes.cloudConnected && !cloudRes.synced) {
        setProfileError(
          `Saved to this browser, but Cloud Firestore sync failed: ${cloudRes.error || 'Please retry cloud sync.'}`
        );
      } else {
        setSaveNotice(successMsg);
      }
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.fields) {
        setProfileError(`${saveError.message} ${Object.values(saveError.fields).join(' ')}`);
      } else {
        setProfileError(saveError instanceof Error ? saveError.message : 'Profile could not be saved.');
      }
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    void saveProfile(editForm);
  };

  const updateField = (field: keyof UserProfile, value: any) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const updateEducation = (field: keyof typeof editForm.education, value: string) => {
    setEditForm(prev => ({
      ...prev,
      education: { ...prev.education, [field]: value }
    }));
  };

  const addSkill = (skill: string) => {
    if (skill && !editForm.skills.includes(skill)) {
      setEditForm(prev => ({ ...prev, skills: [...prev.skills, skill] }));
    }
  };

  const addWorkItem = () => {
    const newItem: WorkExperience = {
      id: `work-${Date.now()}`,
      title: '',
      company: '',
      location: '',
      startDate: '',
      endDate: 'Present',
      current: true,
      description: '',
      source: 'manual',
    };
    if (isEditing) {
      setEditForm(prev => ({
        ...prev,
        workHistory: [newItem, ...(prev.workHistory || [])].slice(0, 25),
      }));
    } else {
      const next = normalizeUserProfile({
        ...user,
        workHistory: [newItem, ...(user.workHistory || [])].slice(0, 25),
      });
      setEditForm(next);
      setIsEditing(true);
      setSaveNotice('');
    }
  };

  const updateWorkItem = (index: number, field: keyof WorkExperience, value: any) => {
    setEditForm(prev => ({
      ...prev,
      workHistory: (prev.workHistory || []).map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeWorkItem = (index: number) => {
    if (isEditing) {
      setEditForm(prev => ({
        ...prev,
        workHistory: (prev.workHistory || []).filter((_, idx) => idx !== index),
      }));
    } else {
      const nextHistory = (user.workHistory || []).filter((_, idx) => idx !== index);
      void saveProfile({ ...user, workHistory: nextHistory }, 'Work experience entry removed.');
    }
  };

  const handleLinkedInSuccess = useCallback(
    async (updatedUser: UserProfile, message: string, syncAction: 'linkedin' | 'profile' = 'linkedin') => {
      const clean = normalizeUserProfile({
        ...updatedUser,
        profileUpdatedAt: updatedUser.profileUpdatedAt || new Date().toISOString(),
      });
      setUser(clean);
      setEditForm(clean);
      setProfileError('');
      const cloudRes = await syncProfileToCloud(clean, syncAction);
      if (cloudRes.cloudConnected && !cloudRes.synced) {
        setProfileError(`Updated locally, but cloud sync failed: ${cloudRes.error || 'Please try again.'}`);
      } else {
        setSaveNotice(message);
      }
    },
    [setUser, syncProfileToCloud]
  );

  const handleLinkedInDisconnect = async () => {
    setIsDisconnectingLinkedIn(true);
    setProfileError('');
    setSaveNotice('');
    try {
      const res = await api.disconnectLinkedIn(false);
      const clean = normalizeUserProfile({
        ...res.user,
        profileUpdatedAt: res.user.profileUpdatedAt || new Date().toISOString(),
      });
      setUser(clean);
      setEditForm(clean);
      const cloudRes = await syncProfileToCloud(clean, 'linkedin');
      if (cloudRes.cloudConnected && !cloudRes.synced) {
        setProfileError(`Disconnected locally, but cloud sync failed: ${cloudRes.error || 'Please try again.'}`);
      } else {
        setSaveNotice('LinkedIn account disconnected. Imported work history remains in your resume.');
      }
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to disconnect LinkedIn.');
    } finally {
      setIsDisconnectingLinkedIn(false);
    }
  };

  const handleConnectGoogleCloudSync = async () => {
    if (isConnectingCloud || isSaving) return;
    setIsConnectingCloud(true);
    setProfileError('');
    setSaveNotice('');
    try {
      await signInWithGoogle();
      setSaveNotice('Google Cloud Sync connected. Your profile photo, details, and interviews are backed up.');
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setProfileError('Google sign-in popup was closed before completing.');
      } else {
        setProfileError(err instanceof Error ? err.message : 'Could not connect Google Cloud Sync.');
      }
    } finally {
      setIsConnectingCloud(false);
    }
  };

  const handleRetryCloudSync = async () => {
    if (isRetryingSync || isSaving) return;
    setIsRetryingSync(true);
    setProfileError('');
    setSaveNotice('');
    try {
      const res = await retryCloudSync();
      if (res.synced) {
        setSaveNotice('Profile synchronized with Cloud Firestore.');
      } else if (res.cloudConnected) {
        setProfileError(`Cloud Firestore sync failed: ${res.error || 'Please try again.'}`);
      }
    } finally {
      setIsRetryingSync(false);
    }
  };

  const activeProfile = isEditing ? editForm : user;
  const fallbackSeed = encodeURIComponent(activeProfile.fullName || activeProfile.email || 'Candidate');
  const avatarSrc = !avatarLoadError && activeProfile.avatarUrl
    ? activeProfile.avatarUrl
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${fallbackSeed}`;

  if (isProfileLoading && !isEditing) {
    return (
      <div className="space-y-8 pb-20" role="status" aria-live="polite" aria-label="Loading profile">
        <div className="relative h-48 md:h-64 rounded-[40px] overflow-hidden bg-gradient-to-r from-blue-600/80 via-blue-500/80 to-purple-600/80 animate-pulse" />
        <div className="max-w-6xl mx-auto px-4 md:px-8 -mt-24 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-8">
              <div className="p-8 rounded-[40px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
                <div className="w-32 h-32 mx-auto rounded-[32px] bg-slate-200 dark:bg-slate-800 animate-pulse" />
                <div className="h-7 w-44 mx-auto rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
                <div className="h-4 w-36 mx-auto rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
                <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className="h-4 w-full rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
                  <div className="h-4 w-3/4 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
                  <div className="h-4 w-5/6 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
                </div>
              </div>
            </div>
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="h-72 rounded-[40px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 animate-pulse" />
              <div className="h-72 rounded-[40px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="relative h-48 md:h-64 rounded-[40px] overflow-hidden bg-gradient-to-r from-blue-600 via-blue-500 to-purple-600">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
        <div className="absolute top-6 right-6 flex space-x-3">
           <button 
            onClick={() => {
              if (isEditing) handleSave();
              else {
                setEditForm(normalizeUserProfile(user));
                setSaveNotice('');
                setProfileError('');
                setIsEditing(true);
              }
            }}
            disabled={isSaving || isUploadingAvatar || isProfileLoading}
            className={`flex items-center space-x-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-lg disabled:opacity-60 ${
              isEditing 
              ? 'bg-green-500 text-white shadow-green-500/20' 
              : 'bg-white text-blue-600 shadow-white/20'
            }`}
           >
              {isEditing ? (
                <><Check className="w-5 h-5" /> <span>{isSaving ? 'Saving & Syncing...' : 'Save Changes'}</span></>
              ) : (
                <><Edit3 className="w-5 h-5" /> <span>Edit Profile</span></>
              )}
           </button>
           {isEditing && (
             <button 
              onClick={() => {
                setEditForm(normalizeUserProfile(user));
                setIsEditing(false);
                setProfileError('');
              }}
              disabled={isSaving}
              className="p-3 bg-red-500 text-white rounded-2xl shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all disabled:opacity-60"
             >
               <X className="w-5 h-5" />
             </button>
           )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 -mt-24 relative z-10">
        {(profileError || saveNotice) && (
          <div className="mb-6">
            {profileError ? (
              <div
                role="alert"
                className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl bg-red-50 dark:bg-red-950/95 border border-red-200 dark:border-red-800/80 text-red-900 dark:text-red-100 shadow-lg shadow-slate-900/10 dark:shadow-black/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
                  <p className="text-sm font-semibold leading-snug">{profileError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileError('')}
                  aria-label="Dismiss error"
                  className="p-1.5 rounded-xl text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                role="status"
                className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/95 border border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-100 shadow-lg shadow-slate-900/10 dark:shadow-black/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-sm font-semibold leading-snug">{saveNotice}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSaveNotice('')}
                  aria-label="Dismiss notice"
                  className="p-1.5 rounded-xl text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="space-y-8">
            <div className="p-8 rounded-[40px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none text-center">
               <div className="relative inline-block mb-6">
                  <div className="w-32 h-32 rounded-[32px] overflow-hidden border-4 border-white dark:border-slate-800 shadow-lg bg-slate-100 dark:bg-slate-800 relative">
                    <img 
                      key={avatarSrc}
                      src={avatarSrc}
                      alt={activeProfile.fullName || 'Candidate Avatar'}
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarLoadError(true)}
                      className="w-full h-full object-cover" 
                    />
                    {(isUploadingAvatar || isSaving) && (
                      <div className="absolute inset-0 bg-slate-950/50 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarUpload}
                    className="hidden"
                    accept="image/*"
                  />
                  <button 
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar || isSaving}
                    className="absolute -bottom-2 -right-2 p-2.5 bg-blue-600 text-white rounded-xl shadow-lg border-2 border-white dark:border-slate-900 hover:scale-110 transition-transform active:scale-95 disabled:opacity-60"
                    title="Change profile picture"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
               </div>
               
               {isEditing ? (
                 <input 
                  type="text"
                  value={editForm.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  className="w-full text-center text-2xl font-bold bg-slate-50 dark:bg-slate-800 border-none rounded-xl mb-1 py-1"
                 />
               ) : (
                 <h2 className="text-2xl font-bold mb-1">{activeProfile.fullName}</h2>
               )}
               
               <p className="text-slate-500 font-medium mb-6">{activeProfile.education?.college || 'Senior Student'}</p>
               
               <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-3 text-slate-600 dark:text-slate-400">
                     <Mail className="w-4 h-4" />
                     {isEditing ? (
                       <input 
                        type="email"
                        value={editForm.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        className="flex-1 text-sm font-medium bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-2"
                       />
                     ) : (
                       <span className="text-sm font-medium">{activeProfile.email}</span>
                     )}
                  </div>
                  <div className="flex items-center space-x-3 text-slate-600 dark:text-slate-400">
                     <Phone className="w-4 h-4" />
                     {isEditing ? (
                       <input 
                        type="tel" inputMode="numeric" placeholder="10-digit mobile number"
                        value={editForm.mobile}
                        onChange={(e) => updateField('mobile', e.target.value)}
                        className="flex-1 text-sm font-medium bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-2"
                       />
                     ) : (
                       <span className="text-sm font-medium">{activeProfile.mobile || 'No mobile set'}</span>
                     )}
                  </div>
                  <div className="flex items-center space-x-3 text-slate-600 dark:text-slate-400">
                     <MapPin className="w-4 h-4" />
                     {isEditing ? (
                       <input 
                        type="text"
                        value={editForm.address}
                        onChange={(e) => updateField('address', e.target.value)}
                        className="flex-1 text-sm font-medium bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-2"
                       />
                     ) : (
                       <span className="text-sm font-medium truncate">{activeProfile.address || 'Location not set'}</span>
                     )}
                  </div>
               </div>

               <div className="flex justify-center space-x-3 mt-8">
                  {/* Social icons removed as per user request */}
               </div>
            </div>

            {/* Cloud Backup & Sync Card */}
            <div className="p-6 rounded-[36px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    !firebaseUid || cloudSyncError
                      ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                      : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                  }`}
                >
                  {isSyncingProfile || isRetryingSync ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : firebaseUid && !cloudSyncError ? (
                    <Cloud className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    {!firebaseUid
                      ? 'Local Session Backup'
                      : cloudSyncError
                      ? 'Cloud Sync Needs Retry'
                      : isSyncingProfile
                      ? 'Syncing to Firestore...'
                      : 'Cloud Sync Active'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {!firebaseUid
                      ? 'Edits are backed up in this browser. Connect Google to sync across devices and server restarts.'
                      : cloudSyncError
                      ? `Local changes are safe. Last cloud sync error: ${cloudSyncError}`
                      : 'Your profile picture, details, and interview history are synced to Cloud Firestore.'}
                  </p>
                </div>
              </div>
              {firebaseUid && cloudSyncError && (
                <button
                  type="button"
                  onClick={handleRetryCloudSync}
                  disabled={isRetryingSync || isSyncingProfile || isSaving}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {isRetryingSync || isSyncingProfile ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>{isRetryingSync || isSyncingProfile ? 'Retrying Cloud Sync...' : 'Retry Cloud Sync'}</span>
                </button>
              )}
              {!firebaseUid && (
                <button
                  type="button"
                  onClick={handleConnectGoogleCloudSync}
                  disabled={isConnectingCloud}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {isConnectingCloud ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Cloud className="w-3.5 h-3.5" />
                  )}
                  <span>{isConnectingCloud ? 'Connecting Google Sync...' : 'Connect Google Cloud Sync'}</span>
                </button>
              )}
            </div>

            {/* LinkedIn Connection Card */}
            <div className="p-7 rounded-[36px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
               <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-[#0A66C2] text-white flex items-center justify-center shrink-0">
                      <Linkedin className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                        LinkedIn Sync
                      </h3>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                        {activeProfile.linkedinProfile?.connected ? 'Connected to Resume' : 'Not connected'}
                      </p>
                    </div>
                  </div>
               </div>

               {activeProfile.linkedinProfile?.connected ? (
                 <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                    {activeProfile.linkedinProfile.headline && (
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {activeProfile.linkedinProfile.headline}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>Synced positions</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {(activeProfile.workHistory || []).length}
                      </span>
                    </div>
                    {activeProfile.linkedinProfile.lastSyncedAt && (
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span>Last updated</span>
                        <span className="font-medium">
                          {new Date(activeProfile.linkedinProfile.lastSyncedAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {activeProfile.linkedinProfile.profileUrl && (
                      <a
                        href={activeProfile.linkedinProfile.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A66C2] dark:text-blue-400 hover:underline pt-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="truncate">View LinkedIn Profile</span>
                      </a>
                    )}
                 </div>
               ) : (
                 <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                   Connect your LinkedIn profile to import work history and skills directly into your resume profile.
                 </p>
               )}

               <div className="flex flex-col gap-2">
                 <button
                   type="button"
                   onClick={() => setIsLinkedInModalOpen(true)}
                   className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#0A66C2] hover:bg-[#004182] text-white text-sm font-bold shadow-sm transition-colors whitespace-nowrap"
                 >
                   {activeProfile.linkedinProfile?.connected ? (
                     <>
                       <RefreshCw className="w-4 h-4" />
                       <span>Sync Work History</span>
                     </>
                   ) : (
                     <>
                       <Linkedin className="w-4 h-4" />
                       <span>Connect with LinkedIn</span>
                     </>
                   )}
                 </button>
                 {activeProfile.linkedinProfile?.connected && (
                   <button
                     type="button"
                     onClick={handleLinkedInDisconnect}
                     disabled={isDisconnectingLinkedIn}
                     className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
                   >
                     <Unlink className="w-3.5 h-3.5" />
                     <span>{isDisconnectingLinkedIn ? 'Disconnecting...' : 'Disconnect LinkedIn'}</span>
                   </button>
                 )}
               </div>
            </div>

          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
             {/* Info Sections */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Personal Info */}
                <div className="p-8 rounded-[40px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                   <div className="flex items-center space-x-3 mb-6">
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600">
                        <User className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl font-bold">Personal Details</h3>
                   </div>
                   <div className="space-y-4">
                      <div>
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Date of Birth</label>
                         {isEditing ? (
                           <div className="mt-1">
                             <DobField
                               label=""
                               value={editForm.dob || ''}
                               onChange={(e) => updateField('dob', e.target.value)}
                             />
                           </div>
                         ) : (
                           <p className="font-bold flex items-center mt-1">
                             <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                             {activeProfile.dob || 'Not set'}
                           </p>
                         )}
                      </div>
                      <div>
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Gender</label>
                         {isEditing ? (
                           <select 
                            value={editForm.gender}
                            onChange={(e) => updateField('gender', e.target.value)}
                            className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 font-medium"
                           >
                              <option value="">Select gender</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                           </select>
                         ) : (
                           <p className="font-bold flex items-center mt-1">
                             <Users className="w-4 h-4 mr-2 text-slate-400" />
                             {activeProfile.gender || 'Not set'}
                           </p>
                         )}
                      </div>
                      <div>
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Preferred Language</label>
                         {isEditing ? (
                           <select
                            value={editForm.preferredLanguage}
                            onChange={(e) => updateField('preferredLanguage', e.target.value)}
                            className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 font-medium"
                           >
                            <option value="">Select a language</option>
                            {LANGUAGES.map((language) => <option key={language} value={language}>{language}</option>)}
                           </select>
                         ) : (
                           <p className="font-bold flex items-center mt-1">
                             <Languages className="w-4 h-4 mr-2 text-slate-400" />
                             {activeProfile.preferredLanguage || 'Not set'}
                           </p>
                         )}
                      </div>
                   </div>
                </div>

                {/* Education Section */}
                <div className="p-8 rounded-[40px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                   <div className="flex items-center space-x-3 mb-6">
                      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-2xl text-purple-600">
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl font-bold">Academic Status</h3>
                   </div>
                   <div className="space-y-4">
                      <div>
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Degree & Major</label>
                         {isEditing ? (
                           <div className="grid grid-cols-2 gap-2 mt-1">
                             <input 
                              type="text"
                              placeholder="Degree"
                              value={editForm.education.degree}
                              onChange={(e) => updateEducation('degree', e.target.value)}
                              className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-3 py-2 text-sm font-medium"
                             />
                             <input 
                              type="text"
                              placeholder="Specialization"
                              value={editForm.education.specialization}
                              onChange={(e) => updateEducation('specialization', e.target.value)}
                              className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-3 py-2 text-sm font-medium"
                             />
                           </div>
                         ) : (
                           <p className="font-bold flex items-center mt-1">
                             <BookOpen className="w-4 h-4 mr-2 text-slate-400" />
                             {activeProfile.education.degree || 'Degree not set'}{activeProfile.education.specialization ? ` in ${activeProfile.education.specialization}` : ''}
                           </p>
                         )}
                      </div>
                      <div>
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Institution</label>
                         {isEditing ? (
                           <input 
                            type="text"
                            value={editForm.education.college}
                            onChange={(e) => updateEducation('college', e.target.value)}
                            className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 font-medium"
                           />
                         ) : (
                           <p className="font-bold flex items-center mt-1">
                             <Building2 className="w-4 h-4 mr-2 text-slate-400" />
                             {activeProfile.education.college || 'Not set'}
                           </p>
                         )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">CGPA</label>
                          {isEditing ? (
                            <input 
                              type="text"
                              value={editForm.education.cgpa}
                              onChange={(e) => updateEducation('cgpa', e.target.value)}
                              className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 font-medium"
                            />
                          ) : (
                            <p className="font-bold mt-1 text-purple-600">{activeProfile.education.cgpa ? `${activeProfile.education.cgpa} / 10.0` : 'Not set'}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Year</label>
                          {isEditing ? (
                            <input 
                              type="text"
                              value={editForm.education.graduationYear}
                              onChange={(e) => updateEducation('graduationYear', e.target.value)}
                              className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 font-medium"
                            />
                          ) : (
                            <p className="font-bold mt-1">{activeProfile.education.graduationYear || 'Not set'}</p>
                          )}
                        </div>
                      </div>
                   </div>
                </div>
             </div>

             {/* Work History (Resume Profile) */}
             <div className="p-8 md:p-10 rounded-[40px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-[#0A66C2] dark:text-blue-400">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Work History</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Automatically synced into your Resume Profile &amp; ATS analysis
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsLinkedInModalOpen(true)}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
                    >
                      <Linkedin className="w-3.5 h-3.5 text-[#0A66C2] dark:text-blue-400" />
                      <span>Import LinkedIn</span>
                    </button>
                    <button
                      type="button"
                      onClick={addWorkItem}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Role</span>
                    </button>
                  </div>
                </div>

                {(activeProfile.workHistory || []).length === 0 ? (
                  <div className="py-10 px-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[28px] space-y-3">
                    <Briefcase className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        No work history added yet
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        Connect with LinkedIn to import your career timeline and skills straight into your resume.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsLinkedInModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-bold transition-colors whitespace-nowrap"
                    >
                      <Linkedin className="w-3.5 h-3.5" />
                      <span>Connect with LinkedIn</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(activeProfile.workHistory || []).map((role, index) => (
                      <div
                        key={role.id || index}
                        className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-3"
                      >
                        {isEditing ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                Role #{index + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeWorkItem(index)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <input
                                type="text"
                                placeholder="Job Title"
                                value={role.title}
                                onChange={(e) => updateWorkItem(index, 'title', e.target.value)}
                                className="px-3 py-2 text-sm font-medium rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                              />
                              <input
                                type="text"
                                placeholder="Company"
                                value={role.company}
                                onChange={(e) => updateWorkItem(index, 'company', e.target.value)}
                                className="px-3 py-2 text-sm font-medium rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                              />
                              <input
                                type="text"
                                placeholder="Start Date (e.g. Jan 2022)"
                                value={role.startDate}
                                onChange={(e) => updateWorkItem(index, 'startDate', e.target.value)}
                                className="px-3 py-2 text-sm font-medium rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                              />
                              <input
                                type="text"
                                placeholder="End Date or Present"
                                value={role.endDate || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateWorkItem(index, 'endDate', val);
                                  updateWorkItem(index, 'current', /^present|current$/i.test(val.trim()));
                                }}
                                className="px-3 py-2 text-sm font-medium rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                              />
                            </div>
                            <input
                              type="text"
                              placeholder="Location (optional)"
                              value={role.location || ''}
                              onChange={(e) => updateWorkItem(index, 'location', e.target.value)}
                              className="w-full px-3 py-2 text-sm font-medium rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                            />
                            <textarea
                              rows={2}
                              placeholder="Key responsibilities and achievements"
                              value={role.description || ''}
                              onChange={(e) => updateWorkItem(index, 'description', e.target.value)}
                              className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                            />
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                                  {role.title}
                                </h4>
                                {role.source === 'linkedin' && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0A66C2] dark:text-blue-400">
                                    <Linkedin className="w-3 h-3" />
                                    LinkedIn
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                {role.company}
                                {role.location ? ` · ${role.location}` : ''}
                              </p>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                                {role.startDate || 'N/A'} – {role.current || !role.endDate ? 'Present' : role.endDate}
                              </p>
                              {role.description && (
                                <p className="text-sm text-slate-600 dark:text-slate-300 pt-1 leading-relaxed">
                                  {role.description}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeWorkItem(index)}
                              title="Remove role"
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
             </div>

             {/* Certificates Section */}
             <div className="p-10 rounded-[40px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-bold">Certificates</h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleCertificateUpload}
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSaving || isUploadingAvatar}
                      className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-60"
                      title="Add Certificate from device"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="text-sm font-semibold pr-1">Add</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {(isEditing ? editForm.certificates : user.certificates || []).map((cert, i) => (
                     <div 
                      key={i} 
                      onClick={() => setPreviewItem({ type: 'certificate', data: cert })}
                      className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-start space-x-4 relative group cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-all hover:shadow-md"
                     >
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                           <Award className="w-8 h-8 text-blue-600" />
                        </div>
                        <div className="flex-1">
                           <p className="font-bold text-lg leading-tight mb-1 group-hover:text-blue-600 transition-colors">{cert.title}</p>
                           <p className="text-sm text-slate-500 font-medium">{cert.provider} • {cert.date}</p>
                           <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Click to preview</p>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isSaving) return;
                            if (isEditing) {
                              const newCerts = editForm.certificates.filter((_, index) => index !== i);
                              setEditForm(prev => ({ ...prev, certificates: newCerts }));
                            } else {
                              const newCerts = (user.certificates || []).filter((_, index) => index !== i);
                              void saveProfile({ ...user, certificates: newCerts }, 'Certificate removed.');
                            }
                          }}
                          disabled={isSaving}
                          className="absolute top-4 right-4 text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-sm border border-red-100 dark:border-red-900/30 disabled:opacity-50"
                          title="Delete Certificate"
                        >
                          <X className="w-4 h-4" />
                        </button>
                     </div>
                   ))}
                   {(isEditing ? editForm.certificates?.length === 0 : (user.certificates || []).length === 0) && (
                     <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[32px]">
                        <Award className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">No certificates added yet.</p>
                     </div>
                   )}
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewItem(null)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-blue-600 text-white rounded-xl">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      Certificate Preview
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">Document Viewer</p>
                  </div>
                </div>
                <button 
                  onClick={() => setPreviewItem(null)}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Content - Simulation */}
              <div className="flex-1 overflow-y-auto p-12 bg-slate-50 dark:bg-slate-950/50">
                <div className="max-w-2xl mx-auto space-y-12">
                  {/* Paper simulation */}
                  <div className="bg-white dark:bg-slate-900 aspect-[1/1.414] w-full shadow-2xl rounded-sm border border-slate-200 dark:border-slate-800 p-12 relative">
                    {/* Watermark */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] rotate-[-45deg]">
                      <span className="text-[120px] font-black uppercase tracking-tighter">Intervyou</span>
                    </div>

                    <div className="relative z-10 space-y-8">
                      <div className="flex justify-between items-start border-b-2 border-blue-600 pb-8">
                        <div>
                          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                            {previewItem.data.title}
                          </h1>
                          <p className="text-blue-600 font-bold mt-1">
                            OFFICIAL CERTIFICATE
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Issue Date</p>
                          <p className="font-bold">{previewItem.data.date}</p>
                        </div>
                      </div>

                      <div className="space-y-12 py-8">
                        <div className="text-center space-y-4 py-12">
                          <p className="text-slate-500 italic font-serif text-lg">This is to certify that</p>
                          <h2 className="text-4xl font-black text-blue-600">{user.fullName}</h2>
                          <p className="text-slate-500 italic font-serif text-lg">has successfully completed the requirements for</p>
                          <h3 className="text-2xl font-bold">{previewItem.data.title}</h3>
                          <p className="text-slate-400 font-medium">Provided by {previewItem.data.provider}</p>
                        </div>
                        
                        <div className="flex justify-center pt-12">
                          <div className="w-32 h-32 border-4 border-double border-blue-100 dark:border-blue-900/30 rounded-full flex items-center justify-center relative">
                            <Award className="w-16 h-16 text-blue-200 dark:text-blue-800/20" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-24 h-24 border border-dashed border-blue-400/30 rounded-full animate-spin-slow" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="absolute bottom-12 left-12 right-12 border-t border-slate-100 dark:border-slate-800 pt-8 flex justify-between items-end">
                        <div className="space-y-1">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Document ID</p>
                          <p className="text-[10px] font-mono text-slate-500 uppercase">IV-PREV-{Math.random().toString(36).substring(7).toUpperCase()}</p>
                        </div>
                        <div className="text-center">
                           <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-lg mb-2 flex items-center justify-center opacity-40">
                              <Shield className="w-8 h-8 text-slate-300" />
                           </div>
                           <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Verified by Intervyou AI</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-center space-x-4">
                    <button className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-500/20 hover:scale-105 transition-transform flex items-center space-x-2">
                      <ExternalLink className="w-5 h-5" />
                      <span>Download Original</span>
                    </button>
                    <button className="px-8 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform flex items-center space-x-2">
                      <Mail className="w-5 h-5" />
                      <span>Send to Email</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LinkedIn Connect & Work History Import Modal */}
      <LinkedInConnectModal
        isOpen={isLinkedInModalOpen}
        user={activeProfile}
        onClose={() => setIsLinkedInModalOpen(false)}
        onSuccess={handleLinkedInSuccess}
      />
    </div>
  );
}