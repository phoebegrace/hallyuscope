import { readFile, writeFile, mkdir } from 'node:fs/promises';

const DATA_DIR = new URL('../data/', import.meta.url);
const INPUT = new URL('social-post-candidates.json', DATA_DIR);
const OUTPUT = new URL('article-drafts.json', DATA_DIR);
const EDITORIAL_DIR = new URL('../assets/editorial/', import.meta.url);
const EDITORIAL_PUBLIC_BASE = 'https://raw.githubusercontent.com/phoebegrace/hallyuscope/live-data/assets/editorial/';

const MODEL = process.env.OPENAI_DRAFT_MODEL || 'gpt-6.1-terra';
const MAX_NEW_DRAFTS_PER_RUN = Number(process.env.MAX_NEW_DRAFTS_PER_RUN || 50);
const MAX_SOURCE_CHARS = 16000;
// Quality version 3: research + verify. Soompi is the reference, the draft
// is synthesized from up to 3 readable reports of the same story, then
// checked against them. Bumping the version re-queues thin/weak drafts so
// the next run rebuilds them under the new flow instead of rewording one
// source again.
const QUALITY_VERSION = 3;
const MAX_RESEARCH_SOURCES = 4;
const MAX_DEEP_LINKS = 2;
// Deeper sources are bonus material, not the backbone — a short official
// statement still counts as corroboration.
const MIN_DEEP_SOURCE_CHARS = 300;
const RESEARCH_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const RESEARCH_SOURCE_CHARS = 6000;
// Only draft from sources the fetcher can actually read. A story whose
// article text cannot be extracted (Google News redirect pages, YouTube
// watch pages, blocked publishers) leaves the model with nothing but a
// headline — and the no-invention rule then forces a 15-word stub that just
// restates the headline. Those stories stay headline links on the site;
// they never become articles.
const MIN_SOURCE_CHARS = 800;

function cleanText(value = '') {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractArticleText(html = '') {
  const paragraphMatches = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(match => cleanText(match[1]))
    .filter(text => text.length >= 40);

  let joined = paragraphMatches.join('\n\n');
  // Some publishers (e.g. Naver mobile) put the story directly inside
  // <article> with <br/> separators instead of <p> tags. When the
  // paragraph pass comes up thin, fall back to the article element,
  // split on its line breaks. Only used when it yields more real text.
  if (joined.length < MIN_SOURCE_CHARS) {
    const articleChunks = [];
    for (const match of html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)) {
      for (const piece of match[1].split(/<br\s*\/?>/gi)) {
        const text = cleanText(piece);
        if (text.length >= 40) articleChunks.push(text);
      }
    }
    if (articleChunks.join('\n\n').length > joined.length) {
      joined = articleChunks.join('\n\n');
    }
  }
  return joined.slice(0, MAX_SOURCE_CHARS);
}

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapHeadline(value = '', max = 27) {
  const words = String(value).trim().split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
    if (lines.length === 2) break;
  }
  if (line && lines.length < 3) lines.push(line);
  return lines.slice(0, 3);
}

