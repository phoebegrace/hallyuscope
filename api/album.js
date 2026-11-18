// Serves /album/<id> as its own page (not an inline section on /albums):
// per-album <title>, canonical and Open Graph / Twitter meta in the raw
// HTML, and the full detail content rendered server-side so the page is
// complete without JavaScript (search engines and social scrapers read
// the HTML as-is).
//
// Wiring (vercel.json): /album/:slug rewrites here, /album rewrites here
// too. The shell below mirrors albums.html; keep the two in sync.
//
// The album id is the slug (e.g. ateez-golden-hour-part-6-2026), taken
// from the live-data comebacks file, the same file /albums reads.

const COMEBACKS_URL = 'https://raw.githubusercontent.com/phoebegrace/hallyuscope/live-data/data/comebacks-calendar.json';
const SITE = 'https://hallyuscope.com';
const DEFAULT_IMAGE = SITE + '/assets/og-image.png';

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const fmt = (date, opts) => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', ...opts }).format(date);
const localDate = (s) => new Date(String(s).slice(0, 10) + 'T12:00:00+08:00');
const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
const fmtDur = (ms) => {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};
const spotifyEmbed = (url) => {
  const m = /open\.spotify\.com\/album\/([A-Za-z0-9]+)/.exec(String(url || ''));
  return m ? 'https://open.spotify.com/embed/album/' + m[1] : '';
};
const appleEmbed = (url) => {
  const clean = String(url || '').split('?')[0];
  const m = /music\.apple\.com\/([a-z]{2})\/album\/[^/]+\/(\d+)/.exec(clean);
  return m ? 'https://embed.music.apple.com/' + m[1] + '/album/' + m[2] : '';
};

function fact(label, value) {
  return '<div class="album-fact"><b>' + esc(label) + '</b><span>' + esc(value) + '</span></div>';
}

function coverHtml(e) {
  if (e.cover) {
    return '<div class="album-cover"><img src="' + esc(e.cover) + '" alt="' +
      esc((e.artist || 'Release') + ' - ' + (e.title || '') + ' album cover') +
      '" loading="lazy"></div>';
  }
  return '<div class="album-cover album-cover--empty"><span aria-hidden="true">?</span></div>';
}

function cardHtml(e) {
  const d = localDate(e.date);
  const day = fmt(d, { day: '2-digit' });
  const mon = fmt(d, { month: 'short', year: 'numeric' }).toUpperCase();
  return '<a class="album-card" href="/album/' + esc(e.id) + '" aria-label="' + esc((e.title || '') + ' by ' + (e.artist || '')) + '">' +
    coverHtml(e) +
    '<div class="album-date">' + esc(day) + '<small>' + esc(mon) + '</small></div>' +
    '<h3>' + esc(e.title || 'Release') + '</h3>' +
    '<p class="album-artist">' + esc(e.artist || '') + '</p>' +
    '<span class="tag">' + esc(e.type || 'Release') + '</span>' +
    '</a>';
}

function buyHtml(e) {
  const links = Array.isArray(e.buyLinks) ? e.buyLinks.filter(b => b && b.url) : [];
  const btns = links.length
    ? links.map(b => '<a class="album-listen-btn" href="' + esc(b.url) + '" target="_blank" rel="noopener sponsored"><span>' + esc(b.label || 'Buy on Shopee') + '</span><span>↗</span></a>').join('')
    : '<span class="album-listen-btn is-disabled"><span>Shopee — links coming soon</span><span>—</span></span>';
  return '<aside class="album-buy-box"><span class="eyebrow">WHERE TO BUY</span><h4>Get the album</h4><p>Buy through our links and support HallyuScope.</p>' + btns + '</aside>';
}

function teasersHtml(e) {
  const teasers = Array.isArray(e.teasers) ? e.teasers : [];
  if (!teasers.length) return '';
  return '<section class="album-section"><h4>Teasers</h4><div class="album-teasers">' +
    teasers.map(t => '<a class="album-teaser" href="https://www.youtube.com/watch?v=' + esc(t.videoId) + '" target="_blank" rel="noopener">' +
      '<img src="' + esc(t.thumb) + '" alt="' + esc(t.title || 'Teaser') + '" loading="lazy">' +
      '<span>' + esc(t.title || 'Teaser') + '</span></a>').join('') +
    '</div></section>';
}

