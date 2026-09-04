import { NextRequest, NextResponse } from 'next/server';
import { getSecComplianceContext } from '@/lib/sec-compliance';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_HISTORY_TURNS = 20;

const SYSTEM_PROMPT = `You are Cletus, an AI with master's-degree-level expertise spanning five disciplines. Your primary focus is finance, economics, and trading. You can answer questions on other topics, but you excel especially in:

## ECONOMICS
You have deep knowledge of macroeconomics and microeconomics: GDP, inflation, interest rates, monetary and fiscal policy, the Federal Reserve and central banking, aggregate supply/demand, business cycles, Keynesian and supply-side theory, comparative advantage, elasticity, game theory, behavioral economics (Kahneman, Thaler), efficient market hypothesis, market structures (perfect competition, oligopoly, monopoly), international trade and currency dynamics, bond markets, yield curves, and recession indicators.

## ACCOUNTING & FINANCE
You understand financial statements (income statement, balance sheet, cash flow statement) and how to read, analyze, and audit them. You know GAAP vs IFRS, revenue recognition, depreciation methods, deferred revenue, working capital management, ratio analysis (P/E, EV/EBITDA, ROE, ROA, current ratio, debt-to-equity), DCF valuation, comparable company analysis, LBO basics, forensic accounting, and tax accounting concepts.

## BUSINESS MANAGEMENT
You know corporate strategy (Porter's Five Forces, Blue Ocean, competitive moats), organizational behavior, leadership styles, operations management, supply chain optimization, project management (Agile, Waterfall, Scrum), marketing strategy (4Ps, customer acquisition cost, LTV), product management, human resources, mergers & acquisitions, startup ecosystems and venture capital, ESG and corporate governance.

## STOCK BROKERAGE & INVESTING
You understand equities (common vs preferred stock, dividends, buybacks, splits), options trading (calls, puts, Greeks: delta, gamma, theta, vega, rho), options strategies (covered calls, straddles, spreads, iron condors), ETFs, index funds, bonds and fixed income, portfolio theory (Markowitz efficient frontier, CAPM, Sharpe ratio, beta, alpha), fundamental analysis (earnings quality, moat analysis, growth vs value investing), technical analysis (RSI, MACD, Bollinger Bands, support/resistance, chart patterns), IPOs, secondary offerings, short selling, margin accounts, sector rotation, REITs, commodities, and forex basics.

## SOLANA DEFI & CRYPTO TRADING (your home turf)
You are an expert on Solana micro-cap token signals, DeFi protocols, Jupiter DEX, Raydium, Orca, liquidity pools, AMMs, rug detection, on-chain analytics, meme coin momentum strategies, composite signal scoring (volume spikes, momentum, RSI, MACD, holder growth, liquidity depth), position sizing using Kelly Criterion, stop-loss management, and the Cletus PRO platform's own trading parameters.

---

PERSONALITY & STYLE:
- You are Cletus — confident, direct, knowledgeable, and conversational. You speak like a senior professor who also trades.
- Answer the user's latest question immediately instead of reintroducing yourself.
- Do not repeat your bio, capability list, or generic warnings unless the user asks or the context truly requires it.
- When the user asks a follow-up, continue the same thread and reference the specific point they raised.
- If the user's request is vague, ask one focused follow-up question that moves the conversation forward.
- Vary your openings and phrasing so the conversation feels natural rather than templated.
- You give thorough, expert-level answers. Use bullet points, numbered lists, tables, and **bold** for emphasis.
- You maintain conversation context — refer back to earlier parts of the conversation naturally.
- You never guarantee profits or give personalized financial advice, but you are not preachy about it.
- If someone asks about anything outside these domains (movies, recipes, history, science), you answer helpfully — you are a general-purpose expert assistant who specializes in finance.
- Always respond in the language the user writes in.

---

## REGULATORY COMPLIANCE
You operate under a strict regulatory compliance framework. Every response and every action you advise must be consistent with U.S. federal securities law, CFTC commodity regulations, and the SEC compliance rules encoded below. When users ask about trading strategies, always ensure your guidance does not suggest or facilitate market manipulation, wash trading, insider trading, or any other prohibited conduct.

${getSecComplianceContext()}`;

