'use client';

/**
 * Community page — live chat + Dev Wallet Audit
 * Users converse; anyone can submit a developer wallet for audit.
 * Cletus reviews linked tokens/wallets and posts a community risk alert.
 * Black background, logo on every page.
 * Route: /app/community
 *
 * Note: Audit results are risk signals from public chain data — not legal findings.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type ChatMessage = {
  id: string;
  user: string;
  text: string;
  at: string;
  kind?: 'user' | 'system' | 'audit';
};

type AuditFinding = {
  label: string;
  detail: string;
  severity: 'info' | 'watch' | 'high';
};

type AuditResult = {
  wallet: string;
  status: 'clean' | 'watch' | 'high_risk' | 'unknown';
  summary: string;
  tokensCreated: number;
  relatedWallets: number;
  findings: AuditFinding[];
  announced: boolean;
  at: string;
};

/** Collective community PnL — all users gains net of losses */
type CollectivePnl = {
  netProfit: number;
  totalGains: number;
  totalLosses: number;
  activeUsers: number;
  updatedAt: string;
};

function shortAddr(a: string) {
  if (!a || a.length < 12) return a || '—';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function isLikelySolanaAddress(value: string) {
  const v = value.trim();
  // Base58-ish length for Solana pubkeys
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
}

export default function CommunityPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      user: 'Cletus',
      text: 'Community is live. Chat with other traders — and use Dev Wallet Audit below to check any developer address. Risk alerts post here for everyone.',
      at: new Date().toISOString(),
      kind: 'system',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [displayName, setDisplayName] = useState('Trader');
  const [auditWallet, setAuditWallet] = useState('');
  const [auditing, setAuditing] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [lastAudit, setLastAudit] = useState<AuditResult | null>(null);
  const [collective, setCollective] = useState<CollectivePnl>({
    netProfit: 0,
    totalGains: 0,
    totalLosses: 0,
    activeUsers: 0,
    updatedAt: '',
  });
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Collective profit ticker — all users net of losses
  useEffect(() => {
    async function loadCollective() {
      try {
        const res = await fetch('/api/community/collective-pnl');
        if (res.ok) {
          const data = await res.json();
          setCollective({
            netProfit: Number(data.netProfit) || 0,
            totalGains: Number(data.totalGains) || 0,
            totalLosses: Number(data.totalLosses) || 0,
            activeUsers: Number(data.activeUsers) || 0,
            updatedAt: data.updatedAt ?? new Date().toISOString(),
          });
        }
      } catch {
        // keep previous / zeros
      }
    }
    loadCollective();
    const t = setInterval(loadCollective, 15_000);
    return () => clearInterval(t);
  }, []);

  // Optional: poll community feed
  useEffect(() => {
    // Wire later: GET /api/community/messages
  }, []);

  const formatCollective = (n: number) => {
    const abs = Math.abs(n);
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs);
    return n >= 0 ? `+${formatted}` : `-${formatted}`;
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text) return;
    const name = displayName.trim() || 'Trader';
    const msg: ChatMessage = {
      id: `local-${Date.now()}`,
      user: name,
      text,
      at: new Date().toISOString(),
      kind: 'user',
    };
    setMessages((prev) => [...prev, msg]);
    setChatInput('');

    try {
      // Wire: POST /api/community/messages
      await fetch('/api/community/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: name, text }),
      });
    } catch {
      // keep local message
    }
  };

  const runAudit = useCallback(async () => {
    const wallet = auditWallet.trim();
    setAuditError('');
    if (!wallet) {
      setAuditError('Paste a developer wallet address.');
      return;
    }
    if (!isLikelySolanaAddress(wallet)) {
      setAuditError('That does not look like a Solana address. Check and try again.');
      return;
    }

    setAuditing(true);
    try {
      // Wire to backend / rugcheck / Helius / your graph:
      // POST /api/community/dev-audit { wallet }
      // Backend should: list tokens created, related wallets, known flags, then return structured result
      const res = await fetch('/api/community/dev-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet }),
      });

      let result: AuditResult;

      if (res.ok) {
        const data = await res.json();
        result = {
          wallet: data.wallet ?? wallet,
          status: data.status ?? 'unknown',
          summary: data.summary ?? 'Audit completed.',
          tokensCreated: data.tokensCreated ?? 0,
          relatedWallets: data.relatedWallets ?? 0,
          findings: Array.isArray(data.findings) ? data.findings : [],
          announced: data.announced !== false,
          at: data.at ?? new Date().toISOString(),
        };
      } else {
        // Graceful demo structure until API is live
        result = {
          wallet,
          status: 'unknown',
          summary:
            'Audit request sent. Connect /api/community/dev-audit to run full token + related-wallet analysis and community announce.',
          tokensCreated: 0,
          relatedWallets: 0,
          findings: [
            {
              label: 'API not wired',
              detail: 'Backend should scan launches, funding paths, and known risk lists.',
              severity: 'info',
            },
          ],
          announced: true,
          at: new Date().toISOString(),
        };
      }

      setLastAudit(result);

      // Announce to community chat
      const statusLabel =
        result.status === 'high_risk'
          ? 'HIGH RISK'
          : result.status === 'watch'
          ? 'WATCH'
          : result.status === 'clean'
          ? 'NO MAJOR FLAGS'
          : 'REVIEW';

      const auditMessage: ChatMessage = {
        id: `audit-${Date.now()}`,
        user: 'Cletus Audit',
        text: `Dev wallet audit · ${shortAddr(result.wallet)} · ${statusLabel}. Tokens linked: ${result.tokensCreated}. Related wallets: ${result.relatedWallets}. ${result.summary}`,
        at: result.at,
        kind: 'audit',
      };
      setMessages((prev) => [...prev, auditMessage]);
    } catch {
      setAuditError('Audit failed. Try again.');
    } finally {
      setAuditing(false);
    }
  }, [auditWallet]);

  const statusColor = (s: AuditResult['status']) => {
    if (s === 'high_risk') return 'text-red-400 border-red-500/40 bg-red-500/10';
    if (s === 'watch') return 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10';
    if (s === 'clean') return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
    return 'text-white/70 border-white/20 bg-white/5';
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Logo on every page */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Link href="/app" className="flex items-center gap-3">
            <Image
              src="/cletus-logo.png"
              alt="Cletus"
              width={40}
              height={40}
              className="object-contain"
              priority
            />
            <div>
              <div className="font-bold text-lg tracking-tight leading-none">Cletus</div>
              <div className="text-xs text-white/50 mt-0.5">Community</div>
            </div>
          </Link>
          <nav className="flex items-center gap-3 text-xs">
            <Link href="/app/signals" className="text-white/50 hover:text-white transition-colors">
              Signals
            </Link>
            <Link href="/app/chart" className="text-white/50 hover:text-white transition-colors">
              Chart
            </Link>
            <Link href="/app/wallet" className="text-white/50 hover:text-white transition-colors">
              Wallet
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Community</h1>
            <p className="text-sm text-white/50 mt-1">
              Talk with other users on the app — and run <strong className="text-white/70">Dev Wallet Audit</strong> so
              the whole community sees risk alerts.
            </p>
          </div>

          {/* Collective profit ticker — all users gains over losses */}
          <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
            <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Community collective PnL
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400/80 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            </div>
            <div className="relative overflow-hidden">
              <div className="animate-[marquee_28s_linear_infinite] flex whitespace-nowrap py-3.5 text-sm font-mono">
                <span className="inline-flex items-center gap-6 px-6">
                  <span>
                    Collective net:{' '}
                    <strong
                      className={
                        collective.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }
                    >
                      {formatCollective(collective.netProfit)}
                    </strong>
                  </span>
                  <span className="text-white/30">|</span>
                  <span>
                    All gains:{' '}
                    <strong className="text-emerald-400">
                      {formatCollective(collective.totalGains)}
                    </strong>
                  </span>
                  <span className="text-white/30">|</span>
                  <span>
                    All losses:{' '}
                    <strong className="text-red-400">
                      {formatCollective(-Math.abs(collective.totalLosses))}
                    </strong>
                  </span>
                  <span className="text-white/30">|</span>
                  <span className="text-white/50">
                    {collective.activeUsers} traders tracked
                  </span>
                  <span className="text-white/30">|</span>
                  <span className="text-white/40">
                    Profit he has gained for the community as a whole
                  </span>
                  {/* duplicate for seamless loop */}
                  <span className="text-white/30">|</span>
                  <span>
                    Collective net:{' '}
                    <strong
                      className={
                        collective.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }
                    >
                      {formatCollective(collective.netProfit)}
                    </strong>
                  </span>
                  <span className="text-white/30">|</span>
                  <span>
                    All gains:{' '}
                    <strong className="text-emerald-400">
                      {formatCollective(collective.totalGains)}
                    </strong>
                  </span>
                  <span className="text-white/30">|</span>
                  <span>
                    All losses:{' '}
                    <strong className="text-red-400">
                      {formatCollective(-Math.abs(collective.totalLosses))}
                    </strong>
                  </span>
                  <span className="text-white/30">|</span>
                  <span className="text-white/50">
                    {collective.activeUsers} traders tracked
                  </span>
                </span>
              </div>
            </div>
            <p className="px-4 py-2 text-[10px] text-white/25 border-t border-white/10">
              Net of all users on Cletus — total gains minus total losses. Not a guarantee of
              future results.
            </p>
          </div>

          <style jsx>{`
            @keyframes marquee {
              0% {
                transform: translateX(0);
              }
              100% {
                transform: translateX(-50%);
              }
            }
          `}</style>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Chat — 3 cols */}
            <section className="lg:col-span-3 flex flex-col rounded-xl border border-white/10 bg-[#0a0a0a] overflow-hidden min-h-[420px]">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-sm font-semibold">Live chat</span>
                <span className="text-xs text-emerald-400/80 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  On-site users
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[360px]">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      m.kind === 'audit'
                        ? 'border border-yellow-500/30 bg-yellow-500/5'
                        : m.kind === 'system'
                        ? 'border border-white/10 bg-white/5 text-white/70'
                        : 'bg-white/5'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <span
                        className={`font-semibold text-xs ${
                          m.kind === 'audit' ? 'text-yellow-400' : 'text-emerald-400/90'
                        }`}
                      >
                        {m.user}
                      </span>
                      <span className="text-[10px] text-white/30 font-mono">
                        {new Date(m.at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-white/85 leading-relaxed">{m.text}</p>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="p-3 border-t border-white/10 space-y-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.slice(0, 24))}
                  placeholder="Display name"
                  className="w-full text-xs px-3 py-2 rounded-lg bg-black border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendChat();
                      }
                    }}
                    placeholder="Message the community…"
                    className="flex-1 text-sm px-3 py-2.5 rounded-lg bg-black border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/40"
                  />
                  <button
                    type="button"
                    onClick={sendChat}
                    className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-white text-black hover:bg-white/90 transition-all"
                  >
                    Send
                  </button>
                </div>
              </div>
            </section>

            {/* Dev Wallet Audit — 2 cols */}
            <section className="lg:col-span-2 space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white/90">
                    Dev Wallet Audit
                  </h2>
                  <p className="text-xs text-white/50 mt-1.5 leading-relaxed">
                    Paste any <strong className="text-white/70">developer wallet</strong>. Cletus
                    checks tokens linked to that wallet, related addresses, and known risk
                    patterns — then <strong className="text-white/70">announces the result in community chat</strong> so
                    everyone on the site can see it.
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Developer wallet</label>
                  <input
                    type="text"
                    value={auditWallet}
                    onChange={(e) => {
                      setAuditWallet(e.target.value);
                      setAuditError('');
                    }}
                    placeholder="Solana address…"
                    className="w-full text-sm font-mono px-3 py-2.5 rounded-lg bg-black border border-white/15 text-white placeholder:text-white/30 focus:outline-none focus:border-yellow-500/40"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>

                {auditError && (
                  <p className="text-xs text-red-400">{auditError}</p>
                )}

                <button
                  type="button"
                  onClick={runAudit}
                  disabled={auditing}
                  className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
                    auditing
                      ? 'bg-white/10 text-white/40 cursor-wait'
                      : 'bg-yellow-500 text-black hover:bg-yellow-400'
                  }`}
                >
                  {auditing ? 'Auditing on-chain…' : 'Run audit & announce to community'}
                </button>

                <ul className="text-xs text-white/40 space-y-1 list-disc list-inside">
                  <li>Tokens created / launched from this wallet</li>
                  <li>Wallets ever associated (funding, authority, related)</li>
                  <li>Public risk signals (not a court judgment)</li>
                  <li>Result posted in community chat for all users</li>
                </ul>
              </div>

              {lastAudit && (
                <div className={`rounded-xl border p-5 space-y-3 ${statusColor(lastAudit.status)}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Last audit
                    </span>
                    <span className="text-xs font-mono">{shortAddr(lastAudit.wallet)}</span>
                  </div>
                  <p className="text-sm leading-relaxed">{lastAudit.summary}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="rounded-lg bg-black/30 px-3 py-2">
                      Tokens linked:{' '}
                      <strong>{lastAudit.tokensCreated}</strong>
                    </div>
                    <div className="rounded-lg bg-black/30 px-3 py-2">
                      Related wallets:{' '}
                      <strong>{lastAudit.relatedWallets}</strong>
                    </div>
                  </div>
                  {lastAudit.findings.length > 0 && (
                    <ul className="space-y-2">
                      {lastAudit.findings.map((f, i) => (
                        <li key={i} className="text-xs border-t border-white/10 pt-2">
                          <span className="font-semibold">{f.label}</span>
                          <span className="text-white/60"> — {f.detail}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {lastAudit.announced && (
                    <p className="text-xs opacity-80">Announced in community chat.</p>
                  )}
                </div>
              )}

              <p className="text-[11px] text-white/30 leading-relaxed">
                Audits use public blockchain data and heuristics. A “high risk” or scammer-style
                alert is a <strong className="text-white/40">community risk signal</strong>, not a
                legal determination. Always do your own research.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
