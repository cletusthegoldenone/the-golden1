# The Golden1 Setup & Launch Runbook

## Local setup
1. Copy environment template: `cp .env.example .env`
2. Set strong values for `SESSION_SECRET` and `AUTH_BOOTSTRAP_TOKEN`.
3. Start server: `npm start`
4. Run tests: `npm test`

## Auth/session flow (hardened)
1. Accept legal terms: `POST /api/legal/accept`
2. Register onboarding identity: `POST /api/register`
3. Exchange identity for signed session via `POST /api/session/login` with `x-bootstrap-token`.
4. Use returned cookie (`tg1_session`) or bearer token for protected routes.

Protected endpoints now require validated auth context and return reason-coded failures:
- `401 AUTH_REQUIRED` (missing session)
- `401 AUTH_INVALID` / `401 AUTH_EXPIRED` (bad/expired session)
- `403 AUTH_IDENTITY_MISMATCH` (legacy identity hint conflicts with session)
- `403 LEGAL_ACCEPTANCE_REQUIRED` (legal gate not satisfied)

## Durability and storage
- Current adapter is file-backed (`PERSISTENCE_FILE_PATH`) and persists:
  - users
  - consent logs
  - onboarding/wallet/delegation state
  - transactions
  - operator kill-switch flag
- TODO (production): migrate to managed Postgres/Redis-backed repository adapters.

## Rate limiting and abuse controls
- Public and protected endpoints have independent configurable limits.
- HTTP 429 response payload is deterministic:
  - `error: rate_limited`
  - `reasonCode: RATE_LIMIT_EXCEEDED`
  - `scope: public|protected`
  - `retryAfterSeconds`

## Launch checklist
- [ ] Legal gate enabled and acceptance required for protected routes.
- [ ] Session secret/bootstrap token rotated from defaults and stored in secret manager.
- [ ] Consent history endpoint audited (`/api/protected/legal/consents`).
- [ ] Onboarding resume/status endpoint checked (`/api/protected/onboarding/status`).
- [ ] Wallet mode paths validated (managed + external delegation).
- [ ] Delegation revocation/expiry checks validated.
- [ ] Policy engine checks validated (trial, stake, cap, weekly pass, fee route, kill switch).
- [ ] Whitelist/blocklist pre-trade validation validated.
- [ ] Tax export endpoints validated (`/api/protected/tax/export`, `/api/protected/tax/summary`).
- [ ] TLS termination enforced upstream; secure-cookie strategy validated in deployment.

## Operator runbook
- Toggle kill switch: `POST /api/protected/operator/kill-switch`
- Revoke external delegation: `POST /api/protected/wallet/revoke-delegation`
- Pull consent audit history: `GET /api/protected/legal/consents`
- Pull onboarding status for deterministic resume: `GET /api/protected/onboarding/status`

## Security tradeoffs and next-step TODOs
- This scaffold uses a bootstrap shared secret to create user sessions. Replace with real user authentication (OIDC/wallet-signature challenge) before production.
- Signed sessions assume secure secret storage and rotation discipline.
- File-backed persistence is durable for restarts but not a substitute for HA datastore durability/locking.
- Enforce HTTPS and secure-cookie policies at edge/load balancer.

## Compliance and disclosure note
The Golden1 provides educational tooling only and does not provide legal or tax advice. Users should consult qualified professionals before relying on tax or legal outcomes.
