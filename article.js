(() => {
  const root = document.getElementById('article');
  const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { root.innerHTML = '<p class="empty">Story not found.</p>'; return; }

  fetch('/data/article-drafts.json?v=' + Date.now(), {cache:'no-store'})
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => {
      const item = (data.items || []).find(x => x.id === id && x.status === 'published');
      if (!item) throw new Error('missing');
      document.title = item.headline + ' | HallyuScope';
      const desc = document.querySelector('meta[name="description"]');
      if (desc && item.seoDescription) desc.setAttribute('content', item.seoDescription);
      const date = new Date(item.publishedAt || item.createdAt);
      const dateText = isFinite(date) ? date.toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Manila'}) : '';
      root.innerHTML = `
        <article class="article-page">
          <div class="article-kicker">${esc(item.category || 'HALLYU NEWS')}</div>
          <h1>${esc(item.headline || '')}</h1>
          <p class="article-dek">${esc(item.dek || '')}</p>
          <div class="article-meta"><span>HallyuScope</span><span>${esc(dateText)}</span></div>
          <div class="article-body">${(item.body || []).map(p => `<p>${esc(p)}</p>`).join('')}</div>
          <aside class="article-source"><strong>Reporting source</strong><p>${esc(item.sourceNote || ('Source: ' + (item.source?.publisher || 'original reporting')))}</p></aside>
          <p class="article-back"><a class="cta" href="/latest">← Back to this week's news</a></p>
        </article>`;
    })
    .catch(() => { root.innerHTML = '<p class="empty">This story is still being prepared. <a href="/latest">Back to latest news.</a></p>'; });
})();