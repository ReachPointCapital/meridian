# Meridian
### by Reach Point Research

<img src="./public/rpr-logo-dark.jpg" alt="Reach Point Research" height="40" />

A modern, institutional-grade financial research terminal. Free, open source, and built for serious investors.

## Features
- Delayed quotes, price charts and a live market dashboard (indices, heatmap, movers, yields, Fear & Greed)
- Full financial statements: income, balance sheet and cash flow
- Models: DCF, LBO, 3-statement and scenario analysis
- Earnings and economic calendars, options calculator (Black-Scholes and Greeks), stock screener
- Accounts with a synced watchlist and per-ticker notes, local portfolio and price alerts
- Light and dark themes

## Data sources
- **Yahoo Finance** (via `yahoo-finance2`): quotes, statements, news, screeners, macro instruments
- **Polygon.io**: price history (falls back to Yahoo)
- **FRED** (optional key): central-bank rates, M2 and economic releases
- Financial Modeling Prep and Alpha Vantage as fallbacks; CNN Fear & Greed; SEC EDGAR filings

## Run it locally
Requires Node 22 or newer.

```bash
npm install
cp .env.example .env     # add your keys (see below)
npm start                # http://localhost:3000
```

`npm start` serves the site and the serverless functions in `api/` together (see `src/setupProxy.js`), so there is no
need for `vercel dev`. Editing a file in `api/` or `src/` takes effect without a restart.

### Environment variables
| Variable | Used for |
| --- | --- |
| `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY` | Sign-in, watchlist and notes (browser). Set up in [docs/supabase-setup.md](docs/supabase-setup.md) |
| `POLYGON_KEY` | Price charts (optional, Yahoo is the fallback) |
| `FMP_KEY`, `ALPHA_VANTAGE_KEY` | Fallback data sources (optional) |
| `FRED_API_KEY` | Central-bank rates, M2 and economic releases (optional, without it those panels show stale fallback data) |
| `ANTHROPIC_API_KEY` | The AI daily brief (optional, the feature is off without it) |

Variables starting with `REACT_APP_` are public: they are built into the site. Keep everything else in `.env`, which is
git-ignored.

## Tests
```bash
npm run test:api     # serverless functions: statement mapping, Yahoo client
npm run test:utils   # formatters, theme contrast, sign-in helpers, price flash
```
`npm run build` is what Vercel runs; it treats lint warnings as errors when `CI=true`.

## Layout
| Path | What it is |
| --- | --- |
| `src/` | The React app. Theme tokens (colors, radii, motion) live in `src/index.css`. |
| `api/` | Vercel serverless functions. Files starting with `_` are shared helpers, not endpoints. |
| `test/` | Tests and fixtures for `api/` |
| `supabase/schema.sql` | Database tables and row-level security for accounts |
| `docs/` | Setup guides |

## Deploying
Pushing to `main` deploys to production on Vercel; other branches get a preview URL (behind a Vercel login). The
Supabase values are baked in at build time, so changing them needs a redeploy.

## Built by
**Reach Point Research**, the research and technology division of Reach Point Capital.

---
*Meridian is not a financial advisor. Data is delayed and for informational purposes only.*
