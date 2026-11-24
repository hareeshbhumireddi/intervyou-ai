import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { ApiError, api } from '../utils/api';
import type { UserProfile } from '../types';
import { Alert, AuthShell, Button, SelectField, TextAreaField, TextField } from '../components/ui';
import { DobField } from '../components/DobField';
import Simple3DScene from '../components/Simple3DScene';
import { useAppState } from '../hooks/useAppState';
import { normalizeUserProfile } from '../services/firestoreService';
import {
  DEGREES, GENDERS, LANGUAGES, STEP_FIELDS, validateFields,
} from '../utils/validation';
import type { FieldErrors, RegistrationValues } from '../utils/validation';

const EMPTY: RegistrationValues = {
  fullName: '', dob: '', gender: '', email: '', mobile: '', address: '', preferredLanguage: '',
  qualification: '', password: '', confirmPassword: '', degree: '', college: '', specialization: '',
  graduationYear: '', cgpa: '',
};

const STEPS = [
  { id: 1 as const, title: 'Personal details', blurb: 'Tell us who you are.' },
  { id: 2 as const, title: 'Contact & account', blurb: 'How we reach you and how you sign in.' },
  { id: 3 as const, title: 'Education', blurb: 'Your academic background.' },
];

const fromServerKey = (key: string) => (key.startsWith('education.') ? key.slice('education.'.length) : key);

