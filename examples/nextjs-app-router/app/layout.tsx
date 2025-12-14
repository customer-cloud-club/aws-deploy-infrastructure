import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { PlatformProvider } from '@/components/PlatformProvider';
import { Header } from '@/components/Header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Platform SDK Demo',
  description: 'Platform SDK integration example with Next.js App Router',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <PlatformProvider>
          <div className="min-h-screen bg-gray-50">
            <Header />
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>
        </PlatformProvider>
      </body>
    </html>
  );
}
