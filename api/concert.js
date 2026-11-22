// Serves /concert/<id> as its own page (not an inline detail on /concerts):
// per-concert <title>, canonical and Open Graph / Twitter meta in the raw
// HTML, and the full detail content rendered server-side so the page is
// complete without JavaScript (search engines and social scrapers read
// the HTML as-is).
//
// Wiring (vercel.json): /concert/:slug rewrites here, /concert rewrites
// here too. The shell below mirrors concerts.html; keep the two in sync.
//
// The concert id is the slug (e.g. le-sserafim-pureflow-manila-2026),
// taken from the live-data concerts file, the same file /concerts reads.

const CONCERTS_URL = 'https://raw.githubusercontent.com/phoebegrace/hallyuscope/live-data/data/concerts-calendar.json';
const SITE = 'https://hallyuscope.com';
const DEFAULT_IMAGE = SITE + '/assets/og-image.png';

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const fmt = (date, opts) => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', ...opts }).format(date);
const localDate = (s) => new Date(String(s).slice(0, 10) + 'T12:00:00+08:00');

function fact(label, value) {
  return '<div class="concert-fact"><b>' + esc(label) + '</b><span>' + esc(value) + '</span></div>';
}

function posterHtml(e) {
  const initial = String(e.artist || 'H').trim().charAt(0).toUpperCase();
  if (e.poster && /^https?:\/\//.test(e.poster)) {
    return '<div class="concert-show-poster"><img src="' + esc(e.poster) + '" alt="' +
      esc((e.artist || 'Concert') + ' official poster') + '" loading="lazy"></div>';
  }
  return '<div class="concert-show-poster concert-show-poster--empty"><span aria-hidden="true">' + esc(initial) + '</span></div>';
}

function showCardHtml(e) {
  const d = localDate(e.date);
  const day = fmt(d, { day: '2-digit' });
  const mon = fmt(d, { month: 'short', year: 'numeric' }).toUpperCase();
  const ticket = e.ticketUrl
    ? '<a class="concert-show-ticket" href="' + esc(e.ticketUrl) + '" target="_blank" rel="noopener"><span>Get tickets</span><span>↗</span></a>'
    : '<span class="concert-show-ticket is-disabled"><span>Tickets soon</span><span>—</span></span>';
  return '<div class="concert-show-card">' +
    '<a class="concert-show-poster-link" href="/concert/' + esc(e.id) + '" aria-label="' + esc((e.artist || '') + ' — ' + (e.tour || '')) + '">' + posterHtml(e) + '</a>' +
    '<div class="concert-show-info">' +
    '<div class="concert-show-date">' + esc(day) + '<small>' + esc(mon) + '</small></div>' +
    '<h3><a href="/concert/' + esc(e.id) + '">' + esc(e.artist || e.title || 'Concert') + '</a></h3>' +
    '<p class="concert-show-tour">' + esc(e.tour || '') + '</p>' +
    '<p class="concert-show-venue">' + esc([e.venue, e.city].filter(Boolean).join(' · ')) + '</p>' +
    '<p class="concert-show-price">' + esc(e.ticketRange || 'TBA') + ' · ' + esc(e.status || '') + '</p>' +
    ticket +
    '</div></div>';
}

function googleCalendarUrl(e) {
  const d = String(e.date).replaceAll('-', '');
  const title = encodeURIComponent((e.artist || e.title || 'Concert') + (e.tour ? ' — ' + e.tour : ''));
  const details = encodeURIComponent(e.description || '');
  const location = encodeURIComponent([e.venue, e.city, 'Philippines'].filter(Boolean).join(', '));
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + title + '&dates=' + d + '/' + d + '&details=' + details + '&location=' + location;
}

function relatedHtml(e, all) {
  const others = all.filter(x => x.id !== e.id);
  if (!others.length) return '';
  const d0 = localDate(e.date).getTime();
  others.sort((a, b) => Math.abs(localDate(a.date).getTime() - d0) - Math.abs(localDate(b.date).getTime() - d0));
  const picks = others.slice(0, 4);
  if (!picks.length) return '';
  return '<section class="album-section"><h4>More concerts</h4><div class="concert-show-grid">' +
    picks.map(showCardHtml).join('') + '</div></section>';
}