function toProfile(v: RegistrationValues): UserProfile {
  return {
    fullName: v.fullName.trim(), dob: v.dob, gender: v.gender, email: v.email.trim(), mobile: v.mobile.trim(),
    address: v.address.trim(), qualification: v.qualification.trim(), preferredLanguage: v.preferredLanguage,
    education: { degree: v.degree, college: v.college.trim(), specialization: v.specialization.trim(), graduationYear: v.graduationYear.trim(), cgpa: v.cgpa.trim() },
    skills: [], certificates: [], stats: { totalInterviews: 0, avgScore: 0, bestScore: 0 }, isCompleted: true,
  };
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { setUser, setAuthenticated, signInWithGoogle } = useAppState();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [values, setValues] = useState<RegistrationValues>(EMPTY);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [duplicateEmail, setDuplicateEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const inFlight = useRef(false);

  const liveErrors = useMemo(() => validateFields(STEP_FIELDS[1].concat(STEP_FIELDS[2], STEP_FIELDS[3]), values), [values]);
  const errorFor = (field: keyof RegistrationValues) => (touched.has(field) ? liveErrors[field] : '') || serverErrors[field] || '';

  const set = (field: keyof RegistrationValues) => (e: { target: { value: string } }) => {
    setValues((prev) => ({ ...prev, [field]: e.target.value }));
    if (serverErrors[field]) setServerErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    if (field === 'email') setDuplicateEmail(false);
  };
  const blur = (field: keyof RegistrationValues) => () => setTouched((prev) => new Set(prev).add(field));
  const common = (field: keyof RegistrationValues) => ({ value: values[field], onChange: set(field), onBlur: blur(field), error: errorFor(field) });

  const touchStep = (s: 1 | 2 | 3) => setTouched((prev) => new Set([...prev, ...STEP_FIELDS[s]]));

  const handleGoogleSignUp = async () => {
    if (submitting || googleLoading) return;
    setSubmitError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setSubmitError('Google sign-in popup was closed before completing.');
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const goNext = (e?: FormEvent) => {
    e?.preventDefault();
    touchStep(step);
    if (Object.keys(validateFields(STEP_FIELDS[step], values)).length > 0) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setStep((s) => (Math.min(3, s + 1) as 1 | 2 | 3));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    setSubmitError('');
    setDuplicateEmail(false);
    const all = validateFields([...STEP_FIELDS[1], ...STEP_FIELDS[2], ...STEP_FIELDS[3]], values);
    if (Object.keys(all).length > 0) {
      setTouched(new Set(Object.keys(values)));
      const firstBad = ([1, 2, 3] as const).find((s) => STEP_FIELDS[s].some((f) => all[f]))!;
      setStep(firstBad);
      setSubmitError('Some details need attention. Please fix the highlighted fields.');
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    try {
      if (auth.currentUser) {
        await signOut(auth).catch(() => undefined);
      }
      const res = await api.register(toProfile(values), values.password);
      if (res.user) {
        setUser(normalizeUserProfile(res.user));
        setAuthenticated(true);
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/login', { state: { registered: true, email: values.email.trim() }, replace: true });
      }
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        const mapped: FieldErrors = {};
        for (const [key, message] of Object.entries(error.fields)) mapped[fromServerKey(key)] = message;
        setServerErrors(mapped);
        setTouched(new Set(Object.keys(values)));
        const firstBad = ([1, 2, 3] as const).find((s) => STEP_FIELDS[s].some((f) => mapped[f]));
        if (firstBad) setStep(firstBad);
        setDuplicateEmail(error.status === 409);
      }
      setSubmitError(error instanceof Error ? error.message : 'Registration failed. Please try again.');
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const current = STEPS[step - 1];

  return (
    <AuthShell
      wide
      title="Create your account"
      subtitle={`Step ${step} of 3 — ${current.title}. ${current.blurb}`}
      visual3d={<Simple3DScene />}
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link></>}
    >
      <div className="mb-5">
        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={googleLoading || submitting}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-xs transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 cursor-pointer"
        >
          {googleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z" />
              <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z" />
            </svg>
          )}
          <span>{googleLoading ? 'Connecting Google account…' : 'Continue with Google (Instant Cloud Sync)'}</span>
        </button>
        <div className="relative mt-4 flex items-center">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
          <span className="mx-3 shrink text-xs font-medium text-slate-400">or register manually</span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
        </div>
      </div>

      {/* 3D Visual Banner on Mobile Devices */}
      <div className="mb-6 block lg:hidden">
        <div className="relative h-32 w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-md">
          <Simple3DScene />
          <div className="absolute bottom-2 left-3 flex items-center gap-1.5 rounded-full bg-slate-900/80 px-2.5 py-0.5 text-[10px] font-semibold text-blue-300 backdrop-blur-xs">
            <Sparkles className="h-3 w-3 text-blue-400" />
            <span>Interactive 3D</span>
          </div>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="mb-8">
        <ol className="flex items-center gap-2" aria-label="Registration progress">
          {STEPS.map((s) => (
            <li key={s.id} className="flex flex-1 items-center gap-2" aria-current={s.id === step ? 'step' : undefined}>
              <motion.span 
                layout
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  s.id < step ? 'bg-green-600 text-white' : s.id === step ? 'bg-brand-600 text-white shadow-md shadow-brand-500/25 ring-2 ring-brand-200 dark:ring-brand-900' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {s.id < step ? <Check className="h-4 w-4" aria-label="completed" /> : s.id}
              </motion.span>
              <span className={`hidden text-xs font-semibold sm:block ${s.id === step ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{s.title}</span>
              {s.id < 3 && <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" aria-hidden />}
            </li>
          ))}
        </ol>

        {/* Animated Progress Bar */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <motion.div
            className="h-full bg-gradient-to-r from-brand-600 to-blue-500 rounded-full"
            initial={false}
            animate={{ width: `${((step - 1) / 2) * 100}%` }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
          />
        </div>
      </div>

      <form onSubmit={step === 3 ? submit : goNext} noValidate className="space-y-6" aria-label={`Registration step ${step}`}>
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <TextField label="Full name" required autoComplete="name" placeholder="e.g. Hareesh Bhumi" {...common('fullName')} />
              
              {/* Clean, Simple Single-Line Date of Birth */}
              <DobField
                label="Date of birth"
                required
                value={values.dob}
                onChange={set('dob')}
                onBlur={blur('dob')}
                error={errorFor('dob')}
              />

              <SelectField label="Gender" {...common('gender')}>
                <option value="">Prefer not to say</option>
                {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
              </SelectField>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <TextField label="Email address" required type="email" inputMode="email" autoComplete="email" placeholder="name@example.com" {...common('email')} />
              {duplicateEmail && (
                <Alert tone="info" action={<Link to="/login" state={{ email: values.email.trim() }} className="font-semibold underline">Go to sign in</Link>}>
                  This email already has an account.
                </Alert>
              )}
              <TextField label="Mobile number" required type="tel" inputMode="numeric" autoComplete="tel-national" prefix="+91" placeholder="10-digit number" hint="Digits only, starting with 6–9." {...common('mobile')} />
              <SelectField label="Preferred language" required {...common('preferredLanguage')}>
                <option value="">Select a language</option>
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </SelectField>
              <TextAreaField label="Current address" placeholder="Optional" autoComplete="street-address" {...common('address')} />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="Password" required type="password" autoComplete="new-password" hint="At least 8 characters." {...common('password')} />
                <TextField label="Confirm password" required type="password" autoComplete="new-password" {...common('confirmPassword')} />
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <SelectField label="Degree" required {...common('degree')}>
                  <option value="">Select degree</option>
                  {DEGREES.map((d) => <option key={d} value={d}>{d}</option>)}
                </SelectField>
                <TextField label="Specialization" placeholder="e.g. Computer Science" {...common('specialization')} />
              </div>
              <TextField label="College / university" required autoComplete="organization" placeholder="Your institution" {...common('college')} />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Graduation (passing) year"
                  required
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="YYYY"
                  hint="Four digits, e.g. 2025."
                  {...common('graduationYear')}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setValues((prev) => ({ ...prev, graduationYear: val }));
                    if (serverErrors.graduationYear) {
                      setServerErrors((prev) => {
                        const next = { ...prev };
                        delete next.graduationYear;
                        return next;
                      });
                    }
                  }}
                />
                <TextField label="CGPA / percentage" inputMode="decimal" placeholder="e.g. 8.5" {...common('cgpa')} />
              </div>
              <TextField label="Highest qualification" placeholder="e.g. Bachelor of Technology" {...common('qualification')} />
            </motion.div>
          )}
        </AnimatePresence>

        {submitError && (
          <Alert tone="error">{submitError}</Alert>
        )}

        <div className="flex gap-3 pt-3">
          {step > 1 && (
            <Button type="button" variant="secondary" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} disabled={submitting}>
              <ChevronLeft className="h-4 w-4" aria-hidden /> Back
            </Button>
          )}
          {step < 3 ? (
            <Button type="submit" full>Next <ChevronRight className="h-4 w-4" aria-hidden /></Button>
          ) : (
            <Button type="submit" full loading={submitting}>{submitting ? 'Creating account…' : 'Create account'}</Button>
          )}
        </div>
      </form>
    </AuthShell>
  );
}
