# The Golden1 (Cletus) — Jupiter-Native Autonomous Trading Super App

The Golden1 is the production direction for **Cletus**: a Jupiter-native Solana trading super app with strict safety controls, legal gating, user-consent architecture, and configurable autonomy.

This README replaces prior draft language and aligns with the final scope discussed.

---

## 1) Product Direction (Final)

The Golden1 is designed around:

- **Mandatory legal gate before access** (Terms + Disclaimer + consent)
- **Personalized account onboarding** after acceptance
- **Two wallet modes**:
  - **Managed Cletus Wallet** (in-app custody flow)
  - **External wallet delegation** (user signs scoped permission for trade execution)
- **Capital deposit and profit withdrawal workflows**
- **Jupiter-native execution path**
- **Autonomy with user-configurable risk limits**
- **Compliance-first disclosures and auditability**

This is a high-risk product domain (algorithmic crypto trading). No guarantee of profit is made.

---

## 2) Required Access Gate (Before Any App Access)

A full-screen white legal page must be accepted before users can access any protected route.

### Required acceptance items

Users must explicitly accept:

1. Terms of Service
2. Risk Disclaimer
3. Trading Authorization Disclosures
4. Privacy / Data handling acknowledgment

### Consent logging (required)

Store a versioned acceptance record containing:

- user id (or pending identity token)
- policy version(s)
- timestamp (UTC)
- IP/device metadata (where legally allowed)
- acceptance status

No protected routes are available until acceptance is recorded.

---

## 3) Registration + Onboarding Flow

1. User lands on legal gate
2. User accepts terms/disclaimer
3. Account is created
4. User profile is initialized (risk + preferences)
5. User chooses wallet model:
   - Managed Cletus Wallet
   - External delegated wallet
6. User sets autonomy/risk guardrails
7. User funds account or links delegated wallet
8. Trading access enabled (subject to policy checks)

---

## 4) Wallet Model (Dual Path)

## A) Managed **Cletus Wallet**

- In-app wallet creation flow
- User can deposit capital for Cletus-managed trading
- User can request withdrawals under policy/security checks

## B) External Wallet + Delegated Permission

- User connects their own wallet
- User signs explicit permission for trade execution scope
- Delegation must be constrained by:
  - allowed actions
  - optional max size / limits
  - revocation capability
  - expiry (recommended)

At all times, users must be able to revoke permissions.

---

## 5) Business Rules (As Agreed)

The Golden1 includes the following usage/economic rules:

- **30-day unlimited trial**
- **Post-trial stake-to-use** requirement
- **Monthly gross-profit cap**
- **$20 USDC weekly continuation pass** (after cap condition)
- **0.5% fee routing** to configured Jupiter wallet:
  - `h1vRxwsCLUtiD6UiKpSgNnTDUAqvXCxurFVUfvH1noj`
- **Global kill switch** (server-enforced emergency halt)

All enforcement is server-side. UI display alone is not sufficient.

---

## 6) Cletus Brain Policy (Intelligence + Guardrails)

Cletus is positioned as an advanced AI trading assistant, not a sentient entity.

### Brain objectives

- High-quality market reasoning
- Persistent memory of user preferences and risk profile
- Explainable decision summaries
- Safe automation under explicit user constraints

### Hard policy constraints

- No claims of guaranteed profits
- No deceptive claims of consciousness/sentience/personhood
- No facilitation of unlawful market behavior
- No personalized legal/tax advice output as a substitute for licensed professionals

---

## 7) Tax Guidance Layer + Individual Tax Forms Support

The app includes a **Tax Center** for individuals and educational guidance.

### Tax center capabilities

- Transaction history export (CSV/JSON)
- Realized/unrealized PnL summaries
- Cost basis support inputs
- Year-end report helpers
- References for U.S. individual filing workflows (including Form 8949 + Schedule D)

### Important tax disclaimer

The Golden1/Cletus provides educational tooling only and does **not** provide legal or tax advice. Users are responsible for filings and should consult a qualified CPA/tax attorney.

---

## 8) Whitelist / Blocklist Trading Controls

Trading authorization includes allow/deny controls:

- token/pair whitelist mode
- token/pair blocklist mode
- route-level risk checks
- permission scope validation before execution

Server rejects non-compliant requests with auditable reason codes.

---

## 9) Safety + Security Controls (Required)

