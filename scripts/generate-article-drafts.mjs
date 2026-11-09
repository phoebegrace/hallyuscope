import { readFile, writeFile } from 'node:fs/promises';

const DATA_DIR = new URL('../data/', import.meta.url);
const INPUT = new URL('social-post-candidates.json', DATA_DIR);
const OUTPUT = new URL('article-drafts.json', DATA_DIR);

const MODEL = process.env.OPENAI_DRAFT_MODEL || 'gpt-6.1-terra';
const MAX_NEW_DRAFTS_PER_RUN = Number(process.env.MAX_NEW_DRAFTS_PER_RUN || 3);
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
  const prompt = `You are an editor for HallyuScope, an independent Korean entertainment and K-pop publication.

Write an ORIGINAL news article based only on the supplied source material. Do not copy sentences or distinctive phrasing from the source. Facts can be retained. Do not invent quotes, dates, locations, prices, names, or details that are not in the supplied material.

Editorial style:
- clean, modern entertainment-news voice
- readable for global K-pop/Hallyu fans
- concise, human, not AI-sounding
- avoid clickbait and exaggerated claims
- 350-650 words when the source material supports it
- if the supplied material is thin, write a shorter article rather than padding
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
${sourceText}`;

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

const previousById = new Map((previous.items || []).map(item => [item.id, item]));
const candidates = (social.items || []).filter(item =>
  item.id &&
  item.social?.status !== 'published' &&
  !previousById.has(item.id)
);

const newlyDrafted = [];

for (const item of candidates.slice(0, MAX_NEW_DRAFTS_PER_RUN)) {
  try {
    const sourceText = await fetchSourceText(item.articleUrl || item.url);
    if (sourceText.length < 180) {
      console.warn(`[draft skipped] ${item.id}: source text too thin`);
      continue;
    }

    const draft = await generateDraft(item, sourceText);

    newlyDrafted.push({
      id: item.id,
      createdAt: new Date().toISOString(),
      status: 'pending_review',
      model: MODEL,
      slug: slugify(draft.headline),
      source: {
        publisher: item.source || null,
        title: item.title || null,
        url: item.articleUrl || item.url || null
      },
      imageUrl: item.imageUrl || null,
      category: item.social?.category || 'HALLYU NEWS',
      ...draft
    });

    console.log(`Drafted: ${draft.headline}`);
  } catch (error) {
    console.warn(`[draft failed] ${item.id}: ${error.message}`);
  }
}

const merged = [...newlyDrafted, ...(previous.items || [])]
  .filter((item, index, arr) => arr.findIndex(other => other.id === item.id) === index);

await writeFile(OUTPUT, JSON.stringify({
  updatedAt: new Date().toISOString(),
  note: 'AI-generated HallyuScope article drafts for editorial review. Nothing here is auto-published.',
  items: merged
}, null, 2) + '\n');

console.log(`New drafts this run: ${newlyDrafted.length}`);
