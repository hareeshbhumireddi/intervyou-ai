import { forwardRef, useId } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, FlaskConical, Info, Loader2 } from 'lucide-react';

const cx = (...parts: (string | false | undefined | null)[]) => parts.filter(Boolean).join(' ');

/* ---------- Brand ---------- */
export function Brand({ to = '/', light = false, className }: { to?: string; light?: boolean; className?: string }) {
  return (
    <Link to={to} className={cx('inline-flex items-center gap-2.5 rounded-lg', className)} aria-label="Intervyou AI home">
      <span className={cx('flex h-9 w-9 items-center justify-center rounded-lg text-base font-extrabold', light ? 'bg-white text-brand-600' : 'bg-brand-600 text-white')}>I</span>
      <span className={cx('text-lg font-bold tracking-tight', light ? 'text-white' : 'text-slate-900 dark:text-white')}>Intervyou AI</span>
    </Link>
  );
}

/* ---------- Button ---------- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean; full?: boolean };
const variants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:hover:bg-brand-600',
  secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
  ghost: 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};
export const buttonClass = (variant: keyof typeof variants = 'primary', full = false) =>
  cx('inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60', variants[variant], full && 'w-full');

export function Button({ variant = 'primary', loading, full, children, disabled, className, ...rest }: ButtonProps) {
  return (
    <button {...rest} disabled={disabled || loading} aria-busy={loading || undefined} className={cx(buttonClass(variant, full), className)}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({ to, variant = 'primary', full, children, className }: { to: string; variant?: keyof typeof variants; full?: boolean; children: ReactNode; className?: string }) {
  return <Link to={to} className={cx(buttonClass(variant, full), className)}>{children}</Link>;
}

/* ---------- Form fields ---------- */
type FieldShellProps = { label: string; error?: string; hint?: string; required?: boolean; id: string; children: ReactNode };
function FieldShell({ label, error, hint, required, id, children }: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}{required && <span className="ml-0.5 text-red-600" aria-hidden>*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{error}
        </p>
      ) : hint ? <p id={`${id}-hint`} className="text-sm text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}

const controlClass = (error?: string) => cx(
  'block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 dark:bg-slate-900 dark:text-white',
  error ? 'border-red-500 focus-visible:outline-red-500' : 'border-slate-300 dark:border-slate-700',
);

type BaseFieldProps = { label: string; error?: string; hint?: string; prefix?: string };

export const TextField = forwardRef<HTMLInputElement, BaseFieldProps & InputHTMLAttributes<HTMLInputElement>>(
  ({ label, error, hint, prefix, required, className, ...rest }, ref) => {
    const generated = useId();
    const id = rest.id || generated;
    const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
    return (
      <FieldShell label={label} error={error} hint={hint} required={required} id={id}>
        <div className="flex">
          {prefix && <span className="inline-flex items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{prefix}</span>}
          <input ref={ref} {...rest} id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} aria-required={required || undefined}
            className={cx(controlClass(error), prefix && 'rounded-l-none', className)} />
        </div>
      </FieldShell>
    );
  },
);
TextField.displayName = 'TextField';

export function SelectField({ label, error, hint, required, children, ...rest }: BaseFieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const generated = useId();
  const id = rest.id || generated;
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} id={id}>
      <select {...rest} id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} aria-required={required || undefined} className={controlClass(error)}>
        {children}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({ label, error, hint, required, ...rest }: BaseFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generated = useId();
  const id = rest.id || generated;
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} id={id}>
      <textarea {...rest} id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} className={cx(controlClass(error), 'min-h-24')} />
    </FieldShell>
  );
}

/* ---------- Surfaces & feedback ---------- */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900', className)}>{children}</div>;
}

export function Alert({ tone = 'error', children, action }: { tone?: 'error' | 'success' | 'info'; children: ReactNode; action?: ReactNode }) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200',
    success: 'border-green-200 bg-green-50 text-green-800 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-200',
    info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200',
  }[tone];
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertCircle;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm', styles)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1 space-y-2"><div>{children}</div>{action}</div>
    </div>
  );
}

/** Persistent label shown whenever AI output comes from the development mock provider. */
export function SimulatedBanner({ className }: { className?: string }) {
  return (
    <div role="status" data-testid="mock-ai-banner" className={cx('flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100', className)}>
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p><strong>Development mock AI.</strong> Questions, feedback and reports are <strong>simulated</strong> by a fixed rubric, not a real AI model. Set <code>AI_PROVIDER=gemini</code> and a Gemini key for real results.</p>
    </div>
  );
}

export function FullPageStatus({ children }: { children: ReactNode }) {
  return <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center gap-3 bg-slate-50 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300"><Loader2 className="h-5 w-5 animate-spin" aria-hidden />{children}</div>;
}

/* ---------- Auth split layout (login & registration) ---------- */
export function AuthShell({ 
  title, 
  subtitle, 
  children, 
  footer, 
  wide, 
  visual3d 
}: { 
  title: string; 
  subtitle?: string; 
  children: ReactNode; 
  footer?: ReactNode; 
  wide?: boolean; 
  visual3d?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 lg:grid lg:grid-cols-[minmax(0,5.5fr)_minmax(0,6.5fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-10 text-white lg:flex border-r border-slate-900">
        {visual3d ? (
          <div className="absolute inset-0 z-0">
            {visual3d}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent pointer-events-none" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-brand-600 opacity-95" />
        )}
        <div className="relative z-10">
          <Brand light to="/" />
        </div>
        <div className="relative z-10 max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            AI Interactive Simulator
          </div>
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight">Practice interviews until they feel easy.</h2>
          <ul className="space-y-3.5 text-slate-300">
            {['Role-specific technical, HR and behavioural questions', 'Instant feedback and scoring on every answer', 'Resume-based personalized questions', 'Reports and progress analytics that build readiness'].map((item) => (
              <li key={item} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" aria-hidden /><span>{item}</span></li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-slate-500">© {new Date().getFullYear()} Intervyou AI • Autonomous Preparation Platform</p>
      </aside>
      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className={cx('w-full', wide ? 'max-w-xl' : 'max-w-md')}>
          <div className="mb-8 lg:hidden"><Brand /></div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
          {subtitle && <p className="mt-1.5 text-slate-600 dark:text-slate-300">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