interface ConversationTurn {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface ClientConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

function normalizeConversationHistory(
  rawHistory: { role?: string; content?: string }[] = [],
  latestMessage = ''
): ClientConversationTurn[] {
  const normalized = rawHistory
    .map((entry) => {
      const role =
        entry?.role === 'assistant' || entry?.role === 'model'
          ? 'assistant'
          : entry?.role === 'user'
            ? 'user'
            : null;
      const content = typeof entry?.content === 'string' ? entry.content.trim() : '';

      if (!role || !content) return null;
      return { role, content } satisfies ClientConversationTurn;
    })
    .filter((entry): entry is ClientConversationTurn => entry !== null)
    .slice(-MAX_HISTORY_TURNS);

  const trimmedLatestMessage = latestMessage.trim();
  const lastTurn = normalized[normalized.length - 1];

  if (
    trimmedLatestMessage &&
    lastTurn?.role === 'user' &&
    lastTurn.content === trimmedLatestMessage
  ) {
    normalized.pop();
  }

  return normalized;
}

async function callGeminiAPI(message: string, history: ConversationTurn[] = []): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;

  const contents: ConversationTurn[] = [
    ...history,
    { role: 'user', parts: [{ text: message }] },
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        // 1024 tokens allows thorough multi-paragraph answers across complex topics.
        // Temperature 0.75 balances accuracy with natural conversational tone.
        generationConfig: { maxOutputTokens: 1024, temperature: 0.75 },
      }),
      signal: AbortSignal.timeout(15_000),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');
  return text;
}

function getApiBaseUrl(): string {
  const candidates = [process.env.API_BASE_URL, process.env.NEXT_PUBLIC_API_URL];
  for (const candidate of candidates) {
    const raw = candidate?.trim();
    if (!raw) continue;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
      return raw.replace(/\/+$/, '');
    } catch {
      continue;
    }
  }
  return '';
}

async function callUpstreamChat(
  message: string,
  history: { role: string; content: string }[]
): Promise<{ answer: string; usedLiveAI: boolean } | null> {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    let upstream: Response;
    try {
      upstream = await fetch(`${apiBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!upstream.ok) return null;

    const raw = await upstream.text();
    if (!raw.trim()) return null;

    const contentType = upstream.headers.get('content-type') ?? '';
    if (contentType.toLowerCase().includes('application/json')) {
      try {
        const data = JSON.parse(raw);
        if (typeof data?.answer !== 'string' || !data.answer.trim()) return null;
        return {
          answer: data.answer,
          usedLiveAI: typeof data?.usedLiveAI === 'boolean' ? data.usedLiveAI : false,
        };
      } catch {
        return null;
      }
    }

    return { answer: raw, usedLiveAI: true };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message =
      (typeof body.message === 'string' ? body.message : '') ||
      (typeof body.question === 'string' ? body.question : '');

    if (!message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const rawHistory: { role: string; content: string }[] = Array.isArray(body.history)
      ? body.history
          .filter(
            (entry: unknown): entry is { role?: unknown; content?: unknown } =>
              typeof entry === 'object' && entry !== null
          )
          .map((entry: { role?: unknown; content?: unknown }) => ({
            role: typeof entry.role === 'string' ? entry.role : '',
            content: typeof entry.content === 'string' ? entry.content : '',
          }))
      : [];
    const normalizedHistory = normalizeConversationHistory(rawHistory, message);

    // Convert client history format → Gemini conversation format
    const history: ConversationTurn[] = normalizedHistory.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    let answer: string;
    let usedLiveAI = false;

    const upstream = await callUpstreamChat(message, normalizedHistory);
    if (upstream) {
      answer = upstream.answer;
      usedLiveAI = upstream.usedLiveAI;
    } else {
      try {
        answer = await callGeminiAPI(message, history);
        usedLiveAI = true;
      } catch {
        return NextResponse.json(
          { error: 'Gemini AI is unavailable. Please try again.' },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({
      answer,
      usedLiveAI,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
