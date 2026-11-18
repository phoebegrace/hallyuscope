# HallyuScope: Cloudflare deployment and rollback

How HallyuScope moves from Vercel to Cloudflare Pages, how to verify it, and
how to roll back. Vercel stays live and working until the Cloudflare
deployment is verified, and it stays available as the fallback afterwards.

## Architecture

| Piece | Where it lives |
|---|---|
| Static site (HTML, CSS, JS, assets) | Repo root, served by Cloudflare Pages |
| Server rendered pages and APIs (`/api/*`) | `functions/` (Pages Functions, thin wrappers over the unchanged `api/` handlers) |
| Routing and rewrites | `_redirects` at the repo root |
| Cache headers | `_headers` at the repo root |
| Project settings | `wrangler.toml` at the repo root, mirrored in the dashboard |
| Live data (news, concerts, comebacks, drafts) | `live-data` branch, read from `raw.githubusercontent.com` |
| Reactions data | `reactions-data` branch, read the same way |
| Hourly refresh | GitHub Actions, `.github/workflows/refresh-kpop-data.yml` |

There is no build step. The repo root is the build output directory.

## How vercel.json maps to Cloudflare

| vercel.json | Cloudflare equivalent |
|---|---|
| `cleanUrls: true` | Built in. Pages serves `/albums` from `albums.html` with no rule, and redirects `/albums.html` to `/albums` with a 308. Do not add a rewrite for this; a rule like `/albums /albums.html 200` loops. |
| `trailingSlash: false` | Built in. Pages redirects `/albums/` to `/albums` with a 308. No rule needed. |
| Rewrites `/article/:slug`, `/album/:slug`, `/concert/:slug` and the bare `/article`, `/album`, `/concert` to `/api/*` | `_redirects`, status 200, slug passed as `?slug=:slug` |
| Rewrite `/sitemap.xml` to `/api/sitemap` | `_redirects`, status 200 |
| `git.deploymentEnabled: live-data false, reactions-data false` | Pages project setting: Preview branch deployments set to Custom branches, excluding `live-data` and `reactions-data` (see below) |
| `/data/*` header `Cache-Control: public, max-age=0, must-revalidate` | `_headers`, exact same value |
| www to bare domain | Not possible in `_redirects` (it cannot match on host). Use a dashboard Single Redirect instead (see DNS). |

## Files in this repo

- `_redirects`: 7 rules (sitemap, 3 bare dynamic paths, 3 slug rewrites). First match wins; static rules come before dynamic ones, as the Cloudflare docs ask.
- `_headers`: 10 rules. Default is `public, max-age=0, must-revalidate` for everything (HTML pages included), `/data/*` matches vercel.json exactly, CSS/JS cache 1 hour, `/assets/*` caches 1 day, content hashed editorial covers (`/assets/editorial/*`) cache 1 year immutable, root icons and manifest cache 1 day.
- `wrangler.toml`: project name `hallyuscope`, `pages_build_output_dir = "."`, `compatibility_flags = ["nodejs_compat"]`, `compatibility_date = "2026-11-18"`. The Functions need `nodejs_compat` for Node APIs (`node:crypto`, `Buffer`).
- `functions/`: Pages Functions. The `api/` directory and `vercel.json` are untouched, so the Vercel deployment keeps working.
- `robots.txt`: unchanged. It allows all, disallows `/review` and `/api/`, and points at `https://hallyuscope.com/sitemap.xml`. It mentions no host by name except the sitemap URL, which stays the same.

## Connect the repo to Cloudflare Pages

1. In the Cloudflare dashboard, go to Workers and Pages, Create, Pages, Connect to Git.
2. Pick the GitHub account and the `phoebegrace/hallyuscope` repo. (If the repo is not listed, install the Cloudflare GitHub app on it first.)
3. Project name: `hallyuscope`.
4. Production branch: `main`.
5. Framework preset: None.
6. Build command: leave empty.
7. Build output directory: `.` (repo root).
8. Create the project. The first deploy runs automatically; that is fine, it lands on the `*.pages.dev` URL, not on the live domain.
9. Set the secrets listed below, then redeploy (Deployments, Retry deployment, or push an empty commit to `main`).
10. Set the branch deploy controls listed below before the next hourly data refresh, so the data branches never trigger a deploy.

