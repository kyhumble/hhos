import type { Metadata } from 'next';
import { Inter, Source_Sans_3 } from 'next/font/google';
import { AppShell } from '@/components/app-shell';
import './globals.css';

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const display = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Lumina — Home-based care OS',
  description:
    'AI-native operating system for home health and hospice. Clarity for every visit. Intelligence for every decision.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
