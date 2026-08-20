const crypto = require('crypto');
const http = require('http');
const { URL } = require('url');
const { recordConsent, hasAcceptedLatest, getConsentHistory } = require('./legal');
const { getUser, state, saveState, persistenceHealth } = require('./store');
const { evaluateTradeAuthorization } = require('./tradingAuth');
const { toCsv, summarize, TAX_DISCLAIMER } = require('./taxCenter');
const {
  AUTH_PROVIDER,
  AUTH_REQUIRE_SECURE_TRANSPORT,
  TRUST_PROXY,
  SOLANA_RPC_URL,
  HELIUS_API_KEY,
  OPERATOR_AUTH_TOKEN,
  OPERATOR_IDENTITIES,
  productionConfigErrors,
  MAX_BODY_BYTES,
  RATE_LIMIT_PUBLIC_MAX,
  RATE_LIMIT_PUBLIC_WINDOW_MS,
  RATE_LIMIT_PROTECTED_MAX,
  RATE_LIMIT_PROTECTED_WINDOW_MS,
  SESSION_TTL_SECONDS
} = require('./config');
const { createSessionToken, verifySessionToken, tokenFromRequest, sessionCookie, clearSessionCookie } = require('./auth');
const { createAuthProvider, AuthProviderError, walletIdentity } = require('./authProvider');
const { PersistenceError } = require('./persistence');
const { RateLimiter } = require('./rateLimit');
const {
  ExternalServiceError,
  evaluateRiskGate,
  getJupiterQuote,
  getJupiterSwap,
  recordTradeAttempt,
  submitSignedTransaction,
  updateTradeAttempt
} = require('./tradeExecution');

const limiter = new RateLimiter();
const authProvider = createAuthProvider();
const runtimeConfigErrors = productionConfigErrors();

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

function identityFromBody(body) {
  if (validateIdentity(body?.identity)) return body.identity.trim();
  try {
    if (typeof body?.walletPublicKey === 'string' && body.walletPublicKey.trim()) {
      return walletIdentity({ walletPublicKey: body.walletPublicKey });
    }
    if (typeof body?.walletPublicKeyPem === 'string' && body.walletPublicKeyPem.trim()) {
      return walletIdentity({ walletPublicKeyPem: body.walletPublicKeyPem });
    }
  } catch (_) {
    return null;
  }
  return null;
}

function requestIdFromRequest(req) {
  const header = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  if (typeof header === 'string' && header.trim()) {
    return header.trim().slice(0, 128);
  }
  return crypto.randomUUID();
}

function operatorAuthorization(identity, req) {
  const providedToken = req.headers['x-operator-token'] || req.headers['x-operator-secret'];
  const tokenAuthorized = OPERATOR_AUTH_TOKEN && providedToken === OPERATOR_AUTH_TOKEN;
  const identityAuthorized = typeof identity === 'string' && OPERATOR_IDENTITIES.includes(identity.toLowerCase());
  return {
    ok: !!tokenAuthorized || !!identityAuthorized,
    actor: identityAuthorized ? identity : tokenAuthorized ? 'operator_secret' : identity || 'anonymous',
    actorType: identityAuthorized ? 'identity' : tokenAuthorized ? 'secret' : 'unauthorized'
  };
}

function appendOperatorAudit(entry) {
  state.operatorAuditLogs.push(entry);
  saveState();
}

function requestIsSecure(req) {
  if (req.socket && req.socket.encrypted) return true;
  if (!TRUST_PROXY) return false;
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto !== 'string') return false;
  return proto.split(',').map((value) => value.trim().toLowerCase()).includes('https');
}

function authTransportGuard(req) {
  if (!AUTH_REQUIRE_SECURE_TRANSPORT) return null;
  if (requestIsSecure(req)) return null;
  return { status: 400, body: { error: 'bad_request', reasonCode: 'AUTH_TLS_REQUIRED' } };
}