## Pages project settings

Set these in the project, Settings, Builds and deployments (and Settings,
Environment variables for the secrets).

| Setting | Value |
|---|---|
| Production branch | `main` |
| Build command | (empty) |
| Build output directory | `.` |
| Compatibility flag | `nodejs_compat` (also in `wrangler.toml`) |
| Production branch deployments | Enabled (automatic on push to `main`) |
| Preview branch deployments | Custom branches: Include `*`, Exclude `live-data`, `reactions-data` |
| Build watch paths | Leave unset (no build step; any push to `main` deploys) |

Branch deploy controls are the Cloudflare version of the
`git.deploymentEnabled` block in `vercel.json`. Excludes are evaluated
before includes, so `live-data` and `reactions-data` never deploy even
though `*` is included. If preview deploys are not wanted at all, set
Preview branch deployments to None instead, but that also stops previews
for ordinary feature branches.

## Secrets

Set these in the Pages project, Settings, Environment variables, for both
Production and Preview. Names only; never paste values into chat, docs, or
the repo. Use the dashboard, or `wrangler pages secret put <NAME>`.

- `GITHUB_REVIEW_TOKEN`
- `REVIEW_PASSWORD`
- `META_PAGE_ACCESS_TOKEN`
- `META_PAGE_ID`
- `META_IG_USER_ID`
- `META_GRAPH_VERSION`
- `OPENAI_API_KEY`
- `OPENAI_DRAFT_MODEL`
- `AI_CENTER_MODEL`
- `BREVO_API_KEY`
- `BREVO_LIST_ID`

These are the same 11 variables Vercel uses (verified against `api/`:
every `process.env.*` reference in the handlers is one of these names, and
the social card signing secret reuses `REVIEW_PASSWORD`, so there is no
12th secret). Copy the values from Vercel, do not invent new ones. After
adding or changing a secret, redeploy: secrets only apply to new
deployments.

## Verify on the preview URL

Do all of this on the `*.pages.dev` preview URL before touching DNS.
The production `*.pages.dev` hostname stays reachable after DNS moves,
so keep using it for checks.

1. Homepage loads: `curl -sI <preview>/` returns 200.
2. Every clean URL returns 200 with the right page: `/albums`,
   `/comebacks`, `/concerts`, `/latest`, `/features`, `/profiles`,
   `/review`, `/ai-center`, `/social-card`. (Pages serves these natively;
   there is no rule for them in `_redirects`.)
3. `/albums.html` returns 308 to `/albums`, and `/albums/` returns 308
   to `/albums`.
4. Dynamic pages return the real rendered page, not the homepage:
   - `/article/<a published slug>` returns 200 with that article's
     `<title>` and canonical tag.
   - `/article?id=<a published id>` returns the same article (legacy
     links). This checks that the incoming query string survives the
     rewrite; the Cloudflare docs do not state whether it does, so test
     it rather than assuming it.
   - `/album/<a live album id>` and `/concert/<a live concert id>`
     return 200 with the right title and canonical tag.
   - `/sitemap.xml` returns 200 with `Content-Type: application/xml`
     and lists published articles, albums, and concerts.
   - A made up slug (`/article/no-such-slug`) returns the function 404
     page, not the homepage.
5. Review login works at `/review` (password check against
   `REVIEW_PASSWORD`), and the review API lists drafts.
6. Newsletter signup works (Brevo) and the subscribe endpoint answers.
7. Meta posting from `/review` is guarded the same way as on Vercel
   (same daily cap, same retry behaviour). Post to the real pages only
   when Phoebe says so.
