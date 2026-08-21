# Cletus Multi-Page Flow (saved code)

Design: black background, logo every page, USDC quote.

## Routes

1. `/legal` — Disclaimer
2. `/tax` — Tax Center + 30-day trial
3. `/app` — Personal PnL dashboard
4. `/app/wallet` — Cletus wallet
5. `/app/signals` — USDC signals
6. `/app/chart` — Any-token chart
7. `/app/community` — Chat + Dev Wallet Audit
8. `/app/ai` — Talk + Live + 8 signals
9. `/app/staking` — Tiers + Coming Soon $CLETUS
10. `/app/config` — **Trading Configuration** (main event)

## Config page (`/app/config`)

- Start / Reset simulation
- Starting capital (+ presets $500–$10,000)
- Trading hours (days + start/end local time)
- Aggression: Conservative / Moderate / Aggressive / Max Risk
- Fine-tune: Position Size %, Stop Loss %, Take Profit %
- PnL margins: daily profit target, daily max loss, max concurrent positions
- Live configuration summary

APIs:
- `POST /api/protected/config`
- `POST /api/protected/simulate/start`
- `POST /api/protected/simulate/reset`

## Files

`app/page.tsx`, `app/legal`, `app/tax`, `app/wallet`, `app/signals`, `app/chart`, `app/community`, `app/ai`, `app/staking`, `app/config`, `components/AppShell.tsx`

Logo: `public/cletus-logo.png`

## Active trading (`/app/trade`)

Paired with `/app/config`:
- Engine status: stopped / active / paused / outside hours
- Start · Pause · Resume · Stop
- Snapshot of active configuration
- Daily PnL vs profit target & max loss bars
- Open positions (close each)
- Paper vs live mode flag

APIs:
- `GET /api/protected/trade/session`
- `POST /api/protected/trade/start|pause|resume|stop`
- `POST /api/protected/trade/close?id=`
