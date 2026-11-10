(() => {
  const root = document.getElementById('article');
  const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { root.innerHTML = '<p class="empty">Story not found.</p>'; return; }

  fetch('https://raw.githubusercontent.com/phoebegrace/hallyuscope/live-data/data/article-drafts.json?v=' + Date.now(), {cache:'no-store'})
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => {
      const item = (data.items || []).find(x => x.id === id && x.status === 'published');
      if (!item) throw new Error('missing');
      document.title = item.headline + ' | HallyuScope';
      const canonicalUrl = 'https://hallyuscope.com/article?id=' + encodeURIComponent(item.id);
      const descText = item.seoDescription || item.dek || 'K-pop and Korean entertainment news from HallyuScope.';
      const imageUrl = item.imageUrl ? new URL(item.imageUrl, 'https://hallyuscope.com').href : 'https://hallyuscope.com/assets/hallyuscope-logo.png';

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
      setupReactions(id);
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