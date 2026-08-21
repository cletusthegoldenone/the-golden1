import type { Metadata, Viewport } from 'next';
import ClientProviders from '@/components/ClientProviders';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cletus | AI Autonomous Trader',
  description:
    'Cletus is an AI-powered autonomous trading system for Solana tokens. Real-time signals, automated execution, and free full access for all users.',
  keywords: ['Solana', 'AI Trading', 'Autonomous Trader', 'DeFi', 'Crypto'],
  authors: [{ name: 'Cletus AI' }],
  openGraph: {
    title: 'Cletus | AI Autonomous Trader',
    description: 'AI-powered autonomous trading system for Solana',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0b0d',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
