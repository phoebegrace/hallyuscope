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
2. switches to the `live-data` branch and merges `main` into it — with `-X theirs`, because both branches edit code files and a plain merge conflicts and kills the refresh (that is what broke the Nov 10, 02:45 UTC run). Generated `data/` and `assets/editorial/` are always restored from the `live-data` tip after the merge, so main's stale copies never clobber them.
3. runs Node 20
4. fetches current K-pop news, PH concert announcements, and comeback announcements
5. updates `data/*.json` on the `live-data` branch
6. commits only when the data changed

You can also run it manually from **GitHub → Actions → Refresh K-pop live data → Run workflow**.

Data lives on the `live-data` branch (and reactions on `reactions-data`). The live site reads it from `raw.githubusercontent.com/.../live-data/data/`, so hourly refreshes never trigger a Vercel redeploy — Vercel deploys are disabled for those branches in `vercel.json`.

## Vercel

This repository includes `vercel.json` and is ready to import into Vercel as a static site.

Use:
- Framework Preset: **Other**
- Root Directory: **repository root**
- Build Command: **leave empty**
- Output Directory: **leave empty**

Every push to `main` will redeploy — and deployments are limited, so batch changes into as few pushes as possible and never push a branch just for a preview. The hourly data refresh does **not** redeploy: it commits to the `live-data` branch, which has deploys disabled.

No paid API key is required for the current setup.

## Article URLs

Every published story has its own canonical URL built from words in the headline, never a random id:

`https://hallyuscope.com/article/sbs-gayo-daejeon-reveals-hosts-for-two-day-2026-festival`

The slug is stored on each draft (`slug`) and never changes once set, so a regenerated draft keeps its published link. Old `?id=<hex>` links still resolve. The per-article `<title>`, canonical and Open Graph / Twitter tags are rendered server-side by `api/article.js` (rewritten from `/article/:slug` in `vercel.json`) — the client-side rewrite in `article.js` alone is invisible to search engines and social scrapers, which do not run JavaScript. Note: editorial covers are SVGs, which Facebook/X cannot use as `og:image`, so article shares fall back to the site card (`/assets/og-image.png`) until per-article PNG covers exist.


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

For up to 100 recent stories it attempts to:
- resolve the article page
- read the page's Open Graph/Twitter image
- classify a social category
- prepare a compact HallyuScope social headline
- expose Canva-ready fields: `Category`, `Headline`, and `FeatureImage`

YouTube links are never "resolved" — YouTube blocks automated fetches, which used to produce broken `youtube.com/undefined` links. Any resolved URL that looks wrong (contains `undefined`, a bot-check/consent page) is rejected and the original link is kept.

The workflow step uses `continue-on-error: true`, so a source blocking metadata/image extraction cannot break the existing hourly news refresh.

The source image URL is metadata only. Review image usage rights before publishing third-party photography to HallyuScope social channels.


## AI article drafts

A separate optional step can turn newly discovered stories into original HallyuScope article drafts for editorial review.

- Script: `scripts/generate-article-drafts.mjs`
- Output: `data/article-drafts.json`
- Default model: `gpt-6.1-terra`
- Maximum new drafts per hourly run: 50 (workflow env `MAX_NEW_DRAFTS_PER_RUN`)
- Draft status: `pending_review`
- Quality version 2: aims for 300–550 words when the source supports it (180–300 word briefs for thin sources), never writes "the source does not specify…" filler, and regenerates thin/weak drafts on the next run. Slugs are stable across regenerations.
- Nothing is automatically published to the website or social media.

The script only runs when the GitHub Actions secret `OPENAI_API_KEY` exists. If the secret is missing or the AI step fails, the normal live-data refresh continues because the workflow step is non-blocking.

The prompt explicitly instructs the model to write original wording, avoid invented facts, and preserve source attribution. Drafts still require editorial review before publication.
