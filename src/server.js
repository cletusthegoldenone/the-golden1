const http = require('http');
const { URL } = require('url');
const { recordConsent, hasAcceptedLatest, getConsentHistory } = require('./legal');
const { getUser, state, saveState } = require('./store');
const { evaluateTradeAuthorization } = require('./tradingAuth');
const { toCsv, summarize, TAX_DISCLAIMER } = require('./taxCenter');
const {
  AUTH_BOOTSTRAP_TOKEN,
  MAX_BODY_BYTES,
  RATE_LIMIT_PUBLIC_MAX,
  RATE_LIMIT_PUBLIC_WINDOW_MS,
  RATE_LIMIT_PROTECTED_MAX,
  RATE_LIMIT_PROTECTED_WINDOW_MS,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS
} = require('./config');
const { createSessionToken, verifySessionToken, tokenFromRequest, sessionCookie } = require('./auth');
const { RateLimiter } = require('./rateLimit');

const limiter = new RateLimiter();

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
  };
}

function json(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    ...securityHeaders(),
    'Content-Type': 'application/json',
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function html(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    ...securityHeaders(),
    'Content-Type': 'text/html; charset=utf-8',
    ...extraHeaders
  });
  res.end(payload);
}

function rateLimitExceeded(res, scope, retryAfterSeconds) {
  return json(
    res,
    429,
    {
      error: 'rate_limited',
      reasonCode: 'RATE_LIMIT_EXCEEDED',
      scope,
      retryAfterSeconds
    },
    { 'Retry-After': String(retryAfterSeconds) }
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let bytes = 0;

    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        const err = new Error('payload_too_large');
        err.code = 'PAYLOAD_TOO_LARGE';
        req.destroy(err);
        return;
      }
      data += chunk;
    });

    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (_) {
        const err = new Error('invalid_json');
        err.code = 'INVALID_JSON';
        reject(err);
      }
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

