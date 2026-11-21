(() => {
  const root = document.getElementById('article');

  /* Mobile nav: hamburger menu (same behaviour as script.js). */
  const navEl = document.querySelector('.nav');
  const menuBtnEl = document.querySelector('.nav-menu-btn');
  if (navEl && menuBtnEl) {
    const setMenu = open => {
      navEl.classList.toggle('menu-open', open);
      menuBtnEl.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtnEl.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    menuBtnEl.addEventListener('click', () => setMenu(!navEl.classList.contains('menu-open')));
    navEl.addEventListener('click', e => {
      if (e.target.closest('a') && navEl.classList.contains('menu-open')) setMenu(false);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && navEl.classList.contains('menu-open')) { setMenu(false); menuBtnEl.focus(); }
    });
  }
  const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const params = new URLSearchParams(location.search);
  // Canonical article URLs are words from the headline: /article/<slug>.
  // Old ?id=<hex> links keep working as a fallback.
  const pathSlug = decodeURIComponent(location.pathname.replace(/^\/article\/?/, '')).replace(/\/$/, '');
  const slug = pathSlug || params.get('slug') || '';
  const id = params.get('id') || '';
  if (!slug && !id) { root.innerHTML = '<p class="empty">Story not found.</p>'; return; }

  fetch('https://raw.githubusercontent.com/phoebegrace/hallyuscope/live-data/data/article-drafts.json?v=' + Date.now(), {cache:'no-store'})
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => {
      const item = (data.items || []).find(x => x.status === 'published' && ((slug && x.slug === slug) || (id && x.id === id)));
      if (!item) throw new Error('missing');
      document.title = item.headline + ' | HallyuScope';
      const canonicalUrl = 'https://hallyuscope.com/article/' + encodeURIComponent(item.slug || item.id);
      // If we arrived on an old ?id= link, quietly move the address bar to the slug URL.
      if (item.slug && location.pathname !== '/article/' + item.slug) {
        try { history.replaceState(null, '', '/article/' + encodeURIComponent(item.slug)); } catch {}
      }
      const descText = item.seoDescription || item.dek || 'K-pop and Korean entertainment news from HallyuScope.';
      // Social previews need a real image. The generated social card is an
      // SVG and is preview-only, so it is never used as og:image; the
      // editorial cover is an SVG too, which Facebook/X cannot use.
      const isSocialCardUrl = u => typeof u === 'string' && u.includes('/api/social-card');
      const usableImage = u => typeof u === 'string' && /^https?:\/\//.test(u) && !/\.svg(\?|$)/i.test(u) && !/undefined/.test(u) && !isSocialCardUrl(u);
      const imageUrl = usableImage(item.socialImageUrl) ? item.socialImageUrl
        : usableImage(item.imageUrl) ? new URL(item.imageUrl, 'https://hallyuscope.com').href
        : 'https://hallyuscope.com/assets/og-image.png';
      // Only a real photo added to the story shows as the cover. The generated
      // SVG editorial graphic is left out: no image is better than a filler.
      const coverHtml = (typeof item.imageUrl === 'string' && /^https?:\/\//.test(item.imageUrl) && !/undefined/.test(item.imageUrl) && !/\.svg(\?|$)/i.test(item.imageUrl))
        ? `<figure class="article-cover"><img src="${esc(item.imageUrl)}" alt="${esc(item.headline || 'HallyuScope story')}"></figure>`
        : '';

      const desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute('content', descText);

      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) canonical.setAttribute('href', canonicalUrl);

      const metaMap = {
        'meta[property="og:title"]': item.headline,
        'meta[property="og:description"]': descText,
        'meta[property="og:url"]': canonicalUrl,
        'meta[property="og:image"]': imageUrl,
        'meta[name="twitter:title"]': item.headline,
        'meta[name="twitter:description"]': descText,
        'meta[name="twitter:image"]': imageUrl
      };
      for (const [selector,value] of Object.entries(metaMap)) {
        const el = document.querySelector(selector);
        if (el && value) el.setAttribute('content', value);
      }
      // "Sources:" lists every outlet the research actually used, each
      // linked; duplicates by publisher collapse to the first URL.
      // Drafts written before research existed fall back to the single
      // reference source; with no usable link it stays plain text.
      const validUrl = u => typeof u === 'string' && /^https?:\/\//.test(u) && !/undefined/.test(u);
      const validName = n => typeof n === 'string' && n.trim() && !/^https?:\/\//.test(n);
      const sources = [];
      for (const s of (Array.isArray(item.researchSources) ? item.researchSources : [])) {
        if (validName(s?.publisher) && validUrl(s?.url) && !sources.some(x => x.name.toLowerCase() === s.publisher.toLowerCase())) {
          sources.push({ name: s.publisher, url: s.url });
        }
      }
      if (!sources.length && validName(item.source?.publisher) && validUrl(item.source?.url)) {
        sources.push({ name: item.source.publisher, url: item.source.url });
      }
      const sourceHtml = sources.length
        ? (sources.length > 1 ? 'Sources: ' : 'Source: ') + sources.map(s =>
            `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a>`).join(' · ')
        : esc(item.sourceNote || ('Source: ' + (validName(item.source?.publisher) ? item.source.publisher : 'original reporting')));
      const sourceLabel = sources.length > 1 ? 'Sources' : 'Reporting source';
      const date = new Date(item.publishedAt || item.createdAt);
      const dateText = isFinite(date) ? date.toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Manila'}) : '';
      // "Keep tracking" links send readers on to the trackers. The one that
      // fits the story best (concert, comeback or actor news) leads.
      const ctaCards = {
        concerts: ['/concerts', 'Concert calendar', 'Every K-pop show in the Philippines, with ticket dates.'],
        comebacks: ['/comebacks', 'Comeback calendar', 'Upcoming albums, singles and MV drops, day by day.'],
        profiles: ['/profiles', 'K-Profiles', 'Quick facts on idols, groups and K-actors. Heart your bias.'],
        albums: ['/albums', 'Album releases', 'New and upcoming albums with covers and tracklists.']
      };
      const storyText = [item.category, item.headline, item.dek].join(' ').toLowerCase();
      const order = /concert|tour|fan ?meet|ticket|manila|arena|venue/.test(storyText) ? ['concerts','comebacks','profiles']
        : /comeback|album|single|release|mv|debut|track|ep\b/.test(storyText) ? ['comebacks','albums','concerts']
        : /drama|actor|actress|film|movie|series|netflix/.test(storyText) ? ['profiles','comebacks','concerts']
        : ['comebacks','concerts','profiles'];
      const ctaHtml = `<section class="article-cta" aria-labelledby="articleCtaHead">
            <div class="article-cta-head"><span class="eyebrow">KEEP TRACKING</span><h2 id="articleCtaHead">Never miss the next one.</h2></div>
            <div class="article-cta-grid">${order.map((k, i) => { const [href, label, text] = ctaCards[k];
              return `<a class="article-cta-card${i === 0 ? ' is-lead' : ''}" href="${href}"><strong>${label}</strong><span>${text}</span><b aria-hidden="true">→</b></a>`; }).join('')}</div>
          </section>`;
      root.innerHTML = `
        <article class="article-page">
          <div class="article-kicker">${esc(item.category || 'HALLYU NEWS')}</div>
          <h1>${esc(item.headline || '')}</h1>
          <p class="article-dek">${esc(item.dek || '')}</p>
          <div class="article-meta"><span>HallyuScope</span><span>${esc(dateText)}</span></div>
          ${coverHtml}
          <div class="article-body">${(item.body || []).map(p => `<p>${esc(p)}</p>`).join('')}</div>
          <aside class="article-source"><strong>${sourceLabel}</strong><p>${sourceHtml}</p></aside>
          ${ctaHtml}
          <section class="article-reactions" data-reactions>
            <div class="article-reactions-head">
              <div><span class="eyebrow">YOUR REACTION</span><h2>What do you think?</h2></div>
              <p class="meta" id="reactionMessage">Pick one.</p>
            </div>
            <div class="reaction-row">
              <button type="button" data-reaction="love"><span>♥</span><b>Love</b><small>0</small></button>
              <button type="button" data-reaction="omg"><span>!</span><b>OMG</b><small>0</small></button>
              <button type="button" data-reaction="congrats"><span>★</span><b>Congrats</b><small>0</small></button>
              <button type="button" data-reaction="interesting"><span>?</span><b>Interesting</b><small>0</small></button>
              <button type="button" data-reaction="sad"><span>↓</span><b>Sad</b><small>0</small></button>
            </div>
          </section>
          <section class="article-share" data-share>
            <div class="article-share-copy">
              <span class="eyebrow">SHARE THIS STORY</span>
              <h2>Send it to your group chat.</h2>
            </div>
            <div class="article-share-actions">
              <button type="button" class="share-main" data-share-native>Share article</button>
              <button type="button" data-share-facebook>Facebook</button>
              <button type="button" data-share-x>X</button>
              <button type="button" data-share-copy>Copy link</button>
            </div>
            <p class="meta share-status" aria-live="polite"></p>
          </section>
          <p class="article-back"><a class="cta" href="/latest">← Back to this week's news</a></p>
        </article>`;
      setupReactions(item.id);
      setupShare(item);
    })
    .catch(() => { root.innerHTML = '<p class="empty">This story is still being prepared. <a href="/latest">Back to latest news.</a></p>'; });

  function setupShare(item){
    const wrap=root.querySelector('[data-share]');
    if(!wrap) return;
    const url=new URL(location.href);
    url.hash='';
    const shareUrl=url.toString();
    const title=item.headline || document.title;
    const text=(item.dek || 'Read the full story on HallyuScope.').trim();
    const status=wrap.querySelector('.share-status');
    const nativeBtn=wrap.querySelector('[data-share-native]');
    const fbBtn=wrap.querySelector('[data-share-facebook]');
    const xBtn=wrap.querySelector('[data-share-x]');
    const copyBtn=wrap.querySelector('[data-share-copy]');

    function openPopup(href){
      window.open(href,'hallyuscope-share','width=720,height=640,noopener,noreferrer');
    }

    if(nativeBtn){
      nativeBtn.addEventListener('click',async()=>{
        if(navigator.share){
          try{
            await navigator.share({title,text,url:shareUrl});
            if(status) status.textContent='Shared.';
          }catch(err){
            if(err?.name!=='AbortError' && status) status.textContent='Sharing was cancelled.';
          }
        }else{
          try{
            await navigator.clipboard.writeText(shareUrl);
            if(status) status.textContent='Link copied.';
          }catch{
            if(status) status.textContent='Copy the page URL from your browser.';
          }
        }
      });
    }

    if(fbBtn){
      fbBtn.addEventListener('click',()=>{
        openPopup('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(shareUrl));
      });
    }

    if(xBtn){
      xBtn.addEventListener('click',()=>{
        const copy=title+' — '+shareUrl;
        openPopup('https://twitter.com/intent/tweet?text='+encodeURIComponent(copy));
      });
    }

    if(copyBtn){
      copyBtn.addEventListener('click',async()=>{
        try{
          await navigator.clipboard.writeText(shareUrl);
          copyBtn.textContent='Copied';
          if(status) status.textContent='Article link copied to clipboard.';
          setTimeout(()=>{copyBtn.textContent='Copy link';},1800);
        }catch{
          if(status) status.textContent='Copy the page URL from your browser.';
        }
      });
    }
  }

  async function setupReactions(articleId){
    const wrap=root.querySelector('[data-reactions]');
    if(!wrap) return;
    const key='hallyuscope_reaction_'+articleId;
    let selected=localStorage.getItem(key)||'';
    const buttons=[...wrap.querySelectorAll('[data-reaction]')];
    const note=wrap.querySelector('#reactionMessage');

    function paint(counts={}){
      buttons.forEach(btn=>{
        const type=btn.dataset.reaction;
        btn.classList.toggle('is-selected',selected===type);
        const n=btn.querySelector('small');
        if(n) n.textContent=Number(counts[type]||0).toLocaleString();
      });
      if(note) note.textContent=selected ? 'You reacted: '+(wrap.querySelector('[data-reaction="'+selected+'"] b')?.textContent||selected)+'.' : 'Pick one.';
    }

    async function load(){
      try{
        const r=await fetch('/api/reactions?id='+encodeURIComponent(articleId),{cache:'no-store'});
        const data=await r.json();
        if(r.ok) paint(data.counts||{});
      }catch{}
    }

    buttons.forEach(btn=>btn.addEventListener('click',async()=>{
      const next=btn.dataset.reaction;
      if(next===selected) return;
      const previous=selected||null;
      buttons.forEach(x=>x.disabled=true);
      if(note) note.textContent='Saving reaction…';
      try{
        const r=await fetch('/api/reactions',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({id:articleId,reaction:next,previous})
        });
        const data=await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(data.error||'Could not save reaction');
        selected=next;
        localStorage.setItem(key,selected);
        paint(data.counts||{});
      }catch(err){
        if(note) note.textContent=err.message||'Could not save reaction.';
      }finally{
        buttons.forEach(x=>x.disabled=false);
      }
    }));

    load();
  }
})();