async function writeEditorialCover(id, headline, category) {
  await mkdir(EDITORIAL_DIR, { recursive: true });
  const lines = wrapHeadline(headline);
  const text = lines.map((line, i) =>
    `<text x="88" y="${250 + i * 82}" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="800" fill="#0a0d22">${escapeXml(line)}</text>`
  ).join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <rect width="1200" height="675" fill="#ffffff"/>
  <rect x="0" y="0" width="1200" height="16" fill="#01229a"/>
  <rect x="0" y="16" width="1200" height="10" fill="#fe0862"/>
  <text x="88" y="100" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" letter-spacing="3" fill="#fe0862">${escapeXml(category || 'HALLYU NEWS')}</text>
  ${text}
  <g transform="translate(950 108)">
    <rect x="0" y="0" width="142" height="142" rx="71" fill="#f7f8fc"/>
    <circle cx="71" cy="71" r="39" fill="none" stroke="#fe0862" stroke-width="14"/>
    <path d="M71 22v26M71 94v26M22 71h26M94 71h26" stroke="#01229a" stroke-width="7"/>
    <path d="M71 53q3 15 18 18-15 3-18 18-3-15-18-18 15-3 18-18Z" fill="#fe0862"/>
  </g>
  <text x="88" y="610" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800" fill="#01229a">HallyuScope</text>
  <text x="300" y="610" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="600" fill="#7b8194">Original editorial cover</text>
</svg>`;
  const filename = `${id}.svg`;
  await writeFile(new URL(filename, EDITORIAL_DIR), svg);
  return `${EDITORIAL_PUBLIC_BASE}${filename}`;
}

function slugify(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

// Never let a broken "resolved" link (…/undefined, bot-check / consent pages)
// become the stored source URL. Anything suspicious falls back to the caller.
function validSourceUrl(value = '') {
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (/undefined/.test(u.href)) return '';
    if (/google\.com\/sorry/i.test(u.href)) return '';
    if (/consent\.youtube\.com|consent\.google\.com|accounts\.google\.com/i.test(u.hostname)) return '';
    return u.href;
  } catch { return ''; }
}

// Slugs are words from the headline, never random ids. A regenerated draft
// keeps its existing slug so published links never break; a brand-new draft
// gets the next free slug if its headline collides with another story.
function uniqueSlug(base, taken) {
  let slug = base || 'hallyu-story';
  let n = 2;
  while (taken.has(slug)) slug = `${base}-${n++}`;
  taken.add(slug);
  return slug;
}

async function fetchSourceText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.7',
        'user-agent': 'Mozilla/5.0 (compatible; HallyuScope/1.3; +https://hallyuscope.com)'
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return { text: extractArticleText(html), links: extractOutboundLinks(html, url) };
  } finally {
    clearTimeout(timeout);
  }
}

// Hosts that never yield a readable article body: social and login walls,
// video pages, and the Google News redirect itself.
const UNREADABLE_HOSTS = new Set([
  'news.google.com', 'www.youtube.com', 'youtube.com', 'youtu.be',
  'x.com', 'twitter.com', 'www.instagram.com', 'instagram.com',
  'weverse.io', 'www.weverse.io', 'threads.net', 'www.threads.net',
  'tiktok.com', 'www.tiktok.com', 'facebook.com', 'www.facebook.com',
  // Viki is Soompi's sister site: its celebrity/show links are auto-inserted
  // into every article body and are cross-promotion, not citations.
  'viki.com', 'www.viki.com'
]);
const SHARE_PATH = /^\/(intent|sharer|share)\b/i;

// Outbound links inside the article's own paragraphs — that is where a
// report cites its sources ("according to X", "X reported"). Nav, footer,
// related-story and share links are outside the paragraphs, so they are
// never picked up. Internal links and unreadable hosts are dropped.
function extractOutboundLinks(html = '', baseUrl = '') {
  let base;
  try { base = new URL(baseUrl); } catch { return []; }
  const seen = new Set();
  const links = [];
  for (const p of String(html).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    for (const match of p[1].matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
      // Hrefs in page HTML carry &amp; / &#038; entities; decode them so
      // the fetched URL is the real one.
      const href = match[1].trim().replace(/&amp;|&#0?38;/g, '&');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) continue;
      let url;
      try { url = new URL(href, base); } catch { continue; }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      const clean = validSourceUrl(url.href);
      if (!clean) continue;
      const host = new URL(clean).hostname.toLowerCase();
      if (host === base.hostname.toLowerCase()) continue;
      if (UNREADABLE_HOSTS.has(host)) continue;
      if (SHARE_PATH.test(new URL(clean).pathname)) continue;
      if (seen.has(clean)) continue;
      seen.add(clean);
      links.push(clean);
      if (links.length >= MAX_DEEP_LINKS) return links;
    }
  }
  return links;
}

// A readable name for a deeper source, from its hostname. Known outlets
// get their proper name; anything else is the domain's first label.
const KNOWN_PUBLISHERS = {
  koreaherald: 'The Korea Herald',
  koreatimes: 'The Korea Times',
  koreajoongangdaily: 'Korea JoongAng Daily',
  naver: 'Naver',
  daum: 'Daum',
  xportsnews: 'Xportsnews',
  osen: 'OSEN',
  newsen: 'Newsen',
  starnews: 'Star News',
  billboard: 'Billboard',
  soompi: 'Soompi',
  kpopmap: 'Kpopmap',
  allkpop: 'allkpop',
  koreaboo: 'Koreaboo'
};

function publisherFromHost(url = '') {
  try {
    // Use the domain name, not the subdomain: m.entertain.naver.com is
    // Naver, not "M". Two-part suffixes (co.kr, co.uk) step one label
    // further back so somethingnew.co.kr is Somethingnew, not "Co".
    const GENERIC_SLD = new Set(['co', 'com', 'org', 'net', 'ac', 'go', 'or']);
    const parts = new URL(url).hostname.toLowerCase().replace(/^www\./, '').split('.');
    let label;
    if (parts.length >= 3 && GENERIC_SLD.has(parts[parts.length - 2])) label = parts[parts.length - 3];
    else if (parts.length >= 2) label = parts[parts.length - 2];
    else label = parts[0];
    return KNOWN_PUBLISHERS[label] || (label.charAt(0).toUpperCase() + label.slice(1));
  } catch { return 'Unknown'; }
}

// Google News redirect pages and YouTube watch pages have no extractable
// article body — they are never useful research material, so don't waste a
// fetch on them. (The primary story can still be drafted if a *related*
// readable report exists.)
function isResearchableUrl(value = '') {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host !== 'news.google.com' && host !== 'www.youtube.com' && host !== 'youtube.com' && host !== 'youtu.be';
  } catch { return false; }
}

const TITLE_STOPWORDS = new Set('watch video reveals reveal announces announced confirms confirmed unveils unveil drops drop teases tease shares share after with from into over under'.split(' '));

function titleTokens(title = '') {
  return new Set(
    String(title).toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !TITLE_STOPWORDS.has(w))
  );
}

// The lead subject of each title (its first distinctive word) must appear
// near the front of the other title. This keeps true pairs where one outlet
// prefixes a group name ("Girls' Generation's Taeyeon …" vs "Taeyeon …")
// while blocking chart roundups that share an artist list but lead with
// different artists ("PLAVE … Sweep Top Spots" vs "CORTIS … Sweep Top
// Spots" are different chart weeks).
function leadSubjectMatches(at, bt) {
  const a = [...at], b = [...bt];
  const nearFront = (word, list) => list.slice(0, 3).includes(word);
  return nearFront(a[0], b) || nearFront(b[0], a);
}

// Same story, different outlet: distinctive words overlap, the lead subject
// matches, and the reports are close in time. Conservative on purpose — a
// missed match just means one less research source; a wrong match would mix
// two stories together. (Checked on live data: 0.45 keeps true pairs like
// the ILLIT Billboard story and the Taeyeon 'Unspecial' album, and excludes
// lookalikes such as two different weekly-roundup articles at 0.36.)
function sameStory(a, b) {
  const at = titleTokens(a.title);
  const bt = titleTokens(b.title);
  if (at.size < 3 || bt.size < 3) return false;
  if (!leadSubjectMatches(at, bt)) return false;
  let shared = 0;
  for (const word of at) if (bt.has(word)) shared++;
  if (shared / (at.size + bt.size - shared) < 0.45) return false;
  const ta = Date.parse(a.publishedAt || 0) || 0;
  const tb = Date.parse(b.publishedAt || 0) || 0;
  if (ta && tb && Math.abs(ta - tb) > RESEARCH_WINDOW_MS) return false;
  return true;
}

// Research for one story: the reference item first, then up to two other
// readable reports of the same story from different outlets, then one level
// deeper — the sources the reference article itself cited. Each entry
// carries the publisher, URL, extracted text (or a substantial RSS summary
// when the body could not be read) and its depth (1 = report of the story,
// 2 = cited by the reference report). Sources with nothing readable are
// left out entirely. The deeper step never recurses.
async function gatherResearch(item, allItems) {
  const related = (allItems || [])
    .filter(other =>
      other.id !== item.id &&
      other.source && other.source !== item.source &&
      sameStory(item, other))
    .sort((a, b) => (Date.parse(b.publishedAt || 0) || 0) - (Date.parse(a.publishedAt || 0) || 0));

  const sources = [];
  const seenPublishers = new Set();
  let deepLinks = [];
  for (const candidate of [item, ...related]) {
    if (sources.length >= MAX_RESEARCH_SOURCES) break;
    if (candidate.source && seenPublishers.has(candidate.source.toLowerCase())) continue;
    const url = validSourceUrl(candidate.articleUrl) || validSourceUrl(candidate.url) || null;
    if (!url || !isResearchableUrl(url)) continue;
    let page = { text: '', links: [] };
    try {
      page = await fetchSourceText(url);
    } catch (error) {
      console.warn(`[source fetch failed] ${candidate.id}: ${error.message}`);
    }
    let text = page.text;
    if (text.length < MIN_SOURCE_CHARS && (candidate.sourceSummary || '').length >= MIN_SOURCE_CHARS) {
      text = candidate.sourceSummary;
    }
    // Citations live in the reference article: remember its outbound links
    // so the next step can follow them one level deeper.
    if (deepLinks.length === 0 && page.links.length > 0) {
      deepLinks = page.links;
    }
    sources.push({ publisher: candidate.source || 'Unknown', title: candidate.title || '', url, text, depth: 1 });
    if (candidate.source) seenPublishers.add(candidate.source.toLowerCase());
  }

  for (const link of deepLinks) {
    if (sources.length >= MAX_RESEARCH_SOURCES) break;
    const publisher = publisherFromHost(link);
    if (seenPublishers.has(publisher.toLowerCase())) continue;
    let deep = { text: '' };
    try {
      deep = await fetchSourceText(link);
    } catch (error) {
      console.warn(`[deep source fetch failed] ${link}: ${error.message}`);
      continue;
    }
    if (deep.text.length < MIN_DEEP_SOURCE_CHARS) continue;
    sources.push({ publisher, title: '', url: link, text: deep.text, depth: 2 });
    seenPublishers.add(publisher.toLowerCase());
  }
  return sources;
}

function responseText(payload) {
  for (const item of payload.output || []) {
    for (const part of item.content || []) {
      if (part.type === 'output_text' && part.text) return part.text;
    }
  }
  return '';
}

function parseJson(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

async function generateDraft(item, researchSources) {
  const reference = researchSources.find(s => s.text.length > 0) || researchSources[0] || { publisher: item.source || 'Unknown', title: item.title || '', url: item.articleUrl || item.url || '' };
  const material = researchSources
    .map((s, i) => `SOURCE ${i + 1} — ${s.publisher}${s.depth === 2 ? ' (cited by the reference report)' : ''} (${s.url}):\n${s.text.slice(0, RESEARCH_SOURCE_CHARS) || '[No extractable article body.]'}`)
    .join('\n\n');
  const prompt = `You are an editor for HallyuScope, an independent Korean entertainment and K-pop publication.

Write an ORIGINAL news article from the research material below. Source 1 is the reference report that surfaced the story; the other sources are independent reports of the same story, or sources the reference report itself cited. Synthesize across them — do not reword any single source. Do not copy sentences or distinctive phrasing from any source. Facts can be retained. Do not invent quotes, dates, locations, prices, names, motivations, context, or details that are not explicitly supported by at least one source. If sources disagree on a detail, use the version the majority supports, or omit the detail.

Editorial style:
- clean, modern entertainment-news voice
- readable for global K-pop/Hallyu fans
- concise, human, not AI-sounding
- avoid clickbait and exaggerated claims
- aim for 300-550 words when there is enough verified material
- if the source is limited, still write a useful, polished 180-300 word news brief using only verified facts
- NEVER write meta-commentary about missing information or the limitations of the source
- NEVER write phrases such as "the report does not specify", "details were not included in the supplied source material", "the source did not provide", or similar filler
- if a fact is unavailable, simply omit it and move on to the strongest verified details
- do not pad with background facts from memory
- attribution must name the actual publisher of the reference article, not a discovery feed or aggregator
- keep the source note factual and minimal
- no emojis

Return ONLY valid JSON with this exact shape:
{
  "headline": "original HallyuScope headline",
  "dek": "one-sentence summary",
  "body": ["paragraph 1", "paragraph 2"],
  "socialCaption": "short social caption ending with a reason to read on HallyuScope",
  "socialHashtags": ["5-8 relevant hashtags including #HallyuScope, artist/group/topic tags, and no spammy generic tags"],
  "seoDescription": "140-160 character meta description",
  "sourceNote": "Source: <publisher>"
}

REFERENCE PUBLISHER: ${reference.publisher}
REFERENCE TITLE: ${reference.title}
REFERENCE URL: ${reference.url}

RESEARCH MATERIAL:
${material}`;

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      reasoning: { effort: 'low' },
      max_output_tokens: 1800,
      input: prompt
    })
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 300)}`);
  }

  const payload = await res.json();
  const draft = parseJson(responseText(payload));

  if (!draft.headline || !Array.isArray(draft.body) || !draft.body.length) {
    throw new Error('Model returned an incomplete draft');
  }

  return {
    headline: String(draft.headline).trim(),
    dek: String(draft.dek || '').trim(),
    body: draft.body.map(x => String(x).trim()).filter(Boolean),
    socialCaption: String(draft.socialCaption || '').trim(),
    socialHashtags: Array.isArray(draft.socialHashtags)
      ? draft.socialHashtags.map(x => String(x).trim()).filter(x => /^#[\p{L}\p{N}_]+$/u.test(x)).slice(0,8)
      : ['#HallyuScope','#Kpop'],
    seoDescription: String(draft.seoDescription || '').trim(),
    sourceNote: String(draft.sourceNote || `Source: ${reference.publisher}`).trim()
  };
}

