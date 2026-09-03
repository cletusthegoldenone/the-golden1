# Cletus multi-page UI — where each file goes in the repo

Put these under **`cletus-frontend/`** in `the-golden1`.

| Local path in this zip | Repo path | Route |
|------------------------|-----------|-------|
| `cletus-frontend/app/page.tsx` | `cletus-frontend/app/page.tsx` | `/` Landing |
| `cletus-frontend/app/legal/page.tsx` | `cletus-frontend/app/legal/page.tsx` | `/legal` |
| `cletus-frontend/app/tax/page.tsx` | `cletus-frontend/app/tax/page.tsx` | `/tax` |
| `cletus-frontend/app/app/page.tsx` | `cletus-frontend/app/app/page.tsx` | `/app` Dashboard |
| `cletus-frontend/app/wallet/page.tsx` | `cletus-frontend/app/wallet/page.tsx` | `/app/wallet` OR `/wallet` (match your AppShell links) |
| `cletus-frontend/app/signals/page.tsx` | same under app/ | Signals |
| `cletus-frontend/app/chart/page.tsx` | | Chart |
| `cletus-frontend/app/community/page.tsx` | | Community + ticker + dev audit |
| `cletus-frontend/app/ai/page.tsx` | | Cletus AI + signals |
| `cletus-frontend/app/staking/page.tsx` | | Staking tiers |
| `cletus-frontend/app/config/page.tsx` | | Trading config |
| `cletus-frontend/app/trade/page.tsx` | | Live / active trades |
| `cletus-frontend/components/AppShell.tsx` | `cletus-frontend/components/AppShell.tsx` | Shared shell |

## Critical for live site

1. **`app/page.tsx` must be the LANDING** (hero, Enter Cletus → `/legal`).
2. **Dashboard is `app/app/page.tsx`** → URL `/app`.
3. Do **not** redirect `/` → `/app`.
4. Logo: put image at `cletus-frontend/public/cletus-logo.png`.

## Railway build (until wallet-adapter fix)

```
npm install --omit=optional --ignore-scripts && npm run build
```

Root Directory = `cletus-frontend`
