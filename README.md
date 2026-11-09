# HallyuScope

K-pop and Korean culture news for Filipino fans — live at [hallyuscope.com](https://hallyuscope.com).

A static Hallyu editorial site with live data refreshed automatically from free public feeds.

## Live data

The site reads these generated files:

- `data/latest.json`
- `data/concert-candidates.json`
- `data/comeback-candidates.json`
- `data/source-health.json`

The updater lives at `scripts/fetch-kpop-data.mjs` and uses Soompi RSS, Kpopmap RSS, and Google News RSS queries.

## Automatic refresh

GitHub Actions runs `.github/workflows/refresh-kpop-data.yml` every hour at minute 17.

The workflow:
1. checks out the repo
2. runs Node 20
3. fetches current K-pop news, PH concert announcements, and comeback announcements
4. updates `data/*.json`
5. commits only when the data changed

You can also run it manually from **GitHub → Actions → Refresh K-pop live data → Run workflow**.

## Vercel

This repository includes `vercel.json` and is ready to import into Vercel as a static site.

Use:
- Framework Preset: **Other**
- Root Directory: **repository root**
- Build Command: **leave empty**
- Output Directory: **leave empty**

Every push to `main` will redeploy. Because the hourly data refresh commits changes to `main`, Vercel will automatically redeploy when fresh data is available.

No paid API key is required for the current setup.


## Newsletter backend

The homepage newsletter posts to `/api/subscribe`, a Vercel Serverless Function in `api/subscribe.js`.

It uses Brevo for subscriber storage. Add these environment variables in Vercel:

- `BREVO_API_KEY` — your Brevo API key
- `BREVO_LIST_ID` — the numeric ID of the Brevo list for HallyuScope subscribers

Add them to Production and Preview environments, then redeploy. Do not commit either value to GitHub.

The endpoint validates email addresses, includes a honeypot bot check, keeps credentials server-side, and uses Brevo's `updateEnabled` behavior so repeat signups do not create duplicate contacts.
