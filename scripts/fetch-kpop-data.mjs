import { writeFile, mkdir, readFile } from 'node:fs/promises';

const OUT = new URL('../data/', import.meta.url);
const MAX_LATEST = 120;
const MAX_CANDIDATES = 100;

const decodeXml = (value = '') => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? decodeXml(m[1]) : '';
}

function parseAtom(xml, sourceMeta={}) {
  const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  return entries.map((block) => {
    const title = tag(block, 'title');
    const published = tag(block, 'published') || tag(block, 'updated');
    const videoId = tag(block, 'yt:videoId');
    const href = block.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i)?.[1]
      || block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1]
      || (videoId ? 'https://www.youtube.com/watch?v=' + videoId : '');
    return {
      title,
      url: href,
      publishedAt: published && !Number.isNaN(Date.parse(published)) ? new Date(published).toISOString() : null,
      source: sourceMeta.name || 'Official source',
      sourceClass: sourceMeta.sourceClass || 'official',
      confidence: sourceMeta.confidence || 'primary',
      sourceId: sourceMeta.id || null,
      description: tag(block, 'media:description') || ''
    };
  }).filter((x) => x.title && x.url);
}

function parseRss(xml, fallbackSource) {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return items.map((block) => {
    const sourceMatch = block.match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i);
    const title = tag(block, 'title');
    const link = tag(block, 'link');
    const pubDate = tag(block, 'pubDate') || tag(block, 'dc:date');
    const description = tag(block, 'description') || tag(block, 'content:encoded');
    return {
      title,
      url: link,
      publishedAt: pubDate && !Number.isNaN(Date.parse(pubDate)) ? new Date(pubDate).toISOString() : null,
      source: sourceMatch ? decodeXml(sourceMatch[1]) : fallbackSource,
      description
    };
  }).filter((x) => x.title && x.url);
}

async function getText(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'accept': 'application/rss+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5',
      'user-agent': 'HallyuScope/1.1 (+https://hallyuscope.com)'
    }
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

function googleNewsUrl(query) {
  const url = new URL('https://news.google.com/rss/search');
  url.searchParams.set('q', query);
  url.searchParams.set('hl', 'en-PH');
  url.searchParams.set('gl', 'PH');
  url.searchParams.set('ceid', 'PH:en');
  return url.toString();
}

