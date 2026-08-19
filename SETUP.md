# The Golden1 Setup & Launch Runbook

## Local setup
1. Copy environment template: `cp .env.example .env`
2. Install dependencies (none beyond Node runtime for current scaffold).
3. Start server: `npm start`
4. Run tests: `npm test`

## Launch checklist
- [ ] Legal gate enabled and acceptance required for protected routes.
- [ ] Consent history endpoint audited (`/api/protected/legal/consents`).
- [ ] Onboarding resume/status endpoint checked (`/api/protected/onboarding/status`).
- [ ] Wallet mode paths validated (managed + external delegation).
- [ ] Delegation revocation/expiry checks validated.
- [ ] Policy engine checks validated (trial, stake, cap, weekly pass, fee route, kill switch).
- [ ] Whitelist/blocklist pre-trade validation validated.
- [ ] Tax export endpoints validated (`/api/protected/tax/export`, `/api/protected/tax/summary`).
- [ ] Risk and educational-only disclaimers visible.

## Operator runbook
- Toggle kill switch: `POST /api/protected/operator/kill-switch`
- Revoke external delegation: `POST /api/protected/wallet/revoke-delegation`
- Pull consent audit history: `GET /api/protected/legal/consents`
- Pull onboarding status for deterministic resume: `GET /api/protected/onboarding/status`

## Compliance and disclosure note
The Golden1 provides educational tooling only and does not provide legal or tax advice. Users should consult qualified professionals before relying on tax or legal outcomes.

## External dependency / follow-up TODOs
- Legal counsel review of policy text and acceptance flow before production launch.
- Security assessment for persistence layer, auth/session hardening, and key management.
- Production data retention/consent logging policy and jurisdiction-specific privacy review.
