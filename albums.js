// Albums page: card grid of K-pop releases, read live from the same
// live-data comebacks file the Comebacks page uses, so a new comeback
// shows up here automatically. Tabs: New (released, newest first) and
// Upcoming (soonest first). Search filters by artist or album title.
(() => {
  const grid = document.getElementById('albumGrid');
  const countEl = document.querySelector('.page-sub [data-count]');
  const searchEl = document.getElementById('albumSearch');
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
    return '<article class="album-card">' +
      coverHtml(e) +
      '<div class="album-date">' + esc(day) + '<small>' + esc(mon) + '</small></div>' +
      '<h3>' + esc(e.artist || 'Release') + '</h3>' +
      '<p class="album-title">' + esc(e.title || '') + '</p>' +
      '<span class="tag">' + esc(e.type || 'Release') + '</span>' +
      '</article>';
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

  fetch('https://raw.githubusercontent.com/phoebegrace/hallyuscope/live-data/data/comebacks-calendar.json?v=' + Date.now(), { cache: 'no-store' })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => { releases = (data.items || []).filter(e => e.id && e.date); render(); })
    .catch(() => { releases = []; render(); });
})();
