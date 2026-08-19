const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/server');
const { state, getUser } = require('../src/store');

function resetState() {
  state.users.clear();
  state.consentLogs.length = 0;
  state.transactions.clear();
  state.operatorFlags.killSwitch = false;
}

async function startServer() {
  const app = createApp();
  await new Promise((resolve) => app.listen(0, resolve));
  const { port } = app.address();
  return {
    app,
    baseUrl: `http://127.0.0.1:${port}`
  };
}

test('protected routes are blocked before legal acceptance', async () => {
  resetState();
  const { app, baseUrl } = await startServer();

  const res = await fetch(`${baseUrl}/api/trade/check?identity=u1`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'SOL/USDC' })
  });

  assert.equal(res.status, 403);
  const payload = await res.json();
  assert.equal(payload.reasonCode, 'LEGAL_ACCEPTANCE_REQUIRED');

  app.close();
});

test('legal acceptance enables onboarding and trading authorization checks', async () => {
  resetState();
  const { app, baseUrl } = await startServer();

  await fetch(`${baseUrl}/api/legal/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: 'u2', accepted: true })
  });

  await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: 'u2' })
  });

  const walletRes = await fetch(`${baseUrl}/api/protected/onboarding/wallet-mode?identity=u2`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'external', allowedActions: ['swap'], maxTradeSizeUsd: 1000 })
  });

  assert.equal(walletRes.status, 200);

  const tradeRes = await fetch(`${baseUrl}/api/trade/check?identity=u2`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'SOL/USDC', expectedGrossProfitUsd: 25 })
  });

  assert.equal(tradeRes.status, 200);
  const tradePayload = await tradeRes.json();
  assert.equal(tradePayload.reasonCode, 'AUTHORIZED');
  assert.equal(tradePayload.feeRouting.destinationWallet, 'h1vRxwsCLUtiD6UiKpSgNnTDUAqvXCxurFVUfvH1noj');

  app.close();
});

test('policy controls and business rules return auditable block reason codes', async () => {
  resetState();
  const { app, baseUrl } = await startServer();

  await fetch(`${baseUrl}/api/legal/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: 'u3', accepted: true })
  });

  const user = getUser('u3');
  user.trialStartedAt = '2025-01-01T00:00:00.000Z';
  user.stakeActive = false;
  user.constraints.whitelistMode = true;
  user.constraints.allowedPairs = ['BONK/USDC'];

  const whitelistBlocked = await fetch(`${baseUrl}/api/trade/check?identity=u3`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'SOL/USDC' })
  });
  assert.equal((await whitelistBlocked.json()).reasonCode, 'PAIR_NOT_WHITELISTED');

  const trialBlocked = await fetch(`${baseUrl}/api/trade/check?identity=u3`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'BONK/USDC' })
  });
  assert.equal((await trialBlocked.json()).reasonCode, 'TRIAL_ENDED_STAKE_REQUIRED');

  user.stakeActive = true;
  user.monthlyGrossProfitUsd = 10000;

  const capBlocked = await fetch(`${baseUrl}/api/trade/check?identity=u3`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'BONK/USDC', expectedGrossProfitUsd: 1 })
  });
  assert.equal((await capBlocked.json()).reasonCode, 'MONTHLY_GROSS_PROFIT_CAP_WEEKLY_PASS_REQUIRED');

  const killSwitchRes = await fetch(`${baseUrl}/api/protected/operator/kill-switch?identity=u3`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: true })
  });
  assert.equal(killSwitchRes.status, 200);

  const killBlocked = await fetch(`${baseUrl}/api/trade/check?identity=u3`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'BONK/USDC' })
  });
  assert.equal((await killBlocked.json()).reasonCode, 'GLOBAL_KILL_SWITCH_ACTIVE');

  app.close();
});

test('consent log retrieval returns versioned records for identity', async () => {
  resetState();
  const { app, baseUrl } = await startServer();

  await fetch(`${baseUrl}/api/legal/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: 'u4', accepted: true })
  });

  const res = await fetch(`${baseUrl}/api/protected/legal/consents?identity=u4`);
  assert.equal(res.status, 200);
  const { consents } = await res.json();
  assert.equal(consents.length, 1);
  assert.equal(consents[0].identity, 'u4');
  assert.equal(consents[0].acceptanceStatus, 'accepted');
  assert.ok(consents[0].policyVersions);
  assert.ok(consents[0].timestampUtc);

  app.close();
});

test('onboarding status endpoint returns current milestones for resume flow', async () => {
  resetState();
  const { app, baseUrl } = await startServer();

  await fetch(`${baseUrl}/api/legal/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: 'u5', accepted: true })
  });

  await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: 'u5' })
  });

  const res = await fetch(`${baseUrl}/api/protected/onboarding/status?identity=u5`);
  assert.equal(res.status, 200);
  const { onboarding } = await res.json();
  assert.equal(onboarding.legalAccepted, true);
  assert.equal(onboarding.accountCreated, true);
  assert.equal(onboarding.completed, false);

  app.close();
});

