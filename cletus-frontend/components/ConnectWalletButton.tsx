'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

export default function ConnectWalletButton() {
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  if (connecting) {
    return (
      <div className="flex items-center gap-x-2 px-3 py-1.5 rounded-lg bg-trading-surface border border-trading-border text-xs text-gray-400">
        <div className="w-3 h-3 border-2 border-trading-green/40 border-t-trading-green rounded-full animate-spin" />
        <span>Connecting…</span>
      </div>
    );
  }

  if (publicKey) {
    const addr = publicKey.toBase58();
    return (
      <div className="flex items-center gap-x-2">
        <div className="flex items-center gap-x-1.5 px-3 py-1.5 rounded-lg bg-trading-green/10 border border-trading-green/30 text-xs font-mono text-trading-green">
          <span className="w-1.5 h-1.5 rounded-full bg-trading-green status-dot-live shrink-0" />
          <span>{addr.slice(0, 4)}…{addr.slice(-4)}</span>
        </div>
        <button
          onClick={disconnect}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-trading-surface border border-trading-border text-gray-400 hover:text-white hover:border-trading-red/40 transition-all"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setVisible(true)}
      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-trading-green text-black hover:bg-trading-green/90 active:scale-[0.97] transition-all"
    >
      Connect Wallet
    </button>
  );
}
