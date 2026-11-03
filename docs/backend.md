# Meridian backend notes

The backend is the serverless functions in `api/*.js` (Vercel, Node 22, `maxDuration` 10 s, 512 MB). Files that start
with `_` are helpers, not endpoints. Run the tests with `npm run test:api`; they use no network.

## How a request is handled

Every endpoint is `module.exports = withApi(handler, { name, cache })` (`api/_api.js`). The wrapper runs, in order:

1. **CORS**: only our own origins get `Access-Control-Allow-Origin` (production, `reachpointcapital.com`, localhost:3000,
   and this project's Vercel previews). Never `*`. Add an origin in `STATIC_ORIGINS`.
2. **Methods**: `GET`, `HEAD` and `OPTIONS` only; anything else is `405`.
3. **Rate limit**: 120 requests per minute per client IP per endpoint (`429` + `Retry-After`). Article fetches (20/min)
   and the AI brief (5/min) have tighter limits of their own in `api/content.js`.
4. **Validation** (`api/_validate.js`): tickers, dates (real calendar dates, at most 400 days apart), `timeframe`,
   `period`, search text and `url` are checked once here, so handlers only ever see clean values. A bad value is a
   `400` before any upstream call is made.
5. **Errors**: a `5xx` body is always `Data is temporarily unavailable` (or `Symbol not found` as a `404`). The real
   message goes to the server log with any API key in the URL replaced by `REDACTED`. Errors are `Cache-Control: no-store`.
6. **CDN caching**: successful answers get `Cache-Control: public, s-maxage=N, stale-while-revalidate=M`. The in-memory
   cache (`api/_cache.js`, 500 entries) only absorbs bursts on one instance; the CDN does the real sharing.

Fetching a page for the article reader goes through `api/_safeFetch.js`: public hosts only (no private, loopback,
link-local or cloud-metadata addresses, no credentials or unusual ports), redirects re-checked at every hop, 1.5 MB cap,
5 s deadline. One gap remains: a hostname that changes its DNS answer between our check and the connection (DNS
rebinding). Closing it needs an outbound proxy.

## Freshness (seconds; CDN `s-maxage`)

| Data | TTL |
| --- | --- |
| Quotes, crypto | 60 |
| Movers, forex, commodities, indices, macro strip, yields | 120 |
| Sectors, heatmap | 300 |
| News | 300 |
| Chart | 60 (1D), 300 (1W), 900 (1M/3M), 3600 (1Y/5Y) |
| Company analysis/analyst/earnings history/shorts, financials (`type=all`), calendar, releases, central banks | 3600 |
| Fear & Greed | 1800 |
| Earnings calendar, IPOs, M2 | 21600 |
| Profile, peers, single statements | 86400 |
| Search | 3600 |

## Data sources

| Endpoint | Source | Notes |
| --- | --- | --- |
| quotes, movers, sectors, heatmap, forex, commodities, indices, crypto, yields, macro | Yahoo (batched) | The heatmap is 3 requests, not ~290. FMP `quote` is the fallback for `type=quote`; Alpha Vantage backs up movers (one shared call, sub-$1 stocks and warrants removed). |
| statements | Yahoo `fundamentalsTimeSeries` | |
| earnings calendar | FMP `/stable/earnings-calendar` | Names and market caps from one batched Yahoo call; falls back to the 20 largest companies. |
| economic calendar | Official FOMC dates plus rule-of-thumb estimates | Estimates are labelled `(est.)` and carry `estimated: true`. FMP's economic calendar is a paid plan feature. |
| releases, M2, central banks | FRED public CSV (`fredgraph.csv`) and the Bank of England CSV | No API key. When a source is down the endpoint errors; nothing is invented. Update `FOMC_2026` in `api/_macro.js` each year. |
| IPOs | SEC EDGAR full-text search (424B4 and S-1) | |
| peers | Yahoo recommendations | Same `{ peers: [{ symbol, peersList }] }` shape the Models page reads. |
| AI brief | Anthropic Messages API | Optional. `ANTHROPIC_API_KEY`; model from `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`). 7 s timeout. |

`GET /api/health` answers without touching any upstream, for uptime monitors.

## Environment variables

`FMP_KEY` (fallbacks and the earnings calendar), `POLYGON_KEY` (chart), `ALPHA_VANTAGE_KEY` (movers fallback),
`ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` (AI brief). `FRED_API_KEY` and `TIINGO_KEY` are no longer used.

**Rotate `FMP_KEY`.** Earlier versions of `company.js` and `dashboard.js` logged full FMP URLs, key included, to the
Vercel logs. Logs are not secret storage: create a new key and retire the old one.

## Recommended Vercel settings

The per-instance limiter slows a single abuser but cannot count across instances. In **Firewall → Rules** add a rate-limit
rule on path `/api/*` (for example 100 requests per minute per IP, then challenge or deny), and a stricter one for
`/api/content` and `/api/search`. Vercel Authentication on previews already keeps the preview URLs private.
