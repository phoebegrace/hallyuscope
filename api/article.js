// Serves /article/<slug> (and legacy /article?id=<id>) with correct
// per-article <title>, canonical and Open Graph / Twitter meta in the raw
// HTML. The client-side rewrite in article.js alone is not enough: search
// engines and social scrapers read the HTML without running JavaScript, so
// they would all see the same generic "HallyuScope Story" tags.
//
// Wiring (vercel.json): /article/:slug rewrites here, /article rewrites here
// too. The shell below mirrors article.html; keep the two in sync.
//
// Canonical article URLs use words from the headline, never the random id:
//   https://hallyuscope.com/article/sbs-gayo-daejeon-reveals-hosts-for-two-day-2026-festival
// Old ?id=<hex> links still resolve (lookup falls back to id).

const DRAFTS_URL = 'https://raw.githubusercontent.com/phoebegrace/hallyuscope/live-data/data/article-drafts.json';
const SITE = 'https://hallyuscope.com';
const DEFAULT_IMAGE = SITE + '/assets/og-image.png';

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Editorial covers are SVGs, which Facebook/X cannot use as og:image.
// Use the real 1200x630 site card until per-article PNG covers exist.
function shareImage(item) {
  const raw = item?.imageUrl || '';
  if (raw && !/\.svg(\?|$)/i.test(raw)) {
    try { return new URL(raw, SITE).href; } catch { /* fall through */ }
  }
  return DEFAULT_IMAGE;
}

function shell({ title, description, canonical, image }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#ffffff">
<meta name="google-site-verification" content="c7h5zaPAxsYySy4iI0ikijlJcHWMC5AtCzVtORqQqBI">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="HallyuScope">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&display=swap">
<link rel="stylesheet" href="/styles.css">
</head>
<body data-page="article">
<header class="masthead"><div class="wrap">
  <a class="mast-logo" href="/" aria-label="HallyuScope home"><img src="/assets/hallyuscope-logo.png" alt="HallyuScope" width="2032" height="344"></a>
</div></header>
<nav class="nav" aria-label="Primary"><div class="wrap nav-in">
  <div class="nav-links"><a href="/">Home</a><a href="/latest">Latest</a><a href="/concerts">Concerts</a><a href="/comebacks">Comebacks</a><a href="/features">Guides</a></div>
</div></nav>
<main class="wrap article-shell" id="article">
  <p class="meta">Loading story…</p>
</main>
<footer class="foot">
  <div class="wrap">
    <div class="foot-top">
      <div><a class="foot-logo" href="/"><img src="/assets/hallyuscope-logo.png" alt="HallyuScope" width="2032" height="344"></a><p>K-pop and Korean culture news rewritten and published on HallyuScope, with source attribution kept inside each story.</p></div>
      <div><h4>Sections</h4><ul><li><a href="/latest">Latest</a></li><li><a href="/concerts">Concerts</a></li><li><a href="/comebacks">Comebacks</a></li><li><a href="/features">Guides</a></li></ul></div>
      <div><h4>HallyuScope</h4><p>Independent coverage, weekly news, concert radar, comeback tracking and fan-first guides.</p></div>
    </div>
    <div class="foot-bottom"><span>© 2026 HallyuScope · hallyuscope.com</span><span>Independent fan publication. Not affiliated with any entertainment agency.</span></div>
  </div>
</footer>
<script src="/article.js" defer></script>
</body>
</html>`;
}

export default async function handler(req, res) {
  const slug = String(req.query?.slug || '').replace(/^\/+|\/+$/g, '');
  const id = String(req.query?.id || '');
  const generic = {
    title: 'HallyuScope Story',
    description: 'K-pop and Korean entertainment news from HallyuScope.',
    canonical: SITE + '/article',
    image: DEFAULT_IMAGE,
  };

  // No identifier: same generic shell as the static page.
  if (!slug && !id) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).send(shell(generic));
  }

  let item = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const r = await fetch(DRAFTS_URL, { signal: controller.signal, cache: 'no-store' });
      if (!r.ok) throw new Error('drafts fetch failed: ' + r.status);
      const data = await r.json();
      const items = data.items || [];
      item = items.find(x => x.status === 'published' && slug && x.slug === slug)
        || items.find(x => x.status === 'published' && id && x.id === id)
        || null;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    item = null;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  if (!item) return res.status(404).send(shell(generic));

  const title = (item.headline || 'HallyuScope Story') + ' | HallyuScope';
  return res.status(200).send(shell({
    title,
    description: item.seoDescription || item.dek || generic.description,
    canonical: SITE + '/article/' + encodeURIComponent(item.slug || item.id),
    image: shareImage(item),
  }));
}
