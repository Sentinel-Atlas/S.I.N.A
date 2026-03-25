import type { Metadata } from 'next';
import '@/styles/globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { StatusBar } from '@/components/layout/StatusBar';

export const metadata: Metadata = {
  title: 'S.I.N.A — Command Center',
  description: 'Personal Offline Command Center',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg-base text-text-primary">
        <Sidebar />
        <main
          className="ml-sidebar pb-statusbar min-h-screen"
          style={{ marginLeft: 'var(--sidebar-width)', paddingBottom: 'var(--statusbar-height)' }}
        >
          {children}
        </main>
        <StatusBar />
      </body>
    </html>
  );
}