function normalizeTitle(title = '') {
  return title
    .replace(/\s+-\s+[^-]{2,45}$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeTitle(item.title).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortNewest(items) {
  return [...items].sort((a, b) => (Date.parse(b.publishedAt || 0) || 0) - (Date.parse(a.publishedAt || 0) || 0));
}

function looksLikeKpop(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  return /(k-pop|kpop|comeback|album|single|music video|\bmv\b|billboard|world tour|fancon|fan meeting|idol|mama awards|music show|inkigayo|m countdown|music bank|concert|seventeen|bts|blackpink|aespa|stray kids|enhypen|txt|ateez|illit|ive|le sserafim|nmixx|twice|red velvet|exo|nct|riize|zerobaseone|babymonster|gidle|i-dle)/i.test(text);
}

function looksLikeConcert(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  const event = /(concert|world tour|tour date|fancon|fan concert|fan meeting|arena|philippine arena|araneta|mall of asia|moa arena|new frontier theater)/i.test(text);
  const ph = /(philippines|philippine|manila|pasay|quezon city|bulacan|moa|araneta|new frontier)/i.test(text);
  return event && ph;
}

function looksLikeComeback(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  return /(comeback|returns? with|new album|mini album|full album|single|ep\b|music video|\bmv\b|release|teaser|track list|tracklist|schedule poster)/i.test(text);
}

function clean(items, limit) {
  return sortNewest(dedupe(items)).slice(0, limit).map((item) => ({
    ...item,
    title: normalizeTitle(item.title),
    sourceSummary: String(item.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200)
  }));
}

async function safeFeed(url, source) {
  const started = Date.now();
  try {
    const items = parseRss(await getText(url), source).map(item => ({
      ...item,
      sourceClass: 'publisher',
      confidence: 'secondary'
    }));
    return { source, url, sourceClass: 'publisher', ok: true, count: items.length, ms: Date.now() - started, items };
  } catch (error) {
    console.error(`[feed failed] ${source}:`, error.message);
    return { source, url, ok: false, count: 0, ms: Date.now() - started, error: error.message, items: [] };
  }
}

await mkdir(OUT, { recursive: true });

async function loadSourceRegistry() {
  try {
    return JSON.parse(await readFile(new URL('source-registry.json', OUT), 'utf8'));
  } catch {
    return { sources: [] };
  }
}

async function safeDirectSource(def) {
  const started = Date.now();
  let url = def.url || '';
  try {
    if (def.type === 'youtube_channel') {
      url = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + encodeURIComponent(def.channelId);
      const items = parseAtom(await getText(url), def);
      return { source: def.name, sourceId: def.id, sourceClass: def.sourceClass || 'official', url, ok: true, count: items.length, ms: Date.now() - started, items };
    }
    if (def.type === 'rss') {
      const items = parseRss(await getText(url), def.name).map(item => ({
        ...item,
        sourceClass: def.sourceClass || 'official',
        confidence: def.confidence || 'primary',
        sourceId: def.id || null
      }));
      return { source: def.name, sourceId: def.id, sourceClass: def.sourceClass || 'official', url, ok: true, count: items.length, ms: Date.now() - started, items };
    }
    throw new Error('Unsupported direct source type: ' + def.type);
  } catch (error) {
    console.error('[direct source failed] ' + def.name + ':', error.message);
    return { source: def.name, sourceId: def.id, sourceClass: def.sourceClass || 'official', url, ok: false, count: 0, ms: Date.now() - started, error: error.message, items: [] };
  }
}

const feedDefs = [
  ['Soompi', 'https://www.soompi.com/feed'],
  ['Kpopmap', 'https://www.kpopmap.com/en/feed/'],
  ['Google News · K-pop', googleNewsUrl('K-pop when:7d')],
  ['Google News · PH concerts', googleNewsUrl('(K-pop OR Kpop) (Manila OR Philippines) (concert OR tour OR fancon OR "fan meeting") when:60d')],
  ['Google News · comebacks', googleNewsUrl('(K-pop OR Kpop) (comeback OR album OR single OR teaser) when:21d')]
];

const registry = await loadSourceRegistry();
const directDefs = (registry.sources || []).filter(x => x.enabled !== false);
const [results, directResults] = await Promise.all([
  Promise.all(feedDefs.map(([source, url]) => safeFeed(url, source))),
  Promise.all(directDefs.map(safeDirectSource))
]);
const bySource = Object.fromEntries(results.map(r => [r.source, r.items]));
const officialItems = directResults.flatMap(r => r.items || []);

const editorialFeeds = [
  ...officialItems,
  ...(bySource['Soompi'] || []),
  ...(bySource['Kpopmap'] || []),
  ...(bySource['Google News · K-pop'] || [])
];

const latest = clean(editorialFeeds.filter(looksLikeKpop), MAX_LATEST);
const concertCandidates = clean([
  ...(bySource['Google News · PH concerts'] || []),
  ...editorialFeeds
].filter(looksLikeConcert), MAX_CANDIDATES);
const comebackCandidates = clean([
  ...(bySource['Google News · comebacks'] || []),
  ...editorialFeeds
].filter(looksLikeComeback), MAX_CANDIDATES);

const updatedAt = new Date().toISOString();

async function writeIfUseful(name, items) {
  const target = new URL(name, OUT);
  if (!items.length) {
    try {
      const previous = JSON.parse(await readFile(target, 'utf8'));
      if ((previous.items || []).length) {
        console.warn(`[preserve] ${name}: no fresh items, keeping previous data`);
        return;
      }
    } catch {}
  }
  await writeFile(target, JSON.stringify({ updatedAt, items }, null, 2) + '\n');
}

await Promise.all([
  writeIfUseful('latest.json', latest),
  writeIfUseful('concert-candidates.json', concertCandidates),
  writeIfUseful('comeback-candidates.json', comebackCandidates),
  writeFile(new URL('source-health.json', OUT), JSON.stringify({
    updatedAt,
    sources: [...directResults, ...results].map(({items, ...r}) => r)
  }, null, 2) + '\n')
]);

console.log(`Direct official items: ${officialItems.length}`);
console.log(`Latest: ${latest.length}`);
console.log(`PH concert announcements: ${concertCandidates.length}`);
console.log(`Comeback announcements: ${comebackCandidates.length}`);