// Second pass: compare the finished draft against the same research
// material and flag anything it cannot support. "Passed" means no
// unsupported facts and no copied phrasing; missing key facts are
// reported for the editor but do not fail the check.
async function verifyDraft(draft, researchSources) {
  const material = researchSources
    .map((s, i) => `SOURCE ${i + 1} — ${s.publisher}:\n${s.text.slice(0, RESEARCH_SOURCE_CHARS) || '[No extractable article body.]'}`)
    .join('\n\n');
  const draftText = [draft.headline, draft.dek, ...draft.body].join('\n');
  const prompt = `You are a fact-checker for HallyuScope. Compare the DRAFT below against the SOURCE MATERIAL and return ONLY valid JSON:

{
  "passed": true,
  "unsupportedClaims": ["each specific claim in the draft that no source supports"],
  "copiedPhrases": ["each sentence or distinctive phrase in the draft that closely copies a source"],
  "missingKeyFacts": ["important facts present in the sources that the draft left out"]
}

Rules:
- "passed" is true only when unsupportedClaims and copiedPhrases are both empty.
- A fact counts as supported if it appears in ANY source, not just Source 1.
- Headline wording and common phrases ("announced", "will hold a concert") are not copying.
- Paraphrasing the same fact in different words is not copying.
- Do not flag a missing fact that is minor or already implied by the draft.
- If a source contradicts the draft, list the draft's version under unsupportedClaims.

SOURCE MATERIAL:
${material}

DRAFT:
${draftText}`;

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      reasoning: { effort: 'low' },
      max_output_tokens: 800,
      input: prompt
    })
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 300)}`);
  }

  const payload = await res.json();
  const verdict = parseJson(responseText(payload));
  const unsupported = Array.isArray(verdict.unsupportedClaims) ? verdict.unsupportedClaims.map(String) : [];
  const copied = Array.isArray(verdict.copiedPhrases) ? verdict.copiedPhrases.map(String) : [];
  return {
    status: unsupported.length === 0 && copied.length === 0 ? 'passed' : 'failed',
    unsupportedClaims: unsupported,
    copiedPhrases: copied,
    missingKeyFacts: Array.isArray(verdict.missingKeyFacts) ? verdict.missingKeyFacts.map(String) : [],
    checkedAt: new Date().toISOString()
  };
}

if (!process.env.OPENAI_API_KEY) {
  console.log('OPENAI_API_KEY is not configured. Skipping article draft generation.');
  process.exit(0);
}

const social = JSON.parse(await readFile(INPUT, 'utf8'));
const previous = await readFile(OUTPUT, 'utf8')
  .then(JSON.parse)
  .catch(() => ({ items: [] }));

const autoPublish = previous.autoPublish === true;
const previousById = new Map((previous.items || []).map(item => [item.id, item]));
const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
function bodyWordCount(item={}) {
  return (item.body || []).join(' ').trim().split(/\s+/).filter(Boolean).length;
}
function needsQualityRefresh(item={}) {
  if (item.status !== 'pending_review') return false;
  if ((item.qualityVersion || 0) >= QUALITY_VERSION) return false;
  const text = (item.body || []).join(' ').toLowerCase();
  const weakPhrases = [
    'does not specify',
    'details such as',
    'were not included in the supplied source material',
    'the supplied source material',
    'the source did not provide',
    'the report identifies'
  ];
  return bodyWordCount(item) < 220 || weakPhrases.some(p => text.includes(p));
}
const candidates = (social.items || []).filter(item => {
  if (!item.id || (item.publishedAt && Date.parse(item.publishedAt) < cutoff) || item.social?.status === 'published') return false;
  const old = previousById.get(item.id);
  return !old || needsQualityRefresh(old);
})
// Drafts waiting on a quality redo go first, then the newest stories.
// Otherwise the 50-per-run cap starves old thin drafts behind fresh news.
.sort((a, b) => {
  const aRefresh = needsQualityRefresh(previousById.get(a.id) || {}) ? 0 : 1;
  const bRefresh = needsQualityRefresh(previousById.get(b.id) || {}) ? 0 : 1;
  if (aRefresh !== bRefresh) return aRefresh - bRefresh;
  return (Date.parse(b.publishedAt || 0) || 0) - (Date.parse(a.publishedAt || 0) || 0);
});

const newlyDrafted = [];
const takenSlugs = new Set((previous.items || []).map(x => x.slug).filter(Boolean));

for (const item of candidates.slice(0, MAX_NEW_DRAFTS_PER_RUN)) {
  try {
    // Research first: the reference item plus up to two other readable
    // reports of the same story. The gate now applies to the combined
    // research material — a story with one thin source but a rich second
    // report still gets drafted; a story with nothing readable anywhere
    // is skipped, not stubbed.
    const research = await gatherResearch(item, social.items || []);
    const researchChars = research.reduce((n, r) => n + r.text.length, 0);
    if (researchChars < MIN_SOURCE_CHARS) {
      console.warn(`[skip thin source] ${item.id}: only ${researchChars} chars readable across ${research.length} source(s)`);
      continue;
    }
    const reference = research.find(r => r.text.length > 0) || research[0];

    const draft = await generateDraft(item, research);

    // Verify the finished draft against the same research material.
    // A failed check does not delete the draft — it stays pending_review
    // with the flags on it, so the editor decides. An error in the check
    // itself is recorded as unverified, never as a pass.
    let verification;
    try {
      verification = await verifyDraft(draft, research);
      if (verification.status === 'failed') {
        console.warn(`[verify failed] ${item.id}: ${verification.unsupportedClaims.length} unsupported, ${verification.copiedPhrases.length} copied, ${verification.missingKeyFacts.length} missing`);
      }
    } catch (error) {
      console.warn(`[verify error] ${item.id}: ${error.message}`);
      verification = { status: 'unverified', unsupportedClaims: [], copiedPhrases: [], missingKeyFacts: [], error: error.message, checkedAt: new Date().toISOString() };
    }

    const originalCover = await writeEditorialCover(item.id, draft.headline, item.social?.category || 'HALLYU NEWS');

    const old = previousById.get(item.id);
    newlyDrafted.push({
      ...(old || {}),
      id: item.id,
      createdAt: new Date().toISOString(),
      status: autoPublish ? 'published' : 'pending_review',
      publishedAt: autoPublish ? new Date().toISOString() : null,
      sourcePublishedAt: item.publishedAt || null,
      model: MODEL,
      qualityVersion: QUALITY_VERSION,
      slug: old?.slug || uniqueSlug(slugify(draft.headline), takenSlugs),
      source: {
        publisher: reference.publisher || null,
        title: item.title || null,
        url: reference.url || null
      },
      researchSources: research.map(r => ({ publisher: r.publisher, url: r.url, chars: r.text.length, depth: r.depth || 1 })),
      verification,
      imageUrl: old?.imageUrl || originalCover,
      imageType: old?.imageType || 'hallyuscope_original',
      sourceImageUrl: old?.sourceImageUrl || item.imageUrl || null,
      imagePolicy: {
        type: 'hallyuscope_original',
        note: 'Competitor/news-site thumbnail is retained only as internal reference. Published image is HallyuScope original unless explicitly replaced with a verified official asset.'
      },
      category: item.social?.category || old?.category || 'HALLYU NEWS',
      ...draft
    });

    console.log(`Drafted: ${draft.headline}`);
  } catch (error) {
    console.warn(`[draft failed] ${item.id}: ${error.message}`);
  }
}

const existingNormalized = [];
for (const item of (previous.items || [])) {
  if (item.imageType === 'official' && item.imageUrl) {
    existingNormalized.push(item);
    continue;
  }
  const cover = await writeEditorialCover(item.id, item.headline || item.source?.title || 'HallyuScope Update', item.category || 'HALLYU NEWS');
  existingNormalized.push({
    ...item,
    sourceImageUrl: item.sourceImageUrl || (item.imageUrl && !String(item.imageUrl).startsWith('/assets/editorial/') ? item.imageUrl : null),
    imageUrl: cover,
    imageType: 'hallyuscope_original',
    imagePolicy: {
      type: 'hallyuscope_original',
      note: 'Competitor/news-site thumbnail is retained only as internal reference. Published image is HallyuScope original unless explicitly replaced with a verified official asset.'
    }
  });
}

const merged = [...newlyDrafted, ...existingNormalized]
  .filter((item, index, arr) => arr.findIndex(other => other.id === item.id) === index);

await writeFile(OUTPUT, JSON.stringify({
  updatedAt: new Date().toISOString(),
  autoPublish,
  note: autoPublish
    ? 'Auto-publish is ON. Newly generated HallyuScope articles publish immediately.'
    : 'Auto-publish is OFF. Newly generated HallyuScope articles wait for editorial approval.',
  items: merged
}, null, 2) + '\n');

console.log(`New drafts this run: ${newlyDrafted.length}`);
