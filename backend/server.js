'use strict';

require('dotenv').config();

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || 'development';
const API_BASE = 'https://api.derivws.com';
const AUTH_BASE = 'https://auth.deriv.com';
const CLIENT_ID = process.env.DERIV_CLIENT_ID;
const REDIRECT_URI = process.env.DERIV_REDIRECT_URI;
const FRONTEND_ORIGIN = (process.env.FRONTEND_ORIGIN || '').replace(/\/$/, '');
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!CLIENT_ID) throw new Error('Missing DERIV_CLIENT_ID');
if (!REDIRECT_URI) throw new Error('Missing DERIV_REDIRECT_URI');
if (!FRONTEND_ORIGIN) throw new Error('Missing FRONTEND_ORIGIN');
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters long');
}

const KEY = crypto.createHash('sha256').update(SESSION_SECRET).digest();
const COOKIE_SESSION = 'gtr_session';
const COOKIE_OAUTH = 'gtr_oauth';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const OAUTH_MAX_AGE = 10 * 60 * 1000;

const allowedOrigins = new Set([
  FRONTEND_ORIGIN,
  ...(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(v => v.trim().replace(/\/$/, ''))
    .filter(Boolean)
]);

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin.replace(/\/$/, ''))) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', apiLimiter);

const DATA_DIR = path.join(__dirname, 'data');
const PAPER_FILE = path.join(DATA_DIR, 'paper-trades.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(PAPER_FILE)) fs.writeFileSync(PAPER_FILE, '[]', 'utf8');

function jsonError(res, status, message, details) {
  return res.status(status).json({
    ok: false,
    error: message,
    ...(details ? { details } : {})
  });
}

function randomString(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function sha256Base64Url(value) {
  return crypto.createHash('sha256').update(value).digest('base64url');
}

function encrypt(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

function decrypt(value) {
  try {
    const raw = Buffer.from(value, 'base64url');
    if (raw.length < 28) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  } catch (_) {
    return null;
  }
}

function parseCookies(header = '') {
  const result = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

function cookieOptions(maxAge) {
  const production = NODE_ENV === 'production';
  return [
    `Max-Age=${Math.floor(maxAge / 1000)}`,
    'Path=/',
    'HttpOnly',
    production ? 'Secure' : '',
    production ? 'SameSite=None' : 'SameSite=Lax'
  ].filter(Boolean).join('; ');
}

function clearCookie(name) {
  const production = NODE_ENV === 'production';
  return [
    `${name}=`,
    'Max-Age=0',
    'Path=/',
    'HttpOnly',
    production ? 'Secure' : '',
    production ? 'SameSite=None' : 'SameSite=Lax'
  ].filter(Boolean).join('; ');
}

function setEncryptedCookie(res, name, payload, maxAge) {
  res.append('Set-Cookie', `${name}=${encodeURIComponent(encrypt(payload))}; ${cookieOptions(maxAge)}`);
}

function getCookiePayload(req, name) {
  const cookies = parseCookies(req.headers.cookie || '');
  if (!cookies[name]) return null;
  return decrypt(cookies[name]);
}

function setSession(res, session) {
  setEncryptedCookie(res, COOKIE_SESSION, session, SESSION_MAX_AGE);
}

function getSession(req) {
  const session = getCookiePayload(req, COOKIE_SESSION);
  if (!session || !session.accessToken || !session.expiresAt) return null;
  return session;
}

async function requireSession(req, res, next) {
  try {
    let session = getSession(req);
    if (!session) return jsonError(res, 401, 'Not authenticated');

    if (Date.now() >= session.expiresAt) {
      if (!session.refreshToken) return jsonError(res, 401, 'Deriv session expired; please log in again');
      session = await refreshAccessToken(session);
      setSession(res, session);
    }

    req.session = session;
    next();
  } catch (error) {
    res.append('Set-Cookie', clearCookie(COOKIE_SESSION));
    return jsonError(res, error.status || 401, error.message);
  }
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function assertAccountId(accountId) {
  return typeof accountId === 'string' && /^[A-Za-z0-9_-]{3,64}$/.test(accountId);
}

async function derivFetch(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = { raw: text }; }
  if (!response.ok) {
    const message = body?.errors?.[0]?.message || body?.error_description || body?.error || `Deriv HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function exchangeCode({ code, state, codeVerifier }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier
  });

  const response = await fetch(`${AUTH_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = {}; }
  if (!response.ok || !data.access_token) {
    const message = data.error_description || data.error || `OAuth token exchange failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.body = data;
    throw error;
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    tokenType: data.token_type || 'Bearer',
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 3600) - 30) * 1000,
    state,
    userKey: randomString(24)
  };
}

async function refreshAccessToken(session) {
  if (!session.refreshToken) throw new Error('No refresh token was supplied by Deriv');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: session.refreshToken
  });

  const response = await fetch(`${AUTH_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = {}; }
  if (!response.ok || !data.access_token) {
    const message = data.error_description || data.error || `OAuth refresh failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.body = data;
    throw error;
  }

  return {
    ...session,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || session.refreshToken,
    tokenType: data.token_type || 'Bearer',
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 3600) - 30) * 1000
  };
}

async function getAccounts(accessToken) {
  return derivFetch(`${API_BASE}/trading/v1/options/accounts`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Deriv-App-ID': CLIENT_ID,
      'Content-Type': 'application/json'
    }
  });
}

async function getAuthorizedAccounts(req) {
  try {
    return await getAccounts(req.session.accessToken);
  } catch (error) {
    if (error.status === 401 && req.session.refreshToken) {
      const refreshed = await refreshAccessToken(req.session);
      req.session = refreshed;
      return await getAccounts(refreshed.accessToken);
    }
    throw error;
  }
}

async function getOtpUrl(accessToken, accountId) {
  return derivFetch(`${API_BASE}/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Deriv-App-ID': CLIENT_ID,
      'Content-Type': 'application/json'
    }
  });
}

function accountFromResponse(payload, accountId) {
  const list = Array.isArray(payload?.data) ? payload.data : (payload?.data ? [payload.data] : []);
  return list.find(a => a.account_id === accountId) || null;
}

function readPaperTrades() {
  try {
    return JSON.parse(fs.readFileSync(PAPER_FILE, 'utf8'));
  } catch (_) {
    return [];
  }
}

function writePaperTrades(trades) {
  const temp = `${PAPER_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(trades, null, 2), 'utf8');
  fs.renameSync(temp, PAPER_FILE);
}

function paperOwner(req) {
  return req.session?.userKey || 'unknown';
}

function normalizeContractType(type) {
  return String(type || '').toUpperCase();
}

function validateDigitTrade(input) {
  const allowed = new Set([
    'DIGITDIFF', 'DIGITMATCH', 'DIGITOVER', 'DIGITUNDER', 'DIGITODD', 'DIGITEVEN'
  ]);
  const contractType = normalizeContractType(input.contract_type);
  if (!allowed.has(contractType)) throw new Error('Paper engine currently supports digit contracts only');

  const symbol = String(input.symbol || input.underlying_symbol || '');
  if (!symbol || !/^[A-Za-z0-9_]+$/.test(symbol)) throw new Error('Invalid symbol');

  const duration = Math.floor(safeNumber(input.duration, 1));
  if (duration < 1 || duration > 1000) throw new Error('Paper duration must be 1-1000 ticks');

  const stake = safeNumber(input.stake ?? input.amount, NaN);
  if (!Number.isFinite(stake) || stake <= 0) throw new Error('Paper stake must be greater than zero');

  const barrier = input.barrier == null ? null : String(input.barrier);
  if (['DIGITDIFF', 'DIGITMATCH', 'DIGITOVER', 'DIGITUNDER'].includes(contractType)) {
    if (!/^[0-9]$/.test(barrier || '')) throw new Error('This digit contract requires barrier 0-9');
  }

  const payout = input.payout == null ? null : safeNumber(input.payout, NaN);
  if (payout !== null && (!Number.isFinite(payout) || payout < 0)) throw new Error('Invalid payout');

  return { contractType, symbol, duration, stake, barrier, payout };
}

function lastDigit(quote, pipSize) {
  const numeric = Number(quote);
  if (!Number.isFinite(numeric)) return null;
  const decimals = Number.isInteger(Number(pipSize)) ? Number(pipSize) : 0;
  if (decimals > 0 && decimals <= 12) {
    const scaled = Math.round(Math.abs(numeric) * (10 ** decimals));
    return scaled % 10;
  }
  const text = String(Math.abs(quote));
  const digits = text.replace(/[^0-9]/g, '');
  return digits ? Number(digits[digits.length - 1]) : null;
}

function evaluateDigit(contractType, barrier, digit) {
  switch (contractType) {
    case 'DIGITDIFF': return digit !== Number(barrier);
    case 'DIGITMATCH': return digit === Number(barrier);
    case 'DIGITOVER': return digit > Number(barrier);
    case 'DIGITUNDER': return digit < Number(barrier);
    case 'DIGITODD': return digit % 2 === 1;
    case 'DIGITEVEN': return digit % 2 === 0;
    default: return false;
  }
}

function publicPaperMessage(type, payload) {
  return JSON.stringify({
    source: 'GTRADERME',
    mode: 'paper',
    type,
    ...payload
  });
}

function safeSend(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(typeof data === 'string' ? data : JSON.stringify(data));
}

// ---------- Health ----------
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'gtraderme-backend', time: new Date().toISOString() });
});

// ---------- OAuth ----------
app.get('/api/auth/start', (req, res) => {
  const state = randomString(24);
  const verifier = randomString(64);
  const challenge = sha256Base64Url(verifier);

  setEncryptedCookie(res, COOKIE_OAUTH, {
    state,
    verifier,
    createdAt: Date.now()
  }, OAUTH_MAX_AGE);

  const url = new URL(`${AUTH_BASE}/oauth2/auth`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', 'trade');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  res.redirect(url.toString());
});

// This endpoint is useful if the frontend callback page is already registered with Deriv.
// The callback page only needs to POST/GET the returned code and state to this backend.
app.all('/api/auth/exchange', async (req, res) => {
  try {
    const code = req.method === 'GET' ? req.query.code : req.body?.code;
    const state = req.method === 'GET' ? req.query.state : req.body?.state;
    const oauth = getCookiePayload(req, COOKIE_OAUTH);

    if (!code || !state || !oauth?.state || !oauth?.verifier) {
      return jsonError(res, 400, 'OAuth exchange data is incomplete or expired');
    }
    if (Date.now() - oauth.createdAt > OAUTH_MAX_AGE) {
      return jsonError(res, 400, 'OAuth exchange expired; start login again');
    }
    if (state !== oauth.state) {
      return jsonError(res, 400, 'OAuth state mismatch');
    }

    const token = await exchangeCode({ code, state, codeVerifier: oauth.verifier });
    setSession(res, token);
    res.append('Set-Cookie', clearCookie(COOKIE_OAUTH));

    return res.json({
      ok: true,
      authenticated: true,
      expiresAt: token.expiresAt
    });
  } catch (error) {
    console.error('OAuth exchange error:', error.message);
    return jsonError(res, error.status || 500, error.message);
  }
});

app.post('/api/auth/refresh', requireSession, async (req, res) => {
  try {
    const refreshed = await refreshAccessToken(req.session);
    setSession(res, refreshed);
    res.json({ ok: true, authenticated: true, expiresAt: refreshed.expiresAt });
  } catch (error) {
    res.append('Set-Cookie', clearCookie(COOKIE_SESSION));
    return jsonError(res, error.status || 401, error.message);
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    let session = getSession(req);
    if (!session) return res.json({ ok: true, authenticated: false });
    if (Date.now() >= session.expiresAt) {
      if (!session.refreshToken) return res.json({ ok: true, authenticated: false, reason: 'expired' });
      session = await refreshAccessToken(session);
      setSession(res, session);
    }
    res.json({
      ok: true,
      authenticated: true,
      expiresAt: session.expiresAt,
      hasRefreshToken: Boolean(session.refreshToken)
    });
  } catch (_) {
    res.append('Set-Cookie', clearCookie(COOKIE_SESSION));
    res.json({ ok: true, authenticated: false });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.append('Set-Cookie', clearCookie(COOKIE_SESSION));
  res.append('Set-Cookie', clearCookie(COOKIE_OAUTH));
  res.json({ ok: true, authenticated: false });
});

// ---------- Account REST ----------
app.get('/api/accounts', requireSession, async (req, res) => {
  try {
    const payload = await getAuthorizedAccounts(req);
    if (req.session !== getSession(req)) setSession(res, req.session);
    res.json({ ok: true, data: payload.data ?? payload });
  } catch (error) {
    return jsonError(res, error.status || 500, error.message, error.body?.errors);
  }
});

app.post('/api/accounts/:accountId/reset-demo', requireSession, async (req, res) => {
  try {
    const accountId = req.params.accountId;
    if (!assertAccountId(accountId)) return jsonError(res, 400, 'Invalid account ID');

    const accounts = await getAuthorizedAccounts(req);
    const account = accountFromResponse(accounts, accountId);
    if (!account) return jsonError(res, 404, 'Account does not belong to this authenticated user');
    if (account.account_type !== 'demo') return jsonError(res, 400, 'Only demo accounts can be reset');

    const payload = await derivFetch(`${API_BASE}/trading/v1/options/accounts/${encodeURIComponent(accountId)}/reset-demo-balance`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}`,
        'Deriv-App-ID': CLIENT_ID,
        'Content-Type': 'application/json'
      }
    });

    res.json({ ok: true, data: payload?.data ?? null });
  } catch (error) {
    return jsonError(res, error.status || 500, error.message, error.body?.errors);
  }
});

