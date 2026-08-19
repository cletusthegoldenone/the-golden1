# The Golden1 — Setup & Operations Guide

## Prerequisites

- Node.js ≥ 18 (uses the built-in `node:test` runner)
- npm ≥ 9

## Local Development

```bash
# 1. Clone the repo
git clone https://github.com/cletusthegoldenone/the-golden1.git
cd the-golden1

# 2. Copy environment template and fill in values
cp .env.example .env

# 3. Install dependencies (none currently required beyond Node builtins)
npm install

# 4. Start the server
npm start
# → The Golden1 server listening on :3000

# 5. Run tests
npm test
```

## Architecture Overview

| Module | Purpose |
|---|---|
| `src/server.js` | HTTP request router — all API routes |
| `src/legal.js` | Consent recording and latest-version validation |
| `src/store.js` | In-process state (replace with DB before production) |
| `src/config.js` | Policy version strings and Jupiter fee wallet address |
| `src/tradingAuth.js` | Server-side trading policy engine (trial / stake / cap / pass / kill switch) |
| `src/policyValidation.js` | Whitelist / blocklist pre-trade pair checks |
| `src/taxCenter.js` | CSV/JSON export and PnL summary with tax disclaimer |

## API Reference (Summary)

### Public

| Method | Path | Description |
|---|---|---|
| GET | `/legal` | Legal gate HTML page |
| POST | `/api/legal/accept` | Record consent (body: `{ identity, accepted: true }`) |
| POST | `/api/register` | Create account (body: `{ identity }`) |

### Protected (requires prior legal acceptance; send `?identity=<id>` or `x-identity` header)

| Method | Path | Description |
|---|---|---|
| GET | `/api/protected/legal/consents` | Retrieve consent log for identity |
| GET | `/api/protected/onboarding/status` | Retrieve onboarding milestone state |
| POST | `/api/protected/onboarding/profile` | Set risk profile |
| POST | `/api/protected/onboarding/wallet-mode` | Choose managed or external wallet |
| POST | `/api/protected/onboarding/constraints` | Set trade constraints |
| POST | `/api/protected/onboarding/fund-or-link` | Complete onboarding |
| GET | `/api/protected/wallet/status` | Wallet + delegation state |
| POST | `/api/protected/wallet/revoke-delegation` | Revoke external wallet delegation |
| POST | `/api/trade/check` | Server-side trade authorization check |
| GET | `/api/protected/tax/export` | Export transactions (`?format=csv` or `json`) |
| GET | `/api/protected/tax/summary` | Realized/unrealized PnL summary |
| POST | `/api/protected/operator/kill-switch` | Operator: enable/disable global kill switch |

## Environment Variables

See `.env.example` for the full annotated list. Key variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP listen port |
| `JUPITER_FEE_WALLET` | see `src/config.js` | 0.5% fee destination wallet |
| `KILL_SWITCH_ON_STARTUP` | `false` | Activate kill switch on server start |
| `POLICY_VERSION_*` | `2026-08-19` | Bump to invalidate stale consents after policy changes |

## Feature Flags

| Flag | Where | Notes |
|---|---|---|
| `operatorFlags.killSwitch` | `src/store.js` + `POST /api/protected/operator/kill-switch` | Blocks all trading immediately |
| `whitelistMode` | user constraints | Only allow listed pairs |
| `blocklistMode` | user constraints | Deny listed pairs |

## Launch Checklist

The items below require human sign-off and are **not** automated:

- [ ] **LEGAL**: Have a licensed attorney review Terms of Service, Risk Disclaimer, and Trading Authorization Disclosures before any user-facing launch.
- [ ] **LEGAL**: Remove or replace all placeholder policy text (clearly marked `[PLACEHOLDER]` in legal copy).
- [ ] **SECURITY**: Replace in-process `Map`-based state (`src/store.js`) with a durable, encrypted database before production.
- [ ] **SECURITY**: Add authentication/JWT session validation so `identity` tokens cannot be forged.
- [ ] **SECURITY**: Add rate limiting to all public endpoints.
- [ ] **SECURITY**: Conduct penetration test / security review of API surface before launch.
- [ ] **SECURITY**: Ensure all private keys, JWT secrets, and API credentials are stored in a secrets manager — never in `.env` committed to source control.
- [ ] **COMPLIANCE**: Engage a licensed CPA or tax attorney to review Tax Center copy before enabling for users.
- [ ] **COMPLIANCE**: Confirm jurisdiction-specific regulatory requirements for algorithmic trading in target markets.
- [ ] **OPS**: Set up structured logging and alerting for consent failures, kill-switch activations, and policy violations.
- [ ] **OPS**: Establish database backup and disaster recovery plan.
- [ ] **OPS**: Set `KILL_SWITCH_ON_STARTUP=false` explicitly in production environment and document the change-control process for activating it.

## Risk Disclaimer

Crypto and automated trading are high risk. Losses, including total loss, are possible. Past performance does not guarantee future outcomes. Use only capital you can afford to lose. The Golden1 / Cletus is software tooling only — it does not provide legal, financial, or tax advice.