function detailHtml(e, all) {
  const d = localDate(e.date);
  const ticket = e.ticketUrl
    ? '<a class="concert-ticket-btn" href="' + esc(e.ticketUrl) + '" target="_blank" rel="noopener"><span>Buy Official Tickets</span><span>↗</span></a>'
    : '<span class="concert-ticket-btn is-disabled"><span>Ticket link coming soon</span><span>—</span></span>';
  const validImg = u => typeof u === 'string' && /^https?:\/\//.test(u);
  const poster = validImg(e.poster)
    ? '<figure class="concert-poster"><img src="' + esc(e.poster) + '" alt="' + esc((e.artist || 'Concert') + ' official poster') + '" loading="lazy"></figure>' : '';
  const seatPlan = validImg(e.seatPlan)
    ? '<figure class="concert-seatplan"><figcaption>Seat plan</figcaption><img src="' + esc(e.seatPlan) + '" alt="' + esc((e.artist || 'Concert') + ' seat plan') + '" loading="lazy"></figure>' : '';
  return '<div class="concert-detail">' +
    '<a class="concert-detail-back" href="/concerts">← All concerts</a>' +
    '<div class="concert-detail-grid"><div>' +
    '<span class="eyebrow">' + esc((e.type || 'Concert').toUpperCase()) + '</span>' +
    '<h3 class="concert-detail-title">' + esc(e.artist || e.title || 'Concert') + (e.tour ? ' — ' + esc(e.tour) : '') + '</h3>' +
    '<p class="concert-detail-dek">' + esc(e.description || 'More details will be added as official information is confirmed.') + '</p>' +
    '<div class="concert-facts">' +
      fact('Date', fmt(d, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })) +
      fact('Venue', e.venue || 'TBA') +
      fact('City', e.city || 'Philippines') +
      fact('Status', e.status || 'Tracking') +
      fact('Ticket range', e.ticketRange || 'TBA') +
      fact('Promoter', e.promoter || 'TBA') +
    '</div>' +
    (e.guideUrl ? '<p class="concert-guide-link" style="margin:24px 0 0"><a class="cta" href="' + esc(e.guideUrl) + '">Read the full concert guide <span class="arr">→</span></a></p>' : '') +
    '</div>' +
    '<div class="concert-detail-side">' + poster + seatPlan +
    '<aside class="concert-ticket-box"><span class="eyebrow">OFFICIAL TICKETING</span><h4>' + esc(e.ticketProvider || 'Ticket details') + '</h4><p>HallyuScope links only to verified official ticketing or promoter destinations when available.</p>' + ticket +
    '<div class="concert-calendar-actions"><a href="' + googleCalendarUrl(e) + '" target="_blank" rel="noopener">Google Calendar</a><a href="#" data-download-ics>Apple / Outlook</a></div></aside></div></div>' +
    relatedHtml(e, all) +
    '</div>' +
    '<script>(function(){var ev=' + JSON.stringify({ id: e.id, date: e.date, artist: e.artist, tour: e.tour, description: e.description, venue: e.venue, city: e.city }) +
    ';function icsData(){var d=String(ev.date).replaceAll("-","");var n=new Date(new Date(String(ev.date).slice(0,10)+"T12:00:00+08:00").getTime()+86400000);var nd=[n.getFullYear(),String(n.getMonth()+1).padStart(2,"0"),String(n.getDate()).padStart(2,"0")].join("");var t=(ev.artist||"Concert")+(ev.tour?" — "+ev.tour:"");return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//HallyuScope//Concert Calendar//EN","BEGIN:VEVENT","UID:"+ev.id+"@hallyuscope.com","DTSTART;VALUE=DATE:"+d,"DTEND;VALUE=DATE:"+nd,"SUMMARY:"+t.replace(/[;,]/g,"\\\\$&"),"LOCATION:"+[ev.venue,ev.city,"Philippines"].filter(Boolean).join(", ").replace(/[;,]/g,"\\\\$&"),"DESCRIPTION:"+(ev.description||"").replace(/[;,]/g,"\\\\$&"),"END:VEVENT","END:VCALENDAR"].join("\\r\\n");}' +
    'document.querySelector("[data-download-ics]").addEventListener("click",function(e){e.preventDefault();var blob=new Blob([icsData()],{type:"text/calendar;charset=utf-8"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=(ev.id||"concert")+".ics";a.click();setTimeout(function(){URL.revokeObjectURL(url)},1000);});})();</script>';
}