app.get('/api/ws-url/:accountId', requireSession, async (req, res) => {
  try {
    const accountId = req.params.accountId;
    if (!assertAccountId(accountId)) return jsonError(res, 400, 'Invalid account ID');
    const accounts = await getAuthorizedAccounts(req);
    const account = accountFromResponse(accounts, accountId);
    if (!account) return jsonError(res, 404, 'Account does not belong to this authenticated user');

    const payload = await getOtpUrl(req.session.accessToken, accountId);
    res.json({ ok: true, account, url: payload?.data?.url || payload?.url });
  } catch (error) {
    return jsonError(res, error.status || 500, error.message, error.body?.errors);
  }
});

// ---------- Paper trading REST ----------
app.get('/api/paper/history', requireSession, (req, res) => {
  const owner = paperOwner(req);
  const trades = readPaperTrades().filter(t => t.owner === owner).slice(-1000).reverse();
  res.json({ ok: true, data: trades });
});

app.delete('/api/paper/history', requireSession, (req, res) => {
  const owner = paperOwner(req);
  const trades = readPaperTrades().filter(t => t.owner !== owner);
  writePaperTrades(trades);
  res.json({ ok: true });
});

// ---------- Error handler ----------
app.use((err, _req, res, _next) => {
  console.error(err);
  return jsonError(res, 500, err.message || 'Internal server error');
});

