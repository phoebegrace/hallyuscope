# Seoul Signal PH — live-data starter

This version keeps the V3 homepage design and adds a free GitHub-based data refresh flow.

## What updates automatically

- `data/latest.json` — live K-pop headlines shown in **Latest Signal** and the trending ticker.
- `data/concert-candidates.json` — fresh Philippine concert/fancon/tour leads for editorial review.
- `data/comeback-candidates.json` — fresh comeback/release leads for editorial review.

Concerts and comeback dates are **not auto-published**. Those are intentionally review-first because search headlines frequently omit, change, or misstate dates and venues.

## Sources

The refresh script currently uses:

- Soompi RSS (`https://www.soompi.com/feed`) as a primary current Korean-entertainment feed.
- Google News RSS searches as a discovery layer for broader K-pop, Philippines concert, and comeback leads.

You can add/remove sources in `scripts/fetch-kpop-data.mjs`.

## Free GitHub setup

1. Create a new **public** GitHub repository named `seoul-signal-ph` under your account (`phoebegrace`).
2. Upload/push this project to the repository root.
3. In GitHub, open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
4. Open **Actions → Refresh K-pop data → Run workflow** once to seed the JSON immediately.
5. The included workflow then refreshes data hourly at minute 17.
6. The Pages workflow deploys on every push to `main`.

The expected free Pages URL will be:

`https://phoebegrace.github.io/seoul-signal-ph/`

## Files added

- `.github/workflows/refresh-kpop-data.yml` — hourly data refresh and commit.
- `.github/workflows/pages.yml` — static GitHub Pages deployment.
- `scripts/fetch-kpop-data.mjs` — no-dependency Node 20 fetch/parser.
- `data/*.json` — site-readable data files.

## Local preview

Do not open the page with `file://` if you want live JSON loading, because browsers block `fetch()` from local files.

From the project folder run:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.