function identityFromLegacy(reqUrl, req) {
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

function verifyAuthContext(reqUrl, req) {
  const token = tokenFromRequest(req);
  const auth = verifySessionToken(token);
  if (!auth.ok) {
    return { ok: false, status: 401, body: { error: 'unauthorized', reasonCode: auth.reasonCode } };
  }

  const legacyIdentity = identityFromLegacy(reqUrl, req);
  if (legacyIdentity && legacyIdentity !== auth.identity) {
    return {
      ok: false,
      status: 403,
      body: { error: 'forbidden', reasonCode: 'AUTH_IDENTITY_MISMATCH' }
    };
  }

  if (!hasAcceptedLatest(auth.identity)) {
    return {
      ok: false,
      status: 403,
      body: { blocked: true, reasonCode: 'LEGAL_ACCEPTANCE_REQUIRED', legalPath: '/legal' }
    };
  }

  return {
    ok: true,
    identity: auth.identity
  };
}

function validateIdentity(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
}

function validateBootstrapToken(req) {
  const token = req.headers['x-bootstrap-token'];
  if (!token) {
    return { ok: false, status: 401, body: { error: 'unauthorized', reasonCode: 'AUTH_BOOTSTRAP_REQUIRED' } };
  }
  if (token !== AUTH_BOOTSTRAP_TOKEN) {
    return { ok: false, status: 401, body: { error: 'unauthorized', reasonCode: 'AUTH_BOOTSTRAP_INVALID' } };
  }
  return { ok: true };
}

function createApp() {
  return http.createServer(async (req, res) => {
    try {
      const reqUrl = new URL(req.url, 'http://localhost');
      const isProtected = isProtectedPath(reqUrl.pathname);
      const sourceIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      const scope = isProtected ? 'protected' : 'public';
      const limit = isProtected ? RATE_LIMIT_PROTECTED_MAX : RATE_LIMIT_PUBLIC_MAX;
      const windowMs = isProtected ? RATE_LIMIT_PROTECTED_WINDOW_MS : RATE_LIMIT_PUBLIC_WINDOW_MS;
      const rate = limiter.consume({ key: `${scope}:${sourceIp}`, limit, windowMs });
      if (!rate.allowed) {
        return rateLimitExceeded(res, scope, rate.retryAfterSeconds);
      }

      let identity = null;
      if (isProtected) {
        const auth = verifyAuthContext(reqUrl, req);
        if (!auth.ok) {
          return json(res, auth.status, auth.body);
        }
        identity = auth.identity;
      }

      if (req.method === 'GET' && reqUrl.pathname === '/legal') {
        html(res, 200, legalGateHtml());
        return;
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/legal/accept') {
        const body = await readBody(req).catch((err) => err);
        if (body instanceof Error) {
          if (body.code === 'PAYLOAD_TOO_LARGE') return json(res, 413, { error: 'payload_too_large' });
          return json(res, 400, { error: 'invalid_json' });
        }

        if (!validateIdentity(body.identity) || body.accepted !== true) {
          return json(res, 400, { error: 'identity and accepted=true required' });
        }
        const log = recordConsent({
          identity: body.identity.trim(),
          accepted: body.accepted,
          sessionId: req.headers['x-session-id'],
          ip: sourceIp,
          userAgent: req.headers['user-agent']
        });
        return json(res, 200, { ok: true, consent: log });
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/register') {
        const body = await readBody(req).catch((err) => err);
        if (body instanceof Error) {
          if (body.code === 'PAYLOAD_TOO_LARGE') return json(res, 413, { error: 'payload_too_large' });
          return json(res, 400, { error: 'invalid_json' });
        }

        if (!validateIdentity(body.identity)) return json(res, 400, { error: 'identity required' });
        const normalizedIdentity = body.identity.trim();
        if (!hasAcceptedLatest(normalizedIdentity)) {
          return json(res, 403, { blocked: true, reasonCode: 'LEGAL_ACCEPTANCE_REQUIRED', legalPath: '/legal' });
        }
        const user = getUser(normalizedIdentity);
        user.onboarding.accountCreated = true;
        saveState();
        return json(res, 200, { ok: true, onboarding: onboardingStatus(user.onboarding) });
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/session/login') {
        const bootstrap = validateBootstrapToken(req);
        if (!bootstrap.ok) return json(res, bootstrap.status, bootstrap.body);

        const body = await readBody(req).catch((err) => err);
        if (body instanceof Error) {
          if (body.code === 'PAYLOAD_TOO_LARGE') return json(res, 413, { error: 'payload_too_large' });
          return json(res, 400, { error: 'invalid_json' });
        }

        if (!validateIdentity(body.identity)) {
          return json(res, 400, { error: 'identity required' });
        }

        const normalizedIdentity = body.identity.trim();
        if (!hasAcceptedLatest(normalizedIdentity)) {
          return json(res, 403, { blocked: true, reasonCode: 'LEGAL_ACCEPTANCE_REQUIRED', legalPath: '/legal' });
        }

        const token = createSessionToken(normalizedIdentity);
        return json(
          res,
          200,
          {
            ok: true,
            identity: normalizedIdentity,
            expiresInSeconds: SESSION_TTL_SECONDS,
            token
          },
          { 'Set-Cookie': sessionCookie(token) }
        );
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/session/logout') {
        return json(
          res,
          200,
          { ok: true },
          { 'Set-Cookie': `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0` }
        );
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/protected/onboarding/profile') {
        const body = await readBody(req).catch((err) => err);
        if (body instanceof Error) {
          if (body.code === 'PAYLOAD_TOO_LARGE') return json(res, 413, { error: 'payload_too_large' });
          return json(res, 400, { error: 'invalid_json' });
        }

        const user = getUser(identity);
        user.profile = {
          riskLevel: body.riskLevel || 'medium',
          preferences: body.preferences && typeof body.preferences === 'object' ? body.preferences : {}
        };
        user.onboarding.profileInitialized = true;
        saveState();
        return json(res, 200, { ok: true, profile: user.profile, onboarding: onboardingStatus(user.onboarding) });
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/protected/onboarding/wallet-mode') {
        const body = await readBody(req).catch((err) => err);
        if (body instanceof Error) {
          if (body.code === 'PAYLOAD_TOO_LARGE') return json(res, 413, { error: 'payload_too_large' });
          return json(res, 400, { error: 'invalid_json' });
        }

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
        saveState();
        return json(res, 200, { ok: true, wallet: user.wallet, onboarding: onboardingStatus(user.onboarding) });
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/protected/onboarding/constraints') {
        const body = await readBody(req).catch((err) => err);
        if (body instanceof Error) {
          if (body.code === 'PAYLOAD_TOO_LARGE') return json(res, 413, { error: 'payload_too_large' });
          return json(res, 400, { error: 'invalid_json' });
        }

        const user = getUser(identity);
        user.constraints = {
          ...user.constraints,
          ...(body && typeof body === 'object' ? body : {})
        };
        user.onboarding.constraintsConfigured = true;
        saveState();
        return json(res, 200, { ok: true, constraints: user.constraints, onboarding: onboardingStatus(user.onboarding) });
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/protected/onboarding/fund-or-link') {
        const user = getUser(identity);
        user.onboarding.walletFundedOrLinked = true;
        user.onboarding.completed = true;
        saveState();
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
          saveState();
        }
        return json(res, 200, { ok: true, wallet: user.wallet });
      }

      if (req.method === 'GET' && reqUrl.pathname === '/api/protected/legal/consents') {
        return json(res, 200, { consents: getConsentHistory(identity) });
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/trade/check') {
        const body = await readBody(req).catch((err) => err);
        if (body instanceof Error) {
          if (body.code === 'PAYLOAD_TOO_LARGE') return json(res, 413, { error: 'payload_too_large' });
          return json(res, 400, { error: 'invalid_json' });
        }

        const expectedGrossProfitUsd = Number(body?.expectedGrossProfitUsd ?? 0);
        const tradeSizeUsd = Number(body?.tradeSizeUsd ?? 0);
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
        const body = await readBody(req).catch((err) => err);
        if (body instanceof Error) {
          if (body.code === 'PAYLOAD_TOO_LARGE') return json(res, 413, { error: 'payload_too_large' });
          return json(res, 400, { error: 'invalid_json' });
        }

        state.operatorFlags.killSwitch = !!body?.enabled;
        saveState();
        return json(res, 200, { ok: true, killSwitch: state.operatorFlags.killSwitch });
      }

      if (req.method === 'GET' && reqUrl.pathname === '/api/protected/tax/export') {
        const user = getUser(identity);
        const txs = state.transactions.get(user.id) || [];
        const format = reqUrl.searchParams.get('format') || 'json';
        if (format === 'csv') {
          res.writeHead(200, {
            ...securityHeaders(),
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

      if (req.method === 'GET' && reqUrl.pathname === '/api/protected/wallet/status') {
        const user = getUser(identity);
        const delegation = user.wallet.delegatedPermission;
        const delegationActive = delegation
          ? !delegation.revokedAt &&
            (!delegation.expiresAt || new Date(delegation.expiresAt) > new Date())
          : false;
        return json(res, 200, {
          mode: user.wallet.mode,
          managedWalletId: user.wallet.managedWalletId,
          delegation: delegation
            ? {
                ...delegation,
                active: delegationActive,
                revokeStatus: delegation.revokedAt ? 'REVOKED' : 'ACTIVE'
              }
            : null
        });
      }

      return json(res, 404, { error: 'not_found' });
    } catch (_) {
      return json(res, 500, { error: 'internal_error' });
    }
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
