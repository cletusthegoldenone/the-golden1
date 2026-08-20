function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolFromEnv(value, fallback) {
  if (value === undefined) return fallback;
  return value === 'true';
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
const SESSION_COOKIE_PATH = process.env.SESSION_COOKIE_PATH || '/';
const SESSION_COOKIE_DOMAIN = process.env.SESSION_COOKIE_DOMAIN || '';
const SESSION_COOKIE_SAME_SITE = process.env.SESSION_COOKIE_SAME_SITE || 'Strict';
const RUNTIME_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = RUNTIME_ENV === 'production';
const SESSION_COOKIE_SECURE = boolFromEnv(process.env.SESSION_COOKIE_SECURE, IS_PRODUCTION);
const AUTH_PROVIDER = process.env.AUTH_PROVIDER || (IS_PRODUCTION ? 'wallet_challenge' : 'bootstrap');
const AUTH_CHALLENGE_TTL_SECONDS = numberFromEnv(process.env.AUTH_CHALLENGE_TTL_SECONDS, 120);
const AUTH_REQUIRE_SECURE_TRANSPORT = boolFromEnv(process.env.AUTH_REQUIRE_SECURE_TRANSPORT, IS_PRODUCTION);
const TRUST_PROXY = boolFromEnv(process.env.TRUST_PROXY, IS_PRODUCTION);

const PERSISTENCE_FILE_PATH = process.env.PERSISTENCE_FILE_PATH || './data/the-golden1-state.json';
const PERSISTENCE_ADAPTER = process.env.PERSISTENCE_ADAPTER || 'file';
const DATABASE_URL = process.env.DATABASE_URL || '';

const RATE_LIMIT_PUBLIC_WINDOW_MS = numberFromEnv(process.env.RATE_LIMIT_PUBLIC_WINDOW_MS, 60000);
const RATE_LIMIT_PUBLIC_MAX = numberFromEnv(process.env.RATE_LIMIT_PUBLIC_MAX, 60);
const RATE_LIMIT_PROTECTED_WINDOW_MS = numberFromEnv(process.env.RATE_LIMIT_PROTECTED_WINDOW_MS, 60000);
const RATE_LIMIT_PROTECTED_MAX = numberFromEnv(process.env.RATE_LIMIT_PROTECTED_MAX, 120);

const MAX_BODY_BYTES = numberFromEnv(process.env.MAX_BODY_BYTES, 1024 * 1024);

function productionConfigErrors() {
  const errors = [];
  if (!IS_PRODUCTION) return errors;
  if (AUTH_PROVIDER === 'bootstrap') errors.push('AUTH_PROVIDER_BOOTSTRAP_FORBIDDEN_IN_PRODUCTION');
  if (!SESSION_COOKIE_SECURE) errors.push('SESSION_COOKIE_SECURE_REQUIRED_IN_PRODUCTION');
  if (!AUTH_REQUIRE_SECURE_TRANSPORT) errors.push('AUTH_REQUIRE_SECURE_TRANSPORT_REQUIRED_IN_PRODUCTION');
  if (SESSION_SECRET === 'dev-session-secret-change-me') errors.push('SESSION_SECRET_DEFAULT_FORBIDDEN_IN_PRODUCTION');
  if (AUTH_PROVIDER === 'wallet_challenge' && SESSION_TTL_SECONDS < 300) {
    errors.push('SESSION_TTL_TOO_SHORT_FOR_PRODUCTION');
  }
  return errors;
}

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
  SESSION_COOKIE_PATH,
  SESSION_COOKIE_DOMAIN,
  SESSION_COOKIE_SAME_SITE,
  SESSION_COOKIE_SECURE,
  AUTH_PROVIDER,
  AUTH_CHALLENGE_TTL_SECONDS,
  AUTH_REQUIRE_SECURE_TRANSPORT,
  TRUST_PROXY,
  RUNTIME_ENV,
  IS_PRODUCTION,
  PERSISTENCE_FILE_PATH,
  PERSISTENCE_ADAPTER,
  DATABASE_URL,
  RATE_LIMIT_PUBLIC_WINDOW_MS,
  RATE_LIMIT_PUBLIC_MAX,
  RATE_LIMIT_PROTECTED_WINDOW_MS,
  RATE_LIMIT_PROTECTED_MAX,
  MAX_BODY_BYTES,
  productionConfigErrors,
  OPERATOR_TOKEN
};