// ---------- WebSocket gateway ----------
const wss = new WebSocketServer({ noServer: true, maxPayload: 100 * 1024 });

async function authorizeSocket(req, accountId) {
  let session = getSession(req);
  if (!session) throw new Error('Not authenticated');
  if (Date.now() >= session.expiresAt) {
    if (!session.refreshToken) throw new Error('Deriv session expired; please log in again');
    session = await refreshAccessToken(session);
  }
  if (!accountId) throw new Error('account_id is required for demo/real mode');
  if (!assertAccountId(accountId)) throw new Error('Invalid account_id');

  let accounts;
  try {
    accounts = await getAccounts(session.accessToken);
  } catch (error) {
    if (error.status === 401 && session.refreshToken) {
      session = await refreshAccessToken(session);
      accounts = await getAccounts(session.accessToken);
    } else {
      throw error;
    }
  }
  const account = accountFromResponse(accounts, accountId);
  if (!account) throw new Error('Account does not belong to authenticated user');
  return { session, account };
}

function attachPaperEngine(client) {
  const paperTrades = new Map();
  let subscribedSymbol = null;
  let upstream = null;

  function connectPublic() {
    upstream = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');

    upstream.on('open', () => {
      safeSend(client, publicPaperMessage('status', { connected: true, upstream: 'public' }));
    });

    upstream.on('message', raw => {
      let message;
      try { message = JSON.parse(raw.toString()); } catch (_) { return; }
      safeSend(client, raw.toString());

      if (message.msg_type !== 'tick' || !message.tick) return;
      const tick = message.tick;
      const symbol = tick.symbol;
      const quote = tick.quote;
      const digit = lastDigit(quote, tick.pip_size);
      if (digit == null) return;

      for (const [id, trade] of paperTrades) {
        if (trade.symbol !== symbol || trade.status !== 'OPEN') continue;
        trade.ticksElapsed += 1;
        trade.lastTick = { quote, epoch: tick.epoch, digit };

        if (trade.ticksElapsed >= trade.duration) {
          const win = evaluateDigit(trade.contract_type, trade.barrier, digit);
          const payout = Number.isFinite(trade.payout) ? trade.payout : 0;
          const profit = win ? payout - trade.stake : -trade.stake;
          trade.status = 'CLOSED';
          trade.result = win ? 'WIN' : 'LOSS';
          trade.profit = Number(profit.toFixed(8));
          trade.exit = trade.lastTick;
          trade.closedAt = Date.now();

          persistPaperTrade(trade);
          safeSend(client, publicPaperMessage('paper_result', { trade }));
          paperTrades.delete(id);
        } else {
          safeSend(client, publicPaperMessage('paper_update', { trade }));
        }
      }
    });

    upstream.on('close', () => {
      safeSend(client, publicPaperMessage('status', { connected: false, upstream: 'public' }));
      if (client.readyState === WebSocket.OPEN) {
        setTimeout(() => {
          if (client.readyState === WebSocket.OPEN) connectPublic();
        }, 1000);
      }
    });

    upstream.on('error', error => {
      safeSend(client, publicPaperMessage('error', { message: error.message }));
    });
  }

  function persistPaperTrade(trade) {
    const trades = readPaperTrades();
    trades.push({ ...trade });
    if (trades.length > 10000) trades.splice(0, trades.length - 10000);
    writePaperTrades(trades);
  }

  connectPublic();

  client.on('message', raw => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch (_) {
      return safeSend(client, publicPaperMessage('error', { message: 'Invalid JSON' }));
    }

    if (message.type === 'subscribe_ticks') {
      const symbol = String(message.symbol || '');
      if (!/^[A-Za-z0-9_]+$/.test(symbol)) {
        return safeSend(client, publicPaperMessage('error', { message: 'Invalid symbol' }));
      }
      subscribedSymbol = symbol;
      if (upstream?.readyState === WebSocket.OPEN) {
        upstream.send(JSON.stringify({ ticks: symbol, subscribe: 1, req_id: message.req_id || Date.now() }));
      }
      return;
    }

    if (message.type === 'paper_open') {
      try {
        const tradeInput = validateDigitTrade(message.trade || message);
        if (subscribedSymbol && tradeInput.symbol !== subscribedSymbol) {
          throw new Error(`Paper trade symbol ${tradeInput.symbol} is not the subscribed symbol ${subscribedSymbol}`);
        }

        const trade = {
          id: `P-${Date.now()}-${randomString(5)}`,
          owner: paperOwner({ session: client.__session }),
          mode: 'paper',
          status: 'OPEN',
          openedAt: Date.now(),
          ticksElapsed: 0,
          ...tradeInput,
          entry: null,
          lastTick: null,
          result: null,
          profit: null,
          exit: null,
          closedAt: null
        };
        paperTrades.set(trade.id, trade);
        safeSend(client, publicPaperMessage('paper_opened', { trade }));
        return;
      } catch (error) {
        return safeSend(client, publicPaperMessage('error', { message: error.message }));
      }
    }

    if (message.type === 'paper_cancel') {
      const id = String(message.trade_id || '');
      const trade = paperTrades.get(id);
      if (!trade) return safeSend(client, publicPaperMessage('error', { message: 'Paper trade not found' }));
      trade.status = 'CANCELLED';
      trade.closedAt = Date.now();
      persistPaperTrade(trade);
      paperTrades.delete(id);
      return safeSend(client, publicPaperMessage('paper_cancelled', { trade }));
    }

    if (message.type === 'deriv') {
      if (upstream?.readyState === WebSocket.OPEN) upstream.send(JSON.stringify(message.payload || {}));
      return;
    }
  });

  client.on('close', () => {
    if (upstream && upstream.readyState === WebSocket.OPEN) upstream.close();
  });
}