function tracksHtml(e) {
  const tracks = Array.isArray(e.tracks) ? e.tracks : [];
  if (!tracks.length) return '';
  return '<section class="album-section"><h4>Tracklist</h4><ol class="album-tracks">' +
    tracks.map(t => '<li><span class="album-track-n">' + esc(String(t.n)) + '</span>' +
      '<span class="album-track-name">' + esc(t.name || '') +
      (t.titleTrack ? ' <b class="album-track-title">Title track</b>' : '') + '</span>' +
      '<span class="album-track-dur">' + esc(fmtDur(t.ms)) + '</span></li>').join('') +
    '</ol></section>';
}

function mvHtml(e) {
  const mv = e.mv || null;
  if (!mv || !mv.videoId) return '';
  const isClip = mv.kind === 'special clip';
  return '<section class="album-section"><h4>' + (isClip ? 'Special clip' : 'Music video') +
    (mv.titleTrack ? ' — ' + esc(mv.titleTrack) : '') + '</h4>' +
    '<div class="album-mv"><iframe src="https://www.youtube-nocookie.com/embed/' + esc(mv.videoId) +
    '" title="' + esc(mv.title || 'Music video') + '" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>' +
    '<p class="album-mv-cap">' + esc(mv.title || '') + (mv.channel ? ' · ' + esc(mv.channel) : '') + '</p></section>';
}

function streamHtml(e) {
  const links = e.links || {};
  const sp = spotifyEmbed(links.spotify);
  const ap = appleEmbed(links.appleMusic);
  if (!sp && !ap) {
    return '<section class="album-section"><h4>Stream it</h4><p class="album-note-line">Streaming links appear here once the album is out.</p></section>';
  }
  return '<section class="album-section"><h4>Stream it</h4><div class="album-stream">' +
    (sp ? '<iframe src="' + esc(sp) + '" title="Listen on Spotify" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>' : '') +
    (ap ? '<iframe src="' + esc(ap) + '" title="Listen on Apple Music" loading="lazy" allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"></iframe>' : '') +
    '</div></section>';
}

function relatedHtml(e, all) {
  const others = all.filter(x => x.id !== e.id);
  if (!others.length) return '';
  const d0 = localDate(e.date).getTime();
  others.sort((a, b) => {
    const sameA = (a.type || '') === (e.type || '') ? 0 : 1;
    const sameB = (b.type || '') === (e.type || '') ? 0 : 1;
    if (sameA !== sameB) return sameA - sameB;
    return Math.abs(localDate(a.date).getTime() - d0) - Math.abs(localDate(b.date).getTime() - d0);
  });
  const picks = others.slice(0, 4);
  if (!picks.length) return '';
  return '<section class="album-section"><h4>More albums</h4><div class="album-grid album-related">' +
    picks.map(cardHtml).join('') + '</div></section>';
}

function detailHtml(e, all) {
  const d = localDate(e.date);
  const isNew = String(e.date).slice(0, 10) <= todayStr;
  const cover = e.cover
    ? '<figure class="album-cover-big"><img src="' + esc(e.cover) + '" alt="' + esc((e.artist || 'Release') + ' - ' + (e.title || '') + ' album cover') + '" loading="lazy"></figure>'
    : '<div class="album-cover-big album-cover-big--empty"><span aria-hidden="true">?</span></div>';
  return '<div class="album-detail">' +
    '<a class="album-detail-back" href="/albums">← All albums</a>' +
    '<div class="album-detail-grid"><div>' +
    '<span class="eyebrow">' + esc((e.type || 'Release').toUpperCase()) + '</span>' +
    '<h3 class="album-detail-title">' + esc(e.title || 'Release') + '</h3>' +
    '<p class="album-detail-artist">' + esc(e.artist || '') + '</p>' +
    '<p class="album-detail-dek">' + esc(e.description || 'More details will be added as official information is confirmed.') + '</p>' +
    '<div class="album-facts">' +
      fact('Release date', fmt(d, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })) +
      fact('Format', e.type || 'Release') +
      fact('Artist', e.artist || '—') +
      fact('Status', isNew ? 'Released' : 'Upcoming') +
    '</div></div>' +
    '<div class="album-detail-side">' + cover + buyHtml(e) + '</div></div>' +
    teasersHtml(e) + tracksHtml(e) + mvHtml(e) + streamHtml(e) + relatedHtml(e, all) +
    '</div>';
}

