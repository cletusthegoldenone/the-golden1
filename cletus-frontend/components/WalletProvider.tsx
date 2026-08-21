'use client';

import { useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  TrustWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import '@solana/wallet-adapter-react-ui/styles.css';

const SOLANA_RPC =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

// Cast adapters to satisfy React 18 JSX types
const ConnProvider = ConnectionProvider as React.ComponentType<{
  endpoint: string;
  children: React.ReactNode;
}>;
const WalletAdapterProvider = WalletProvider as React.ComponentType<{
  wallets: (
    | InstanceType<typeof PhantomWalletAdapter>
    | InstanceType<typeof SolflareWalletAdapter>
    | InstanceType<typeof CoinbaseWalletAdapter>
    | InstanceType<typeof TrustWalletAdapter>
  )[];
  autoConnect?: boolean;
  children: React.ReactNode;
}>;
const ModalProvider = WalletModalProvider as React.ComponentType<{
  children: React.ReactNode;
}>;

export default function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new CoinbaseWalletAdapter(),
      new TrustWalletAdapter(),
    ],
    [],
  );

  return (
    <ConnProvider endpoint={SOLANA_RPC}>
      <WalletAdapterProvider wallets={wallets} autoConnect>
        <ModalProvider>{children}</ModalProvider>
      </WalletAdapterProvider>
    </ConnProvider>
  );
}
