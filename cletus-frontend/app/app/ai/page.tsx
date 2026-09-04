'use client';

/**
 * Cletus AI page — text chat + Cletus Live (voice) + 8 token signals
 * Black background, logo on every page. Signals quote: USDC.
 * Route: /app/ai
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  includeInHistory?: boolean;
};

type TokenSignal = {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  score: number;
  change24h: number;
  note: string;
};

type ApiSignal = Partial<{
  id: string;
  base: string;
  symbol: string;
  tokenName: string;
  side: 'LONG' | 'SHORT' | string;
  direction: 'LONG' | 'SHORT' | string;
  score: number | string;
  compositeScore: number;
  change24h: number | string;
  priceChange24h: number;
  signals: string[];
  strength: 'WEAK' | 'MODERATE' | 'STRONG' | 'EXTREME';
}>;

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toText(value: unknown, fallback = '???') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function pickSymbol(s: ApiSignal) {
  const direct = toText(s.base ?? s.symbol, '');
  if (direct) return direct.toUpperCase();

  const fromTokenName = toText(s.tokenName, '');
  if (/^[a-z0-9$._-]{1,12}$/i.test(fromTokenName)) {
    return fromTokenName.toUpperCase();
  }

  return '???';
}

const FALLBACK_SIGNALS: TokenSignal[] = [
  { id: '1', symbol: 'SOL', side: 'LONG', score: 88, change24h: 4.2, note: 'Momentum · volume up' },
  { id: '2', symbol: 'BONK', side: 'LONG', score: 81, change24h: 12.5, note: 'Breakout watch' },
  { id: '3', symbol: 'WIF', side: 'SHORT', score: 64, change24h: -3.1, note: 'Fade into resistance' },
  { id: '4', symbol: 'JUP', side: 'LONG', score: 79, change24h: 2.8, note: 'Steady bid' },
  { id: '5', symbol: 'RAY', side: 'LONG', score: 72, change24h: 1.4, note: 'Range high test' },
  { id: '6', symbol: 'ORCA', side: 'SHORT', score: 58, change24h: -1.9, note: 'Weak relative to SOL' },
  { id: '7', symbol: 'PYTH', side: 'LONG', score: 75, change24h: 5.6, note: 'Narrative + flow' },
  { id: '8', symbol: 'W', side: 'LONG', score: 70, change24h: 0.9, note: 'Hold above support' },
];

const MAX_CHAT_HISTORY_TURNS = 20;

function buildConversationHistory(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.includeInHistory !== false && message.content.trim())
    .slice(-MAX_CHAT_HISTORY_TURNS)
    .map(({ role, content }) => ({
      role,
      content: content.trim(),
    }));
}

export default function CletusAIPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hey — I'm Cletus. Ask me about Solana tokens, signals, risk, or your setup. I'm software, not a human advisor. Trading can lose money.",
      includeInHistory: false,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [signals, setSignals] = useState<TokenSignal[]>(FALLBACK_SIGNALS);
  const [liveOn, setLiveOn] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'idle' | 'listening' | 'speaking' | 'error'>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  const liveStatusRef = useRef(liveStatus);
  const voiceRequestInFlightRef = useRef(false);
  const recognitionActiveRef = useRef(false);
  const resumeRecognitionAfterSpeechRef = useRef(false);
  const suppressRecognitionRestartRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const liveOnRef = useRef(false);

  useEffect(() => { liveOnRef.current = liveOn; }, [liveOn]);
  useEffect(() => { liveStatusRef.current = liveStatus; }, [liveStatus]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const restartRecognitionIfNeeded = useCallback(() => {
    if (
      !recognitionRef.current ||
      !liveOnRef.current ||
      voiceRequestInFlightRef.current ||
      liveStatusRef.current === 'speaking' ||
      recognitionActiveRef.current
    ) {
      return;
    }

    try {
      recognitionRef.current.start();
    } catch {
      // ignore restart race
    }
  }, []);

  const appendMessage = useCallback((message: ChatMessage) => {
    const next = [...messagesRef.current, message];
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const queueUserMessage = useCallback((content: string) => {
    const userMessage: ChatMessage = { role: 'user', content };
    const nextMessages = [...messagesRef.current, userMessage];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);

    return {
      history: buildConversationHistory(nextMessages).slice(0, -1),
      userMessage,
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load 8 token signals for this page

  useEffect(() => {
    async function loadSignals() {
      try {
        const res = await fetch('/api/signals?quote=USDC&limit=8');
        if (res.ok) {
          const data = await res.json();
          const list = (data.signals ?? []).slice(0, 8).map((s: ApiSignal, i: number) => {
            const rawScore = toNumber(s.score ?? s.compositeScore);
            const tags = Array.isArray((s as { signals?: unknown }).signals)
              ? ((s as { signals: unknown[] }).signals.filter(
                  (x): x is string => typeof x === 'string',
                ) ?? [])
              : [];

            return {
              id: s.id ?? String(i),
              symbol: pickSymbol(s),
              side: (s.side === 'SHORT' || s.direction === 'SHORT' ? 'SHORT' : 'LONG') as
                | 'LONG'
                | 'SHORT',
              score:
                rawScore >= 0 && rawScore <= 1
                  ? Math.round(rawScore * 100)
                  : Math.round(rawScore),
              change24h: toNumber(s.change24h ?? s.priceChange24h),
              note: tags.length ? tags.join(' · ') : s.strength ?? 'Signal',
            };
          });
          if (list.length) setSignals(list);
        }
      } catch {
        // keep fallback 8
      }
    }
    loadSignals();
    const t = setInterval(loadSignals, 30_000);
    return () => clearInterval(t);
  }, []);

  const sendChat = async () => {
    const text = input.trim();
    if (!text || loading || voiceRequestInFlightRef.current) return;
    setInput('');
    const { history } = queueUserMessage(text);
    setLoading(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
        }),
      });
      const data = await res.json();
      appendMessage({
        role: 'assistant',
        content: data.answer ?? data.message ?? 'Something went wrong. Try again.',
      });
    } catch {
      appendMessage({ role: 'assistant', content: 'Connection error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const speak = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.onstart = () => setLiveStatus('speaking');
    u.onend = () => {
      if (liveOnRef.current) {
        setLiveStatus('listening');
        if (voiceRequestInFlightRef.current) {
          resumeRecognitionAfterSpeechRef.current = true;
          return;
        }
        restartRecognitionIfNeeded();
      } else {
        setLiveStatus('idle');
      }
    };
    window.speechSynthesis.speak(u);
    return true;
  };

  const stopLive = useCallback(() => {
    setLiveOn(false);
    liveOnRef.current = false;
    setLiveStatus('idle');
    setLiveTranscript('');
    voiceRequestInFlightRef.current = false;
    resumeRecognitionAfterSpeechRef.current = false;
    suppressRecognitionRestartRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const startLive = useCallback(() => {
    const SR =
      typeof window !== 'undefined'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
        : null;
    if (!SR) {
      setLiveStatus('error');
      setLiveTranscript('Voice not supported in this browser. Use text chat.');
      return;
    }

    setLiveOn(true);
    liveOnRef.current = true;
    setLiveStatus('listening');
    setLiveTranscript('Listening… speak to Cletus');

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onstart = () => {
      recognitionActiveRef.current = true;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = async (event: any) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += piece;
      }
      if (!finalText.trim()) return;
      if (voiceRequestInFlightRef.current) return;

      setLiveTranscript(finalText.trim());
      setLiveStatus('speaking');
      voiceRequestInFlightRef.current = true;
      suppressRecognitionRestartRef.current = true;
      try {
        recognition.stop();
      } catch {
        // ignore stop race
      }

      const userLine = finalText.trim();
      const { history } = queueUserMessage(userLine);
      let shouldRestartListening = false;

      try {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userLine, history, voice: true }),
        });
        const data = await res.json();
        const answer =
          data.answer ?? data.message ?? "I didn't catch that. Try again.";
        appendMessage({ role: 'assistant', content: answer });
        const didSpeak = speak(answer);
        if (!didSpeak && liveOnRef.current) {
          setLiveStatus('listening');
          shouldRestartListening = true;
        }
      } catch {
        const fail = 'Connection error on voice. Try text chat.';
        appendMessage({ role: 'assistant', content: fail });
        const didSpeak = speak(fail);
        if (!didSpeak && liveOnRef.current) {
          setLiveStatus('listening');
          shouldRestartListening = true;
        }
      } finally {
        voiceRequestInFlightRef.current = false;
        if (shouldRestartListening || resumeRecognitionAfterSpeechRef.current) {
          resumeRecognitionAfterSpeechRef.current = false;
          restartRecognitionIfNeeded();
        }
      }
    };

    recognition.onerror = () => {
      setLiveStatus('error');
      setLiveTranscript('Mic error — check permissions or use text chat.');
      voiceRequestInFlightRef.current = false;
      resumeRecognitionAfterSpeechRef.current = false;
      liveOnRef.current = false;
      setLiveOn(false);
      suppressRecognitionRestartRef.current = true;
    };

    recognition.onend = () => {
    recognitionActiveRef.current = false;
    if (suppressRecognitionRestartRef.current) {
      suppressRecognitionRestartRef.current = false;
      return;
    }
    if (
      recognitionRef.current &&
      liveOnRef.current &&
      !voiceRequestInFlightRef.current &&
      liveStatusRef.current !== 'speaking'
    ) {
      restartRecognitionIfNeeded();
    }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setLiveStatus('error');
    }
  }, [appendMessage, queueUserMessage, restartRecognitionIfNeeded]);


  useEffect(() => {
    return () => stopLive();
  }, [stopLive]);

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
              <div className="text-xs text-white/50 mt-0.5">Talk · Live · Signals</div>
            </div>
          </Link>
          <nav className="flex items-center gap-3 text-xs">
            <Link href="/app/signals" className="text-white/50 hover:text-white transition-colors">
              Signals
            </Link>
            <Link href="/app/community" className="text-white/50 hover:text-white transition-colors">
              Community
            </Link>
            <Link href="/app/chart" className="text-white/50 hover:text-white transition-colors">
              Chart
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Talk to Cletus</h1>
            <p className="text-sm text-white/50 mt-1">
              Text chat · <strong className="text-white/70">Cletus Live</strong> voice · his top{' '}
              <strong className="text-white/70">8 token signals</strong> (USDC)
            </p>
          </div>

          {/* 8 token signals from Cletus */}
          <section className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Cletus token signals · 8
              </h2>
              <span className="text-xs font-mono text-emerald-400/80">USDC</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {signals.slice(0, 8).map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-white/10 bg-black/50 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm font-mono">{s.symbol}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        s.side === 'LONG'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-red-500/15 text-red-400'
                      }`}
                    >
                      {s.side}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs font-mono">
                    <span className="text-white/50">Score {s.score}</span>
                    <span
                      className={s.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}
                    >
                      {s.change24h >= 0 ? '+' : ''}
                      {s.change24h.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-white/40 mt-1 truncate">{s.note}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Text chat */}
            <section className="lg:col-span-3 flex flex-col rounded-xl border border-white/10 bg-[#0a0a0a] overflow-hidden min-h-[420px]">
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <span className="text-lg">🤖</span>
                <div>
                  <div className="text-sm font-semibold">Chat with Cletus</div>
                  <div className="text-xs text-white/40">Text · not financial advice</div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[340px]">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-emerald-500 text-black rounded-br-md'
                          : 'bg-white/10 text-white/90 rounded-bl-md'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white/10 rounded-2xl px-4 py-3 text-xs text-white/40">
                      Cletus is thinking…
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-3 border-t border-white/10 flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendChat();
                    }
                  }}
                  placeholder="Ask Cletus anything…"
                  className="flex-1 text-sm px-3 py-2.5 rounded-xl bg-black border border-white/15 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/40"
                />
                <button
                  type="button"
                  onClick={sendChat}
                  disabled={loading || voiceRequestInFlightRef.current || !input.trim()}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-white/90 disabled:opacity-40 transition-all"
                >
                  Send
                </button>
              </div>
            </section>

            {/* Cletus Live — voice */}
            <section className="lg:col-span-2 space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎙️</span>
                  <div>
                    <h2 className="text-sm font-bold">Cletus Live</h2>
                    <p className="text-xs text-white/50">Voice conversation</p>
                  </div>
                </div>

                <div
                  className={`rounded-xl border p-4 text-center ${
                    liveStatus === 'listening'
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : liveStatus === 'speaking'
                      ? 'border-yellow-500/40 bg-yellow-500/10'
                      : liveStatus === 'error'
                      ? 'border-red-500/40 bg-red-500/10'
                      : 'border-white/10 bg-black/40'
                  }`}
                >
                  <div className="text-3xl mb-2">
                    {liveStatus === 'listening'
                      ? '👂'
                      : liveStatus === 'speaking'
                      ? '🗣️'
                      : liveStatus === 'error'
                      ? '⚠️'
                      : '🪿'}
                  </div>
                  <div className="text-xs font-mono uppercase tracking-wider text-white/50">
                    {liveStatus === 'idle' && 'Ready'}
                    {liveStatus === 'listening' && 'Listening'}
                    {liveStatus === 'speaking' && 'Cletus speaking'}
                    {liveStatus === 'error' && 'Unavailable'}
                  </div>
                  {liveTranscript && (
                    <p className="text-sm text-white/70 mt-2 leading-relaxed">
                      {liveTranscript}
                    </p>
                  )}
                </div>

                {!liveOn ? (
                  <button
                    type="button"
                    onClick={startLive}
                    className="w-full py-3 rounded-xl text-sm font-semibold bg-emerald-500 text-black hover:bg-emerald-400 transition-all"
                  >
                    Start Cletus Live
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopLive}
                    className="w-full py-3 rounded-xl text-sm font-semibold border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    End voice session
                  </button>
                )}

                <p className="text-[11px] text-white/35 leading-relaxed">
                  Uses your browser mic and speech APIs. Allow microphone access when prompted.
                  Voice replies also appear in the text chat. Not financial advice.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/45 leading-relaxed">
                Cletus is software. Signals and chat are educational. You can lose money trading.
                Confirm anything important yourself.
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
