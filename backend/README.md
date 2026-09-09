# GTRADERME Backend

This is the backend for the current GTRADERME live-trading integration.

## Included now

- Deriv OAuth 2.0 + PKCE
- Server-side OAuth token exchange
- Account discovery
- Live public Deriv tick streaming
- Paper trades based on the same live tick feed
- Authenticated Deriv Options WebSocket connections
- Demo proposal/buy/sell endpoints
- Real proposal/buy/sell endpoints guarded by ENABLE_REAL_TRADING
- Demo-balance reset
- Health/status endpoint
- No OAuth access token hard-coded in frontend
- No `.env` committed to GitHub

## Files

- `server.js`
- `package.json`
- `.gitignore`
- `.env.example`

## Important

The current Deriv API documentation exposes the new Options API for authenticated demo/real trading. Digit contract types are not exposed in the current Options API documentation. Therefore this backend deliberately does not fake digit execution. The `/api/status` endpoint reports this.

The existing GTRADERME strategy/engine can consume the live tick stream through:

`GET /api/market/stream/{SYMBOL}`

The frontend sends the returned OAuth `sessionId` in:

`X-GTRADER-SESSION: <sessionId>`

Real trading remains disabled until:

`ENABLE_REAL_TRADING=true`

is deliberately set on the server.

## Start

```bash
npm install
npm start
```

## Minimum deployment requirement

A Node.js 18+ server with WebSocket support.

GitHub Pages is for the frontend; it does not run this `server.js`.
