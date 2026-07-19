/* Shared UI primitives — keep prop types loose to avoid dual @types/react conflicts. */

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
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="ui-kicker mb-1.5">{eyebrow}</div>}
        <h1 className="ui-page-title">{title}</h1>
        {description && <p className="ui-page-desc">{description}</p>}
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
  tone?: 'brand' | 'success' | 'warn' | 'neutral';
}) {
  const accent =
    tone === 'success'
      ? 'from-emerald-500/10 to-transparent'
      : tone === 'warn'
        ? 'from-amber-500/10 to-transparent'
        : tone === 'neutral'
          ? 'from-ink-400/10 to-transparent'
          : 'from-brand-500/12 to-transparent';
  return (
    <div className={`ui-stat bg-gradient-to-br ${accent}`}>
      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500">{label}</div>
      <div className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-950">
        {value}
      </div>
      {hint ? <p className="mt-1.5 text-xs text-ink-500">{hint}</p> : null}
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
      {hint ? <p className="mt-1.5 text-xs leading-relaxed text-ink-400">{hint}</p> : null}
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
  const icons = {
    info: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
      />
    ),
    warn: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    ),
    error: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
      />
    ),
    success: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  };
  return (
    <div className={`${map[tone]} flex gap-3`}>
      <svg
        className="mt-0.5 h-5 w-5 shrink-0 opacity-80"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        {icons[tone]}
      </svg>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="px-4 py-14 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-ink-100 to-brand-50 text-brand-600 shadow-soft ring-1 ring-ink-200/60">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
          />
        </svg>
      </div>
      <p className="font-display font-semibold text-ink-900">{title}</p>
      {body ? <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">{body}</p> : null}
    </div>
  );
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
