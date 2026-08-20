function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const POLICY_VERSIONS = {
  terms: process.env.POLICY_VERSION_TERMS || '2026-08-19',
  riskDisclaimer: process.env.POLICY_VERSION_RISK || '2026-08-19',
  tradingAuthorization: process.env.POLICY_VERSION_TRADING_AUTH || '2026-08-19',
  privacy: process.env.POLICY_VERSION_PRIVACY || '2026-08-19'
};

const JUPITER_FEE_WALLET = process.env.JUPITER_FEE_WALLET || 'h1vRxwsCLUtiD6UiKpSgNnTDUAqvXCxurFVUfvH1noj';
const FEE_ROUTING_ENABLED = process.env.FEE_ROUTING_ENABLED !== 'false';
const FEE_ROUTING_BPS = numberFromEnv(process.env.FEE_ROUTING_BPS, 50);
const TRIAL_DAYS = numberFromEnv(process.env.TRIAL_DAYS, 30);
const MONTHLY_GROSS_PROFIT_CAP_USD = numberFromEnv(process.env.MONTHLY_GROSS_PROFIT_CAP_USD, 10000);
const WEEKLY_PASS_USDC = numberFromEnv(process.env.WEEKLY_PASS_USDC, 20);

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret-change-me';
const SESSION_TTL_SECONDS = numberFromEnv(process.env.SESSION_TTL_SECONDS, 3600);
const AUTH_BOOTSTRAP_TOKEN = process.env.AUTH_BOOTSTRAP_TOKEN || 'dev-bootstrap-token-change-me';
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'tg1_session';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';

const PERSISTENCE_FILE_PATH = process.env.PERSISTENCE_FILE_PATH || './data/the-golden1-state.json';

const RATE_LIMIT_PUBLIC_WINDOW_MS = numberFromEnv(process.env.RATE_LIMIT_PUBLIC_WINDOW_MS, 60000);
const RATE_LIMIT_PUBLIC_MAX = numberFromEnv(process.env.RATE_LIMIT_PUBLIC_MAX, 60);
const RATE_LIMIT_PROTECTED_WINDOW_MS = numberFromEnv(process.env.RATE_LIMIT_PROTECTED_WINDOW_MS, 60000);
const RATE_LIMIT_PROTECTED_MAX = numberFromEnv(process.env.RATE_LIMIT_PROTECTED_MAX, 120);

const MAX_BODY_BYTES = numberFromEnv(process.env.MAX_BODY_BYTES, 1024 * 1024);

// Simple operator protection for kill-switch (replace with real role system later)
const OPERATOR_TOKEN = process.env.OPERATOR_TOKEN || 'dev-operator-token-change-me';

module.exports = {
  POLICY_VERSIONS,
  JUPITER_FEE_WALLET,
  FEE_ROUTING_ENABLED,
  FEE_ROUTING_BPS,
  TRIAL_DAYS,
  MONTHLY_GROSS_PROFIT_CAP_USD,
  WEEKLY_PASS_USDC,
  SESSION_SECRET,
  SESSION_TTL_SECONDS,
  AUTH_BOOTSTRAP_TOKEN,
  SESSION_COOKIE_NAME,
  COOKIE_SECURE,
  PERSISTENCE_FILE_PATH,
  RATE_LIMIT_PUBLIC_WINDOW_MS,
  RATE_LIMIT_PUBLIC_MAX,
  RATE_LIMIT_PROTECTED_WINDOW_MS,
  RATE_LIMIT_PROTECTED_MAX,
  MAX_BODY_BYTES,
  OPERATOR_TOKEN
};
