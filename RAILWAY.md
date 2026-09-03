# The Golden1 → Railway deployment guide

Repo: `cletusthegoldenone/the-golden1`

You have **two apps** in one repo. Deploy them as **two Railway services** (recommended), or frontend-only if you only need the Next UI for now.

| Service | Root directory | What it is |
|---------|----------------|------------|
| **API** | `.` (repo root) | Node policy server `src/server.js` — legal, session, trade auth, tax, Helius send |
| **Web** | `cletus-frontend` | Next.js 14 UI + App Router API routes (signals, AI, trade, etc.). **Do not use `.` for this service.** |

---

## 1) Create project on Railway

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Select `cletusthegoldenone/the-golden1`
3. Add **PostgreSQL** plugin (optional but recommended for production state)

---

## 2) Service A — API (backend)

**Settings → Root Directory:** leave empty (repo root)

**Build / Start** (already in root `railway.toml`):
- Builder: Nixpacks
- Start: `npm start` → `node src/server.js`
- Healthcheck: `GET /api/health` (also `/healthz`)
- Readiness: `GET /readyz`

**Variables (API service)** — set in Railway Variables (do **not** set `PORT`):

```bash
NODE_ENV=production
SESSION_SECRET=<openssl rand -hex 64>
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAME_SITE=Strict
TRUST_PROXY=true
AUTH_REQUIRE_SECURE_TRANSPORT=true
AUTH_PROVIDER=wallet_challenge
PERSISTENCE_ADAPTER=postgres
# DATABASE_URL is auto-injected if Postgres plugin is attached to this service

HELIUS_API_KEY=
JUPITER_API_KEY=
RUGCHECK_API_KEY=
GEMINI_API_KEY=
ADMIN_PIN=
ADMIN_WALLET_ADDRESS=GJwtCupMcNGbhGX1vapg2ueK2pedx2tgMkzGjhugnxaA
JUPITER_FEE_WALLET=GJwtCupMcNGbhGX1vapg2ueK2pedx2tgMkzGjhugnxaA
FEE_WALLET_ADDRESS=GJwtCupMcNGbhGX1vapg2ueK2pedx2tgMkzGjhugnxaA

TRIAL_DAYS=30
ENABLE_LIVE_TRADING=false
```

Generate secrets:

```bash
openssl rand -hex 64   # SESSION_SECRET
```

---

## 3) Service B — Web (Next.js)

**Settings → Root Directory:** `cletus-frontend` (do not set `.` for website service)

Use `cletus-frontend/railway.toml` (or paste):

```toml
[build]
builder = "nixpacks"
buildCommand = "npm install --omit=optional --ignore-scripts && npm run build"

[deploy]
startCommand = "node .next/standalone/server.js"
healthcheckPath = "/api/system-status"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

**Variables (Web service)** — do **not** set `PORT`:

```bash
NODE_VERSION=20
NODE_ENV=production
NEXT_PUBLIC_HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=<helius-key>
# Server-side API proxy target for unmatched /api/* routes in Next
# (set only if proxying)
API_BASE_URL=https://<your-api-service>.up.railway.app
# Optional client-exposed URL for direct browser calls
# NEXT_PUBLIC_API_URL=https://<your-api-service>.up.railway.app

# AI routes only
GEMINI_API_KEY=
```

DB guidance:
- If using Postgres, set a **private** `DATABASE_URL` only on the service that needs DB access.
- Do not set `PERSISTENCE_ADAPTER` on the web service.
- For the API service, use `PERSISTENCE_ADAPTER=file` when not using Postgres.

`package.json` already has:
- `"start": "next start -p ${PORT:-3000}"`
- `next.config.js` → `output: 'standalone'`
- `engines.node: ">=18"`

---

## 4) Networking

1. Generate domain for **Web** (public users).
2. Generate domain for **API** (or use private networking + `API_BASE_URL`).
3. Optional: custom domain `cletusai.xyz` → point to Web service.

---

## 5) Verify after deploy

**API**
```bash
curl -s https://<api>.up.railway.app/api/health
curl -s https://<api>.up.railway.app/readyz
```

**Web**
```bash
curl -s https://<web>.up.railway.app/api/system-status
# Open / in browser — landing page
```

---

## 6) Known gaps (fix before “live money”)

1. **Root `package.json` has no npm dependencies** — API only uses Node built-ins + local `src/*`. Fine for now; if you add `pg`, list it in root `package.json`.
2. **Postgres adapter is scaffolded** — `PERSISTENCE_ADAPTER=postgres` needs a real DB client wired in `src/persistence.js` before relying on it. Until then use `file` only for demos (ephemeral on Railway filesystem).
3. **Production auth** — `AUTH_PROVIDER=wallet_challenge` is required; bootstrap is blocked when `NODE_ENV=production`.
4. **Live trading** — keep `ENABLE_LIVE_TRADING=false` until policy + wallet flows are tested.

---

## 7) Quick CLI (optional)

```bash
npm i -g @railway/cli
railway login
railway link
# From repo root for API:
railway up
# Or set root directory in dashboard for frontend service
```

---

## Checklist

- [ ] GitHub repo connected
- [ ] Postgres plugin (recommended)
- [ ] API service: root `.`, env vars, health `/api/health`
- [ ] Web service: root `cletus-frontend`, env vars, health `/api/system-status`
- [ ] `SESSION_SECRET` rotated
- [ ] `NODE_ENV=production`
- [ ] `TRUST_PROXY=true`, secure cookies
- [ ] `ENABLE_LIVE_TRADING=false` until ready
- [ ] Custom domain (optional)
