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

## Design

Editorial layout in the logo colours (navy #01229a, pink #fe0862) with Archivo type, a navy nav bar and footer, video mood loops in `assets/video/`, and live data rendered by `script.js`. Deploy changes from the latest `main` commit; avoid redeploying older deployments in Vercel.


## Social post enrichment

The existing live-data fetch remains unchanged. A separate additive script, `scripts/build-social-post-data.mjs`, runs after the normal fetch and writes `data/social-post-candidates.json`.

For up to 12 recent stories it attempts to:
- resolve the article page
- read the page's Open Graph/Twitter image
- classify a social category
- prepare a compact HallyuScope social headline
- expose Canva-ready fields: `Category`, `Headline`, and `FeatureImage`

The workflow step uses `continue-on-error: true`, so a source blocking metadata/image extraction cannot break the existing hourly news refresh.

The source image URL is metadata only. Review image usage rights before publishing third-party photography to HallyuScope social channels.


## AI article drafts

A separate optional step can turn newly discovered stories into original HallyuScope article drafts for editorial review.

- Script: `scripts/generate-article-drafts.mjs`
- Output: `data/article-drafts.json`
- Default model: `gpt-6.1-terra`
- Maximum new drafts per hourly run: 3
- Draft status: `pending_review`
- Nothing is automatically published to the website or social media.

The script only runs when the GitHub Actions secret `OPENAI_API_KEY` exists. If the secret is missing or the AI step fails, the normal live-data refresh continues because the workflow step is non-blocking.

The prompt explicitly instructs the model to write original wording, avoid invented facts, and preserve source attribution. Drafts still require editorial review before publication.