function errorResponseFromException(error) {
  if (error instanceof AuthProviderError) {
    const status = Number.isInteger(error.status) ? error.status : 401;
    return { status, body: { error: status === 503 ? 'service_unavailable' : 'unauthorized', reasonCode: error.reasonCode } };
  }
  if (error instanceof PersistenceError) {
    const reasonCode = error.reasonCode || 'PERSISTENCE_UNAVAILABLE';
    const status = reasonCode === 'PERSISTENCE_CONFIG_INVALID' ? 500 : 503;
    return { status, body: { error: status === 500 ? 'internal_error' : 'service_unavailable', reasonCode } };
  }
  if (error instanceof ExternalServiceError) {
    return {
      status: error.status,
      body: { error: error.status >= 500 ? 'bad_gateway' : 'bad_request', reasonCode: error.reasonCode, details: error.details }
    };
  }
  return { status: 500, body: { error: 'internal_error' } };
}

function createApp() {
  return http.createServer(async (req, res) => {
    try {
      const reqUrl = new URL(req.url, 'http://localhost');
      const requestId = requestIdFromRequest(req);
      res.setHeader('X-Request-Id', requestId);
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

      if (req.method === 'GET' && (reqUrl.pathname === '/healthz' || reqUrl.pathname === '/api/health')) {
        return json(res, 200, { ok: true, service: 'the-golden1' });
      }

      if (req.method === 'GET' && reqUrl.pathname === '/readyz') {
        const authHealth = authProvider.health();
        const persistence = persistenceHealth();
        const ready = runtimeConfigErrors.length === 0 && authHealth.ok && persistence.ok;
        const rpcConfigErrors = runtimeConfigErrors.filter(
          (entry) => entry.includes('HELIUS') || entry.includes('SOLANA_RPC')
        );
        return json(res, ready ? 200 : 503, {
          ok: ready,
          auth: authHealth,
          persistence,
          rpc: {
            ok: rpcConfigErrors.length === 0,
            provider: HELIUS_API_KEY ? 'helius' : 'custom',
            configured: !!SOLANA_RPC_URL
          },
          configErrors: runtimeConfigErrors
        });
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/legal/accept') {
        const body = await readBody(req).catch((err) => err);
        if (body instanceof Error) {
          if (body.code === 'PAYLOAD_TOO_LARGE') return json(res, 413, { error: 'payload_too_large' });
          return json(res, 400, { error: 'invalid_json' });
        }

        const identity = identityFromBody(body);
        if (!identity || body.accepted !== true) {
          return json(res, 400, { error: 'identity and accepted=true required' });
        }
        const log = recordConsent({
          identity,
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

        const identity = identityFromBody(body);
        if (!identity) return json(res, 400, { error: 'identity required' });
        if (!hasAcceptedLatest(identity)) {
          return json(res, 403, { blocked: true, reasonCode: 'LEGAL_ACCEPTANCE_REQUIRED', legalPath: '/legal' });
        }
        const user = getUser(identity);
        user.onboarding.accountCreated = true;
        saveState();
        return json(res, 200, { ok: true, onboarding: onboardingStatus(user.onboarding) });
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/session/login') {
        const authTransportFailure = authTransportGuard(req);
        if (authTransportFailure) return json(res, authTransportFailure.status, authTransportFailure.body);

        const body = await readBody(req).catch((err) => err);
        if (body instanceof Error) {
          if (body.code === 'PAYLOAD_TOO_LARGE') return json(res, 413, { error: 'payload_too_large' });
          return json(res, 400, { error: 'invalid_json' });
        }

        let authIdentity;
        try {
          const verified = authProvider.completeAuth({
            identity: body.identity,
            challengeId: body.challengeId,
            walletPublicKey: body.walletPublicKey,
            walletPublicKeyPem: body.walletPublicKeyPem,
            signature: body.signature,
            bootstrapToken: req.headers['x-bootstrap-token']
          });
          authIdentity = verified.identity;
        } catch (error) {
          const response = errorResponseFromException(error);
          return json(res, response.status, response.body);
        }

        if (!validateIdentity(authIdentity)) {
          return json(res, 401, { error: 'unauthorized', reasonCode: 'AUTH_IDENTITY_REQUIRED' });
        }

        if (!hasAcceptedLatest(authIdentity)) {
          return json(res, 403, { blocked: true, reasonCode: 'LEGAL_ACCEPTANCE_REQUIRED', legalPath: '/legal' });
        }

        const token = createSessionToken(authIdentity);
        return json(
          res,
          200,
          {
            ok: true,
            identity: authIdentity,
            authProvider: AUTH_PROVIDER,
            expiresInSeconds: SESSION_TTL_SECONDS,
            token
          },
          { 'Set-Cookie': sessionCookie(token) }
        );
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/auth/challenge') {
        const authTransportFailure = authTransportGuard(req);
        if (authTransportFailure) return json(res, authTransportFailure.status, authTransportFailure.body);

        const body = await readBody(req).catch((err) => err);
        if (body instanceof Error) {
          if (body.code === 'PAYLOAD_TOO_LARGE') return json(res, 413, { error: 'payload_too_large' });
          return json(res, 400, { error: 'invalid_json' });
        }

        try {
          const challenge = authProvider.beginAuth({
            walletPublicKey: body.walletPublicKey,
            walletPublicKeyPem: body.walletPublicKeyPem
          });
          return json(res, 200, { ok: true, authProvider: AUTH_PROVIDER, challenge });
        } catch (error) {
          const response = errorResponseFromException(error);
          return json(res, response.status, response.body);
        }
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/session/logout') {
        return json(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie() });
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

        const authorization = operatorAuthorization(identity, req);
        const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
        const auditEntry = {
          actor: authorization.actor,
          actorType: authorization.actorType,
          timestamp: new Date().toISOString(),
          reason: reason || null,
          requestId,
          correlationId: requestId,
          requestedState: !!body?.enabled,
          outcome: !authorization.ok ? 'denied' : reason ? 'applied' : 'invalid'
        };
        appendOperatorAudit(auditEntry);

        if (!authorization.ok) {
          return json(res, 403, { error: 'forbidden', reasonCode: 'OPERATOR_AUTH_REQUIRED', requestId });
        }
        if (!reason) {
          return json(res, 400, { error: 'bad_request', reasonCode: 'KILL_SWITCH_REASON_REQUIRED', requestId });
        }

        state.operatorFlags.killSwitch = !!body?.enabled;
        saveState();
        return json(res, 200, {
          ok: true,
          killSwitch: state.operatorFlags.killSwitch,
          audit: { actor: auditEntry.actor, timestamp: auditEntry.timestamp, reason, requestId }
        });
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/protected/trade/execute') {
        const body = await readBody(req).catch((err) => err);
        if (body instanceof Error) {
          if (body.code === 'PAYLOAD_TOO_LARGE') return json(res, 413, { error: 'payload_too_large' });
          return json(res, 400, { error: 'invalid_json' });
        }

        const amount = Number(body?.amount);
        const tradeSizeUsd = Number(body?.tradeSizeUsd ?? 0);
        const expectedGrossProfitUsd = Number(body?.expectedGrossProfitUsd ?? 0);
        if (!body?.inputMint || !body?.outputMint || !Number.isFinite(amount) || amount <= 0) {
          return json(res, 400, { error: 'inputMint, outputMint, and positive amount are required' });
        }
        if (!Number.isFinite(tradeSizeUsd) || tradeSizeUsd < 0 || !Number.isFinite(expectedGrossProfitUsd) || expectedGrossProfitUsd < 0) {
          return json(res, 400, { error: 'tradeSizeUsd and expectedGrossProfitUsd must be valid numbers' });
        }

        const user = getUser(identity);
        const attempt = recordTradeAttempt(identity, body, requestId);
        const auth = evaluateTradeAuthorization(user, {
          pair: body?.pair || `${body.inputMint}/${body.outputMint}`,
          action: body?.action || 'swap',
          tradeSizeUsd,
          expectedGrossProfitUsd
        });
        if (!auth.allowed) {
          updateTradeAttempt(attempt, {
            status: 'blocked',
            failureClass: 'policy_denied',
            reasonCode: auth.reasonCode,
            reason: auth.reason,
            metadata: { authorization: auth }
          });
          return json(res, 403, {
            ok: false,
            status: 'blocked',
            failureClass: 'policy_denied',
            attemptId: attempt.attemptId,
            reasonCode: auth.reasonCode,
            reason: auth.reason
          });
        }

        const risk = await evaluateRiskGate({
          inputMint: body.inputMint,
          outputMint: body.outputMint,
          requestId
        });
        if (!risk.allowed) {
          updateTradeAttempt(attempt, {
            status: 'blocked',
            failureClass: 'risk_denied',
            reasonCode: risk.reasonCode,
            reason: risk.reason,
            riskDecisions: risk.decisions,
            metadata: { authorization: auth }
          });
          return json(res, 403, {
            ok: false,
            status: 'blocked',
            failureClass: 'risk_denied',
            attemptId: attempt.attemptId,
            reasonCode: risk.reasonCode,
            reason: risk.reason,
            riskDecisions: risk.decisions
          });
        }

        updateTradeAttempt(attempt, {
          riskDecisions: risk.decisions,
          metadata: { authorization: auth }
        });

        let quote;
        try {
          quote = await getJupiterQuote({
            inputMint: body.inputMint,
            outputMint: body.outputMint,
            amount,
            slippageBps: body?.slippageBps,
            requestId
          });
        } catch (error) {
          updateTradeAttempt(attempt, {
            status: 'failed',
            failureClass: 'quote_failure',
            reasonCode: error.reasonCode || 'JUPITER_QUOTE_FAILED',
            reason: 'Unable to obtain Jupiter quote.'
          });
          throw error;
        }

        const userPublicKey = typeof body?.userPublicKey === 'string' && body.userPublicKey.trim()
          ? body.userPublicKey.trim()
          : typeof body?.walletPublicKey === 'string' && body.walletPublicKey.trim()
            ? body.walletPublicKey.trim()
            : null;
        if (!userPublicKey) {
          updateTradeAttempt(attempt, {
            status: 'failed',
            failureClass: 'tx_failure',
            reasonCode: 'USER_PUBLIC_KEY_REQUIRED',
            reason: 'userPublicKey is required to build a Jupiter swap transaction.',
            metadata: {
              ...attempt.metadata,
              quote: {
                inAmount: quote?.inAmount ?? String(amount),
                outAmount: quote?.outAmount ?? null
              }
            }
          });
          return json(res, 400, { error: 'userPublicKey is required to prepare a Jupiter swap' });
        }

        let swap;
        try {
          swap = await getJupiterSwap({
            quoteResponse: quote,
            userPublicKey,
            requestId
          });
        } catch (error) {
          updateTradeAttempt(attempt, {
            status: 'failed',
            failureClass: 'tx_failure',
            reasonCode: error.reasonCode || 'JUPITER_SWAP_FAILED',
            reason: 'Unable to prepare Jupiter swap transaction.'
          });
          throw error;
        }

        if (!swap?.swapTransaction) {
          updateTradeAttempt(attempt, {
            status: 'failed',
            failureClass: 'tx_failure',
            reasonCode: 'JUPITER_SWAP_FAILED',
            reason: 'Jupiter swap response did not include a transaction.'
          });
          return json(res, 502, { error: 'bad_gateway', reasonCode: 'JUPITER_SWAP_FAILED' });
        }

        const metadata = {
          ...attempt.metadata,
          quote: {
            inAmount: quote?.inAmount ?? String(amount),
            outAmount: quote?.outAmount ?? null,
            routeSegments: Array.isArray(quote?.routePlan) ? quote.routePlan.length : 0
          },
          swap: {
            lastValidBlockHeight: swap?.lastValidBlockHeight ?? null
          }
        };

        if (typeof body?.signedTransaction === 'string' && body.signedTransaction.trim()) {
          try {
            const txSignature = await submitSignedTransaction({
              signedTransaction: body.signedTransaction.trim(),
              requestId
            });
            updateTradeAttempt(attempt, {
              status: 'submitted',
              reasonCode: 'TX_SUBMITTED',
              reason: 'Trade submitted to Solana RPC.',
              txSignature,
              metadata
            });
            return json(res, 202, {
              ok: true,
              status: 'submitted',
              attemptId: attempt.attemptId,
              txSignature,
              metadata
            });
          } catch (error) {
            updateTradeAttempt(attempt, {
              status: 'failed',
              failureClass: 'tx_failure',
              reasonCode: error.reasonCode || 'SOLANA_TX_FAILED',
              reason: 'Failed to submit signed Solana transaction.',
              metadata
            });
            throw error;
          }
        }

        updateTradeAttempt(attempt, {
          status: 'prepared',
          reasonCode: 'TX_PREPARED',
          reason: 'Swap transaction prepared for client-side signature/submission.',
          metadata
        });
        return json(res, 200, {
          ok: true,
          status: 'prepared',
          attemptId: attempt.attemptId,
          swapTransaction: swap.swapTransaction,
          lastValidBlockHeight: swap?.lastValidBlockHeight ?? null,
          metadata
        });
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
    } catch (error) {
      const response = errorResponseFromException(error);
      return json(res, response.status, response.body);
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
