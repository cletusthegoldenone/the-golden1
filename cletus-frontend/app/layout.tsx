import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cletus — Autonomous Trading System',
  description:
    'Jupiter-native Solana trading super app. Signals in USDC. Policy gates. Personal PnL. Community audits.',
};

export const viewport: Viewport = {
  themeColor: '#000000',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
