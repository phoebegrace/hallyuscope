// The Weekly Scope: keeps Brevo in sync with the emails in api/newsletter-emails.js
// and prepares draft campaigns from the site's own data.
//
//   GET /api/newsletter?action=templates  Create or update the welcome and
//                                         re-engagement templates in Brevo.
//   GET /api/newsletter?action=weekly     Save this week's issue as a Brevo
//                                         draft (once per week).
//   GET /api/newsletter?action=alerts     Save ticket and comeback alerts as
//                                         Brevo drafts (once per show / day).
//
// Nothing here sends email. Drafts wait in Brevo for a person to review and
// press Send. Every action is idempotent, so repeated calls are harmless.
// The cron Worker reaches these through /api/cron-dispatch.
import { welcome, reengage, weeklyIssue, ticketAlert, comebackAlert } from './newsletter-emails.js';

const BREVO = 'https://api.brevo.com/v3';
const RAW = 'https://raw.githubusercontent.com/phoebegrace/hallyuscope/live-data/data/';
const RAW_MAIN = 'https://raw.githubusercontent.com/phoebegrace/hallyuscope/main/data/';
const SENDER = { name: 'HallyuScope', email: 'hello@hallyuscope.com' };
const REPLY_TO = 'hello@hallyuscope.com';
const STATE = { owner: 'phoebegrace', repo: 'hallyuscope', path: 'data/newsletter-state.json', branch: 'live-data' };

const manilaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());

async function brevo(path, options = {}) {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY is not configured');
  const r = await fetch(BREVO + path, { ...options, headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': key, ...(options.headers || {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error('Brevo ' + r.status + ': ' + text.slice(0, 200));
  return text ? JSON.parse(text) : null;
}

async function getJson(url) {
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('fetch ' + r.status + ' ' + url);
  return r.json();
}

async function listCampaigns() {
  const out = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await brevo('/emailCampaigns?limit=100&offset=' + offset + '&sort=desc&excludeHtmlContent=true');
    out.push(...(page?.campaigns || []));
    if (!page?.campaigns || page.campaigns.length < 100) break;
  }
  return out;
}

async function createDraft({ name, subject, preheader, html, tag }) {
  const listId = Number(process.env.BREVO_LIST_ID);
  if (!Number.isInteger(listId) || listId <= 0) throw new Error('BREVO_LIST_ID is not configured');
  return brevo('/emailCampaigns', {
    method: 'POST',
    body: JSON.stringify({ name, subject, previewText: preheader, sender: SENDER, replyTo: REPLY_TO, htmlContent: html, recipients: { listIds: [listId] }, tag }),
  });
}

/* ---------- templates ---------- */

export async function syncTemplates() {
  const existing = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await brevo('/smtp/templates?limit=100&offset=' + offset);
    existing.push(...(page?.templates || []));
    if (!page?.templates || page.templates.length < 100) break;
  }
  const results = [];
  const all = [
    ...welcome.map((e, i) => ({ ...e, name: `HallyuScope · Welcome ${i + 1} · ${e.subject}` })),
    ...reengage.map((e, i) => ({ ...e, name: `HallyuScope · Re-engage ${i + 1} · ${e.subject}` })),
  ];
  for (const e of all) {
    const body = { templateName: e.name, subject: e.subject, htmlContent: e.html(), sender: SENDER, replyTo: REPLY_TO, isActive: true, tag: e.key };
    const found = existing.find(t => t.tag === e.key || t.name === e.name);
    if (found) {
      await brevo('/smtp/templates/' + found.id, { method: 'PUT', body: JSON.stringify(body) });
      results.push({ key: e.key, id: found.id, updated: true });
    } else {
      const made = await brevo('/smtp/templates', { method: 'POST', body: JSON.stringify(body) });
      results.push({ key: e.key, id: made?.id, created: true });
    }
  }
  return results;
}

/* ---------- weekly issue ---------- */

export async function draftWeekly({ force = false } = {}) {
  const today = manilaToday();
  const name = 'The Weekly Scope · ' + today;
  const campaigns = await listCampaigns();
  if (campaigns.some(c => c.name === name) && !force) return { skipped: 'already drafted', name };
  const issueNo = campaigns.filter(c => String(c.name || '').startsWith('The Weekly Scope · ')).length + 1;
  const [articles, comebacks, concerts] = await Promise.all([
    getJson(RAW + 'article-drafts.json'), getJson(RAW + 'comebacks-calendar.json'), getJson(RAW + 'concerts-calendar.json'),
  ]);
  const issue = weeklyIssue({ today, articles: articles.items || [], comebacks: comebacks.items || [], concerts: concerts.items || [], issueNo });
  const made = await createDraft({ name, subject: issue.subject, preheader: issue.preheader, html: issue.html, tag: 'weekly-scope' });
  return { drafted: name, id: made?.id, subject: issue.subject };
}

