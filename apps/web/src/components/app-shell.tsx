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
  if (pathname === '/') return 'Home';
  const map: Record<string, string> = {
    '/ai-assist': 'AI Assist',
    '/intake': 'Intake',
    '/oasis': 'Assessments',
    '/tasks': 'Care tasks',
    '/routing': 'Schedule',
    '/field-tasks': 'Visits',
    '/orders': 'Orders',
    '/hospice': 'Hospice',
    '/billing': 'Billing',
    '/admin': 'Team & settings',
    '/onboard': 'New agency',
    '/patients/new': 'Add patient',
  };
  for (const [k, v] of Object.entries(map)) {
    if (pathname === k || pathname.startsWith(`${k}/`)) return v;
  }
  if (pathname.startsWith('/patients/')) return 'Patient';
  if (pathname.startsWith('/episodes/')) return 'Episode';
  if (pathname.startsWith('/oasis/')) return 'Assessment';
  return 'Lumina';
}

function pageCrumb(pathname: string): string {
  if (pathname === '/') return 'Overview';
  if (
    pathname.startsWith('/ai-assist') ||
    pathname.startsWith('/intake') ||
    pathname.startsWith('/oasis') ||
    pathname.startsWith('/tasks')
  ) {
    return 'Care';
  }
  if (pathname.startsWith('/routing') || pathname.startsWith('/field')) return 'Field';
  if (
    pathname.startsWith('/orders') ||
    pathname.startsWith('/hospice') ||
    pathname.startsWith('/billing')
  ) {
    return 'Records';
  }
  if (pathname.startsWith('/admin') || pathname.startsWith('/onboard')) return 'Agency';
  return 'Lumina';
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
    <div className="flex h-full flex-col bg-[#0a1628] text-white">
      <div className="flex h-[var(--header-h)] items-center gap-3 border-b border-white/5 px-4">
        <div className="relative flex h-9 w-9 items-center justify-center">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 opacity-90" />
          <div className="relative text-[13px] font-bold tracking-tight text-white">L</div>
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[14px] font-semibold tracking-tight text-white">Lumina</div>
          <div className="truncate text-[10px] font-medium text-teal-400/80">Home-based care</div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
        {groups.map((group) => (
          <div key={group}>
            <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
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
                            ? 'bg-teal-600/90 text-white shadow-sm shadow-teal-900/40'
                            : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                        }`}
                      >
                        <NavIcon
                          name={iconForHref(item.href)}
                          className={`h-4 w-4 shrink-0 ${active ? 'opacity-100' : 'opacity-60'}`}
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

      <div className="border-t border-white/5 p-3">
        {user ? (
          <div className="rounded-xl bg-white/[0.03] p-2.5 ring-1 ring-white/5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-[10px] font-bold text-white">
                {user.fullName
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-slate-100">{user.fullName}</div>
                <div className="truncate text-[10px] capitalize text-slate-500">
                  {user.roles[0]?.replace(/_/g, ' ')}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="mt-2.5 w-full rounded-lg bg-white/[0.04] px-2 py-1.5 text-[11px] font-semibold text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex w-full items-center justify-center rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-500"
          >
            Sign in
          </Link>
        )}
        <p className="mt-2.5 text-center text-[10px] text-slate-600">Demo · sample data only</p>
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

      <div className="flex min-w-0 flex-1 flex-col bg-canvas">
        <header className="sticky top-0 z-30 border-b border-ink-200/80 bg-white/85 backdrop-blur-md">
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
                  <span className="font-medium text-ink-700">{pageTitle(pathname)}</span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link href="/ai-assist" className="ui-btn-primary ui-btn-sm hidden sm:inline-flex">
                AI Assist
              </Link>
              <Link
                href="/patients/new"
                className="ui-btn-secondary ui-btn-sm hidden md:inline-flex"
              >
                Add patient
              </Link>
              <span className="hidden items-center gap-1.5 rounded-full border border-teal-100 bg-teal-50 px-2.5 py-1 text-2xs font-medium text-teal-800 sm:inline-flex">
                <span className="ui-dot bg-teal-500" />
                Demo
              </span>
              {user ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-100 to-teal-200 text-2xs font-bold text-teal-800 ring-1 ring-teal-200/80">
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
