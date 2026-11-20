// Writes every Weekly Scope email to emails/ as standalone HTML, for preview
// and for pasting into Brevo ("Paste your code"). The weekly issue sample
// uses the live data on the live-data branch.
import { mkdir, writeFile } from 'node:fs/promises';
import { welcome, reengage, ticketAlert, comebackAlert, weeklyIssue } from '../api/newsletter-emails.js';

const RAW = 'https://raw.githubusercontent.com/phoebegrace/hallyuscope/live-data/data/';
const dir = new URL('../emails/', import.meta.url);
await mkdir(dir, { recursive: true });
const out = [];
for (const e of [...welcome, ...reengage]) {
  await writeFile(new URL(e.key + '.html', dir), e.html());
  out.push(`${e.key}.html  |  ${e.delay}  |  ${e.subject}`);
}
const get = async f => { try { const r = await fetch(RAW + f); return r.ok ? r.json() : { items: [] }; } catch { return { items: [] }; } };
const [articles, comebacks, concerts] = await Promise.all([get('article-drafts.json'), get('comebacks-calendar.json'), get('concerts-calendar.json')]);
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
const issue = weeklyIssue({ today, articles: articles.items, comebacks: comebacks.items, concerts: concerts.items, issueNo: 1 });
await writeFile(new URL('weekly-scope-sample.html', dir), issue.html);
out.push(`weekly-scope-sample.html  |  ${issue.subject}`);
const show = (concerts.items || []).find(c => /on sale/i.test(c.status || '')) || concerts.items?.[0];
if (show) { const a = ticketAlert(show); await writeFile(new URL('alert-tickets-sample.html', dir), a.html); out.push(`alert-tickets-sample.html  |  ${a.subject}`); }
const rel = (comebacks.items || []).find(c => c.cover && c.tracks?.length) || comebacks.items?.[0];
if (rel) { const a = comebackAlert(rel); await writeFile(new URL('alert-comeback-sample.html', dir), a.html); out.push(`alert-comeback-sample.html  |  ${a.subject}`); }
console.log(out.join('\n'));