8. `/api/social-card` renders (this was the flagged hard part of the
   migration: the old handler used headless Chrome, which cannot run in
   Workers). If it does not render on the preview, do not cut over;
   that decision is still open.
9. Cache headers, checked with `curl -sI`:
   - `/data/latest.json`: `Cache-Control: public, max-age=0, must-revalidate`
   - `/styles.css`: `public, max-age=3600, must-revalidate`
   - `/assets/og-image.png`: `public, max-age=86400, must-revalidate`
   - An editorial cover under `/assets/editorial/`: `public, max-age=31536000, immutable`
   - `/albums`: `public, max-age=0, must-revalidate`
   Note: `_headers` applies to static asset responses only. Responses
   from Functions (`/api/*` and the rewritten dynamic pages) set their
   own headers in function code; the article, album, concert, and
   sitemap handlers already set theirs.
10. Search and social checks: fetch a published article URL with a
    social debugger and confirm the `og:title`, `og:image`, and
    canonical tag are the article's, not the homepage's.

### What local testing could and could not prove

Tested 2026-11-18 with `wrangler pages dev` (wrangler 4.164.0) against
this repo. What passed: all 10 clean URLs return 200 natively,
`/albums.html` and `/albums/` return 308 to `/albums`, all 7 redirect
rules and all 10 header rules parse with no warnings, and every cache
header above came back with the exact expected value. Direct calls to
`/api/sitemap` return real XML.

What local testing could NOT prove, and must be checked on the preview:

- The `_redirects` rewrites to the Functions, on their own, do not reach
  the Functions router in `wrangler pages dev` (`/article/<slug>`,
  `/album/<slug>`, `/concert/<slug>`, and `/sitemap.xml` returned the
  homepage there). That is why the pretty URLs are routed by file-based
  Functions instead: `functions/album/[slug].js`,
  `functions/concert/[slug].js`, `functions/article/[slug].js`, and
  `functions/sitemap.xml.js`, each a thin adapter over the same
  `api/*.js` handler. Verified in `wrangler pages dev` 2026-11-18:
  `/album/<slug>` and `/concert/<slug>` reach their handlers (returning
  the handler's own not-found page when the live-data fetch is
  unavailable in the sandbox), `/sitemap.xml` returns real XML, and
  unknown paths return 404 via `404.html`. The `_redirects` rules are
  kept as a fallback for the same paths and for the bare `/article`,
  `/album`, `/concert`. Re-check the pretty URLs on the preview, but
  they no longer depend on the rewrite working.
- Article, album, and concert lookups. In this sandbox the worker's
  outbound fetch to `raw.githubusercontent.com` fails, so the sitemap
  came back with static pages only and article lookups 404'd, even
  though the same URL fetched fine from the shell. That is a sandbox
  limit, not a code bug; the preview deployment has normal internet
  access, so re-check there.
- The www redirect. It is not in `_redirects` (see below) and DNS has
  not moved, so it cannot be tested until cutover.

## DNS change

Do this only after every preview check above passes.

1. First, copy every existing DNS record for `hallyuscope.com` from the
   current DNS host (registrar or Vercel DNS): A, AAAA, CNAME, MX, TXT
   (including any verification records), and anything else. Email
   records (MX, SPF, DKIM) must be recreated exactly, or mail breaks.
2. Recommended route: move the nameservers to Cloudflare. In the
   Cloudflare dashboard, add the `hallyuscope.com` zone, copy the
   records from step 1 into it, then set the Cloudflare nameservers at
   the registrar. DNS propagation can take up to 24 hours; the old DNS
   keeps answering until it stops.
3. Alternative route, if the nameservers must stay where they are:
   point the apex at the Pages project with a CNAME or ALIAS to the
   `*.pages.dev` hostname, and point `www` at the same target. This
   keeps DNS at the registrar, but the www redirect below then needs
   the zone on Cloudflare to work as a Single Redirect, so prefer the
   nameserver move.
