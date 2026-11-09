import { readFile, writeFile, mkdir } from 'node:fs/promises';

const DATA_DIR = new URL('../data/', import.meta.url);
const INPUT = new URL('social-post-candidates.json', DATA_DIR);
const OUTPUT = new URL('article-drafts.json', DATA_DIR);
const EDITORIAL_DIR = new URL('../assets/editorial/', import.meta.url);

const MODEL = process.env.OPENAI_DRAFT_MODEL || 'gpt-6.1-terra';
const MAX_NEW_DRAFTS_PER_RUN = Number(process.env.MAX_NEW_DRAFTS_PER_RUN || 50);
const MAX_SOURCE_CHARS = 12000;

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

  const joined = paragraphMatches.join('\n\n');
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
  return `/assets/editorial/${filename}`;
}

function slugify(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
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
    return extractArticleText(html);
  } finally {
    clearTimeout(timeout);
  }
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

async function generateDraft(item, sourceText) {
  const thinSource = sourceText.length < 180;
  const prompt = `You are an editor for HallyuScope, an independent Korean entertainment and K-pop publication.

Write an ORIGINAL news article based only on the supplied source material and verified headline metadata. Do not copy sentences or distinctive phrasing from the source. Facts can be retained. Do not invent quotes, dates, locations, prices, names, motivations, context, or details that are not explicitly supported.

Editorial style:
- clean, modern entertainment-news voice
- readable for global K-pop/Hallyu fans
- concise, human, not AI-sounding
- avoid clickbait and exaggerated claims
- 350-650 words only when the source material supports it
- when source material is thin or unavailable, write a SHORT NEWS BRIEF of about 90-180 words using only facts explicitly present in the verified source headline, publisher name, date/category metadata, and any supplied text
- never pad a thin brief with background facts from memory
- mention the original source naturally in a short Sources note, but do not make the competitor the main CTA
- no emojis

Return ONLY valid JSON with this exact shape:
{
  "headline": "original HallyuScope headline",
  "dek": "one-sentence summary",
  "body": ["paragraph 1", "paragraph 2"],
  "socialCaption": "short social caption ending with a reason to read on HallyuScope",
  "seoDescription": "140-160 character meta description",
  "sourceNote": "Source: <publisher>"
}

SOURCE PUBLISHER: ${item.source || 'Unknown'}
SOURCE TITLE: ${item.title || ''}
SOURCE URL: ${item.articleUrl || item.url || ''}
SOURCE MATERIAL:
${sourceText || '[No extractable article body. Use only the verified headline and metadata above.]'}`;

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
    seoDescription: String(draft.seoDescription || '').trim(),
    sourceNote: String(draft.sourceNote || `Source: ${item.source || 'Original reporting'}`).trim()
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
const candidates = (social.items || []).filter(item =>
  item.id &&
  (!item.publishedAt || Date.parse(item.publishedAt) >= cutoff) &&
  item.social?.status !== 'published' &&
  !previousById.has(item.id)
);

const newlyDrafted = [];

for (const item of candidates.slice(0, MAX_NEW_DRAFTS_PER_RUN)) {
  try {
    let sourceText = '';
    try {
      sourceText = await fetchSourceText(item.articleUrl || item.url);
    } catch (error) {
      console.warn(`[source fetch failed] ${item.id}: ${error.message}`);
    }

    const draft = await generateDraft(item, sourceText);

    const originalCover = await writeEditorialCover(item.id, draft.headline, item.social?.category || 'HALLYU NEWS');

    newlyDrafted.push({
      id: item.id,
      createdAt: new Date().toISOString(),
      status: autoPublish ? 'published' : 'pending_review',
      publishedAt: autoPublish ? new Date().toISOString() : null,
      sourcePublishedAt: item.publishedAt || null,
      model: MODEL,
      slug: slugify(draft.headline),
      source: {
        publisher: item.source || null,
        title: item.title || null,
        url: item.articleUrl || item.url || null
      },
      imageUrl: originalCover,
      imageType: 'hallyuscope_original',
      sourceImageUrl: item.imageUrl || null,
      imagePolicy: {
        type: 'hallyuscope_original',
        note: 'Competitor/news-site thumbnail is retained only as internal reference. Published image is HallyuScope original unless explicitly replaced with a verified official asset.'
      },
      category: item.social?.category || 'HALLYU NEWS',
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
