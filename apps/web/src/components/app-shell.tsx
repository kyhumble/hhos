'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, getStoredUser, type SessionUser } from '@/lib/auth';

type NavItem = { href: string; label: string; group: string };

const NAV: NavItem[] = [
  { href: '/', label: 'Dashboard', group: 'Overview' },
  { href: '/intake', label: 'Intake', group: 'Clinical' },
  { href: '/oasis', label: 'OASIS', group: 'Clinical' },
  { href: '/tasks', label: 'Clinical tasks', group: 'Clinical' },
  { href: '/routing', label: 'Routing', group: 'Operations' },
  { href: '/field-tasks', label: 'Field tasks', group: 'Operations' },
  { href: '/orders', label: 'Orders / 485', group: 'Compliance' },
  { href: '/hospice', label: 'Hospice', group: 'Compliance' },
  { href: '/billing', label: 'Billing', group: 'Revenue' },
  { href: '/admin', label: 'Org admin', group: 'Platform' },
  { href: '/onboard', label: 'New agency', group: 'Platform' },
];

function navActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const bare = pathname.startsWith('/sign/') || pathname === '/login';

  useEffect(() => {
    setUser(getStoredUser());
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (bare) {
    return <div className="min-h-screen">{children}</div>;
  }

  const groups = [...new Set(NAV.map((n) => n.group))];

  function logout() {
    clearSession();
    setUser(null);
    window.location.href = '/login';
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-sm font-bold text-white shadow-lg shadow-brand-900/30">
          HH
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-tight text-white">HHOS</div>
          <div className="truncate text-[11px] text-brand-200/80">Home Health · Hospice</div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group}>
            <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-200/50">
              {group}
            </div>
            <ul className="space-y-0.5">
              {NAV.filter((n) => n.group === group).map((item) => {
                const active = navActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center rounded-xl px-3 py-2 text-sm font-medium transition ${
                        active
                          ? 'bg-white/12 text-white shadow-sm ring-1 ring-white/10'
                          : 'text-brand-100/75 hover:bg-white/6 hover:text-white'
                      }`}
                    >
                      <span
                        className={`mr-2.5 h-1.5 w-1.5 rounded-full ${
                          active ? 'bg-brand-300' : 'bg-brand-400/30'
                        }`}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        {user ? (
          <div className="rounded-xl bg-white/8 p-3 ring-1 ring-white/10">
            <div className="truncate text-sm font-semibold text-white">{user.fullName}</div>
            <div className="truncate text-xs text-brand-200/70">{user.email}</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {user.roles.slice(0, 2).map((r) => (
                <span
                  key={r}
                  className="rounded-md bg-brand-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-100"
                >
                  {r.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={logout}
              className="mt-3 w-full rounded-lg bg-white/10 px-2 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex w-full items-center justify-center rounded-xl bg-brand-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-400"
          >
            Sign in
          </Link>
        )}
        <p className="mt-3 px-1 text-[10px] leading-relaxed text-brand-200/40">
          Synthetic data only · Not for production PHI
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[var(--sidebar-width)] shrink-0 bg-gradient-to-b from-ink-950 via-brand-950 to-ink-950 lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(100%,var(--sidebar-width))] bg-gradient-to-b from-ink-950 via-brand-950 to-ink-950 shadow-2xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-white/80 backdrop-blur-md lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              className="ui-btn-secondary ui-btn-sm"
              onClick={() => setMobileOpen(true)}
            >
              Menu
            </button>
            <div className="text-sm font-semibold text-ink-900">HHOS</div>
            <Link href="/login" className="text-xs font-semibold text-brand-700">
              {user ? user.fullName.split(' ')[0] : 'Login'}
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