function shell({ title, description, canonical, image, body }) {
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
<body data-page="album">
<a class="sr-only" href="#main">Skip to content</a>
<div class="topbar"><div class="wrap topbar-in">
  <span class="meta" data-today>Today</span>
  <span class="meta live"><i></i><span data-updated>Updated hourly</span><span class="hide-sm">&nbsp;· Manila time</span></span>
</div></div>
<header class="masthead"><div class="wrap">
  <a class="mast-logo" href="/" aria-label="HallyuScope home"><img src="/assets/hallyuscope-logo.png" alt="HallyuScope" width="2032" height="344"></a>
  <p class="mast-line"><span class="kr">한류</span><span>K-pop &amp; Korean culture news for Filipino fans</span></p>
</div></header>
<nav class="nav" aria-label="Primary"><div class="wrap nav-in">
  <a class="nav-logo" href="/" aria-label="HallyuScope home" tabindex="-1"><img src="/assets/hallyuscope-logo-light.png" alt="" width="2032" height="344"></a>
  <div class="nav-links"><a href="/">Home</a><a href="/latest">Latest</a><a href="/concerts">Concerts</a><a href="/comebacks">Comebacks</a><a href="/albums" aria-current="page">Albums</a><a href="/features">Guides</a></div>
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
        <p>K-pop and Korean culture news rewritten and published on HallyuScope, with source attribution kept inside each story.</p>
      </div>
      <div><h4>Sections</h4><ul><li><a href="/latest">Latest</a></li><li><a href="/concerts">Concerts</a></li><li><a href="/comebacks">Comebacks</a></li><li><a href="/albums">Albums</a></li><li><a href="/features">Guides</a></li></ul></div>
      <div><h4>HallyuScope</h4><p>Independent coverage, weekly news, concert radar, comeback tracking and fan-first guides.</p></div>
    </div>
    <div class="foot-bottom"><span>© 2026 HallyuScope · hallyuscope.com</span><span>Independent fan publication. Not affiliated with any entertainment agency.</span></div>
    <div class="foot-mark" aria-hidden="true">HallyuScope</div>
  </div>
</footer>
<div class="search" id="search" role="dialog" aria-modal="true" aria-label="Search HallyuScope" aria-hidden="true">
  <div class="search-bar"><div class="wrap"><label class="sr-only" for="q">Search</label><input id="q" type="search" placeholder="Search artists, groups, cities" autocomplete="off"><button class="search-close" id="searchClose" type="button">Close · Esc</button></div></div>
  <div class="search-body"><div class="wrap" id="results"></div></div>
</div>

<script src="/script.js" defer></script>
</body>
</html>`;
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
      const r = await fetch(COMEBACKS_URL, { signal: controller.signal, cache: 'no-store' });
      if (!r.ok) throw new Error('comebacks fetch failed: ' + r.status);
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
      title: 'Album not found | HallyuScope',
      description: 'This album could not be found on HallyuScope.',
      canonical: SITE + '/albums',
      image: DEFAULT_IMAGE,
      body: '<div class="album-detail"><a class="album-detail-back" href="/albums">← All albums</a>' +
        '<h3>Album not found</h3><p class="album-detail-dek">This album is not in our releases list. It may have been removed, or the link is wrong.</p></div>',
    }));
  }

  const title = (item.title || 'Release') + ' — ' + (item.artist || '') + ' | HallyuScope';
  return res.status(200).send(shell({
    title,
    description: item.description || ((item.artist || '') + ' — ' + (item.title || '') + ', released ' + String(item.date || '').slice(0, 10) + '. Tracklist, music video, teasers and streaming links on HallyuScope.'),
    canonical: SITE + '/album/' + encodeURIComponent(item.id),
    image: item.cover || DEFAULT_IMAGE,
    body: detailHtml(item, items),
  }));
}
