// K-Profiles directory: every K-pop group, soloist and K-actor on one page.
// The page ships the featured profiles as plain HTML (for search engines and
// no-JS readers). This script then loads the full directory index, renders it
// in pages, and loads each category's details only when an "About" opens.
(() => {
  const directory=document.querySelector('#profileDirectory');
  if(!directory)return;
  const search=document.querySelector('#profileSearch');
  const status=document.querySelector('#profileResults');
  const empty=document.querySelector('#profileEmpty');
  const filters=[...directory.querySelectorAll('[data-profile-filter]')];
  const disbandedToggle=document.querySelector('#profileDisbanded');
  const BASE='/data/directory/';
  const PAGE=60, PREVIEW=12;
  const CATS=[['girl-groups','Girl groups','group'],['boy-groups','Boy groups','group'],['co-ed','Co-ed groups','group'],['soloists','Soloists','artist'],['k-actors','K-actors','actor']];
  const CAT_IDS=new Set([...CATS.map(c=>c[0]),'most-biased']);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const plural=(n,noun)=>n.toLocaleString('en-PH')+' '+noun+(n===1?'':'s');
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const longDate=s=>{const [y,m,d]=String(s).split('-').map(Number);return m?months[m-1]+' '+d+', '+y:String(s);};
  const shortDate=s=>{const [y,m,d]=String(s).split('-').map(Number);return m?months[m-1].slice(0,3)+' '+d+', '+y:String(s);};
  const HEART='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.9 4.5c2.1 0 3.6 1.1 5.1 3 1.5-1.9 3-3 5.1-3 3.9 0 6 3.9 4.5 7.3C19.5 16.4 12 21 12 21z"/></svg>';

  let items=[], byId=new Map();
  let category=CAT_IDS.has(location.hash.slice(1))?location.hash.slice(1):'all';
  let shown={};           // how many cards each list shows
  let showDisbanded=true;
  const details={};       // category -> details object (loaded on demand)

  // ---- Bias hearts (shared totals through /api/reactions) -----------------
  const KEY='hallyuscope_biases';
  let mine=new Set(); try{mine=new Set(JSON.parse(localStorage.getItem(KEY)||'[]'));}catch{}
  const saveMine=()=>{try{localStorage.setItem(KEY,JSON.stringify([...mine]));}catch{}};
  let counts={}, loaded=false;
  const totalEl=document.querySelector('#biasTotal');
  const fmt=n=>Number(n||0).toLocaleString('en-PH');
  const paintTotal=t=>{if(totalEl)totalEl.textContent=fmt(t)+' '+(t===1?'heart':'hearts')+' from fans so far';};

  // ---- Card markup -------------------------------------------------------
  const initials=n=>{const w=String(n).replace(/[^\p{L}\p{N} ]/gu,' ').trim().split(/\s+/).filter(Boolean);return (w.length>1?w[0][0]+w[1][0]:String(w[0]||'?').slice(0,2)).toUpperCase();};
  const hue=s=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))>>>0;return h%4;};
  function media(x){
    if(!x.img)return `<div class="profile-ph ph-${hue(x.i)}" aria-hidden="true"><span>${esc(initials(x.n))}</span></div>`;
    const cr=x.img.cr||{};
    const credit=`<span class="photo-credit" tabindex="0" role="button" aria-label="Photo credit for ${esc(x.n)}" data-photo-credit><span aria-hidden="true">!</span><span class="photo-credit-tip" role="tooltip"><b>Photo</b> ${esc(cr.a||'Wikimedia Commons contributor')}<br><a href="${esc(cr.s)}" target="_blank" rel="noopener">Wikimedia Commons</a>${cr.l?` · <a href="${esc(cr.lu||cr.s)}" target="_blank" rel="noopener">${esc(cr.l)}</a>`:''}${cr.note?`<br><small>${esc(cr.note)}</small>`:''}</span></span>`;
    return `<button type="button" class="profile-photo" data-enlarge-profile aria-label="Enlarge ${esc(x.n)} photo"><img src="${esc(x.img.u)}" alt="${esc(x.n)}" width="${x.img.w||480}" height="${x.img.h||480}" loading="lazy" decoding="async"></button>${credit}`;
  }
  function card(x,rank){
    const on=mine.has(x.b);
    return `<article class="artist-card${x.x?' is-disbanded':''}" data-artist="${esc(x.n)}" data-category="${esc(x.c)}" data-id="${esc(x.i)}" data-bias="${esc(x.b)}"${rank?` data-rank="${rank}"`:''}><div class="profile-media">${media(x)}${x.x?'<span class="profile-badge">Disbanded</span>':''}</div><h3>${esc(x.n)}</h3>${x.k&&x.k!==x.n?`<p class="profile-kr" lang="ko">${esc(x.k)}</p>`:''}<button type="button" class="bias-btn${on?' is-on':''}" data-bias-btn aria-pressed="${on}" aria-label="${on?'Remove ':'Make '}${esc(x.n)}${on?' from your biases':' your bias'}, ${fmt(counts[x.b])} hearts">${HEART}<span class="bias-label">Bias</span><b class="bias-count">${fmt(counts[x.b])}</b></button><details class="profile-about" data-about><summary>About ${esc(x.n)}</summary><div class="profile-about-body"><p class="profile-loading">Loading profile…</p></div></details></article>`;
  }
  function aboutHtml(x,d){
    d=d||{};const rows=[];const actor=x.c==='k-actors';
    if(d.koreanName&&d.koreanName!==x.n)rows.push(['Korean name',d.koreanName]);
    if(d.birthName)rows.push(['Birth name',d.birthName]);
    if(d.born)rows.push(['Born',longDate(d.born)]);
    if(d.debutDate)rows.push([actor?'Acting debut':'Debut',longDate(d.debutDate)]);else if(d.debutYear)rows.push([actor?'Acting debut':'Debut',d.debutYear]);
    if(x.x)rows.push(['Status','Disbanded']);
    if(d.group)rows.push(['Group',d.group]);
    if(d.positions)rows.push(['Position',d.positions]);
    if(d.height)rows.push(['Height',d.height]);
    if(d.nationality&&!/^(south )?korean$/i.test(d.nationality))rows.push(['Nationality',d.nationality]);
    if(d.fandom)rows.push(['Fandom',d.fandom]);
    if(d.agency)rows.push(['Agency',d.agency]);
    if(d.labels?.length)rows.push(['Labels',d.labels.join(', ')]);
    const mp=d.members||[];
    const members=mp.length?`<div class="profile-members"><h4>${esc(plural(mp.length,'member'))}</h4><ul>${mp.map(m=>`<li><b>${esc(m.n)}</b>${m.p||m.d?`<span>${[m.p,m.d&&shortDate(m.d)].filter(Boolean).map(esc).join(' · ')}</span>`:''}${m.b&&m.b!==m.n?`<small>${esc(m.b)}</small>`:''}</li>`).join('')}</ul></div>`:'';
    const kp=d.kp||x.kp;const links=[kp&&`<a class="profile-more" href="${esc(kp)}" target="_blank" rel="noopener">Full profile on Kprofiles ↗</a>`,d.wikipedia&&`<a class="profile-more" href="${esc(d.wikipedia)}" target="_blank" rel="noopener">Wikipedia ↗</a>`].filter(Boolean).join('');
    if(!rows.length&&!members)return `<p class="profile-loading">No extra details yet.</p>${links?`<p class="profile-links">${links}</p>`:''}`;
    return `<dl>${rows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${members}${links?`<p class="profile-links">${links}</p>`:''}`;
  }

  // ---- Filtering and rendering ------------------------------------------
  const sortKey=(a,b)=>(a.f||1e9)-(b.f||1e9)||(a.x||0)-(b.x||0)||a.n.localeCompare(b.n,'en',{sensitivity:'base'});
  function matches(x,term){
    if(!showDisbanded&&x.x)return false;
    if(!term)return true;
    return x.s.includes(term);
  }
  function more(list,key,label){
    const n=shown[key]||PAGE; if(list.length<=n)return '';
    return `<div class="profile-more-wrap"><button type="button" class="profile-show-more" data-show-more="${esc(key)}">Show more ${esc(label)} <span>(${(list.length-n).toLocaleString('en-PH')} left)</span></button></div>`;
  }
  function section(id,label,noun,list,limit,key,extra=''){
    return `<section class="artist-section" id="${esc(id)}-list" aria-labelledby="${esc(id)}-heading"><div class="artist-section-head"><h2 id="${esc(id)}-heading">${esc(label)}</h2><span>${plural(list.length,noun)}</span></div><div class="profile-grid">${list.slice(0,limit).map(x=>card(x)).join('')}</div>${extra||more(list,key,label.toLowerCase())}</section>`;
  }
  const root=document.createElement('div'); root.className='profile-results';
  function render(){
    const term=normalize(search.value);
    const list=items.filter(x=>matches(x,term));
    let html='', count=0;
    if(category==='most-biased'){
      const ranked=list.slice().sort((a,b)=>(counts[b.b]||0)-(counts[a.b]||0)||sortKey(a,b));
      const withHearts=ranked.filter(x=>counts[x.b]);
      const pool=withHearts.length?withHearts:ranked.slice(0,PAGE);
      const n=shown['most-biased']||PAGE;
      count=pool.length;
      html=`<section class="artist-section" id="most-biased"><div class="artist-section-head"><h2>Most biased</h2><span>${loaded?plural(pool.length,'profile')+' with fan hearts':'Loading hearts…'}</span></div><ol class="profile-grid bias-ranking">${pool.slice(0,n).map((x,i)=>`<li class="bias-rank" data-rank="${i+1}">${card(x)}</li>`).join('')}</ol>${more(pool,'most-biased','profiles')}</section>`;
    }else if(category==='all'&&!term){
      for(const [id,label,noun] of CATS){
        const sub=list.filter(x=>x.c===id).sort(sortKey); if(!sub.length)continue; count+=sub.length;
        const extra=sub.length>PREVIEW?`<div class="profile-more-wrap"><button type="button" class="profile-show-more" data-go="${id}">See all ${esc(plural(sub.length,label.toLowerCase().replace(/s$/,'')))} →</button></div>`:'';
        html+=section(id,label,noun,sub,PREVIEW,id,extra||' ');
      }
    }else if(category==='all'){
      const sub=list.sort(sortKey); count=sub.length;
      if(sub.length)html=section('search','Search results','profile',sub,shown.search||PAGE,'search');
    }else{
      const meta=CATS.find(c=>c[0]===category);
      const sub=list.filter(x=>x.c===category).sort(sortKey); count=sub.length;
      if(sub.length)html=section(category,meta[1],meta[2],sub,shown[category]||PAGE,category);
    }
    root.innerHTML=html;
    filters.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.profileFilter===category)));
    status.textContent=plural(count,'profile')+(term?' matching “'+search.value+'”':'')+'. Select a photo to enlarge it.';
    empty.hidden=!!count;
  }

  // ---- Events -------------------------------------------------------------
  directory.addEventListener('click',async event=>{
    const go=event.target.closest('[data-go]');
    if(go){setCategory(go.dataset.go);directory.scrollIntoView({behavior:'smooth',block:'start'});return;}
    const moreBtn=event.target.closest('[data-show-more]');
    if(moreBtn){const k=moreBtn.dataset.showMore;shown[k]=(shown[k]||PAGE)+PAGE;const y=window.scrollY;render();window.scrollTo(0,y);return;}
    const btn=event.target.closest('[data-bias-btn]');
    if(btn&&!btn.disabled){
      const el=btn.closest('[data-artist]'); const id=el.dataset.bias; const on=!mine.has(id); const before=counts[id]||0;
      on?mine.add(id):mine.delete(id); counts[id]=Math.max(0,before+(on?1:-1)); saveMine(); paint(el);
      btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); if(on)burst(btn);
      btn.disabled=true;
      try{
        const r=await fetch('/api/reactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bias:id,on})});
        const d=await r.json().catch(()=>({})); if(!r.ok)throw new Error(d.error||'failed');
        counts[id]=d.count; paintTotal(d.total);
      }catch{ on?mine.delete(id):mine.add(id); counts[id]=before; saveMine(); status.textContent='Could not save your heart for '+el.dataset.artist+'. Please try again.'; }
      finally{ btn.disabled=false; paint(el); }
      return;
    }
    const enlarge=event.target.closest('[data-enlarge-profile]');
    if(enlarge){const el=enlarge.closest('[data-artist]');photo.src=enlarge.querySelector('img').src;photo.alt=enlarge.querySelector('img').alt;dialog.querySelector('figcaption').textContent=el.dataset.artist;dialog.showModal();return;}
    const badge=event.target.closest('[data-photo-credit]');
    if(event.target.closest('.photo-credit-tip a'))return;
    directory.querySelectorAll('[data-photo-credit].is-open').forEach(c=>{if(c!==badge)c.classList.remove('is-open');});
    if(badge){event.preventDefault();badge.classList.toggle('is-open');}
  });
  directory.addEventListener('keydown',event=>{
    const badge=event.target.closest('[data-photo-credit]'); if(!badge)return;
    if(event.key==='Escape'){badge.classList.remove('is-open');badge.blur();}
    if(event.key==='Enter'||event.key===' '){event.preventDefault();badge.classList.toggle('is-open');}
  });
  // Details load per category, the first time any "About" in it opens.
  directory.addEventListener('toggle',async event=>{
    const el=event.target; if(!el.matches||!el.matches('[data-about]')||!el.open||el.dataset.ready)return;
    const cardEl=el.closest('[data-id]'); const x=byId.get(cardEl.dataset.id); if(!x)return;
    try{
      details[x.c]=details[x.c]||fetch(BASE+x.c+'.json').then(r=>{if(!r.ok)throw 0;return r.json();});
      const d=await details[x.c];
      el.querySelector('.profile-about-body').innerHTML=aboutHtml(x,d[x.i]); el.dataset.ready='1';
    }catch{ el.querySelector('.profile-about-body').innerHTML='<p class="profile-loading">Details are unavailable right now. Please try again.</p>'; }
  },true);
  function paint(el){
    const btn=el.querySelector('[data-bias-btn]'); const id=el.dataset.bias; const on=mine.has(id);
    btn.classList.toggle('is-on',on); btn.setAttribute('aria-pressed',String(on));
    btn.querySelector('.bias-count').textContent=fmt(counts[id]);
    btn.setAttribute('aria-label',(on?'Remove ':'Make ')+el.dataset.artist+(on?' from your biases':' your bias')+', '+fmt(counts[id])+' hearts');
  }
  function burst(btn){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const layer=document.createElement('span'); layer.className='bias-burst'; layer.setAttribute('aria-hidden','true');
    for(let i=0;i<9;i++){const h=document.createElement('i');h.innerHTML=HEART;h.style.setProperty('--x',(Math.random()*120-60).toFixed(0)+'px');h.style.setProperty('--y',(-50-Math.random()*70).toFixed(0)+'px');h.style.setProperty('--r',(Math.random()*70-35).toFixed(0)+'deg');h.style.setProperty('--s',(0.55+Math.random()*0.6).toFixed(2));h.style.animationDelay=(i*35)+'ms';layer.appendChild(h);}
    btn.appendChild(layer); setTimeout(()=>layer.remove(),1300);
  }
  function setCategory(c){
    category=c; shown={};
    history.replaceState(null,'',location.pathname+location.search+(c==='all'?'':'#'+c));
    render();
  }
  filters.forEach(b=>b.addEventListener('click',()=>setCategory(b.dataset.profileFilter)));
  let t; search.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>{shown={};render();},120);});
  disbandedToggle?.addEventListener('change',()=>{showDisbanded=disbandedToggle.checked;shown={};render();});
  window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);category=CAT_IDS.has(h)?h:'all';shown={};render();});
  const dialog=document.querySelector('#profilePhotoDialog'); const photo=dialog.querySelector('img');
  dialog.querySelector('button').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});

  // ---- Boot -------------------------------------------------------------------
  async function boot(){
    status.textContent='Loading the full directory…';
    try{
      const r=await fetch(BASE+'index.json'); if(!r.ok)throw 0;
      const d=await r.json();
      items=d.items.map(x=>({...x,b:x.b||x.i,s:normalize(x.n+' '+(x.k||'')+' '+(x.a||''))}));
      byId=new Map(items.map(x=>[x.i,x]));
    }catch{
      status.textContent='The full directory is unavailable right now, showing featured profiles.';
      return; // keep the server-rendered featured cards
    }
    directory.querySelectorAll('[data-artist-section]').forEach(s=>s.remove());
    empty.insertAdjacentElement('beforebegin',root);
    render();
    try{
      const r=await fetch('/api/reactions?bias=all',{cache:'no-store'}); const d=await r.json(); if(!r.ok)throw 0;
      counts=d.biases||{}; loaded=true; paintTotal(d.total||0);
    }catch{ if(totalEl)totalEl.textContent='Heart counts are unavailable right now.'; }
    root.querySelectorAll('[data-artist]').forEach(paint); if(category==='most-biased')render();
  }
  boot();
})();