test('wallet status endpoint shows delegation state and revoke status', async () => {
  resetState();
  const { app, baseUrl } = await startServer();

  await fetch(`${baseUrl}/api/legal/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: 'u6', accepted: true })
  });

  await fetch(`${baseUrl}/api/protected/onboarding/wallet-mode?identity=u6`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'external', allowedActions: ['swap'], maxTradeSizeUsd: 500 })
  });

  const beforeRevoke = await fetch(`${baseUrl}/api/protected/wallet/status?identity=u6`);
  assert.equal(beforeRevoke.status, 200);
  const beforePayload = await beforeRevoke.json();
  assert.equal(beforePayload.mode, 'external');
  assert.equal(beforePayload.delegation.revokeStatus, 'ACTIVE');
  assert.equal(beforePayload.delegation.active, true);

  await fetch(`${baseUrl}/api/protected/wallet/revoke-delegation?identity=u6`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  });

  const afterRevoke = await fetch(`${baseUrl}/api/protected/wallet/status?identity=u6`);
  const afterPayload = await afterRevoke.json();
  assert.equal(afterPayload.delegation.revokeStatus, 'REVOKED');
  assert.equal(afterPayload.delegation.active, false);

  app.close();
});

test('managed wallet mode shows managedWalletId with no delegation', async () => {
  resetState();
  const { app, baseUrl } = await startServer();

  await fetch(`${baseUrl}/api/legal/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: 'u7', accepted: true })
  });

  await fetch(`${baseUrl}/api/protected/onboarding/wallet-mode?identity=u7`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'managed' })
  });

  const res = await fetch(`${baseUrl}/api/protected/wallet/status?identity=u7`);
  const payload = await res.json();
  assert.equal(payload.mode, 'managed');
  assert.ok(payload.managedWalletId);
  assert.equal(payload.delegation, null);

  app.close();
});

test('tax export returns CSV with expected headers', async () => {
  resetState();
  const { app, baseUrl } = await startServer();

  await fetch(`${baseUrl}/api/legal/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: 'u8', accepted: true })
  });

  const res = await fetch(`${baseUrl}/api/protected/tax/export?identity=u8&format=csv`);
  assert.equal(res.status, 200);
  const csv = await res.text();
  assert.ok(csv.startsWith('timestamp,pair,side,quantity,priceUsd,realizedPnlUsd'));

  app.close();
});

test('tax summary includes form references and disclaimer', async () => {
  resetState();
  const { app, baseUrl } = await startServer();

  await fetch(`${baseUrl}/api/legal/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: 'u9', accepted: true })
  });

  const res = await fetch(`${baseUrl}/api/protected/tax/summary?identity=u9`);
  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.ok(payload.mappingReferences.includes('Form 8949'));
  assert.ok(payload.mappingReferences.includes('Schedule D'));
  assert.ok(payload.disclaimer.includes('Educational only'));

  app.close();
});

test('blocklist mode blocks listed pairs with human-readable reason code', async () => {
  resetState();
  const { app, baseUrl } = await startServer();

  await fetch(`${baseUrl}/api/legal/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: 'u10', accepted: true })
  });

  const user = getUser('u10');
  user.constraints.blocklistMode = true;
  user.constraints.blockedPairs = ['SCAM/USDC'];

  const blocked = await fetch(`${baseUrl}/api/trade/check?identity=u10`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'SCAM/USDC' })
  });
  assert.equal(blocked.status, 403);
  assert.equal((await blocked.json()).reasonCode, 'PAIR_BLOCKLISTED');

  const allowed = await fetch(`${baseUrl}/api/trade/check?identity=u10`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'SOL/USDC' })
  });
  assert.equal(allowed.status, 200);
  assert.equal((await allowed.json()).reasonCode, 'AUTHORIZED');

  app.close();
});
