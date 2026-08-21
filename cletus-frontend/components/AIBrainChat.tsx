'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage } from '@/types';

const TOPIC_CHIPS = [
  { label: '📊 Economics', starter: 'Explain how the Federal Reserve uses interest rates to control inflation' },
  { label: '📒 Accounting', starter: 'Walk me through how to read a company\'s balance sheet' },
  { label: '🏢 Business', starter: 'Explain Porter\'s Five Forces and how I can use them to analyze a company' },
  { label: '📈 Stocks', starter: 'Explain the key stock valuation metrics like P/E, EV/EBITDA, and how to use them' },
  { label: '⚙️ Options', starter: 'Explain options Greeks — delta, gamma, theta, vega — in simple terms' },
  { label: '💼 Portfolio', starter: 'Explain Modern Portfolio Theory and the Sharpe ratio' },
  { label: '⚡ Solana DeFi', starter: 'How does Cletus score and rank Solana tokens for trading?' },
  { label: '🛡️ Risk', starter: 'What are the best risk management strategies for trading volatile assets?' },
];

const SUGGESTED_QUESTIONS = [
  'What causes a yield curve inversion and why does it predict recessions?',
  'Explain how DCF valuation works step by step',
  'What is the difference between a call and put option?',
  'How do I calculate a company\'s intrinsic value?',
  'What is the Kelly Criterion and how is it used in trading?',
  'Explain competitive moats — what makes a business defensible?',
  'What is your current trading strategy for Solana tokens?',
  'How do you detect rug pulls before they happen?',
];

const CLETUS_RESPONSES: Record<string, { content: string; citations?: string[] }> = {
  strategy: {
    content: `My current trading strategy focuses on **momentum-based entry** on Solana tokens with the following criteria:

**Signal Requirements:**
- Composite score ≥ 65/100
- Market cap: $10K–$500K (sweet spot for asymmetric returns)
- Volume/MCap ratio ≥ 0.3 (healthy liquidity)
- RSI between 45–70 (not overbought)
- MACD crossover confirmation

**Risk Management:**
- Max 2% of portfolio per trade
- Stop loss: 8–15% below entry
- Take profit: 25–50% above entry
- Never FOMO — patience is the edge

⚠️ *This is not financial advice. All trading involves risk.*`,
    citations: ['TRADING_PARAMETERS.env', 'TRADING_PARAMETERS_GUIDE.md'],
  },
  signals: {
    content: `My **composite signal score** is calculated from 8 independent indicators:

| Indicator | Weight | Description |
|-----------|--------|-------------|
| Volume Spike | 20% | Unusual volume vs 7-day average |
| Momentum | 18% | Price velocity over 1h/4h |
| Breakout | 17% | Key resistance level breaks |
| RSI Signal | 15% | Divergence and oversold recovery |
| MACD Cross | 12% | Signal line crossovers |
| Holder Growth | 8% | New wallet growth rate |
| Liquidity Score | 6% | DEX liquidity depth |
| Social Sentiment | 4% | On-chain social signals |

**Strength Tiers:**
- 🔴 EXTREME (85+): High conviction, larger position
- 🟢 STRONG (72+): Standard execution
- 🟡 MODERATE (60+): Reduced size, tight stops
- ⚪ WEAK (<60): Watchlist only`,
    citations: ['TRADING_PARAMETERS.env#signal-weights'],
  },
  risk: {
    content: `**Risk Management Framework:**

**Position Sizing:**
- Kelly Criterion adapted for crypto volatility
- Never more than 2% of portfolio per trade
- Max 4 simultaneous positions

**Stop Loss Strategy:**
- Hard stops: Always set before entry
- Trailing stops: Activated after 15% gain
- Time-based exits: 72h max hold if no momentum

**Red Flags (Instant Skip):**
- Honeypot detected
- Top 10 holders > 70%
- Liquidity < $10K
- Contract not renounced

**Circuit Breakers:**
- Trading paused if daily loss > $2,000
- System halt if weekly loss > $5,000`,
    citations: ['TRADING_PARAMETERS.env#risk-management'],
  },
};

// Typewriter speed constants
const TYPEWRITER_CHARS_PER_TICK = 6;
const TYPEWRITER_DELAY_MS = 16;

