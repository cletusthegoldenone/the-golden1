const http = require('http');
const { URL } = require('url');
const { recordConsent, hasAcceptedLatest, getConsentHistory } = require('./legal');
const { getUser, state } = require('./store');
const { evaluateTradeAuthorization } = require('./tradingAuth');
const { toCsv, summarize, TAX_DISCLAIMER } = require('./taxCenter');

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function identityFrom(reqUrl, req) {
  return reqUrl.searchParams.get('identity') || req.headers['x-identity'] || null;
}

function isProtectedPath(pathname) {
  return pathname.startsWith('/app') || pathname.startsWith('/api/protected') || pathname === '/api/trade/check';
}

const ONBOARDING_STEPS = [
  ['legalAccepted', 'legal'],
  ['accountCreated', 'register'],
  ['profileInitialized', 'profile'],
  ['walletModeSelected', 'wallet-mode'],
  ['constraintsConfigured', 'constraints'],
  ['walletFundedOrLinked', 'fund-or-link']
];

function onboardingStatus(onboarding) {
  const next = ONBOARDING_STEPS.find(([key]) => !onboarding[key]);
  return {
    ...onboarding,
    nextStep: next ? next[1] : null,
    resumable: !!next
  };
}

function parseOptionalPositiveNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function legalGateHtml() {
  return `<!doctype html><html><head><title>The Golden1 Legal Gate</title><style>body{margin:0;font-family:sans-serif;background:#fff;color:#111}main{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}section{max-width:720px}h1{font-size:2rem}</style></head><body><main><section><h1>Legal Acceptance Required</h1><p>You must accept Terms, Risk Disclaimer, Trading Authorization Disclosures, and Privacy Acknowledgement before app access.</p></section></main></body></html>`;
}

