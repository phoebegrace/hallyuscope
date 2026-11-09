/* HallyuScope — live front page */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const TZ = 'Asia/Manila';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- text helpers ---------- */
  const decoder = document.createElement('textarea');
  const decode = (s = '') => { decoder.innerHTML = s; return decoder.value; };
  const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function cleanTitle(item) {
    let t = decode(item.title || '').replace(/\s+/g, ' ').trim();
    const src = (item.source || '').trim();
    if (src) {
      const tail = new RegExp('\\s+[-–|]\\s+' + src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
      t = t.replace(tail, '');
    }
    t = t.replace(/\s*\((?:📷|photo|via)[^)]*\)/gi, '')
         .replace(/\s*\|\s*(?:via\b.*|vi|v)$/i, '')
         .replace(/\s*\|\s*$/, '').trim();
    if (t.length > 130) t = t.slice(0, 126).replace(/\s+\S*$/, '') + '…';
    return t;
  }

  const RULES = [
    ['Concert', /\b(concert|tour|fan ?con|fan ?meeting|fanmeet|encore|arena|stadium|ticket|showcase in|world tour)\b/i],
    ['Drama', /\b(drama|k-drama|episode|series|netflix|disney\+|tving|film|movie|actor|actress|cast|starring|watch:|webtoon|rom-com|romance|genre|empress|lead roles?|bid farewell)\b/i],
    ['Music', /\b(comeback|album|single|release|mv|music video|title track|debut|teaser|tracklist|mini|ep|chart|billboard|melon|song|ost)\b/i],
  ];
  const tagOf = t => (RULES.find(([, re]) => re.test(t)) || ['News'])[0];

  const normalize = list => (list || []).map(it => {
    const title = cleanTitle(it);
    return { ...it, title, tag: tagOf(title), time: new Date(it.publishedAt) };
  }).filter(it => it.title && it.url);

  const normalizeDrafts = list => (list || []).map(it => {
    const title = decode(it.headline || '').replace(/\s+/g, ' ').trim();
    const category = it.category || 'HALLYU NEWS';
    const tagMap = {
      'CONCERT NEWS': 'Concert',
      'COMEBACK NEWS': 'Music',
      'K-DRAMA NEWS': 'Drama',
      'TRENDING': 'News',
      'HALLYU NEWS': 'News'
    };
    return {
      ...it,
      title,
      tag: tagMap[category] || tagOf(title),
      category,
      source: 'HallyuScope',
      url: '/article?id=' + encodeURIComponent(it.id),
      time: new Date(it.publishedAt || it.createdAt)
    };
  }).filter(it => it.id && it.title);

  const weekOnly = list => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return list.filter(it => !isFinite(it.time) || it.time.getTime() >= cutoff);
  };

  function ago(d) {
    const ms = Date.now() - d.getTime();
    if (!isFinite(ms)) return 'Recent';
    const m = Math.max(1, Math.round(ms / 6e4));
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} hr${h > 1 ? 's' : ''} ago`;
    const dd = Math.round(h / 24);
    return `${dd} day${dd > 1 ? 's' : ''} ago`;
  }
  const fmt = (d, o) => isFinite(d) ? d.toLocaleDateString('en-PH', { timeZone: TZ, ...o }) : '';
  const dayNum = d => fmt(d, { day: '2-digit' });
  const mon = d => fmt(d, { month: 'short' }).toUpperCase();
  const clock = d => isFinite(d) ? d.toLocaleTimeString('en-PH', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }) : '';
  const dayKey = d => fmt(d, { year: 'numeric', month: '2-digit', day: '2-digit' });

  function dayLabel(d) {
    const k = dayKey(d), today = dayKey(new Date()), yest = dayKey(new Date(Date.now() - 864e5));
    if (k === today) return 'Today';
    if (k === yest) return 'Yesterday';
    return fmt(d, { weekday: 'long' });
  }

  /* ---------- data ---------- */
  const cache = {};
  const get = name => cache[name] ||= fetch(`/data/${name}.json?v=${Math.floor(Date.now() / 6e5)}`, { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

  /* ---------- chrome: date, updated, nav ---------- */
  const today = $('[data-today]');
  if (today) today.textContent = fmt(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  get('article-drafts').then(d => {
    const u = new Date(d.updatedAt);
    $$('[data-updated]').forEach(el => el.textContent = `Updated ${ago(u)}`);
  }).catch(() => $$('[data-updated]').forEach(el => el.textContent = 'Updated hourly'));

  const nav = $('.nav'), mast = $('.masthead');
  if (nav && mast && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => nav.classList.toggle('compact', !e.isIntersecting), { threshold: 0 }).observe(mast);
  }

  const link = (it, inner, cls = '') => `<a class="${cls}" href="${esc(it.url)}">${inner}</a>`;
  const tag = it => `<span class="tag" data-t="${it.tag}">${it.tag}</span>`;
  const srcMeta = it => `<span class="meta"><b>${esc(it.source || 'Source')}</b> · ${ago(it.time)}</span>`;

  /* ---------- home ---------- */
  async function home() {
    const lead = $('#lead'); if (!lead) return;
    try {
      const items = weekOnly(normalizeDrafts((await get('article-drafts')).items)).sort((a,b) => b.time - a.time);
      if (!items.length) throw 0;
      const top = items[0];
      $('[data-lead-tags]', lead).innerHTML = `${tag(top)}${srcMeta(top)}`;
      $('.lead-title', lead).innerHTML = link(top, esc(top.title));
      $('[data-lead-link]', lead).forEach(a => { a.href = top.url; a.removeAttribute('target'); a.removeAttribute('rel'); });
      $('[data-lead-src]', lead).textContent = 'HallyuScope';
      $('#also').innerHTML = items.slice(1, 7).map(it => `<li>${link(it, `<h3>${esc(it.title)}</h3>${srcMeta(it)}`)}</li>`).join('');
      const tick = items.slice(0, 12).map(it => link(it, esc(it.title))).join('');
      $('#ticker').innerHTML = tick + tick;
    } catch { $('.lead-title', lead).textContent = 'Live headlines are refreshing — check back in a moment.'; }

    get('article-drafts').then(d => {
      const items = weekOnly(normalizeDrafts(d.items)).filter(i => i.category === 'CONCERT NEWS').sort((a,b) => b.time - a.time).slice(0, 4);
      $('#homeConcerts').innerHTML = items.length ? items.map(ledgerRow).join('') : '<li class="empty">No new Philippine concert announcements this hour.</li>';
    }).catch(() => $('#homeConcerts').innerHTML = '<li class="empty">Concert radar is refreshing.</li>');

    get('article-drafts').then(d => {
      const items = weekOnly(normalizeDrafts(d.items)).filter(i => i.category === 'COMEBACK NEWS').sort((a,b) => b.time - a.time).slice(0, 4);
      const sameDay = new Set(items.map(i => dayKey(i.time))).size === 1;
      const big = it => sameDay
        ? `<div class="d clock">${clock(it.time).replace(/\s?[AP]M/i, '')}<small>${clock(it.time).slice(-2).toUpperCase()} · ${dayLabel(it.time)}</small></div>`
        : `<div class="d">${dayNum(it.time)}<small>${mon(it.time)}</small></div>`;
      $('#homeComebacks').innerHTML = items.map(it => link(it,
        `${big(it)}<span class="meta"><b>${esc(it.source || '')}</b></span><h3>${esc(it.title)}</h3>`, 'cb scope')).join('');
    }).catch(() => {});
  }

  const ledgerRow = it => `<li>${link(it,
    `<div class="d"><b>${dayNum(it.time)}</b><span>${mon(it.time)}</span></div><h3>${esc(it.title)}</h3><span class="meta s"><b>${esc(it.source || '')}</b><br>${ago(it.time)}</span><span class="arrow" aria-hidden="true">↗</span>`)}</li>`;

  /* ---------- stream pages ---------- */
  const streamRow = it => `<li>${link(it,
    `<span class="t">${clock(it.time)}</span><div><h3>${esc(it.title)}</h3><div class="src">${tag(it)}<span class="meta"><b>${esc(it.source || '')}</b> · ${ago(it.time)}</span></div></div><span class="go" aria-hidden="true">↗</span>`)}</li>`;

  function grouped(items, row = streamRow) {
    const groups = [];
    items.forEach(it => {
      const k = dayKey(it.time);
      let g = groups.find(x => x.k === k);
      if (!g) groups.push(g = { k, d: it.time, list: [] });
      g.list.push(it);
    });
    return groups.map(g => `<section class="day"><div class="day-label"><strong>${dayLabel(g.d)}</strong><span class="meta">${fmt(g.d, { day: 'numeric', month: 'long' })}</span></div><ol class="stream">${g.list.map(row).join('')}</ol></section>`).join('');
  }

  async function streamPage(root, feed, opts = {}) {
    try {
      let items = feed === 'article-drafts'
        ? weekOnly(normalizeDrafts((await get(feed)).items)).sort((a, b) => b.time - a.time)
        : normalize((await get(feed)).items).sort((a, b) => b.time - a.time);
      if (opts.filter) items = items.filter(opts.filter);
      const count = $('[data-count]');
      if (count) { count.innerHTML = `<span>0</span> ${opts.noun || 'stories'}`; countUp(count, items.length); }
      if (!items.length) { root.innerHTML = `<p class="empty">${opts.empty || 'Nothing new this hour.'}</p>`; return; }
      const bar = $('#filters');
      const draw = t => { root.innerHTML = opts.ledger
        ? `<ol class="ledger light">${items.filter(i => !t || i.tag === t).map(ledgerRow).join('')}</ol>`
        : grouped(items.filter(i => !t || i.tag === t)); };
      if (bar) {
        const tags = ['Music', 'Drama', 'Concert', 'News'].map(t => [t, items.filter(i => i.tag === t).length]).filter(([, n]) => n);
        bar.innerHTML = [['All', items.length], ...tags].map(([t, n], i) => `<button type="button" data-tag="${t}" aria-pressed="${i === 0}">${t}<span>${n}</span></button>`).join('');
        bar.addEventListener('click', e => {
          const b = e.target.closest('button'); if (!b) return;
          $$('button', bar).forEach(x => x.setAttribute('aria-pressed', x === b));
          draw(b.dataset.tag === 'All' ? '' : b.dataset.tag);
        });
      }
      draw('');
    } catch { root.innerHTML = '<p class="empty">Live data is refreshing — try again in a moment.</p>'; }
  }

  /* ---------- staggered lists ---------- */
  function stagger(root) {
    if (!root) return;
    [...root.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 12)));
    root.classList.add('stg');
    if (reduce || !io) { root.classList.add('in'); return; }
    root.classList.remove('in');
    requestAnimationFrame(() => io.observe(root));
  }
  const watch = sel => { const el = $(sel); if (!el) return;
    new MutationObserver(() => { stagger(el); $$('.stream, .ledger', el).forEach(stagger); }).observe(el, { childList: true }); };
  ['#also', '#homeConcerts', '#homeComebacks', '#stream', '#results'].forEach(watch);

  function countUp(el, to) {
    if (reduce) { el.firstChild.textContent = to; return; }
    const t0 = performance.now(), dur = 900;
    const step = t => { const k = Math.min(1, (t - t0) / dur); el.firstChild.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  const page = document.body.dataset.page;
  if (page === 'home') home();
  if (page === 'latest') streamPage($('#stream'), 'article-drafts');
  if (page === 'comebacks') streamPage($('#stream'), 'article-drafts', { noun: 'stories', filter: i => i.category === 'COMEBACK NEWS' });
  if (page === 'concerts') streamPage($('#stream'), 'article-drafts', { ledger: true, noun: 'stories', filter: i => i.category === 'CONCERT NEWS', empty: 'No Philippine concert stories published this week yet.' });

  /* ---------- search ---------- */
  const panel = $('#search'), input = $('#q'), out = $('#results');
  let pool = null;
  async function loadPool() {
    if (pool) return pool;
    const data = await get('article-drafts');
    pool = weekOnly(normalizeDrafts(data.items)).sort((a, b) => b.time - a.time);
    return pool;
  }
  function render(q) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = words.length ? pool.filter(i => words.every(w => (i.title + ' ' + i.source + ' ' + i.tag).toLowerCase().includes(w))) : pool.slice(0, 8);
    out.innerHTML = `<p class="meta">${words.length ? `${hits.length} result${hits.length === 1 ? '' : 's'}` : 'Latest across HallyuScope'}</p>` +
      (hits.length ? `<ol class="stream">${hits.slice(0, 40).map(streamRow).join('')}</ol>` : '<p class="empty">No matches yet. Try a group, artist or city.</p>');
  }
  function openSearch() {
    if (!panel) return;
    panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => input.focus(), 30);
    loadPool().then(() => render(input.value));
  }
  function closeSearch() {
    if (!panel) return;
    panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  $$('[data-open-search]').forEach(b => b.addEventListener('click', openSearch));
  $('#searchClose')?.addEventListener('click', closeSearch);
  input?.addEventListener('input', () => pool && render(input.value));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSearch();
    if (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
  });

  /* ---------- reveal on scroll ---------- */
  const io = (!reduce && 'IntersectionObserver' in window)
    ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' })
    : null;
  const reveal = el => io ? io.observe(el) : el.classList.add('in');
  $$('.rv').forEach(reveal);

  // split statement lines into words that rise in one by one
  $$('.words').forEach(el => {
    let i = 0;
    const walk = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const w = document.createElement('span'); w.className = 'w';
          const inner = document.createElement('span'); inner.textContent = part; inner.style.setProperty('--i', i++);
          w.appendChild(inner); frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else walk(n);
    });
    walk(el); reveal(el);
  });

  /* ---------- mood loops: play only when on screen ---------- */
  $$('.vid').forEach(fig => {
    const v = $('video', fig); if (!v || reduce) return;
    v.addEventListener('loadeddata', () => fig.classList.add('ready'), { once: true });
    v.addEventListener('error', () => fig.classList.add('no-video'), true);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { if (v.preload !== 'auto') { v.preload = 'auto'; v.load(); } v.play().catch(() => {}); }
        else v.pause();
      }, { threshold: .15 }).observe(fig);
    } else { v.autoplay = true; v.load(); }
  });
})();

/* ---------- newsletter (posts to /api/subscribe → Brevo) ---------- */
(() => {
  const form = document.getElementById('newsletterForm');
  if (!form) return;
  const input = document.getElementById('newsletterEmail');
  const btn = document.getElementById('newsletterSubmit');
  const msg = document.getElementById('signupMessage');
  const say = (text, state = '') => { msg.textContent = text; msg.className = 'meta' + (state ? ' ' + state : ''); };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = (input.value || '').trim();
    const website = (form.elements.website?.value || '').trim();
    if (!email || !input.checkValidity()) { say('Please enter a valid email address.', 'err'); input.focus(); return; }
    btn.disabled = true; btn.textContent = 'Joining…'; say('Adding you to the list…');
    try {
      const res = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, website }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unable to subscribe right now.');
      say(data.message || 'You’re on the list.', 'ok');
      form.reset();
    } catch (err) {
      say(err.message || 'Something went wrong. Please try again.', 'err');
    } finally { btn.disabled = false; btn.textContent = 'Join free'; }
  });
})();