// Newsletter signup on article and guide pages (same as the rest of the site).
/* ---------- newsletter (posts to /api/subscribe → Brevo) ---------- */
(() => {
  const form = document.getElementById('newsletterForm');
  if (!form) return;
  const input = document.getElementById('newsletterEmail');
  const btn = document.getElementById('newsletterSubmit');
  const msg = document.getElementById('signupMessage');
  const say = (text, state = '') => { msg.textContent = text; msg.className = 'meta' + (state ? ' ' + state : ''); form.classList.toggle('is-error', state === 'err'); };
  input.addEventListener('input', () => { if (form.classList.contains('is-error')) say('Free · Once a week · Unsubscribe anytime'); });
  const done = email => {
    const box = document.createElement('div');
    box.className = 'nl-done'; box.setAttribute('role', 'status'); box.tabIndex = -1;
    box.innerHTML = '<span class="nl-done-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><div><strong>You’re in! Welcome to The Weekly Scope.</strong><p></p></div>';
    box.querySelector('p').textContent = 'We’ll send comebacks, PH concert news and ticket alerts to ' + email + '. Your first issue arrives on Friday.';
    form.querySelector('.nl-row').hidden = true; msg.hidden = true;
    form.appendChild(box); box.focus({ preventScroll: true });
  };
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
      form.reset(); done(email);
    } catch (err) {
      say(err.message || 'Something went wrong. Please try again.', 'err');
    } finally { btn.disabled = false; btn.textContent = 'Join free'; }
  });
})();

