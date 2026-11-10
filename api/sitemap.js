// Serves /sitemap.xml with every published article, generated live from the
// same live-data drafts file api/article.js reads. The old static
// sitemap.xml listed only the 5 main pages and zero article URLs, so Google
// never learned the stories existed — and the site is not indexed yet
// (site:hallyuscope.com returns nothing as of 2026-11-10).
//
// Wiring (vercel.json): /sitemap.xml rewrites here; the static sitemap.xml
// is deleted so the rewrite is reached (a static file would win over the
// rewrite). robots.txt already points at /sitemap.xml, no change needed.
//
// Behaviour:
// - Static pages first, same as before: / (hourly, 1.0), /latest (hourly,
//   0.9), /concerts + /comebacks (daily, 0.8), /features (weekly, 0.6).
// - One <url> per published draft with a slug: /article/<slug>,
//   lastmod = publishedAt date, changefreq daily, priority 0.8.
// - Drafts still in pending_review are NOT listed (their canonical URLs
//   404 until approved, same as article.js).
// - If the drafts fetch fails, the sitemap still returns 200 with just the
//   static pages, so Google never gets an error page.
// - Cache: s-maxage=3600 + stale-while-revalidate=86400, so a newly
//   published story shows up in the sitemap within about an hour (plus the
//   ~5 min raw.githubusercontent lag already seen on publishes).

const DRAFTS_URL = 'https://raw.githubusercontent.com/phoebegrace/hallyuscope/live-data/data/article-drafts.json';
const SITE = 'https://hallyuscope.com';

const STATIC_PAGES = [
  { loc: '/', changefreq: 'hourly', priority: '1.0' },
  { loc: '/latest', changefreq: 'hourly', priority: '0.9' },
  { loc: '/concerts', changefreq: 'daily', priority: '0.8' },
  { loc: '/comebacks', changefreq: 'daily', priority: '0.8' },
  { loc: '/features', changefreq: 'weekly', priority: '0.6' },
];

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return '  <url><loc>' + esc(SITE + loc) + '</loc>'
    + (lastmod ? '<lastmod>' + esc(lastmod) + '</lastmod>' : '')
    + '<changefreq>' + changefreq + '</changefreq>'
    + '<priority>' + priority + '</priority></url>';
}

export default async function handler(req, res) {
  let articles = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const r = await fetch(DRAFTS_URL, { signal: controller.signal, cache: 'no-store' });
      if (!r.ok) throw new Error('drafts fetch failed: ' + r.status);
      const data = await r.json();
      const items = data.items || [];
      articles = items
        .filter(x => x.status === 'published' && x.slug)
        .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    articles = [];
  }

  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for (const page of STATIC_PAGES) lines.push(urlEntry(page));
  for (const item of articles) {
    const lastmod = String(item.publishedAt || '').slice(0, 10) || undefined;
    lines.push(urlEntry({
      loc: '/article/' + encodeURIComponent(item.slug),
      lastmod,
      changefreq: 'daily',
      priority: '0.8',
    }));
  }
  lines.push('</urlset>');

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(lines.join('\n') + '\n');
}
