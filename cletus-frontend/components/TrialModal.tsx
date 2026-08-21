'use client';
import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

interface TrialModalProps {
  open: boolean;
  onClose: () => void;
}

export default function TrialModal({ open, onClose }: TrialModalProps) {
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const [active, setActive] = useState(false);

  const activate = async () => {
    if (!publicKey) {
      setVisible(true);
      return;
    }
    try {
      // Backend call to start trial
      await fetch('/api/trial/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: publicKey?.toBase58() })
      });
      setActive(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (e) {
      console.error(e);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="glass max-w-md w-full rounded-3xl p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white text-xl"
        >
          ✕
        </button>
        <h2 className="text-3xl font-bold text-white">30-Day Free Trial</h2>
        <p className="text-white/70 mt-2">Full access to Live Chat, Scanner, and Trading</p>
        
        {active ? (
          <div className="mt-8 text-center text-emerald-500 font-semibold p-4 bg-emerald-500/10 rounded-2xl">
            ✓ Trial Activated Successfully!
          </div>
        ) : (
          <button onClick={activate} className="mt-8 w-full py-4 bg-emerald-500 hover:bg-emerald-600 transition-colors text-black rounded-3xl font-semibold">
            {publicKey ? 'Activate Trial' : 'Connect Wallet'}
          </button>
        )}
      </div>
    </div>
  );
}
