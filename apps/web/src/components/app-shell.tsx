'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { clearSession, getStoredUser, loadSessionUser, type SessionUser } from '@/lib/auth';
import { navForUser } from '@/lib/nav';
import { iconForHref, NavIcon } from '@/lib/nav-icons';

function navActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function pageTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  const map: Record<string, string> = {
    '/intake': 'Intake',
    '/oasis': 'OASIS',
    '/tasks': 'Clinical tasks',
    '/routing': 'Routing',
    '/field-tasks': 'Field tasks',
    '/orders': 'Orders / 485',
    '/hospice': 'Hospice',
    '/billing': 'Billing',
    '/admin': 'Organization',
    '/onboard': 'Onboarding',
    '/patients/new': 'New patient',
  };
  for (const [k, v] of Object.entries(map)) {
    if (pathname === k || pathname.startsWith(`${k}/`)) return v;
  }
  if (pathname.startsWith('/patients/')) return 'Patient';
  if (pathname.startsWith('/episodes/')) return 'Episode';
  if (pathname.startsWith('/oasis/')) return 'Assessment';
  return 'HHOS';
}

function pageCrumb(pathname: string): string {
  if (pathname === '/') return 'Overview';
  if (pathname.startsWith('/intake') || pathname.startsWith('/oasis') || pathname.startsWith('/tasks')) {
    return 'Clinical';
  }
  if (pathname.startsWith('/routing') || pathname.startsWith('/field')) return 'Operations';
  if (pathname.startsWith('/orders') || pathname.startsWith('/hospice')) return 'Compliance';
  if (pathname.startsWith('/billing')) return 'Revenue';
  if (pathname.startsWith('/admin') || pathname.startsWith('/onboard')) return 'Platform';
  return 'Console';
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const bare =
    pathname.startsWith('/sign/') || pathname === '/login' || pathname === '/invite';

  useEffect(() => {
    setUser(getStoredUser());
    void loadSessionUser().then((u) => setUser(u));
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const nav = useMemo(() => navForUser(user), [user]);
  const groups = useMemo(() => [...new Set(nav.map((n) => n.group))], [nav]);

  if (bare) {
    return <div className="min-h-screen bg-canvas">{children}</div>;
  }

  function logout() {
    clearSession();
    setUser(null);
    window.location.href = '/login';
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-side text-white">
      <div className="flex h-[var(--header-h)] items-center gap-2.5 border-b border-side-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-[11px] font-bold tracking-tight">
          HH
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13px] font-semibold tracking-tight">HHOS</div>
          <div className="truncate text-[10px] text-side-muted">Home Health OS</div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
        {groups.map((group) => (
          <div key={group}>
            <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-side-muted/70">
              {group}
            </div>
            <ul className="space-y-0.5">
              {nav
                .filter((n) => n.group === group)
                .map((item) => {
                  const active = navActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition ${
                          active
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <NavIcon
                          name={iconForHref(item.href)}
                          className={`h-4 w-4 shrink-0 ${active ? 'opacity-100' : 'opacity-70'}`}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-side-border p-3">
        {user ? (
          <div className="rounded-lg bg-side-elev p-2.5 ring-1 ring-side-border">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold">
                {user.fullName
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">{user.fullName}</div>
                <div className="truncate text-[10px] text-side-muted">{user.roles[0]?.replace(/_/g, ' ')}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="mt-2 w-full rounded-md bg-white/5 px-2 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex w-full items-center justify-center rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500"
          >
            Sign in
          </Link>
        )}
        <p className="mt-2 text-center text-[10px] text-side-muted/60">Synthetic · non-PHI</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 z-40 hidden h-screen w-[var(--sidebar-width)] shrink-0 lg:block">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink-950/50"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(100%,var(--sidebar-width))] shadow-2xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/90 backdrop-blur-md">
          <div className="flex h-[var(--header-h)] items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="ui-btn-secondary ui-btn-sm lg:hidden"
                onClick={() => setMobileOpen(true)}
              >
                Menu
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-2xs text-ink-400">
                  <span>{pageCrumb(pathname)}</span>
                  <span className="text-ink-300">/</span>
                  <span className="font-medium text-ink-600">{pageTitle(pathname)}</span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link href="/patients/new" className="ui-btn-primary ui-btn-sm hidden sm:inline-flex">
                New patient
              </Link>
              <span className="hidden items-center gap-1.5 rounded-md border border-ink-200 bg-ink-50 px-2 py-1 text-2xs font-medium text-ink-600 sm:inline-flex">
                <span className="ui-dot bg-emerald-500" />
                Demo
              </span>
              {user ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-2xs font-bold text-ink-700 ring-1 ring-ink-200">
                  {user.fullName
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
              ) : (
                <Link href="/login" className="ui-btn-secondary ui-btn-sm">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-6 sm:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
