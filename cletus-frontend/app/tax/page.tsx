'use client';

/**
 * Page 2 — Tax Center registration + 30-day free trial
 * Black background, logo on page. After register → Cletus wallet.
 * Route: /tax
 */

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function TaxCenterRegisterPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullLegalName: '',
    email: '',
    country: '',
    taxId: '',
    acknowledgeTaxResponsibility: false,
    acknowledgeReporting: false,
    acknowledgeTrial: false,
  });

  const canSubmit =
    form.fullLegalName.trim().length > 1 &&
    form.email.includes('@') &&
    form.country.trim().length > 1 &&
    form.acknowledgeTaxResponsibility &&
    form.acknowledgeReporting &&
    form.acknowledgeTrial &&
    !submitting;

  const update = (key: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');

    try {
      // Wire to Golden1: register + start trial
      // POST /api/register, tax profile, trial start
      router.push('/app/wallet');
    } catch {
      setError('Registration failed. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          {/* Logo — every page */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 relative mb-3">
              <Image
                src="/cletus-logo.png"
                alt="Cletus"
                width={80}
                height={80}
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Tax Center</h1>
            <p className="text-sm text-white/50 mt-1 text-center">
              Register · Start free trial · Unlock your Cletus wallet
            </p>
          </div>

          {/* FREE TRIAL BANNER */}
          <div className="mb-6 rounded-xl border-2 border-emerald-500/60 bg-emerald-500/10 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎁</span>
              <div>
                <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wide">
                  30-Day Free Trial
                </h2>
                <p className="text-sm text-white/80 mt-1 leading-relaxed">
                  When you register, your <strong className="text-white">30-day unlimited trial</strong>{' '}
                  starts. No stake required during the trial. After registration you get access to
                  your own <strong className="text-white">Cletus wallet</strong> and can use the app
                  under trial terms.
                </p>
                <ul className="mt-2 text-xs text-emerald-300/90 space-y-1 list-disc list-inside">
                  <li>Full access during the 30-day trial</li>
                  <li>Your Cletus wallet is created after you register</li>
                  <li>After trial: stake / weekly pass rules apply (see app policy)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border border-white/10 rounded-xl p-5 mb-6 bg-white/5 text-sm text-white/80 space-y-3">
            <p>
              <strong className="text-white">Why register here.</strong> If you make enough
              profit, you may need tax reporting. The Tax Center stores your registration so
              we can support history exports and, where applicable, tax-form related notices.
            </p>
            <p>
              <strong className="text-white">After you register</strong> your trial begins and
              you unlock your <strong className="text-white">Cletus wallet</strong>.
            </p>
            <p className="text-white/50">
              Cletus does <strong className="text-white/70">not</strong> provide tax or legal
              advice. You are responsible for your own filings.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Full legal name
              </label>
              <input
                type="text"
                required
                value={form.fullLegalName}
                onChange={(e) => update('fullLegalName', e.target.value)}
                className="w-full border border-white/15 rounded-xl px-4 py-3 text-sm bg-black text-white focus:outline-none focus:border-white/40 placeholder:text-white/30"
                placeholder="As it appears on official documents"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className="w-full border border-white/15 rounded-xl px-4 py-3 text-sm bg-black text-white focus:outline-none focus:border-white/40 placeholder:text-white/30"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Country of tax residence
              </label>
              <input
                type="text"
                required
                value={form.country}
                onChange={(e) => update('country', e.target.value)}
                className="w-full border border-white/15 rounded-xl px-4 py-3 text-sm bg-black text-white focus:outline-none focus:border-white/40 placeholder:text-white/30"
                placeholder="e.g. United States"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Tax ID (optional)
              </label>
              <input
                type="text"
                value={form.taxId}
                onChange={(e) => update('taxId', e.target.value)}
                className="w-full border border-white/15 rounded-xl px-4 py-3 text-sm bg-black text-white focus:outline-none focus:border-white/40 placeholder:text-white/30"
                placeholder="Only if you choose to provide it"
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.acknowledgeTaxResponsibility}
                onChange={(e) => update('acknowledgeTaxResponsibility', e.target.checked)}
                className="mt-1 h-4 w-4 accent-emerald-500"
              />
              <span className="text-sm text-white/80">
                I am solely responsible for taxes on any profits. Cletus does not file taxes
                for me or give tax advice.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.acknowledgeReporting}
                onChange={(e) => update('acknowledgeReporting', e.target.checked)}
                className="mt-1 h-4 w-4 accent-emerald-500"
              />
              <span className="text-sm text-white/80">
                If I make enough profit, I may need tax forms in my country and may use the Tax
                Center to export history or receive form-related notices where supported.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.acknowledgeTrial}
                onChange={(e) => update('acknowledgeTrial', e.target.checked)}
                className="mt-1 h-4 w-4 accent-emerald-500"
              />
              <span className="text-sm text-white/80">
                I understand my <strong className="text-white">30-day free trial</strong> starts
                when I register, that I will receive a Cletus wallet after registration, and
                that post-trial stake or weekly pass rules may apply.
              </span>
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all ${
                canSubmit
                  ? 'bg-white text-black hover:bg-white/90'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              {submitting
                ? 'Starting trial…'
                : 'Register · Start 30-Day Trial · Open Cletus Wallet'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-white/30">
            Educational tooling only. Not tax, legal, or investment advice. Trading involves
            risk of loss.
          </p>
        </div>
      </main>
    </div>
  );
}
