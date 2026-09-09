/**
 * GTRADERME backend
 * Live Deriv market feed + paper trading + authenticated demo/real Options API.
 *
 * Node.js 18+ required.
 *
 * OAuth design:
 *  - /api/auth/start creates PKCE state and returns the Deriv login URL.
 *  - Deriv redirects to the registered GitHub Pages URL with ?code=&state=.
 *  - The existing frontend can POST code/state to /api/auth/exchange.
 *  - The server exchanges the code for the short-lived OAuth access token.
 *  - Tokens stay server-side in memory.
 *
 * Live ticks:
 *  - /api/market/stream/:symbol is a Server-Sent Events stream from the
 *    public Deriv WebSocket. Public ticks do not require authentication.
 *
 * Paper trading:
 *  - Paper trades are simulated against the same live ticks.
 *  - No Deriv order is sent when mode = paper.
 *
 * Demo/real Options trading:
 *  - The server requests a short-lived OTP for the selected Options account,
 *    connects to Deriv's authenticated WebSocket, requests proposals and buys.
 *
 * IMPORTANT:
 *  - This backend does NOT put an OAuth client secret in the browser.
 *  - Real-money execution is disabled unless ENABLE_REAL_TRADING=true.
 *  - Digit contracts are part of Deriv's legacy API surface, not the current
 *    Options API documented here. This backend therefore exposes a legacy
 *    adapter hook but does not pretend the new Options API supports digit
 *    contract types. See /api/status.
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const WebSocket = require('ws');

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const APP_ID = process.env.DERIV_CLIENT_ID || process.env.DERIV_APP_ID || '3497VuTj1R9ut2cz78ouv';
const REDIRECT_URI = process.env.DERIV_REDIRECT_URI || 'https://georgeiphone704-cyber.github.io/gtraderme';
const OAUTH_SCOPES = process.env.DERIV_OAUTH_SCOPES || 'trade';
const API_BASE = 'https://api.derivws.com';
const AUTH_BASE = 'https://auth.deriv.com';
const ENABLE_REAL_TRADING = String(process.env.ENABLE_REAL_TRADING || 'false').toLowerCase() === 'true';

const STATE_SECRET = process.env.STATE_SECRET || crypto.randomBytes(32).toString('hex');

const sessions = new Map();
const paperTrades = [];
const sseClients = new Map();
const publicStreams = new Map();
let nextSessionId = 1;
let nextPaperId = 1;

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function randomString(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function pkceChallenge(verifier) {
  return b64url(crypto.createHash('sha256').update(verifier).digest());
}

function signState(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', STATE_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyState(state) {
  if (!state || !state.includes('.')) throw new Error('Invalid OAuth state');
  const [body, sig] = state.split('.');
  const expected = crypto.createHmac('sha256', STATE_SECRET).update(body).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('Invalid OAuth state signature');
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (!payload.iat || Date.now() - payload.iat > 10 * 60 * 1000) {
    throw new Error('OAuth state expired');
  }
  return payload;
}

function safeTokenPreview(token) {
  return token ? `${token.slice(0, 6)}…${token.slice(-4)}` : null;
}

async function derivFetch(path, options = {}, accessToken) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!response.ok) {
    const err = new Error(data?.errors?.[0]?.message || data?.message || `Deriv HTTP ${response.status}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function exchangeCode(code, verifier) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: APP_ID,
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI
  });

  const response = await fetch(`${AUTH_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    const err = new Error(data?.error_description || data?.error || 'OAuth token exchange failed');
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function listAccounts(accessToken) {
  return derivFetch('/trading/v1/options/accounts', { method: 'GET' }, accessToken);
}

async function getOtp(accessToken, accountId) {
  return derivFetch(`/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`, {
    method: 'POST'
  }, accessToken);
}

function makeSession(accessToken, tokenResponse) {
  const id = crypto.randomBytes(24).toString('hex');
  sessions.set(id, {
    id,
    accessToken,
    expiresAt: Date.now() + Number(tokenResponse.expires_in || 3600) * 1000,
    createdAt: Date.now(),
    sockets: new Map()
  });
  return id;
}

function requireSession(req) {
  const id = req.headers['x-gtrader-session'] || req.query.session;
  const session = id && sessions.get(id);
  if (!session) {
    const err = new Error('Not authenticated');
    err.status = 401;
    throw err;
  }
  if (Date.now() >= session.expiresAt - 5000) {
    sessions.delete(id);
    const err = new Error('OAuth access token expired; login again');
    err.status = 401;
    throw err;
  }
  return session;
}

function sendJson(res, status, data) {
  res.status(status).json(data);
}

function broadcast(symbol, message) {
  const set = sseClients.get(symbol);
  if (!set) return;
  const payload = `data: ${JSON.stringify(message)}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch {}
  }
}

function connectPublicTicks(symbol) {
  if (publicStreams.has(symbol)) return publicStreams.get(symbol);

  const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');
  const stream = { ws, symbol, clients: 0, lastTick: null, connected: false };
  publicStreams.set(symbol, stream);

  ws.on('open', () => {
    stream.connected = true;
    ws.send(JSON.stringify({ ticks: symbol, subscribe: 1, req_id: 1 }));
    broadcast(symbol, { type: 'status', status: 'connected', symbol });
  });

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.error) {
      broadcast(symbol, { type: 'error', error: msg.error, symbol });
      return;
    }
    if (msg.msg_type === 'tick' && msg.tick) {
      const tick = {
        symbol,
        quote: Number(msg.tick.quote),
        epoch: Number(msg.tick.epoch),
        id: msg.tick.id || null,
        raw: msg.tick
      };
      stream.lastTick = tick;
      broadcast(symbol, { type: 'tick', tick });
    }
  });

  ws.on('close', () => {
    stream.connected = false;
    broadcast(symbol, { type: 'status', status: 'disconnected', symbol });
    publicStreams.delete(symbol);
    if (stream.clients > 0) setTimeout(() => connectPublicTicks(symbol), 1000);
  });

  ws.on('error', err => {
    broadcast(symbol, { type: 'error', error: { message: err.message }, symbol });
  });

  return stream;
}

app.get('/api/status', (req, res) => {
  sendJson(res, 200, {
    ok: true,
    service: 'gtraderme-backend',
    node: process.version,
    oauth: {
      configured: Boolean(APP_ID && REDIRECT_URI),
      clientId: APP_ID,
      redirectUri: REDIRECT_URI,
      scopes: OAUTH_SCOPES
    },
    liveTicks: {
      publicWebSocket: true,
      activeStreams: [...publicStreams.keys()]
    },
    trading: {
      optionsDemo: true,
      optionsReal: ENABLE_REAL_TRADING,
      realTradingEnabledByServer: ENABLE_REAL_TRADING
    },
    legacyDigits: {
      supportedByThisBackend: false,
      reason: 'Current Deriv Options API documentation does not expose digit contract types. A legacy adapter requires a compatible legacy API credential/app.'
    },
    sessions: sessions.size
  });
});

app.get('/api/auth/start', (req, res) => {
  const verifier = randomString(48);
  const state = signState({
    iat: Date.now(),
    verifier,
    nonce: randomString(16)
  });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: OAUTH_SCOPES,
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: 'S256'
  });

  sendJson(res, 200, {
    authorizationUrl: `${AUTH_BASE}/oauth2/auth?${params.toString()}`,
    redirectUri: REDIRECT_URI,
    state
  });
});

app.post('/api/auth/exchange', async (req, res) => {
  try {
    const { code, state } = req.body || {};
    const payload = verifyState(state);
    if (!code) return sendJson(res, 400, { ok: false, error: 'Missing authorization code' });

    const token = await exchangeCode(code, payload.verifier);
    const sessionId = makeSession(token.access_token, token);
    const accounts = await listAccounts(token.access_token);

    sendJson(res, 200, {
      ok: true,
      sessionId,
      token: {
        expiresIn: token.expires_in,
        tokenType: token.token_type,
        preview: safeTokenPreview(token.access_token)
      },
      accounts
    });
  } catch (err) {
    sendJson(res, err.status || 500, {
      ok: false,
      error: err.message,
      details: err.data || undefined
    });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const id = req.headers['x-gtrader-session'];
  if (id) sessions.delete(id);
  sendJson(res, 200, { ok: true });
});

app.get('/api/accounts', async (req, res) => {
  try {
    const session = requireSession(req);
    const accounts = await listAccounts(session.accessToken);
    sendJson(res, 200, { ok: true, accounts });
  } catch (err) {
    sendJson(res, err.status || 500, { ok: false, error: err.message, details: err.data || undefined });
  }
});

app.get('/api/market/stream/:symbol', (req, res) => {
  const symbol = String(req.params.symbol || '').trim();
  if (!/^[A-Za-z0-9_]+$/.test(symbol)) {
    return sendJson(res, 400, { ok: false, error: 'Invalid symbol' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  if (!sseClients.has(symbol)) sseClients.set(symbol, new Set());
  sseClients.get(symbol).add(res);

  const stream = connectPublicTicks(symbol);
  stream.clients++;

  res.write(`data: ${JSON.stringify({
    type: 'status',
    status: stream.connected ? 'connected' : 'connecting',
    symbol,
    lastTick: stream.lastTick
  })}\n\n`);

  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch {}
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const set = sseClients.get(symbol);
    if (set) {
      set.delete(res);
      if (set.size === 0) sseClients.delete(symbol);
    }
    stream.clients = Math.max(0, stream.clients - 1);
    if (stream.clients === 0 && stream.ws.readyState === WebSocket.OPEN) {
      try { stream.ws.close(); } catch {}
    }
  });
});

app.get('/api/market/tick/:symbol', (req, res) => {
  const symbol = String(req.params.symbol || '').trim();
  const stream = publicStreams.get(symbol);
  sendJson(res, 200, { ok: true, symbol, tick: stream?.lastTick || null });
});

app.post('/api/paper-trades', (req, res) => {
  const {
    symbol,
    contractType,
    stake,
    prediction,
    duration,
    metadata = {}
  } = req.body || {};

  const numericStake = Number(stake);
  if (!symbol || !Number.isFinite(numericStake) || numericStake <= 0) {
    return sendJson(res, 400, { ok: false, error: 'symbol and positive stake are required' });
  }

  const trade = {
    id: `PAPER-${String(nextPaperId++).padStart(8, '0')}`,
    mode: 'paper',
    status: 'OPEN',
    symbol: String(symbol),
    contractType: contractType || null,
    stake: numericStake,
    prediction: prediction ?? null,
    duration: duration ?? null,
    openedAt: new Date().toISOString(),
    entryTick: publicStreams.get(symbol)?.lastTick || null,
    metadata
  };

  paperTrades.unshift(trade);
  if (paperTrades.length > 5000) paperTrades.length = 5000;

  sendJson(res, 201, { ok: true, trade });
});

app.get('/api/paper-trades', (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
  sendJson(res, 200, { ok: true, trades: paperTrades.slice(0, limit) });
});

app.delete('/api/paper-trades', (req, res) => {
  paperTrades.length = 0;
  sendJson(res, 200, { ok: true });
});

async function createAuthenticatedWs(session, accountId) {
  const otp = await getOtp(session.accessToken, accountId);
  const url = otp?.data?.url;
  if (!url) throw new Error('Deriv OTP response did not contain a WebSocket URL');

  const ws = new WebSocket(url);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Authenticated WebSocket connection timed out')), 15000);
    ws.once('open', () => { clearTimeout(timer); resolve(); });
    ws.once('error', err => { clearTimeout(timer); reject(err); });
  });

  return ws;
}

function wsRequest(ws, request, matcher, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Deriv WebSocket request timed out'));
    }, timeoutMs);

    const handler = raw => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.error) {
        cleanup();
        const err = new Error(msg.error.message || 'Deriv WebSocket error');
        err.data = msg;
        reject(err);
        return;
      }
      if (matcher(msg)) {
        cleanup();
        resolve(msg);
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      ws.off('message', handler);
    };

    ws.on('message', handler);
    ws.send(JSON.stringify(request));
  });
}

app.post('/api/trading/proposal', async (req, res) => {
  try {
    const session = requireSession(req);
    const {
      accountId,
      underlying_symbol,
      contract_type,
      amount,
      basis = 'stake',
      duration,
      duration_unit = 's',
      barrier,
      multiplier
    } = req.body || {};

    if (!accountId || !underlying_symbol || !contract_type) {
      return sendJson(res, 400, { ok: false, error: 'accountId, underlying_symbol and contract_type are required' });
    }

    const ws = await createAuthenticatedWs(session, accountId);
    const request = {
      proposal: 1,
      amount: Number(amount),
      basis,
      contract_type,
      duration: Number(duration),
      duration_unit,
      underlying_symbol,
      ...(barrier !== undefined ? { barrier: String(barrier) } : {}),
      ...(multiplier !== undefined ? { multiplier: Number(multiplier) } : {})
    };

    const result = await wsRequest(ws, request, msg => msg.msg_type === 'proposal');
    try { ws.close(); } catch {}
    sendJson(res, 200, { ok: true, proposal: result.proposal });
  } catch (err) {
    sendJson(res, err.status || 500, { ok: false, error: err.message, details: err.data || undefined });
  }
});

app.post('/api/trading/buy', async (req, res) => {
  try {
    const session = requireSession(req);
    const { accountId, proposalId, price } = req.body || {};

    if (!accountId || !proposalId || !Number.isFinite(Number(price))) {
      return sendJson(res, 400, { ok: false, error: 'accountId, proposalId and price are required' });
    }

    const account = String(accountId);
    const isReal = account.startsWith('CR') || account.startsWith('CRW') || account.includes('REAL');
    if (isReal && !ENABLE_REAL_TRADING) {
      return sendJson(res, 403, {
        ok: false,
        error: 'Real trading is disabled by the server. Set ENABLE_REAL_TRADING=true only when you are ready.'
      });
    }

    const ws = await createAuthenticatedWs(session, accountId);
    const result = await wsRequest(
      ws,
      { buy: String(proposalId), price: Number(price), req_id: 1001 },
      msg => msg.msg_type === 'buy'
    );

    const contractId = result.buy?.contract_id || result.buy?.longcode || null;

    if (result.buy?.contract_id) {
      ws.send(JSON.stringify({
        proposal_open_contract: 1,
        contract_id: result.buy.contract_id,
        subscribe: 1,
        req_id: 1002
      }));
    }

    sendJson(res, 200, {
      ok: true,
      mode: isReal ? 'real' : 'demo',
      buy: result.buy,
      contractId
    });

    setTimeout(() => {
      try { ws.close(); } catch {}
    }, 30000);
  } catch (err) {
    sendJson(res, err.status || 500, { ok: false, error: err.message, details: err.data || undefined });
  }
});

app.post('/api/trading/sell', async (req, res) => {
  try {
    const session = requireSession(req);
    const { accountId, contractId, price = 0 } = req.body || {};
    if (!accountId || !contractId) {
      return sendJson(res, 400, { ok: false, error: 'accountId and contractId are required' });
    }

    const ws = await createAuthenticatedWs(session, accountId);
    const result = await wsRequest(
      ws,
      { sell: String(contractId), price: Number(price) },
      msg => msg.msg_type === 'sell'
    );
    try { ws.close(); } catch {}
    sendJson(res, 200, { ok: true, sell: result.sell });
  } catch (err) {
    sendJson(res, err.status || 500, { ok: false, error: err.message, details: err.data || undefined });
  }
});

app.post('/api/account/reset-demo', async (req, res) => {
  try {
    const session = requireSession(req);
    const { accountId } = req.body || {};
    if (!accountId) return sendJson(res, 400, { ok: false, error: 'accountId is required' });

    const data = await derivFetch(
      `/trading/v1/options/accounts/${encodeURIComponent(accountId)}/reset-demo-balance`,
      { method: 'POST' },
      session.accessToken
    );
    sendJson(res, 200, { ok: true, data });
  } catch (err) {
    sendJson(res, err.status || 500, { ok: false, error: err.message, details: err.data || undefined });
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  sendJson(res, 500, { ok: false, error: 'Internal server error' });
});

app.listen(PORT, HOST, () => {
  console.log(`GTRADERME backend listening on ${HOST}:${PORT}`);
  console.log(`OAuth redirect: ${REDIRECT_URI}`);
  console.log(`Real trading enabled: ${ENABLE_REAL_TRADING}`);
});
