import { readFile, writeFile } from 'node:fs/promises';

const DATA_DIR = new URL('../data/', import.meta.url);
const OUTPUT = new URL('social-post-candidates.json', DATA_DIR);
const MAX_ITEMS = 12;
const MAX_HTML_BYTES = 2_000_000;

function cleanText(value='') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripPublisherSuffix(title='') {
  return cleanText(title).replace(/\s+-\s+[^-]{2,45}$/u, '').trim();
}

function socialCategory(item={}) {
  const text = `${item.title || ''} ${item.source || ''}`.toLowerCase();
  if (/(concert|tour|fancon|fan concert|fan meeting|arena|manila|philippines)/i.test(text)) return 'CONCERT NEWS';
  if (/(comeback|album|single|teaser|tracklist|track list|music video|\bmv\b|release)/i.test(text)) return 'COMEBACK NEWS';
  if (/(drama|series|actor|actress|romance|episode|cast)/i.test(text)) return 'K-DRAMA NEWS';
  if (/(award|chart|billboard|music show|win|ranking)/i.test(text)) return 'TRENDING';
  return 'HALLYU NEWS';
}

function socialHeadline(title='') {
  let text = stripPublisherSuffix(title)
    .replace(/\s*[:|]\s*/g, ': ')
    .replace(/\s+/g, ' ')
    .trim();

  text = text
    .replace(/\bto hold\b/i, 'is set to hold')
    .replace(/\bto release\b/i, 'is set to release')
    .replace(/\bto debut\b/i, 'is set to debut');

  if (text.length > 105) {
    const clipped = text.slice(0, 102);
    const lastSpace = clipped.lastIndexOf(' ');
    text = `${clipped.slice(0, lastSpace > 70 ? lastSpace : 102).trim()}…`;
  }

  return text.toUpperCase();
}

function metaContent(html, keys) {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i')
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return cleanText(match[1]);
    }
  }
  return '';
}

function canonicalUrl(html) {
  const match = html.match(/<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["'][^>]*>/i);
  return match?.[1] ? cleanText(match[1]) : '';
}

async function fetchPageMeta(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.7',
        'user-agent': 'Mozilla/5.0 (compatible; HallyuScope/1.2; +https://hallyuscope.com)'
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const type = res.headers.get('content-type') || '';
    if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) {
      throw new Error(`Unsupported content type: ${type}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    let total = 0;
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_HTML_BYTES) break;
      chunks.push(value);
    }

    const html = Buffer.concat(chunks.map(v => Buffer.from(v))).toString('utf8');
    const imageUrl = metaContent(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']);
    const pageTitle = metaContent(html, ['og:title', 'twitter:title']);
    const canonical = canonicalUrl(html);

    return {
      finalUrl: canonical || res.url || url,
      pageTitle,
      imageUrl
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(name) {
  return JSON.parse(await readFile(new URL(name, DATA_DIR), 'utf8'));
}

function storyKey(item={}) {
  return `${stripPublisherSuffix(item.title || '').toLowerCase()}|${item.source || ''}`;
}

const [latestData, concertData, comebackData] = await Promise.all([
  readJson('latest.json'),
  readJson('concert-candidates.json'),
  readJson('comeback-candidates.json')
]);

const merged = [
  ...(latestData.items || []),
  ...(concertData.items || []),
  ...(comebackData.items || [])
];

const seen = new Set();
const baseItems = merged.filter(item => {
  const key = storyKey(item);
  if (!key || seen.has(key)) return false;
  seen.add(key);
  return true;
}).slice(0, MAX_ITEMS);

const enriched = [];
for (const item of baseItems) {
  let meta = { finalUrl: item.url, pageTitle: '', imageUrl: '' };
  try {
    meta = await fetchPageMeta(item.url);
  } catch (error) {
    console.warn(`[social-meta] ${item.source || 'source'}: ${error.message}`);
  }

  const category = socialCategory(item);
  const headline = socialHeadline(meta.pageTitle || item.title);

  enriched.push({
    ...item,
    articleUrl: meta.finalUrl || item.url,
    imageUrl: meta.imageUrl || null,
    social: {
      category,
      headline,
      status: meta.imageUrl ? 'ready_for_review' : 'needs_image',
      canvaFields: {
        Category: category,
        Headline: headline,
        FeatureImage: meta.imageUrl || null
      }
    }
  });
}

const previous = await readJson('social-post-candidates.json').catch(() => ({ items: [] }));
const previousByKey = new Map((previous.items || []).map(item => [storyKey(item), item]));

const items = enriched.map(item => {
  if (item.imageUrl) return item;
  const old = previousByKey.get(storyKey(item));
  return old?.imageUrl ? {
    ...item,
    imageUrl: old.imageUrl,
    social: {
      ...item.social,
      status: 'ready_for_review',
      canvaFields: {
        ...item.social.canvaFields,
        FeatureImage: old.imageUrl
      }
    }
  } : item;
});

await writeFile(OUTPUT, JSON.stringify({
  updatedAt: new Date().toISOString(),
  note: 'Additive social-post enrichment. Existing live site data files are unchanged.',
  items
}, null, 2) + '\n');

console.log(`Social post candidates: ${items.length}`);
console.log(`With source images: ${items.filter(item => item.imageUrl).length}`);