/* ---------- alerts ---------- */

async function github(path, options = {}) {
  const token = process.env.GITHUB_REVIEW_TOKEN;
  if (!token) throw new Error('GITHUB_REVIEW_TOKEN is not configured');
  const r = await fetch('https://api.github.com' + path, { ...options, headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'HallyuScope (+https://hallyuscope.com)', ...(options.headers || {}) } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('GitHub ' + r.status + ': ' + (await r.text()).slice(0, 160));
  return r.json();
}
async function readState() {
  const file = await github(`/repos/${STATE.owner}/${STATE.repo}/contents/${STATE.path}?ref=${STATE.branch}`);
  if (!file) return { sha: null, json: null };
  return { sha: file.sha, json: JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')) };
}
async function writeState(json, sha, message) {
  await github(`/repos/${STATE.owner}/${STATE.repo}/contents/${STATE.path}`, {
    method: 'PUT',
    body: JSON.stringify({ message, branch: STATE.branch, sha: sha || undefined, content: Buffer.from(JSON.stringify(json, null, 2) + '\n').toString('base64') }),
  });
}

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export async function draftAlerts() {
  const today = manilaToday();
  const [concerts, comebacks, profiles, state] = await Promise.all([
    getJson(RAW + 'concerts-calendar.json'), getJson(RAW + 'comebacks-calendar.json'), getJson(RAW_MAIN + 'profiles.json').catch(() => ({ items: [] })), readState(),
  ]);
  const onSale = (concerts.items || []).filter(c => /on sale/i.test(c.status || '') && String(c.date).slice(0, 10) >= today);
  // Comeback alerts cover artists with a K-Profile (the acts most fans follow),
  // and real releases, not every music video upload.
  const known = (profiles.items || []).filter(p => p.category !== 'k-actors').map(p => norm(p.name));
  const outToday = (comebacks.items || []).filter(c => String(c.date).slice(0, 10) === today
    && !/music video release/i.test(c.type || '')
    && known.some(k => k && (norm(c.artist).includes(k) || k.includes(norm(c.artist)))));

  // First run: remember what is already on sale so old shows don't trigger alerts.
  if (!state.json) {
    await writeState({ createdAt: new Date().toISOString(), tickets: onSale.map(c => c.id), comebackDays: [today] }, null, 'newsletter: start alert tracking');
    return { baseline: true, tickets: onSale.length };
  }
  const next = { ...state.json, tickets: [...(state.json.tickets || [])], comebackDays: [...(state.json.comebackDays || [])] };
  const made = [];
  for (const show of onSale.filter(c => !next.tickets.includes(c.id))) {
    const a = ticketAlert(show);
    const d = await createDraft({ name: `Alert · Tickets · ${show.artist} · ${show.date}`, subject: a.subject, preheader: a.preheader, html: a.html, tag: 'alert-tickets' });
    next.tickets.push(show.id); made.push({ tickets: show.id, id: d?.id });
  }
  if (outToday.length && !next.comebackDays.includes(today)) {
    const a = comebackAlert(outToday);
    const d = await createDraft({ name: `Alert · Comebacks · ${today}`, subject: a.subject, preheader: a.preheader, html: a.html, tag: 'alert-comeback' });
    next.comebackDays.push(today); made.push({ comebacks: today, releases: outToday.length, id: d?.id });
  }
  if (made.length) {
    next.tickets = next.tickets.slice(-300); next.comebackDays = next.comebackDays.slice(-120);
    await writeState(next, state.sha, 'newsletter: alert drafts ' + today);
  }
  return { drafted: made };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const action = String(req.query?.action || '');
  try {
    if (action === 'templates') return res.status(200).json({ templates: await syncTemplates() });
    if (action === 'weekly') return res.status(200).json(await draftWeekly());
    if (action === 'alerts') return res.status(200).json(await draftAlerts());
    return res.status(400).json({ error: 'Use ?action=templates, weekly or alerts' });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
}
