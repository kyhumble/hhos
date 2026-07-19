import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HHOS — Home Health OS',
  description: 'HIPAA-by-design home health operating system (Phase 0 scaffold)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-sm font-bold text-white">
                  HH
                </div>
                <div>
                  <div className="text-sm font-semibold tracking-tight">HHOS</div>
                  <div className="text-xs text-slate-500">Multi-tenant · Synthetic data only</div>
                </div>
              </div>
              <nav className="flex flex-wrap gap-3 text-sm text-slate-600">
                <a className="hover:text-brand-700" href="/">
                  Dashboard
                </a>
                <a className="hover:text-brand-700" href="/intake">
                  Intake
                </a>
                <a className="hover:text-brand-700" href="/oasis">
                  OASIS
                </a>
                <a className="hover:text-brand-700" href="/routing">
                  Routing
                </a>
                <a className="hover:text-brand-700" href="/field-tasks">
                  Field tasks
                </a>
                <a className="hover:text-brand-700" href="/orders">
                  Orders / 485
                </a>
                <a className="hover:text-brand-700" href="/tasks">
                  Clinical tasks
                </a>
                <a className="hover:text-brand-700" href="/admin">
                  Admin
                </a>
                <a className="hover:text-brand-700" href="/onboard">
                  Onboard
                </a>
                <a className="hover:text-brand-700" href="/login">
                  Login
                </a>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
