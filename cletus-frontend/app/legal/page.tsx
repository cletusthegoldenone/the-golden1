'use client';

/**
 * Page 1 — Legal gate (first page)
 * Full black background, Cletus logo, disclaimer, own-volition acceptance.
 * Route: /legal  (or use as / before any app access)
 */

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function LegalEntryPage() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleEnter = async () => {
    if (!accepted || submitting) return;
    setSubmitting(true);

    try {
      // Wire to Golden1: POST /api/legal/accept
      // await fetch('/api/legal/accept', { method: 'POST', ... });

      router.push('/tax');
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          {/* Logo — every page */}
          <div className="flex flex-col items-center mb-10">
            <div className="w-28 h-28 relative mb-4">
              <Image
                src="/cletus-logo.png"
                alt="Cletus"
                width={112}
                height={112}
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Cletus</h1>
            <p className="text-sm text-white/50 mt-1">Autonomous Trading System</p>
          </div>

          <h2 className="text-xl font-semibold text-center mb-6">
            Disclaimer & Entry Acknowledgment
          </h2>

          <div className="border border-white/10 rounded-xl p-6 space-y-4 text-sm leading-relaxed text-white/80 bg-white/5">
            <p>
              <strong className="text-white">What Cletus is.</strong> Cletus is an
              autonomous, AI-assisted trading software system for Solana and related
              digital assets. It is a machine that scans markets, evaluates signals, and
              can execute or recommend trades under rules you configure. Cletus is{' '}
              <strong className="text-white">not</strong> a human, not a licensed financial
              advisor, not a broker-dealer, and not a fund manager.
            </p>

            <p>
              <strong className="text-white">Your entry is voluntary.</strong> By
              continuing, you confirm that you are entering this website and application{' '}
              <strong className="text-white">on your own volition</strong>. No one is
              requiring you to use Cletus. You may leave at any time before accepting.
            </p>

            <p>
              <strong className="text-white">Risks you must understand.</strong>{' '}
              Cryptocurrency and automated trading involve a high risk of loss, including
              the possible loss of all capital you put at risk. Markets are volatile. Past
              results do not predict future performance. Software can fail, APIs can go
              down, and strategies can underperform or lose money.
            </p>

            <p>
              <strong className="text-white">No guarantees.</strong> Nothing on this site
              or in the application is a promise of profit, income, or specific results.
              Cletus does not guarantee returns, win rates, or protection from loss.
            </p>

            <p>
              <strong className="text-white">Not advice.</strong> Content, signals, AI
              chat, and automation are for informational and educational purposes only.
              They are not legal, tax, or investment advice. You are solely responsible
              for your decisions and for any trades placed with your wallets or accounts.
            </p>

            <p>
              <strong className="text-white">Eligibility.</strong> You represent that you
              are of legal age in your jurisdiction and that using this software is lawful
              where you live. You are responsible for complying with applicable laws and
              regulations.
            </p>

            <p>
              <strong className="text-white">If you accept and enter,</strong> you confirm
              that you have read this disclaimer, that you clearly understand the risks,
              and that you still choose to proceed into the Cletus website and application
              at your own risk.
            </p>
          </div>

          <label className="mt-8 flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 accent-emerald-500"
            />
            <span className="text-sm text-white/80">
              I have read this disclaimer. I am entering on my own volition. I understand
              the risks of autonomous crypto trading, including possible total loss of
              capital, and I accept those risks if I continue.
            </span>
          </label>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleEnter}
              disabled={!accepted || submitting}
              className={`flex-1 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                accepted && !submitting
                  ? 'bg-white text-black hover:bg-white/90'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              {submitting ? 'Entering…' : 'I Understand the Risks — Enter Cletus'}
            </button>
            <a
              href="https://google.com"
              className="flex-1 py-3.5 rounded-xl text-sm font-medium text-center border border-white/20 text-white/70 hover:bg-white/5 transition-all"
            >
              Leave
            </a>
          </div>

          <p className="mt-6 text-center text-xs text-white/30">
            Educational software only. Not financial, legal, or tax advice.
          </p>
        </div>
      </main>
    </div>
  );
}
