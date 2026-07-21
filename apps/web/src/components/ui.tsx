/* Shared UI primitives — Lumina calm clinical system. */

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="ui-kicker mb-0.5">{eyebrow}</div> : null}
        <h1 className="ui-page-title">{title}</h1>
        {description ? <p className="ui-page-desc">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <div className={`${padded ? 'ui-card-pad' : 'ui-card'} ${className}`}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'brand',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'brand' | 'success' | 'warn' | 'neutral' | 'danger';
}) {
  const bar =
    tone === 'success'
      ? 'bg-emerald-500'
      : tone === 'warn'
        ? 'bg-amber-500'
        : tone === 'danger'
          ? 'bg-red-500'
          : tone === 'neutral'
            ? 'bg-ink-400'
            : 'bg-teal-600';
  return (
    <div className="ui-stat relative overflow-hidden">
      <div className={`absolute inset-y-0 left-0 w-0.5 ${bar}`} />
      <div className="text-2xs font-semibold uppercase tracking-wide text-ink-400">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink-900">
        {value}
      </div>
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: BtnProps) {
  const v =
    variant === 'primary'
      ? 'ui-btn-primary'
      : variant === 'secondary'
        ? 'ui-btn-secondary'
        : variant === 'danger'
          ? 'ui-btn-danger'
          : 'ui-btn-ghost';
  const s = size === 'sm' ? 'ui-btn-sm' : '';
  return (
    <button type={props.type ?? 'button'} className={`${v} ${s} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props;
  return <input className={`ui-input ${className}`} {...rest} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...rest } = props;
  return (
    <select className={`ui-select ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="ui-label">
      {children}
    </label>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="mt-1 text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'warn' | 'danger';
}) {
  const map = {
    neutral: 'ui-badge-neutral',
    brand: 'ui-badge-brand',
    success: 'ui-badge-success',
    warn: 'ui-badge-warn',
    danger: 'ui-badge-danger',
  } as const;
  return <span className={map[tone]}>{children}</span>;
}

export function Alert({
  children,
  tone = 'info',
}: {
  children: React.ReactNode;
  tone?: 'info' | 'warn' | 'error' | 'success';
}) {
  const map = {
    info: 'ui-alert-info',
    warn: 'ui-alert-warn',
    error: 'ui-alert-error',
    success: 'ui-alert-success',
  } as const;
  return <div className={map[tone]}>{children}</div>;
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-14 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600 ring-1 ring-teal-100">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
          />
        </svg>
      </div>
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">{body}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return <span className="ui-avatar">{initials || '?'}</span>;
}

export function statusTone(
  status: string,
): 'neutral' | 'brand' | 'success' | 'warn' | 'danger' {
  const s = status.toLowerCase();
  if (['signed', 'active', 'ready', 'exported', 'complete', 'completed', 'accepted'].includes(s)) {
    return 'success';
  }
  if (['blocked', 'rejected', 'void', 'failed', 'expired', 'non_admit'].includes(s)) {
    return 'danger';
  }
  if (['pending', 'draft', 'sent', 'viewed', 'pre_admit', 'incomplete', 'missing'].includes(s)) {
    return 'warn';
  }
  if (['scheduled', 'in_progress', 'open'].includes(s)) return 'brand';
  return 'neutral';
}

export function socUrgency(socDueAt: string | null): {
  label: string;
  tone: 'neutral' | 'brand' | 'success' | 'warn' | 'danger';
} {
  if (!socDueAt) return { label: 'No SOC due', tone: 'neutral' };
  const due = new Date(socDueAt).getTime();
  const hours = (due - Date.now()) / (1000 * 60 * 60);
  if (hours < 0) return { label: 'Overdue', tone: 'danger' };
  if (hours < 12) return { label: 'Due soon', tone: 'warn' };
  if (hours < 48) return { label: 'On track', tone: 'brand' };
  return { label: 'Scheduled', tone: 'success' };
}