4. In the Pages project, Custom domains, add `hallyuscope.com` and
   `www.hallyuscope.com`. Both must be attached, or `www` will not
   resolve to the project at all.
5. Create the www redirect as a dashboard Single Redirect on the zone
   (Rules, Redirect Rules, or the built-in redirect from www to root
   template): match `https://www.hallyuscope.com/*`, target
   `https://hallyuscope.com/$1`, status 301, preserve query string on.
   This is the rule that `_redirects` cannot express, because
   `_redirects` sources must be relative paths and Cloudflare lists
   domain level redirects as unsupported there. The same rule is written
   as a comment in `_redirects` so the intent stays in the repo.
6. Verify live: `curl -sI https://hallyuscope.com/` is 200,
   `curl -sI https://www.hallyuscope.com/albums` is 301 to
   `https://hallyuscope.com/albums`, and the checks in the preview
   section pass again on the live domain. Check a deep link with a
   query string too, for example an article URL with `?utm_source=`
   attached, and confirm the parameters survive.
7. Leave the Vercel deployment alone for at least a week after cutover.

## Rollback

Vercel is the fallback. Nothing in this migration deletes the Vercel
project, its environment variables, or `vercel.json`, so rollback is a
DNS change only.

1. Point DNS back to Vercel: restore the nameservers at the registrar
   to the pre-migration values (or restore the apex A/CNAME records to
   Vercel's values, if DNS stayed at the registrar).
2. Wait for propagation, then check `https://hallyuscope.com/` and a
   few article, album, and concert URLs answer from Vercel with the
   right content.
3. Optional: pause the Cloudflare side so it cannot take traffic by
   accident. Either remove the custom domains from the Pages project
   (it stays reachable on `*.pages.dev`) or turn off automatic
   production branch deployments in Settings, Builds and deployments.
   Do not delete the Pages project until the migration is confirmed
   settled; recreating it means re-entering all 11 secrets.
4. If the rollback is permanent, note it in the README and in this
   file, and say why, so the next attempt does not repeat the same
   failure.

## GitHub Actions audit (no workflow change needed)

`.github/workflows/refresh-kpop-data.yml` runs hourly (cron `17 * * * *`),
plus manually and on push to `.github/refresh-now.txt`. It checks out the
repo, switches to the `live-data` branch, merges `main` into it, runs the
fetch scripts, and pushes the result to `live-data` only. It never
commits to `main` and never pushes any other branch. The step name
"Commit refreshed data without deploying Vercel" is now out of date in
wording only; the behaviour it describes (data commits do not deploy)
is preserved by the branch deploy controls above, not by the workflow.

What the workflow touches:

- Branches: `live-data` only (reads `main`, writes `live-data`).
  `reactions-data` is written by the reactions API, not by any workflow.
- Could it trigger a Pages deploy? Only if the Pages project deploys
  the `live-data` branch. With Preview branch deployments set to Custom
  branches excluding `live-data` and `reactions-data`, it cannot. This
  is a dashboard setting, not something the workflow can enforce, so
  confirm it in the dashboard before the next hourly run after the
  project is created. The hourly run commits roughly once an hour, so a
  misconfigured setting would show up quickly as unwanted preview
  deployments.
- The workflow file itself lives on `main`, so editing it deploys like
  any other `main` change. That is fine; it changes rarely.

## Platform behaviours that differ from Vercel

- Clean URLs and trailing slashes are platform defaults on Pages, not
  config. Do not re-add rules for them.
- Unknown paths serve `index.html` with a 200 on Pages when no
  `404.html` exists. A `404.html` is now in the repo root (same shell as
  the homepage, "Page not found" with a link home), verified in local
  dev: `/nonexistent-page` returns 404 with that page.
- `_headers` and `_redirects` do not apply to responses generated by
  Pages Functions. Function response headers live in the handler code.
- Pages keeps every deployment, including previews, reachable at its
  hash URL until deleted. Old preview URLs do not vanish when a new
  production deploy lands.