function findBestResponse(question: string): { content: string; citations?: string[] } {
  const q = question.toLowerCase();
  if (q.includes('strateg') || q.includes('current') || q.includes('approach')) {
    return CLETUS_RESPONSES.strategy;
  }
  if (q.includes('signal') || q.includes('score') || q.includes('indicator')) {
    return CLETUS_RESPONSES.signals;
  }
  if (q.includes('risk') || q.includes('stop') || q.includes('position') || q.includes('manag')) {
    return CLETUS_RESPONSES.risk;
  }
  if (q.includes('timeframe') || q.includes('meme') || q.includes('memecoin')) {
    return {
      content: `**Optimal Timeframes for Meme Coins on Solana:**

**Primary:** 15m & 1h charts — meme coins move fast; 15m for entry, 1h for confirmation.
**Secondary:** 4h for trend direction. Never trade against the 4h trend.

**What I Watch:**
- 15m Volume spike = potential entry signal
- 1h RSI crossing 50 from below = momentum confirmation
- 4h showing higher lows = bullish structure

⚠️ 80% of meme coins eventually go to zero. Position sizing and stops are non-negotiable.`,
    };
  }
  if (q.includes('inflation') || q.includes('fed') || q.includes('gdp') || q.includes('econom') || q.includes('interest rate')) {
    return {
      content: `**Economics Overview:**

**GDP** = C + I + G + (X – M). The Fed targets ~2% inflation.

**Key Rate Tools:**
- Federal Funds Rate (benchmark short-term rate)
- Quantitative Easing / Tightening (expanding/contracting the money supply)

**Yield Curve:** When short-term rates exceed long-term rates (inversion), a recession typically follows within 12–18 months — one of the most reliable leading indicators in macro.

**Inflation vs Markets:** Rising inflation → Fed hikes rates → bond prices fall → high-P/E growth stocks reprice lower → commodities often outperform.`,
    };
  }
  if (q.includes('accounting') || q.includes('balance sheet') || q.includes('p/e') || q.includes('dcf') || q.includes('ebitda') || q.includes('ratio')) {
    return {
      content: `**Accounting & Valuation Fundamentals:**

**The Three Financial Statements:**
- **Income Statement** → Revenue, Gross Profit, EBITDA, Net Income
- **Balance Sheet** → Assets = Liabilities + Equity
- **Cash Flow Statement** → Operating, Investing, Financing

**Key Valuation Ratios:**
| Metric | Formula | Use |
|--------|---------|-----|
| P/E | Price / EPS | Earnings multiple |
| EV/EBITDA | EV / EBITDA | Business value |
| ROE | Net Income / Equity | Profitability |
| Debt/Equity | Debt / Equity | Leverage |

**DCF:** Discount all future free cash flows at WACC. Extremely sensitive to terminal growth rate.`,
    };
  }
  if (q.includes('option') || q.includes('call') || q.includes('put') || q.includes('greek') || q.includes('delta') || q.includes('theta') || q.includes('stock') || q.includes('equit')) {
    return {
      content: `**Stock & Options Fundamentals:**

**Stocks:** Common stock = ownership + voting rights. Intrinsic value = PV of all future cash flows.

**Options Greeks:**
| Greek | Meaning |
|-------|---------|
| Delta (Δ) | $ change per $1 move in underlying |
| Gamma (Γ) | Rate of delta change |
| Theta (Θ) | Daily time decay (options lose value daily) |
| Vega (ν) | Sensitivity to implied volatility |

**Popular Strategies:**
- Covered call: own stock + sell call → income generation
- Iron condor: sell OTM call + OTM put → profits in range-bound markets
- Long straddle: buy call + put → profits from big moves either direction`,
    };
  }
  if (q.includes('porter') || q.includes('strategy') || q.includes('moat') || q.includes('business')) {
    return {
      content: `**Business Strategy Frameworks:**

**Porter's Five Forces:**
1. Threat of new entrants
2. Supplier bargaining power
3. Buyer bargaining power
4. Threat of substitutes
5. Industry rivalry intensity

**Competitive Moats (Buffett):**
- Network effects (Visa, Mastercard)
- Cost advantages (Walmart, Amazon)
- Switching costs (Salesforce, Oracle)
- Intangible assets (patents, brands)
- Efficient scale (regulated utilities)

**Blue Ocean Strategy:** Create uncontested market space rather than competing in saturated markets.`,
    };
  }
  return {
    content: `That's a great question. As Cletus, I have master's-level expertise in:

**📊 Economics** — macro/micro theory, Fed policy, inflation, yield curves, business cycles
**📒 Accounting** — financial statements, ratios, DCF valuation, GAAP
**🏢 Business** — strategy, Porter's Five Forces, competitive moats, M&A
**📈 Stocks & Options** — equities, Greeks, portfolio theory, CAPM, Sharpe ratio
**⚡ Solana DeFi** — signal scoring, momentum trading, rug detection

Ask me anything — from "explain the yield curve" to "how do I read a balance sheet" to "what's your current trading strategy."

*Remember: I'm an AI. Always do your own research.*`,
  };
}

function parseMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-trading-surface px-1 py-0.5 rounded text-trading-green text-xs font-mono">$1</code>')
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```\w*\n?/, '').replace(/```$/, '');
      return `<pre class="bg-trading-surface rounded-lg p-3 my-2 text-xs font-mono text-trading-green overflow-x-auto whitespace-pre">${code}</pre>`;
    })
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br/>')
    .replace(/\|(.*?)\|/g, (match) => {
      if (match.includes('---')) return '';
      const cells = match.split('|').filter(Boolean);
      return `<div class="flex gap-4 text-xs">${cells.map((c) => `<span class="flex-1">${c.trim()}</span>`).join('')}</div>`;
    });
}

function MessageBubble({ message, isStreaming }: { message: ChatMessage; isStreaming?: boolean }) {
  const isUser = message.role === 'user';
  const timeStr = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-slide-up`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
          isUser ? 'bg-trading-blue/30 border border-trading-blue/50' : 'bg-trading-green/20 border border-trading-green/40'
        }`}
      >
        {isUser ? '👤' : '🤖'}
      </div>

      {/* Content */}
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser ? 'chat-bubble-user text-white' : 'chat-bubble-ai text-gray-200'
          }`}
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div
              className="prose prose-invert prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }}
            />
          )}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-trading-green/70 ml-0.5 animate-pulse rounded-sm" />
          )}
        </div>

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {message.citations.map((cite) => (
              <span
                key={cite}
                className="text-xs bg-trading-surface border border-trading-border px-2 py-0.5 rounded-full text-gray-500"
              >
                📄 {cite}
              </span>
            ))}
          </div>
        )}

        <div className="text-xs text-gray-600 px-1">{timeStr}</div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-trading-green/20 border border-trading-green/40 flex items-center justify-center text-sm shrink-0">
        🤖
      </div>
      <div className="chat-bubble-ai px-4 py-3 rounded-2xl">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-gray-400"
              style={{ animation: `pulseGreen 1s ease-in-out ${i * 0.3}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AIBrainChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `**Hey — I'm Cletus.** 🤖

I've got master's-degree-level knowledge across five disciplines and I'm ready to go deep on any of them:

📊 **Economics** — macro theory, Fed policy, inflation, recessions, yield curves
📒 **Accounting** — reading financial statements, valuation (P/E, DCF, EV/EBITDA), ratio analysis
🏢 **Business Management** — strategy frameworks, competitive moats, Porter's Five Forces, M&A
📈 **Stocks & Options** — equities, Greeks, portfolio theory, CAPM, Sharpe ratio, fundamental & technical analysis
⚡ **Solana DeFi** — token signals, momentum trading, rug detection, liquidity analysis

**You can ask me absolutely anything** — from "explain the yield curve" to "what is an iron condor?" to "how do I read a 10-K?" to "what's your current trading strategy."

What do you want to learn?`,
      timestamp: Date.now() - 5000,
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  // Typewriter effect for AI messages
  const typewriterEffect = useCallback((msgId: string, fullText: string) => {
    setStreamingId(msgId);
    let i = 0;
    const tick = () => {
      i += TYPEWRITER_CHARS_PER_TICK;
      const partial = fullText.slice(0, i);
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, content: partial } : m))
      );
      if (i < fullText.length) {
        setTimeout(tick, TYPEWRITER_DELAY_MS);
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, content: fullText } : m))
        );
        setStreamingId(null);
      }
    };
    setTimeout(tick, TYPEWRITER_DELAY_MS);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      // Prevent sending while typing or while typewriter animation is in progress
      if (!content.trim() || isTyping || streamingId !== null) return;

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsTyping(true);

      // Build history for the API.
      // Exclude UI-only system messages (welcome/new-session) and cap at 20 turns
      // to stay within Gemini's context window without sending excessive tokens.
      const historySnapshot = [...messages, userMsg]
        .filter((m) => m.id !== 'welcome' && m.id !== 'new-session')
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content.trim(),
            history: historySnapshot.slice(0, -1), // exclude the current user message (already in `message`)
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data = await res.json();
        const answer =
          typeof data?.answer === 'string' && data.answer
            ? data.answer
            : findBestResponse(content).content;
        const aiMsgId = (Date.now() + 1).toString();
        const aiMsg: ChatMessage = {
          id: aiMsgId,
          role: 'assistant',
          content: '', // start empty for typewriter
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setIsTyping(false);
        typewriterEffect(aiMsgId, answer);
      } catch {
        const response = findBestResponse(content);
        const aiMsgId = (Date.now() + 1).toString();
        const aiMsg: ChatMessage = {
          id: aiMsgId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          citations: response.citations,
        };
        setMessages((prev) => [...prev, aiMsg]);
        setIsTyping(false);
        typewriterEffect(aiMsgId, response.content + '\n\n*⚠️ Running in offline mode — AI API unavailable.*');
      }
    },
    [messages, isTyping, streamingId, typewriterEffect]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setStreamingId(null);
    setMessages([
      {
        id: 'new-session',
        role: 'assistant',
        content: 'Session cleared. What would you like to explore — economics, accounting, business strategy, stocks, or Solana DeFi?',
        timestamp: Date.now(),
      },
    ]);
  };

  const isBusy = isTyping || streamingId !== null;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px] animate-fade-in">
      {/* Header */}
      <div className="trading-card p-4 mb-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-trading-green/20 border border-trading-green/40 flex items-center justify-center">
              🤖
            </div>
            <div>
              <div className="font-bold">Cletus AI Brain</div>
              <div className="flex items-center gap-1.5 text-xs">
                <div className="w-2 h-2 rounded-full bg-trading-green status-dot-live" />
                <span className="text-trading-green">Online · Gemini 2.0 Flash · Master-Level Knowledge</span>
              </div>
            </div>
          </div>
          <button
            onClick={clearChat}
            className="text-xs text-gray-500 hover:text-white bg-trading-surface border border-trading-border px-3 py-1.5 rounded-lg transition-colors"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Topic Chips */}
      <div className="mb-3 shrink-0">
        <div className="text-xs text-gray-500 mb-2">Quick topics:</div>
        <div className="flex flex-wrap gap-2">
          {TOPIC_CHIPS.map((chip) => (
            <button
              key={chip.label}
              onClick={() => sendMessage(chip.starter)}
              disabled={isBusy}
              className="text-xs bg-trading-surface border border-trading-border rounded-full px-3 py-1.5 text-gray-400 hover:text-white hover:border-trading-green/50 transition-all disabled:opacity-40"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isStreaming={streamingId === msg.id} />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions (only early in conversation) */}
      {messages.length <= 2 && (
        <div className="mb-4 shrink-0">
          <div className="text-xs text-gray-500 mb-2">Try asking:</div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.slice(0, 4).map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-xs bg-trading-surface border border-trading-border rounded-full px-3 py-1.5 text-gray-400 hover:text-white hover:border-trading-green/50 transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Cletus anything — economics, accounting, stocks, options, DeFi..."
            rows={1}
            className="flex-1 bg-trading-card border border-trading-border rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-trading-green resize-none transition-all"
            style={{ maxHeight: '120px' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isBusy}
            className="px-4 py-3 rounded-xl bg-trading-green text-black font-bold text-sm hover:bg-trading-green/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shrink-0"
          >
            {isTyping ? '⏳' : '↑'}
          </button>
        </div>
        <div className="text-xs text-gray-600 mt-2 text-center">
          Enter to send · Shift+Enter for new line · Ask anything — economics, finance, business, crypto
        </div>
      </form>
    </div>
  );
}
