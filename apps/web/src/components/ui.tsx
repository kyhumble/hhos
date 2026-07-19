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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">
            {eyebrow}
          </div>
        )}
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

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="px-4 py-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
          />
        </svg>
      </div>
      <p className="font-medium text-ink-800">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">{body}</p> : null}
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
