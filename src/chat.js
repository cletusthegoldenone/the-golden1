'use strict';

const { getSecComplianceContext } = require('./secCompliance');
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

/**
 * Normalize client chat history for upstream model calls.
 *
 * @param {{ role?: string, content?: string }[]} rawHistory
 * @param {string} latestMessage
 * @returns {{ role: 'user'|'assistant', content: string }[]}
 */
function normalizeConversationHistory(rawHistory = [], latestMessage = '') {
  const normalized = rawHistory
    .map((entry) => {
      const role = entry?.role === 'assistant' || entry?.role === 'model'
        ? 'assistant'
        : entry?.role === 'user'
          ? 'user'
          : null;
      const content = typeof entry?.content === 'string' ? entry.content.trim() : '';

      if (!role || !content) return null;
      return { role, content };
    })
    .filter(Boolean)
    .slice(-MAX_HISTORY_TURNS);

  const trimmedLatestMessage = typeof latestMessage === 'string' ? latestMessage.trim() : '';
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

/**
 * Call the Gemini generative language API.
 *
 * @param {string} message
 * @param {{ role: 'user'|'model', parts: { text: string }[] }[]} history
 * @returns {Promise<string>}
 */
async function callGeminiAPI(message, history = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;

  const contents = [
    ...history,
    { role: 'user', parts: [{ text: message }] },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  let res;
  try {
    res = await fetch(
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
        signal: controller.signal,
      }
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');
  return text;
}

/**
 * Offline fallback used when the Gemini API is unavailable.
 *
 * @param {string} question
 * @returns {string}
 */
function mockResponse(question, history = []) {
  const q = question.toLowerCase();
  const recentUserTurns = history.filter((turn) => turn.role === 'user');
  const previousUserMessage = recentUserTurns[recentUserTurns.length - 1]?.content?.trim() ?? '';
  const isFollowUp = /^(and|also|what about|how about|why|how|when|where|which|can you|could you|go deeper|elaborate|expand|compare)\b/i.test(question.trim());

  if (isFollowUp && previousUserMessage) {
    return `Let's build on your last point about **${previousUserMessage}**.\n\nGive me one more specific angle — for example the **risk**, **setup**, **metrics**, or **trade thesis** you want to unpack — and I'll stay on that thread instead of resetting the conversation.`;
  }

  if (q.includes('signal') || q.includes('scanner')) {
    return `**Cletus Signal Engine** scans 500+ Solana micro-cap tokens every 15 seconds.\n\n**What I actually look for first:**\n- 🔥 Volume spike: 5m volume >5% of market cap\n- 📈 Momentum breakout: >5% price increase in 5m\n- 💧 Liquidity build: growing LP depth\n- 🐋 Buy pressure: buys >70% of 5m txns\n\nIf you want, I can go deeper on **how I weight those signals**, **what score is tradable**, or **how I size risk once a token qualifies**.`;
  }
  if (q.includes('stake') || q.includes('staking')) {
    return `**Cletus Staking Tiers:**\n\nStaking $CLETUS unlocks your **monthly platform trading limit** — the maximum Cletus can trade on your behalf each month. Staking does **not** pay SOL rewards or profit sharing.\n\n- **Starter** (500K CLETUS): $750/mo trading limit\n- **Growth** (2M CLETUS): $1,500/mo trading limit\n- **Pro** (5M CLETUS): $3,000/mo trading limit\n- **Elite** (10M CLETUS): $10,000/mo trading limit\n- **Whale** (25M+ CLETUS): Unlimited trading limit\n\nA 1% trade fee applies on every close: 20% developer, 25% platform access pool, 30% platform upgrades, 25% digital bank fund. $CLETUS token is coming soon — staking opens at launch.`;
  }
  if (q.includes('rug') || q.includes('scam')) {
    return `**Rug Detection Checklist:**\n\n- ✅ Check rugcheck.xyz for risk score\n- ✅ Verify LP is locked (>6 months ideal)\n- ✅ Dev wallet <5% of supply\n- ✅ No honeypot in contract\n- ✅ Cletus rug database: known bad devs flagged automatically`;
  }
  if (q.includes('solana') || q.includes('sol')) {
    return `**Solana DeFi Quick Overview:**\n\n- ⚡ 65k TPS, sub-$0.001 fees\n- 🔥 Hottest DEXes: Raydium, Orca, Meteora\n- 📊 Key metrics: Birdeye or DexScreener\n\nWhat specifically about Solana would you like to know?`;
  }
  if (q.includes('gdp') || q.includes('inflation') || q.includes('fed') || q.includes('interest rate') || q.includes('econom')) {
    return `**Economics Fundamentals:**\n\n**GDP** (Gross Domestic Product) = C + I + G + (X – M) — the total value of goods and services produced in an economy.\n\n**Inflation** is measured by CPI and PCE. The Fed targets ~2% inflation. When inflation runs hot, the Fed raises rates to cool spending and borrowing.\n\n**Federal Reserve Tools:**\n- Federal Funds Rate (short-term rate)\n- Open Market Operations (buying/selling Treasuries)\n- Reserve Requirements\n- Quantitative Easing / Tightening\n\n**Yield Curve:** When short-term rates > long-term rates (inverted), a recession often follows within 12–18 months — historically the most reliable leading indicator.`;
  }
  if (q.includes('p/e') || q.includes('balance sheet') || q.includes('income statement') || q.includes('accounting') || q.includes('ebitda') || q.includes('dcf')) {
    return `**Key Accounting & Valuation Concepts:**\n\n**Financial Statements:**\n- Income Statement: Revenue → Gross Profit → EBITDA → Net Income\n- Balance Sheet: Assets = Liabilities + Equity\n- Cash Flow Statement: Operating / Investing / Financing activities\n\n**Common Ratios:**\n| Metric | Formula | Meaning |\n|--------|---------|----------|\n| P/E | Price / EPS | How much you pay per $1 of earnings |\n| EV/EBITDA | Enterprise Value / EBITDA | Whole-company valuation |\n| ROE | Net Income / Equity | Profitability on shareholder funds |\n| Debt/Equity | Total Debt / Equity | Leverage level |\n\n**DCF Valuation:** Sum of discounted future cash flows. The discount rate = WACC. Highly sensitive to terminal growth rate assumptions.`;
  }
  if (q.includes('option') || q.includes('call') || q.includes('put') || q.includes('greek') || q.includes('delta') || q.includes('theta')) {
    return `**Options Trading Essentials:**\n\n**Calls & Puts:**\n- Call = right to BUY at strike price → profits when stock rises\n- Put = right to SELL at strike price → profits when stock falls\n\n**The Greeks:**\n| Greek | Measures |\n|-------|----------|\n| Delta (Δ) | Price sensitivity to $1 move in underlying |\n| Gamma (Γ) | Rate of change of delta |\n| Theta (Θ) | Time decay — options lose value daily |\n| Vega (ν) | Sensitivity to implied volatility changes |\n| Rho (ρ) | Sensitivity to interest rate changes |\n\n**Common Strategies:** Covered call, protective put, bull call spread, iron condor (neutral), long straddle (high-volatility bet).`;
  }
  if (q.includes('porter') || q.includes('strategy') || q.includes('competitive') || q.includes('moat') || q.includes('business model')) {
    return `**Business Strategy Frameworks:**\n\n**Porter's Five Forces:**\n1. Threat of new entrants\n2. Bargaining power of suppliers\n3. Bargaining power of buyers\n4. Threat of substitutes\n5. Industry rivalry\n\n**Competitive Moats (Warren Buffett):**\n- Network effects (Visa, Meta)\n- Cost advantages (Walmart, Costco)\n- Switching costs (Salesforce, Oracle)\n- Intangible assets (patents, brands)\n- Efficient scale (regulated utilities)\n\n**Blue Ocean Strategy:** Create uncontested market space instead of competing in existing markets.`;
  }
  if (q.includes('portfolio') || q.includes('sharpe') || q.includes('capm') || q.includes('diversif')) {
    return `**Portfolio Theory Fundamentals:**\n\n**Modern Portfolio Theory (Markowitz):**\n- Diversification reduces unsystematic risk\n- Efficient Frontier: portfolios with max return for a given risk level\n- Adding uncorrelated assets improves risk-adjusted returns\n\n**CAPM:** Expected Return = Rf + β × (Rm − Rf)\n- Rf = risk-free rate (T-bills)\n- β = sensitivity to market movements\n- (Rm − Rf) = equity risk premium (~5–7% historically)\n\n**Sharpe Ratio** = (Return − Rf) / Standard Deviation\nHigher is better. A ratio above 1.0 is good; above 2.0 is excellent.`;
  }

  return `Give me the exact angle you want to explore and I'll stay with it.\n\nI can help with:\n- 📊 macro + markets\n- 📒 accounting + valuation\n- 📈 stocks + options\n- ⚡ Solana signals + token analysis\n\nIf you want a better answer, ask a concrete follow-up like **"compare two setups"**, **"stress-test this thesis"**, or **"walk me through the trade step by step."**`;
}

/**
 * Handle a POST /api/chat request.
 *
 * Expected body:
 *   { message: string, history?: { role: 'user'|'assistant', content: string }[] }
 *
 * The `question` field is accepted as an alias for `message` for
 * backwards-compatibility.
 *
 * @param {object} body  Parsed JSON body
 * @returns {Promise<{ status: number, payload: object }>}
 */
async function handleChat(body) {
  const message = (typeof body.message === 'string' ? body.message : '') ||
                  (typeof body.question === 'string' ? body.question : '');

  if (!message.trim()) {
    return { status: 400, payload: { error: 'Message is required' } };
  }

  const normalizedHistory = normalizeConversationHistory(
    Array.isArray(body.history) ? body.history : [],
    message
  );

  // Convert client history format → Gemini conversation format
  const history = normalizedHistory.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  let answer;
  let usedLiveAI = false;

  try {
    answer = await callGeminiAPI(message, history);
    usedLiveAI = true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[chat] Gemini API unavailable, falling back to mock:', err.message);
    answer = mockResponse(message, normalizedHistory);
  }

  return {
    status: 200,
    payload: {
      answer,
      usedLiveAI,
      timestamp: new Date().toISOString(),
    },
  };
}

module.exports = { handleChat, callGeminiAPI, mockResponse, normalizeConversationHistory };
