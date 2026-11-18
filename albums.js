// Albums page: card grid of K-pop releases, read live from the same
// live-data comebacks file the Comebacks page uses, so a new comeback
// shows up here automatically. Tabs: New (released, newest first) and
// Upcoming (soonest first). Search filters by artist or album title.
(() => {
  const grid = document.getElementById('albumGrid');
  const countEl = document.querySelector('.page-sub [data-count]');
  const searchEl = document.getElementById('albumSearch');
  const toolsEl = document.getElementById('albumTools');
  const noteEl = document.querySelector('.album-note');
  const detail = document.getElementById('albumDetail');
  const detailBody = document.getElementById('albumDetailBody');
  if (!grid) return;

  const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (date, opts) => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', ...opts }).format(date);
  const localDate = (s) => new Date(String(s).slice(0, 10) + 'T12:00:00+08:00');
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());

  let releases = [];
  let tab = 'new';
  let query = '';

  function visible() {
    const q = query.trim().toLowerCase();
    // A search looks across every release, not just the current tab.
    if (q) {
      return releases
        .filter(e => String(e.artist || '').toLowerCase().includes(q)
          || String(e.title || '').toLowerCase().includes(q))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    }
    const list = releases.filter(e => {
      const isNew = String(e.date).slice(0, 10) <= todayStr;
      if (tab === 'new' && !isNew) return false;
      if (tab === 'upcoming' && isNew) return false;
      return true;
    });
    list.sort((a, b) => tab === 'new'
      ? String(b.date).localeCompare(String(a.date))
      : String(a.date).localeCompare(String(b.date)));
    return list;
  }

  // If a cover image fails to load, swap it for the initial-letter placeholder.
  window.albumCoverError = function (img) {
    const box = img.parentNode;
    box.classList.add('album-cover--empty');
    box.classList.add('album-cover-big--empty');
    img.remove();
    const s = document.createElement('span');
    s.setAttribute('aria-hidden', 'true');
    s.textContent = (img.alt || 'H').charAt(0);
    box.appendChild(s);
  };

  function coverHtml(e) {
    const initial = String(e.artist || 'H').trim().charAt(0).toUpperCase();
    if (e.cover) {
      return '<div class="album-cover"><img src="' + esc(e.cover) + '" alt="' +
        esc((e.artist || 'Release') + ' - ' + (e.title || '') + ' album cover') +
        '" loading="lazy" onerror="albumCoverError(this)"></div>';
    }
    return '<div class="album-cover album-cover--empty"><span aria-hidden="true">' + esc(initial) + '</span></div>';
  }

  function cardHtml(e) {
    const d = localDate(e.date);
    const day = fmt(d, { day: '2-digit' });
    const mon = fmt(d, { month: 'short', year: 'numeric' }).toUpperCase();
    return '<article class="album-card" data-album-id="' + esc(e.id) + '" tabindex="0" role="button" aria-label="' + esc((e.title || '') + ' by ' + (e.artist || '')) + '">' +
      coverHtml(e) +
      '<div class="album-date">' + esc(day) + '<small>' + esc(mon) + '</small></div>' +
      '<h3>' + esc(e.title || 'Release') + '</h3>' +
      '<p class="album-artist">' + esc(e.artist || '') + '</p>' +
      '<span class="tag">' + esc(e.type || 'Release') + '</span>' +
      '</article>';
  }

  function fact(label, value) { return '<div class="album-fact"><b>' + esc(label) + '</b><span>' + esc(value) + '</span></div>'; }

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

  function relatedHtml(e) {
    const others = releases.filter(x => x.id !== e.id);
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

  function showAlbum(e) {
    if (!e) return;
    const d = localDate(e.date);
    const isNew = String(e.date).slice(0, 10) <= todayStr;
    const initial = String(e.artist || 'H').trim().charAt(0).toUpperCase();
    const cover = e.cover
      ? '<figure class="album-cover-big"><img src="' + esc(e.cover) + '" alt="' + esc((e.artist || 'Release') + ' - ' + (e.title || '') + ' album cover') + '" loading="lazy" onerror="albumCoverError(this)"></figure>'
      : '<div class="album-cover-big album-cover-big--empty"><span aria-hidden="true">' + esc(initial) + '</span></div>';
    detailBody.innerHTML =
      '<div class="album-detail-grid"><div>' +
      '<span class="eyebrow">' + esc((e.type || 'Release').toUpperCase()) + '</span>' +
      '<h3>' + esc(e.title || 'Release') + '</h3>' +
      '<p class="album-detail-artist">' + esc(e.artist || '') + '</p>' +
      '<p class="album-detail-dek">' + esc(e.description || 'More details will be added as official information is confirmed.') + '</p>' +
      '<div class="album-facts">' +
        fact('Release date', fmt(d, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })) +
        fact('Format', e.type || 'Release') +
        fact('Artist', e.artist || '—') +
        fact('Status', isNew ? 'Released' : 'Upcoming') +
      '</div></div>' +
      '<div class="album-detail-side">' + cover + buyHtml(e) + '</div></div>' +
      teasersHtml(e) + tracksHtml(e) + mvHtml(e) + streamHtml(e) + relatedHtml(e);
    if (toolsEl) toolsEl.hidden = true;
    grid.hidden = true;
    if (noteEl) noteEl.hidden = true;
    detail.hidden = false;
    try { history.replaceState(null, '', '#album-' + e.id); } catch (err) { location.hash = 'album-' + e.id; }
    window.scrollTo(0, 0);
  }

  function showMain() {
    detail.hidden = true;
    if (toolsEl) toolsEl.hidden = false;
    grid.hidden = false;
    if (noteEl) noteEl.hidden = false;
    try { history.replaceState(null, '', location.pathname); } catch (err) { location.hash = ''; }
  }

  function render() {
    const list = visible();
    if (countEl) {
      const nNew = releases.filter(e => String(e.date).slice(0, 10) <= todayStr).length;
      const nUp = releases.length - nNew;
      countEl.textContent = nNew + ' new · ' + nUp + ' upcoming';
    }
    if (!releases.length) {
      grid.innerHTML = '<p class="album-empty">Album data could not be loaded. Please try again in a moment.</p>';
      return;
    }
    grid.innerHTML = list.length
      ? list.map(cardHtml).join('')
      : '<p class="album-empty">' + (query.trim() ? 'No albums match your search.' : 'No releases in this view yet.') + '</p>';
  }

  document.querySelectorAll('[data-album-tab]').forEach(btn => btn.addEventListener('click', () => {
    tab = btn.dataset.albumTab;
    document.querySelectorAll('[data-album-tab]').forEach(b => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
    render();
  }));
  if (searchEl) searchEl.addEventListener('input', () => { query = searchEl.value; render(); });

  grid.addEventListener('click', (ev) => {
    const card = ev.target.closest('[data-album-id]');
    if (card) showAlbum(releases.find(x => x.id === card.dataset.albumId));
  });
  grid.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const card = ev.target.closest('[data-album-id]');
    if (card) { ev.preventDefault(); showAlbum(releases.find(x => x.id === card.dataset.albumId)); }
  });
  const backBtn = document.getElementById('albumDetailBack');
  if (backBtn) backBtn.addEventListener('click', showMain);

  // Related albums live inside the detail body, so they get their own delegation.
  if (detailBody) {
    detailBody.addEventListener('click', (ev) => {
      const card = ev.target.closest('[data-album-id]');
      if (card) showAlbum(releases.find(x => x.id === card.dataset.albumId));
    });
    detailBody.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const card = ev.target.closest('[data-album-id]');
      if (card) { ev.preventDefault(); showAlbum(releases.find(x => x.id === card.dataset.albumId)); }
    });
  }

  fetch('https://raw.githubusercontent.com/phoebegrace/hallyuscope/live-data/data/comebacks-calendar.json?v=' + Date.now(), { cache: 'no-store' })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => {
      releases = (data.items || []).filter(e => e.id && e.date);
      render();
      const m = /^#album-(.+)$/.exec(location.hash || '');
      if (m) showAlbum(releases.find(x => x.id === m[1]));
    })
    .catch(() => { releases = []; render(); });
})();
