# The Golden1 Setup & Launch Runbook

## Local setup
1. Copy environment template: `cp .env.example .env`
2. Set strong values for `SESSION_SECRET` (and `AUTH_BOOTSTRAP_TOKEN` only if using local bootstrap auth).
3. Start server: `npm start`
4. Run tests: `npm test`

## Auth/session flow (production-ready path)
### Wallet challenge flow (recommended / production)
1. Accept legal terms: `POST /api/legal/accept`
2. Register onboarding identity: `POST /api/register`
3. Request challenge: `POST /api/auth/challenge` with `walletPublicKeyPem`.
4. Sign returned `challenge.message` client-side with wallet key.
5. Exchange signature for session via `POST /api/session/login` with:
   - `walletPublicKeyPem`
   - `challengeId`
   - `signature` (base64)
4. Use returned cookie (`tg1_session`) or bearer token for protected routes.

### Bootstrap flow (dev-only transitional path)
- Keep `AUTH_PROVIDER=bootstrap` and call `POST /api/session/login` with `identity` plus `x-bootstrap-token`.
- In `NODE_ENV=production`, bootstrap auth is blocked by readiness checks (`AUTH_PROVIDER_BOOTSTRAP_FORBIDDEN_IN_PRODUCTION`).

Protected endpoints now require validated auth context and return reason-coded failures:
- `401 AUTH_REQUIRED` (missing session)
- `401 AUTH_INVALID` / `401 AUTH_EXPIRED` (bad/expired session)
- `401 AUTH_SIGNATURE_INVALID` / `401 AUTH_CHALLENGE_EXPIRED` / `401 AUTH_CHALLENGE_REPLAYED`
- `403 AUTH_IDENTITY_MISMATCH` (legacy identity hint conflicts with session)
- `403 LEGAL_ACCEPTANCE_REQUIRED` (legal gate not satisfied)
- `400 AUTH_TLS_REQUIRED` (secure transport required for login/challenge)

## Durability and storage
- File adapter (`PERSISTENCE_ADAPTER=file`) persists:
  - users
  - consent logs
  - onboarding/wallet/delegation state
  - transactions
  - operator kill-switch flag
- Managed adapter path (`PERSISTENCE_ADAPTER=postgres`) is scaffolded with transaction hook surface (`withTransaction`) and readiness/error signaling. Wire runtime DB client before launch.

### Migration utility
- Import existing file-backed snapshot into configured target adapter:
  - `MIGRATION_SOURCE_FILE=./data/the-golden1-state.json node src/migrateState.js`
- This command is safe for file->file migration now and is the canonical import entrypoint for future Postgres wiring.

## Rate limiting and abuse controls
- Public and protected endpoints have independent configurable limits.
- HTTP 429 response payload is deterministic:
  - `error: rate_limited`
  - `reasonCode: RATE_LIMIT_EXCEEDED`
  - `scope: public|protected`
  - `retryAfterSeconds`

## Launch checklist
- [ ] Legal gate enabled and acceptance required for protected routes.
- [ ] Session secret rotated from defaults and stored in secret manager.
- [ ] Bootstrap token disabled in production (wallet challenge or other real provider only).
- [ ] Consent history endpoint audited (`/api/protected/legal/consents`).
- [ ] Onboarding resume/status endpoint checked (`/api/protected/onboarding/status`).
- [ ] Wallet mode paths validated (managed + external delegation).
- [ ] Delegation revocation/expiry checks validated.
- [ ] Policy engine checks validated (trial, stake, cap, weekly pass, fee route, kill switch).
- [ ] Whitelist/blocklist pre-trade validation validated.
- [ ] Tax export endpoints validated (`/api/protected/tax/export`, `/api/protected/tax/summary`).
- [ ] TLS termination enforced upstream; `x-forwarded-proto` forwarding validated when `TRUST_PROXY=true`.
- [ ] Production cookie policy enforced (`Secure`, `HttpOnly`, `SameSite`, domain/path as configured).
- [ ] `/readyz` integrated into deployment readiness gate.

## Operator runbook
- Toggle kill switch: `POST /api/protected/operator/kill-switch`
- Revoke external delegation: `POST /api/protected/wallet/revoke-delegation`
- Pull consent audit history: `GET /api/protected/legal/consents`
- Pull onboarding status for deterministic resume: `GET /api/protected/onboarding/status`

## Security tradeoffs and next-step TODOs
- Wallet challenge flow is production-path ready but currently PEM-signature based; if migrating to chain-native wallet verification, keep the same provider interface.
- Signed sessions assume secure secret storage and rotation discipline.
- Postgres adapter is scaffolded for managed datastore rollout; runtime DB driver + migrations are still required before launch.
- Enforce HTTPS and secure-cookie policies at edge/load balancer.
- Never log raw signatures, bootstrap tokens, or session secrets.

## Production variables and rotation notes
- Required in production:
  - `NODE_ENV=production`
  - `AUTH_PROVIDER=wallet_challenge` (or future OIDC provider implementation)
  - `SESSION_COOKIE_SECURE=true`
  - `AUTH_REQUIRE_SECURE_TRANSPORT=true`
  - `TRUST_PROXY=true` (if TLS terminates at edge/reverse proxy)
  - `SESSION_SECRET=<strong random>`
  - `PERSISTENCE_ADAPTER` + adapter-specific credentials (for file: path, for postgres: `DATABASE_URL`)
- Rotation:
  - Rotate `SESSION_SECRET` and auth-provider secrets in secret manager.
  - Use short overlap windows when rotating session secrets to avoid mass logout (future dual-key verify enhancement).

## Compliance and disclosure note
The Golden1 provides educational tooling only and does not provide legal or tax advice. Users should consult qualified professionals before relying on tax or legal outcomes.
