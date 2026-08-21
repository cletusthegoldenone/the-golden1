'use client';

import SolanaWalletProvider from '@/components/WalletProvider';

/**
 * Root-level client providers.
 * Wrapping here means wallet context is available on every page,
 * including the landing page navbar.
 */
export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return <SolanaWalletProvider>{children}</SolanaWalletProvider>;
}