function shell({ title, description, canonical, image, body, jsonld = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#ffffff">
<meta name="google-site-verification" content="c7h5zaPAxsYySy4iI0ikijlJcHWMC5AtCzVtORqQqBI">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">${jsonld}
<meta property="og:type" content="website">
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
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&display=swap&text=%ED%95%9C%EB%A5%98%EB%89%B4%EC%8A%A4%EC%BD%98%EC%84%9C%ED%8A%B8%EC%BB%B4%EB%B0%B1%EA%B0%80%EC%9D%B4%EB%93%9C%EC%A7%80%EA%B8%88%EC%95%88%EB%82%B4%ED%8C%AC">
<link rel="stylesheet" href="/styles.css">
</head>
<body data-page="concert">
<a class="sr-only" href="#main">Skip to content</a>
<div class="topbar"><div class="wrap topbar-in">
  <span class="meta" data-today>Today</span>
  <span class="meta live"><i></i><span data-updated>Updated hourly</span><span class="hide-sm">&nbsp;· Manila time</span></span>
</div></div>
<header class="masthead"><div class="wrap">
  <a class="mast-logo" href="/" aria-label="HallyuScope home"><img src="/assets/hallyuscope-logo.png" alt="HallyuScope" width="2032" height="344"></a>
  <p class="mast-line"><span class="kr">한류</span><span>Your K-pop concert &amp; comeback tracker</span></p>
</div></header>
<nav class="nav" aria-label="Primary"><div class="wrap nav-in">
  <button class="nav-menu-btn" type="button" aria-label="Open menu" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
  <a class="nav-logo" href="/" aria-label="HallyuScope home" tabindex="-1"><img src="/assets/hallyuscope-logo-light.png" alt="" width="2032" height="344"></a>
  <div class="nav-links"><a href="/">Home</a><div class="nav-has-sub"><a href="/concerts" aria-current="page">Concerts</a><div class="nav-sub"><a href="/concerts">Concert calendar</a><a href="/tickets">Ticket watch</a><a href="/venues">Venue guide</a></div></div><a href="/comebacks">Comebacks</a><a href="/albums">Albums</a><div class="nav-has-sub"><a href="/profiles">K-Profile</a><div class="nav-sub"><a href="/profiles#girl-groups">Girl groups</a><a href="/profiles#boy-groups">Boy groups</a><a href="/profiles#soloists">Soloists</a><a href="/profiles#k-actors">K-actors</a></div></div><a href="/features">Guides</a><a href="/latest">News</a></div>
  <button class="search-btn" type="button" data-open-search aria-label="Search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><span class="lbl">Search</span><kbd>/</kbd></button>
</div></nav>
<main id="main" class="wrap">
${body}
</main>
<section class="news-sign rv" aria-labelledby="nl-h">
  <div class="wrap nl-in">
    <div class="nl-copy">
      <span class="kr">팬 뉴스</span>
      <h2 id="nl-h">Get <em>The Weekly Scope</em></h2>
      <p class="nl-sub">Everything Filipino K-pop fans need to know, in one email a week.</p>
      <ul class="nl-perks">
        <li><b>Comebacks</b> Release dates and teasers the moment they drop</li>
        <li><b>PH concerts</b> Every Manila show and ticket sale in one list</li>
        <li><b>Top stories</b> The week's must-reads in a 3-minute email</li>
      </ul>
      <form class="nl-form" id="newsletterForm" novalidate>
        <label class="sr-only" for="newsletterEmail">Email address</label>
        <div class="nl-row"><input id="newsletterEmail" name="email" type="email" placeholder="Your email address" autocomplete="email" required><button id="newsletterSubmit" type="submit">Join free</button></div>
        <div class="hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></div>
        <p class="meta" id="signupMessage" role="status" aria-live="polite">Free · Once a week · Unsubscribe anytime</p>
      </form>
    </div>
    <aside class="nl-preview" aria-hidden="true">
      <div class="nl-mail scope locked">
        <div class="nl-mail-top"><img src="/assets/hallyuscope-logo.png" alt="" width="2032" height="344"><span class="meta">This week's issue</span></div>
        <ol class="nl-list" id="nlPreview"><li><span class="sk" style="width:90%"></span></li><li><span class="sk" style="width:75%"></span></li><li><span class="sk" style="width:85%"></span></li><li><span class="sk" style="width:70%"></span></li></ol>
        <p class="nl-mail-foot meta">The Weekly Scope · Made for fans in the Philippines</p>
      </div>
    </aside>
  </div>
</section>
<footer class="foot">
  <div class="wrap">
    <div class="foot-top">
      <div>
        <a class="foot-logo" href="/" aria-label="HallyuScope home"><img src="/assets/hallyuscope-logo-light.png" alt="HallyuScope" width="2032" height="344"></a>
        <p>Philippine K-pop concerts, upcoming releases and artist profiles, with news and guides to keep you in the loop.</p>
      </div>
      <div><h4>Sections</h4><ul><li><a href="/latest">Latest</a></li><li><a href="/concerts">Concerts</a></li><li><a href="/comebacks">Comebacks</a></li><li><a href="/albums">Albums</a></li><li><a href="/profiles">K-Profile</a></li><li><a href="/features">Guides</a><a href="/latest">News</a></li></ul></div>
      <div><h4>HallyuScope</h4><p>Concert and comeback tracking for Filipino fans, plus artist profiles, news and practical guides.</p></div>
    </div>
    <div class="foot-bottom"><span>© 2026 HallyuScope · <a href="/about">About</a> · <a href="/privacy">Privacy policy</a></span><span>Independent fan publication. Not affiliated with any entertainment agency.</span></div>
    <div class="foot-mark" aria-hidden="true">HallyuScope</div>
  </div>
</footer>
<div class="search" id="search" role="dialog" aria-modal="true" aria-label="Search HallyuScope" aria-hidden="true">
  <div class="search-bar"><div class="wrap"><label class="sr-only" for="q">Search</label><input id="q" type="search" placeholder="Search artists, groups, cities" autocomplete="off"><button class="search-close" id="searchClose" type="button">Close · Esc</button></div></div>
  <div class="search-body"><div class="wrap" id="results"></div></div>
</div>

<script src="/script.js?v=20261119-trackers" defer></script>
</body>
</html>`;
}

// Structured data so Google can show the show as an event (date, venue,
// ticket price) in search results.
const METRO = /pasay|quezon|manila|san juan|taguig|makati|pasig|para[nñ]aque|mandaluyong|muntinlupa|caloocan/i;
function eventKind(e) {
  const t = (e.type || '') + ' ' + (e.tour || '');
  return /fan ?meet/i.test(t) ? 'Fan Meeting' : /fan ?con(cert)?/i.test(t) ? 'Fan Concert' : 'Concert';
}
function startTime(e) {
  const m = String(e.description || '').match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!m) return String(e.date).slice(0, 10);
  let h = Number(m[1]) % 12; if (/pm/i.test(m[3])) h += 12;
  return String(e.date).slice(0, 10) + 'T' + String(h).padStart(2, '0') + ':' + (m[2] || '00') + ':00+08:00';
}
function eventJsonLd(e, url) {
  const prices = String(e.ticketRange || '').replace(/,/g, '').match(/\d+(?:\.\d+)?/g)?.map(Number).filter(n => n >= 100) || [];
  const status = /cancel/i.test(e.status || '') ? 'EventCancelled' : /postpon/i.test(e.status || '') ? 'EventPostponed' : 'EventScheduled';
  const availability = /sold out/i.test(e.status || '') ? 'SoldOut' : /on sale|available/i.test(e.status || '') ? 'InStock' : 'PreOrder';
  const ev = {
    '@context': 'https://schema.org', '@type': eventKind(e) === 'Concert' ? 'MusicEvent' : 'Event',
    name: (e.artist || 'Concert') + (e.tour ? ' — ' + e.tour : ''),
    startDate: startTime(e),
    eventStatus: 'https://schema.org/' + status,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: e.venue || 'TBA', address: { '@type': 'PostalAddress', addressLocality: e.city || 'Metro Manila', addressCountry: 'PH' } },
    description: e.description || undefined,
    image: e.poster && /^https?:\/\//.test(e.poster) ? [e.poster] : [DEFAULT_IMAGE],
    performer: { '@type': eventKind(e) === 'Fan Meeting' ? 'Person' : 'MusicGroup', name: e.artist },
    organizer: e.promoter && e.promoter !== 'TBA' ? { '@type': 'Organization', name: e.promoter } : undefined,
    url,
  };
  if (e.ticketUrl) {
    ev.offers = prices.length
      ? { '@type': 'AggregateOffer', url: e.ticketUrl, priceCurrency: 'PHP', lowPrice: Math.min(...prices), highPrice: Math.max(...prices), availability: 'https://schema.org/' + availability }
      : { '@type': 'Offer', url: e.ticketUrl, priceCurrency: 'PHP', availability: 'https://schema.org/' + availability };
  }
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
    { '@type': 'ListItem', position: 2, name: 'K-pop concerts in the Philippines', item: SITE + '/concerts' },
    { '@type': 'ListItem', position: 3, name: ev.name, item: url },
  ] };
  const safe = o => JSON.stringify(o).replace(/</g, '\\u003c');
  return '\n<script type="application/ld+json">' + safe(ev) + '</script>\n<script type="application/ld+json">' + safe(crumbs) + '</script>';
}

export default async function handler(req, res) {
  const slug = String(req.query?.slug || '').replace(/^\/+|\/+$/g, '');
  const id = String(req.query?.id || '');
  const key = slug || id;

  let items = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const r = await fetch(CONCERTS_URL, { signal: controller.signal, cache: 'no-store' });
      if (!r.ok) throw new Error('concerts fetch failed: ' + r.status);
      const data = await r.json();
      items = (data.items || []).filter(e => e.id && e.date);
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    items = [];
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  const item = key ? items.find(x => x.id === key) || null : null;
  if (!item) {
    return res.status(404).send(shell({
      title: 'Concert not found | HallyuScope',
      description: 'This concert could not be found on HallyuScope.',
      canonical: SITE + '/concerts',
      image: DEFAULT_IMAGE,
      body: '<div class="concert-detail"><a class="concert-detail-back" href="/concerts">← All concerts</a>' +
        '<h3>Concert not found</h3><p class="concert-detail-dek">This concert is not in our Philippine concert list. It may have been removed, or the link is wrong.</p></div>',
    }));
  }

  const canonical = SITE + '/concert/' + encodeURIComponent(item.id);
  const year = String(item.date || '').slice(0, 4);
  const place = METRO.test(item.city || '') || METRO.test(item.venue || '') ? 'Manila' : (item.city || 'Philippines');
  const title = (item.artist || 'K-pop') + ' ' + place + ' ' + eventKind(item) + ' ' + year + ': Tickets, Prices & Seat Plan | HallyuScope';
  const longDate = fmt(localDate(item.date), { month: 'long', day: 'numeric', year: 'numeric' });
  const description = (item.artist || '') + (item.tour ? ' ' + item.tour : '') + ': ' + longDate + (item.venue ? ' at ' + item.venue : '') + (item.city ? ', ' + item.city : '') + '. ' + (item.ticketRange && !/see official/i.test(item.ticketRange) ? 'Ticket prices ' + item.ticketRange + ', ' : 'Ticket prices, ') + 'seat plan, official ticket link and what to know before you go.';
  return res.status(200).send(shell({
    title,
    description,
    canonical,
    jsonld: eventJsonLd(item, canonical),
    image: (item.poster && /^https?:\/\//.test(item.poster)) ? item.poster : DEFAULT_IMAGE,
    body: detailHtml(item, items),
  }));
}