function createApp() {
  return http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, 'http://localhost');
    const identity = identityFrom(reqUrl, req);

    if (req.method === 'GET' && reqUrl.pathname === '/legal') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(legalGateHtml());
      return;
    }

    if (isProtectedPath(reqUrl.pathname)) {
      if (!identity || !hasAcceptedLatest(identity)) {
        return json(res, 403, { blocked: true, reasonCode: 'LEGAL_ACCEPTANCE_REQUIRED', legalPath: '/legal' });
      }
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/legal/accept') {
      const body = await readBody(req).catch(() => null);
      if (!body || !body.identity || body.accepted !== true) {
        return json(res, 400, { error: 'identity and accepted=true required' });
      }
      const log = recordConsent({
        identity: body.identity,
        accepted: body.accepted,
        sessionId: req.headers['x-session-id'],
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
      });
      return json(res, 200, { ok: true, consent: log });
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/register') {
      const body = await readBody(req).catch(() => null);
      if (!body || !body.identity) return json(res, 400, { error: 'identity required' });
      if (!hasAcceptedLatest(body.identity)) {
        return json(res, 403, { blocked: true, reasonCode: 'LEGAL_ACCEPTANCE_REQUIRED', legalPath: '/legal' });
      }
      const user = getUser(body.identity);
      user.onboarding.accountCreated = true;
      return json(res, 200, { ok: true, onboarding: onboardingStatus(user.onboarding) });
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/protected/onboarding/profile') {
      const body = await readBody(req).catch(() => null);
      if (!body || !identity) return json(res, 400, { error: 'identity required' });
      const user = getUser(identity);
      user.profile = {
        riskLevel: body.riskLevel || 'medium',
        preferences: body.preferences || {}
      };
      user.onboarding.profileInitialized = true;
      return json(res, 200, { ok: true, profile: user.profile, onboarding: onboardingStatus(user.onboarding) });
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/protected/onboarding/wallet-mode') {
      const body = await readBody(req).catch(() => null);
      if (!body || !identity) return json(res, 400, { error: 'identity required' });
      if (!['managed', 'external'].includes(body.mode)) {
        return json(res, 400, { error: 'mode must be managed|external' });
      }
      const user = getUser(identity);
      user.wallet.mode = body.mode;
      if (body.mode === 'managed') {
        user.wallet.managedWalletId = `cw_${identity}`;
        user.wallet.delegatedPermission = null;
      } else {
        const allowedActions = Array.isArray(body.allowedActions)
          ? body.allowedActions.filter((value) => typeof value === 'string' && value.trim())
          : ['swap'];
        const maxTradeSizeUsd = parseOptionalPositiveNumber(body.maxTradeSizeUsd);
        const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
        if (body.expiresAt && Number.isNaN(expiresAt.getTime())) {
          return json(res, 400, { error: 'expiresAt must be a valid ISO timestamp' });
        }
        user.wallet.delegatedPermission = {
          allowedActions: allowedActions.length ? allowedActions : ['swap'],
          maxTradeSizeUsd,
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
          revocable: true,
          revokedAt: null
        };
      }
      user.onboarding.walletModeSelected = true;
      return json(res, 200, { ok: true, wallet: user.wallet, onboarding: onboardingStatus(user.onboarding) });
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/protected/onboarding/constraints') {
      const body = await readBody(req).catch(() => null);
      const user = getUser(identity);
      user.constraints = {
        ...user.constraints,
        ...body
      };
      user.onboarding.constraintsConfigured = true;
      return json(res, 200, { ok: true, constraints: user.constraints, onboarding: onboardingStatus(user.onboarding) });
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/protected/onboarding/fund-or-link') {
      const user = getUser(identity);
      user.onboarding.walletFundedOrLinked = true;
      user.onboarding.completed = true;
      return json(res, 200, { ok: true, onboarding: onboardingStatus(user.onboarding) });
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/protected/onboarding/status') {
      const user = getUser(identity);
      return json(res, 200, { onboarding: onboardingStatus(user.onboarding) });
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/protected/wallet/revoke-delegation') {
      const user = getUser(identity);
      if (user.wallet.delegatedPermission) {
        user.wallet.delegatedPermission.revokedAt = new Date().toISOString();
      }
      return json(res, 200, { ok: true, wallet: user.wallet });
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/protected/legal/consents') {
      return json(res, 200, { consents: getConsentHistory(identity) });
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/trade/check') {
      const body = await readBody(req).catch(() => null);
      const expectedGrossProfitUsd = Number(body?.expectedGrossProfitUsd || 0);
      const tradeSizeUsd = Number(body?.tradeSizeUsd || 0);
      if (!Number.isFinite(expectedGrossProfitUsd) || expectedGrossProfitUsd < 0 || !Number.isFinite(tradeSizeUsd) || tradeSizeUsd < 0) {
        return json(res, 400, { error: 'expectedGrossProfitUsd and tradeSizeUsd must be valid numbers' });
      }
      const user = getUser(identity);
      const auth = evaluateTradeAuthorization(user, {
        pair: body?.pair,
        action: body?.action || 'swap',
        tradeSizeUsd,
        expectedGrossProfitUsd
      });
      return json(res, auth.allowed ? 200 : 403, auth);
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/protected/operator/kill-switch') {
      const body = await readBody(req).catch(() => null);
      state.operatorFlags.killSwitch = !!body?.enabled;
      return json(res, 200, { ok: true, killSwitch: state.operatorFlags.killSwitch });
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/protected/tax/export') {
      const user = getUser(identity);
      const txs = state.transactions.get(user.id) || [];
      const format = reqUrl.searchParams.get('format') || 'json';
      if (format === 'csv') {
        res.writeHead(200, {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="transactions.csv"'
        });
        res.end(toCsv(txs));
        return;
      }
      if (format !== 'json') {
        return json(res, 400, { error: 'format must be json|csv' });
      }
      return json(res, 200, { disclaimer: TAX_DISCLAIMER, transactions: txs });
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/protected/tax/summary') {
      const user = getUser(identity);
      const txs = state.transactions.get(user.id) || [];
      return json(res, 200, summarize(txs));
    }

    return json(res, 404, { error: 'not_found' });
  });
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  createApp().listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`The Golden1 server listening on :${port}`);
  });
}

module.exports = {
  createApp
};
