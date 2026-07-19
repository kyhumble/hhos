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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const bare =
    pathname.startsWith('/sign/') || pathname === '/login' || pathname === '/invite';

  useEffect(() => {
    // Prefer cached user immediately, then validate token with /v1/me
    setUser(getStoredUser());
    void loadSessionUser().then((u) => setUser(u));
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const nav = useMemo(() => navForUser(user), [user]);
  const groups = useMemo(() => [...new Set(nav.map((n) => n.group))], [nav]);

  if (bare) {
    return <div className="min-h-screen">{children}</div>;
  }

  function logout() {
    clearSession();
    setUser(null);
    window.location.href = '/login';
  }

  const sidebar = (
    <div className="relative flex h-full flex-col overflow-hidden bg-sidebar-lux text-white shadow-sidebar">
      <div className="pointer-events-none absolute inset-0 bg-hero-shine opacity-60" />
      <div className="pointer-events-none absolute -right-16 top-24 h-48 w-48 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 bottom-20 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-sm font-bold tracking-tight text-white shadow-glow ring-1 ring-white/25 backdrop-blur">
          HH
        </div>
        <div className="min-w-0">
          <div className="truncate font-display text-[15px] font-bold tracking-tight text-white">
            HHOS
          </div>
          <div className="truncate text-[11px] font-medium text-brand-100/70">
            Home Health · Hospice
          </div>
        </div>
      </div>

      <nav className="relative flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {groups.map((group) => (
          <div key={group}>
            <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
              {group}
            </div>
            <ul className="space-y-1">
              {nav
                .filter((n) => n.group === group)
                .map((item) => {
                  const active = navActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition duration-150 ${
                          active
                            ? 'bg-white text-brand-900 shadow-lg shadow-black/10'
                            : 'text-white/75 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                            active
                              ? 'bg-brand-600 text-white shadow-sm'
                              : 'bg-white/10 text-white/80 group-hover:bg-white/15'
                          }`}
                        >
                          <NavIcon name={iconForHref(item.href)} className="h-[15px] w-[15px]" />
                        </span>
                        <span className="truncate">{item.label}</span>
                        {active && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />
                        )}
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="relative border-t border-white/10 p-4">
        {user ? (
          <div className="rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/15 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-300 to-brand-600 text-xs font-bold text-white shadow-sm">
                {user.fullName
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{user.fullName}</div>
                <div className="truncate text-[11px] text-white/55">{user.email}</div>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1">
              {user.roles.slice(0, 2).map((r) => (
                <span
                  key={r}
                  className="rounded-md bg-black/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-100"
                >
                  {r.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={logout}
              className="mt-3 w-full rounded-xl bg-white/10 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex w-full items-center justify-center rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-brand-800 shadow-glow transition hover:bg-brand-50"
          >
            Sign in
          </Link>
        )}
        <p className="mt-3 px-1 text-center text-[10px] leading-relaxed text-white/30">
          Synthetic data only · Not production PHI
        </p>
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
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(100%,var(--sidebar-width))] shadow-2xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — desktop + mobile */}
        <header className="sticky top-0 z-30 border-b border-ink-200/60 bg-white/75 backdrop-blur-xl">
          <div className="mx-auto flex h-[var(--header-h)] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="ui-btn-secondary ui-btn-sm lg:hidden"
                onClick={() => setMobileOpen(true)}
              >
                Menu
              </button>
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-semibold text-ink-950 sm:text-base">
                  {pageTitle(pathname)}
                </div>
                <div className="hidden text-[11px] text-ink-400 sm:block">
                  Home Health Operating System
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 sm:inline-flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Demo · synthetic
              </span>
              {user ? (
                <div className="hidden items-center gap-2 rounded-full border border-ink-200 bg-white py-1 pl-1 pr-3 shadow-sm md:flex">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                    {user.fullName
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                  <span className="max-w-[8rem] truncate text-xs font-semibold text-ink-800">
                    {user.fullName.split(' ')[0]}
                  </span>
                </div>
              ) : (
                <Link href="/login" className="ui-btn-primary ui-btn-sm">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
          {children}
        </main>

        <footer className="border-t border-ink-200/50 py-4 text-center text-[11px] text-ink-400">
          HHOS · HIPAA-by-design · Phases 0–9 platform
        </footer>
      </div>
    </div>
  );
}