- API key/secret isolation on backend only
- No private key exposure to client
- Signed action audit logs
- Withdrawal protections (step-up auth recommended)
- Rate limits + anomaly detection
- Drawdown/risk-based auto-pause
- **Emergency kill switch** available to operator controls

---

## 10) Compliance Positioning

The Golden1 should be presented as:

- software tooling platform
- user-consent-based automation system
- risk-forward and disclosure-first product

The project must avoid unsupported legal/financial claims, including but not limited to:

- “untaxable” guarantees
- guaranteed returns
- blanket regulatory immunity statements

Legal policy text should be reviewed by licensed counsel before production launch.

---

## 11) Voice: Cletus Live (Planned/Scaffold)

Cletus Live voice interaction is included in scope as a controlled interface layer for:

- conversational assistance
- strategy explanation
- optional verbal confirmations

Trade execution remains governed by backend authorization and policy checks.

---

## 12) Current Repo Intent

This repository is the canonical base for The Golden1 migration and implementation.

Priority sequence:

1. Legal gate + consent logging
2. Registration/onboarding
3. Wallet mode selection and permission architecture
4. Trading authorization engine (trial/stake/cap/pass/fee)
5. Tax center + exports
6. Voice + advanced autonomy UX

---

## 13) Risk Disclaimer (Plain Language)

Crypto and automated trading are high risk. Losses, including total loss, are possible. Past performance does not guarantee future outcomes. Use only capital you can afford to lose.

---

## 14) License

Repository license applies as configured in this project.

---

## 15) Railway Deployment

### Deploy from GitHub

1. Push this repository to GitHub.
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
3. Select this repository. Railway auto-detects Node.js via `nixpacks`.
4. Set the required environment variables (see below).
5. Railway injects `PORT` automatically — do **not** set it manually.
6. The app starts with `npm start` (`node src/server.js`).

### Required Environment Variables

| Variable | Description | Production value |
|---|---|---|
| `NODE_ENV` | Runtime environment | `production` |
| `SESSION_SECRET` | Strong random secret for sessions | Generate with `openssl rand -base64 32` |
| `AUTH_PROVIDER` | Auth strategy | `wallet_challenge` |
| `AUTH_REQUIRE_SECURE_TRANSPORT` | Enforce HTTPS | `true` |
| `SESSION_COOKIE_SECURE` | Secure cookie flag | `true` |
| `TRUST_PROXY` | Trust Railway reverse proxy | `true` |
| `PERSISTENCE_ADAPTER` | Storage backend | `postgres` (or `file` for ephemeral) |
| `DATABASE_URL` | PostgreSQL connection string | Set by Railway PostgreSQL plugin |

Copy `.env.example` as a starting point. In the Railway dashboard, add variables under **Settings → Variables**.

### PostgreSQL Setup

1. In your Railway project, click **+ New** → **Database** → **PostgreSQL**.
2. Railway automatically sets `DATABASE_URL` in your service's environment.
3. Set `PERSISTENCE_ADAPTER=postgres` in your service variables.
4. To run DB migrations (when a migration tool is wired): add a **Deploy Command** or run via Railway shell:
   ```
   npm run db:migrate
   ```
   The `db:migrate` script is a placeholder — replace it with your ORM migration command (e.g. `npx prisma migrate deploy` for Prisma, or `knex migrate:latest` for Knex).

### Health Check Route

Railway (and any load balancer) can poll the health endpoint:

| Path | Description |
|---|---|
| `GET /healthz` | Returns `{ ok: true, service: "the-golden1" }` — original liveness probe |
| `GET /api/health` | Same as `/healthz` (alias added for Railway / standard tooling) |
| `GET /readyz` | Full readiness check including auth + persistence health |

`railway.toml` is pre-configured with `healthcheckPath = "/api/health"`.

### Suggested Route Structure

| Route | Type | Description |
|---|---|---|
| `/` | Marketing | Landing / home page |
| `/about` | Marketing | About The Golden1 / Cletus |
| `/how-it-works` | Marketing | Feature explainer |
| `/docs` | Marketing | Documentation hub |
| `/blog` | Marketing | Blog / updates |
| `/legal` | Legal gate | Terms acceptance (required before app access) |
| `/app` | App shell | Main authenticated trading app |
| `/app/wallet` | App | Wallet management |
| `/app/trade` | App | Trade execution |
| `/app/tax` | App | Tax center |
| `/api/health` | API | Health / liveness probe |
| `/readyz` | API | Readiness probe |
| `/api/legal/accept` | API | Consent submission |