/* ---------- newsletter preview: show this week's real headlines ---------- */
(() => {
  const ol = document.getElementById('nlPreview');
  if (!ol) return;
  const ta = document.createElement('textarea');
  const clean = it => {
    ta.innerHTML = it.title || ''; let t = ta.value.replace(/\s+/g, ' ').trim();
    const src = (it.source || '').trim();
    if (src && t.toLowerCase().endsWith((' - ' + src).toLowerCase())) t = t.slice(0, -(src.length + 3));
    t = t.replace(/\s*\((?:📷|photo|via)[^)]*\)/gi, '').replace(/\s*\|\s*(?:via\b.*|vi|v)$/i, '').trim();
    return t.length > 90 ? t.slice(0, 86).replace(/\s+\S*$/, '') + '…' : t;
  };
  const tagOf = t => /concert|tour|fan ?con|fan ?meeting|arena|ticket/i.test(t) ? 'Concert'
    : /comeback|album|single|release|mv|title track|debut|teaser/i.test(t) ? 'Music'
    : /drama|episode|series|netflix|film|actor|actress|cast/i.test(t) ? 'Drama' : 'News';
  fetch('https://raw.githubusercontent.com/phoebegrace/hallyuscope/live-data/data/latest.json?v=' + Math.floor(Date.now() / 6e5), { cache: 'no-store' })
    .then(r => r.json())
    .then(d => {
      const items = (d.items || []).slice(0, 4);
      if (!items.length) return;
      ol.innerHTML = '';
      items.forEach(it => {
        const t = clean(it), li = document.createElement('li'), s = document.createElement('span'), tag = document.createElement('span');
        s.textContent = t; tag.className = 'tag'; tag.dataset.t = tagOf(t); tag.textContent = tagOf(t);
        li.append(s, tag); ol.appendChild(li);
      });
    }).catch(() => {});
})();
