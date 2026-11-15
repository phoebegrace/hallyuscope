# HallyuScope: Cloudflare migration (in progress)

This branch is **not ready for production**. It intentionally leaves Vercel and public DNS unchanged.

## Phase 1: edge article and sitemap routing

- Added Pages Functions for `/article`, `/article/:slug`, and `/sitemap.xml`.
- These reuse the existing `api/article.js` and `api/sitemap.js` handlers through a read-only response adapter. Published-only article checks, server-rendered Open Graph meta and the dynamic sitemap remain centralized in their original files.
- The functions still fetch article data from public GitHub `live-data`: this is a *compatibility step*, **not** the R2 migration.
- `_routes.json` explicitly opts only these dynamic routes into Functions. Static pages/assets remain static.
- Files under `api/` are still Vercel handlers, **not** deployed Cloudflare endpoints. The review dashboard, AI Center, newsletter, image upload, reactions and Meta publishing cannot safely be cut over yet.

## Required before preview or production cutover

1. Port all remaining `/api/*` endpoints to Cloudflare Functions, using `context.env` for secrets, and test real requests. Puppeteer/Chromium social-card generation needs a dedicated compatibility review.
2. Provision R2 private editorial storage and public published-media storage. Do not place unpublished article drafts in a public bucket. Add `media.hallyuscope.com` and appropriate CORS and caching.
3. Backfill published JSON and approved editorial images, change all readers/writers and GitHub Actions sync, then test public content from the new storage.
4. Configure Cloudflare Pages project from GitHub `main` **after** migration is validated, with a static output directory containing the HTML/assets and a root `functions/` directory. No secrets in the repository.
5. Test preview site: `/article`, published slug, nonexistent slug 404, legacy `?id=`, sitemap, SEO and Facebook Open Graph cards, homepage, concerts, comebacks, review login, image upload, newsletter, AI Center, Meta, mobile.
6. Switch DNS only after acceptance tests pass. Keep the old Vercel deployment operational until Cloudflare production is verified. Then make repo private only after removing raw GitHub dependencies.

## Notes

- Existing `vercel.json` is retained until cutover.
- `main` has a 10-post/24h Meta limit and 30-minute spacing. Preserve these guardrails.
- This branch is isolated from production to avoid accidental Cloudflare deploys.
- If a build system copies the static site into a separate output folder, copy `_routes.json` into that output folder as well.