async function attachAuthenticatedProxy(client, req, accountId) {
  const { session, account } = await authorizeSocket(req, accountId);
  client.__session = session;
  client.__account = account;

  const otp = await getOtpUrl(session.accessToken, accountId);
  const upstreamUrl = otp?.data?.url || otp?.url;
  if (!upstreamUrl) throw new Error('Deriv did not return an authenticated WebSocket URL');

  const upstream = new WebSocket(upstreamUrl);

  upstream.on('open', () => {
    safeSend(client, {
      source: 'GTRADERME',
      mode: account.account_type,
      type: 'status',
      connected: true,
      account: {
        account_id: account.account_id,
        account_type: account.account_type,
        currency: account.currency
      }
    });
  });

  upstream.on('message', raw => safeSend(client, raw.toString()));

  upstream.on('close', (code, reason) => {
    safeSend(client, {
      source: 'GTRADERME',
      type: 'status',
      connected: false,
      code,
      reason: reason?.toString() || ''
    });
    if (client.readyState === WebSocket.OPEN) client.close();
  });

  upstream.on('error', error => {
    safeSend(client, {
      source: 'GTRADERME',
      type: 'error',
      message: error.message
    });
  });

  client.on('message', raw => {
    if (upstream.readyState !== WebSocket.OPEN) {
      return safeSend(client, { source: 'GTRADERME', type: 'error', message: 'Deriv connection is not ready' });
    }

    let payload;
    try { payload = JSON.parse(raw.toString()); } catch (_) {
      return safeSend(client, { source: 'GTRADERME', type: 'error', message: 'Invalid JSON' });
    }

    // The authenticated Deriv connection already belongs to the selected account.
    // Do not allow client-supplied account/login identifiers to override it.
    delete payload.loginid;
    delete payload.account_id;
    delete payload.token;
    delete payload.authorize;

    upstream.send(JSON.stringify(payload));
  });

  client.on('close', () => {
    if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
      try { upstream.close(); } catch (_) {}
    }
  });
}

server.on('upgrade', async (req, socket, head) => {
  try {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.has(origin.replace(/\/$/, ''))) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname !== '/ws/deriv') {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    const mode = String(url.searchParams.get('mode') || 'demo').toLowerCase();
    const accountId = url.searchParams.get('account_id');

    if (!['paper', 'demo', 'real'].includes(mode)) throw new Error('Invalid WebSocket mode');

    if (mode !== 'paper') {
      const session = getSession(req);
      if (!session) throw new Error('Not authenticated');
    }

    wss.handleUpgrade(req, socket, head, async client => {
      try {
        if (mode === 'paper') {
          const session = getSession(req);
          if (!session) throw new Error('Not authenticated');
          client.__session = session;
          attachPaperEngine(client);
        } else {
          await attachAuthenticatedProxy(client, req, accountId);
        }
      } catch (error) {
        safeSend(client, { source: 'GTRADERME', type: 'error', message: error.message });
        client.close();
      }
    });
  } catch (error) {
    socket.write(`HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\n\r\n${error.message}`);
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`GTRADERME backend listening on port ${PORT}`);
  console.log(`Frontend origin: ${FRONTEND_ORIGIN}`);
  console.log(`OAuth redirect: ${REDIRECT_URI}`);
});
