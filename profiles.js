(() => {
  const directory=document.querySelector('#profileDirectory');
  if(!directory)return;
  const cards=[...directory.querySelectorAll('[data-artist]')];
  const sections=[...directory.querySelectorAll('[data-artist-section]')];
  const filters=[...directory.querySelectorAll('[data-profile-filter]')];
  const search=document.querySelector('#profileSearch');
  const status=document.querySelector('#profileResults');
  const empty=document.querySelector('#profileEmpty');
  const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const categories=new Set(['girl-groups','boy-groups','soloists','k-actors','most-biased']);
  let category=categories.has(location.hash.slice(1))?location.hash.slice(1):'all';
  function render(){
    const term=normalize(search.value);
    let count=0;
    cards.forEach(card=>{
      card.hidden=!(category==='all'||category==='most-biased'||card.dataset.category===category)||!normalize(card.dataset.artist).includes(term);
      if(!card.hidden) count++;
    });
    arrange();
    sections.forEach(section=>{
      const visible=[...section.querySelectorAll('[data-artist]')].filter(card=>!card.hidden).length;
      section.hidden=!visible;
      const noun=section.dataset.noun||'artist';
      section.querySelector('[data-section-count]').textContent=visible+' '+noun+(visible===1?'':'s');
    });
    filters.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.profileFilter===category)));
    status.textContent=count+' '+(count===1?'profile':'profiles')+(term?' matching “'+search.value+'”':'')+'. Select a photo to enlarge it.';
    empty.hidden=!!count;
  }
  // ---- Bias hearts -------------------------------------------------------
  // One heart per artist per browser; totals are shared through /api/reactions.
  const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,64);
  const KEY='hallyuscope_biases';
  let mine=new Set(); try{mine=new Set(JSON.parse(localStorage.getItem(KEY)||'[]'));}catch{}
  const saveMine=()=>{try{localStorage.setItem(KEY,JSON.stringify([...mine]));}catch{}};
  let counts={}; let loaded=false;
  const totalEl=document.querySelector('#biasTotal');
  const fmt=n=>Number(n||0).toLocaleString('en-PH');
  const HEART='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.9 4.5c2.1 0 3.6 1.1 5.1 3 1.5-1.9 3-3 5.1-3 3.9 0 6 3.9 4.5 7.3C19.5 16.4 12 21 12 21z"/></svg>';
  cards.forEach(card=>{
    card.dataset.bias=slug(card.dataset.artist);
    const btn=document.createElement('button');
    btn.type='button'; btn.className='bias-btn'; btn.dataset.biasBtn='';
    btn.innerHTML=HEART+'<span class="bias-label">Bias</span><b class="bias-count">0</b>';
    card.querySelector('h3').insertAdjacentElement('afterend',btn);
  });
  function paintBias(card){
    const btn=card.querySelector('[data-bias-btn]'); const id=card.dataset.bias; const on=mine.has(id);
    btn.classList.toggle('is-on',on); btn.setAttribute('aria-pressed',String(on));
    btn.querySelector('.bias-count').textContent=fmt(counts[id]);
    btn.setAttribute('aria-label',(on?'Remove ':'Make ')+card.dataset.artist+(on?' from your biases':' your bias')+', '+fmt(counts[id])+' hearts');
  }
  function paintTotal(total){ if(totalEl) totalEl.textContent=fmt(total)+' '+(total===1?'heart':'hearts')+' from fans so far'; }
  function burst(btn){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const layer=document.createElement('span'); layer.className='bias-burst'; layer.setAttribute('aria-hidden','true');
    for(let i=0;i<9;i++){
      const h=document.createElement('i'); h.innerHTML=HEART;
      h.style.setProperty('--x',(Math.random()*120-60).toFixed(0)+'px');
      h.style.setProperty('--y',(-50-Math.random()*70).toFixed(0)+'px');
      h.style.setProperty('--r',(Math.random()*70-35).toFixed(0)+'deg');
      h.style.setProperty('--s',(0.55+Math.random()*0.6).toFixed(2));
      h.style.animationDelay=(i*35)+'ms';
      layer.appendChild(h);
    }
    btn.appendChild(layer); setTimeout(()=>layer.remove(),1300);
  }
  async function loadBiases(){
    try{
      const r=await fetch('/api/reactions?bias=all',{cache:'no-store'}); const d=await r.json();
      if(!r.ok) throw new Error(d.error);
      counts=d.biases||{}; loaded=true; paintTotal(d.total||0);
    }catch{ if(totalEl) totalEl.textContent='Heart counts are unavailable right now.'; }
    cards.forEach(paintBias); if(category==='most-biased') render();
  }
  directory.addEventListener('click',async event=>{
    const btn=event.target.closest('[data-bias-btn]'); if(!btn||btn.disabled) return;
    const card=btn.closest('[data-artist]'); const id=card.dataset.bias; const on=!mine.has(id);
    // Optimistic update, rolled back if the save fails.
    const before=counts[id]||0;
    on?mine.add(id):mine.delete(id); counts[id]=Math.max(0,before+(on?1:-1)); saveMine(); paintBias(card);
    btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); if(on) burst(btn);
    btn.disabled=true;
    try{
      const r=await fetch('/api/reactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bias:id,on})});
      const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error||'failed');
      counts[id]=d.count; paintTotal(d.total);
    }catch{
      on?mine.delete(id):mine.add(id); counts[id]=before; saveMine();
      status.textContent='Could not save your heart for '+card.dataset.artist+'. Please try again.';
    }finally{ btn.disabled=false; paintBias(card); }
  });
  // "Most biased": one ranked grid of every artist, most hearts first.
  const ranked=document.createElement('section'); ranked.className='artist-section'; ranked.id='most-biased'; ranked.hidden=true;
  ranked.innerHTML='<div class="artist-section-head"><h2>Most biased</h2><span data-ranked-count></span></div><ol class="profile-grid bias-ranking"></ol>';
  const rankedList=ranked.querySelector('ol');
  (sections[0]||directory).insertAdjacentElement('beforebegin',ranked);
  const home=cards.map(card=>({card,parent:card.parentElement}));
  let arrangedAs='';
  function arrange(){
    const mode=category==='most-biased'?'ranked':'sections';
    if(mode==='ranked'){
      const order=cards.slice().sort((a,b)=>(counts[b.dataset.bias]||0)-(counts[a.dataset.bias]||0)||a.dataset.artist.localeCompare(b.dataset.artist));
      order.forEach((card,i)=>{let li=card.parentElement.matches('li.bias-rank')?card.parentElement:document.createElement('li');li.className='bias-rank';li.dataset.rank=i+1;li.appendChild(card);rankedList.appendChild(li);li.hidden=card.hidden;});
    }else if(arrangedAs==='ranked'){
      home.forEach(({card,parent})=>parent.appendChild(card)); rankedList.innerHTML='';
    }
    arrangedAs=mode;
    ranked.hidden=mode!=='ranked'||!cards.some(c=>!c.hidden);
    if(mode==='ranked'){ const n=cards.filter(c=>!c.hidden).length; ranked.querySelector('[data-ranked-count]').textContent=loaded?n+' profiles, ranked by fan hearts':'Loading hearts…'; }
  }
  filters.forEach(button=>button.addEventListener('click',()=>{
    category=button.dataset.profileFilter;
    history.replaceState(null,'',location.pathname+location.search+(category==='all'?'':'#'+category));
    render();
  }));
  search.addEventListener('input',render);
  window.addEventListener('hashchange',()=>{category=categories.has(location.hash.slice(1))?location.hash.slice(1):'all';render();});
  const dialog=document.querySelector('#profilePhotoDialog');
  const photo=dialog.querySelector('img');
  directory.addEventListener('click',event=>{
    const button=event.target.closest('[data-enlarge-profile]');
    if(!button)return;
    const card=button.closest('[data-artist]');
    photo.src=button.querySelector('img').src;
    photo.alt=button.querySelector('img').alt;
    dialog.querySelector('figcaption').textContent=card.dataset.artist;
    dialog.showModal();
  });
  dialog.querySelector('button').addEventListener('click',()=>dialog.close());
  // Photo credit "!" badges open on hover/focus (CSS); taps toggle them on touch screens.
  const credits=[...directory.querySelectorAll('[data-photo-credit]')];
  const closeCredits=except=>credits.forEach(c=>{if(c!==except)c.classList.remove('is-open');});
  directory.addEventListener('click',event=>{
    const badge=event.target.closest('[data-photo-credit]');
    if(event.target.closest('.photo-credit-tip a'))return;
    if(!badge){closeCredits();return;}
    event.preventDefault();closeCredits(badge);badge.classList.toggle('is-open');
  });
  directory.addEventListener('keydown',event=>{
    const badge=event.target.closest('[data-photo-credit]');
    if(!badge)return;
    if(event.key==='Escape'){badge.classList.remove('is-open');badge.blur();}
    if(event.key==='Enter'||event.key===' '){event.preventDefault();badge.classList.toggle('is-open');}
  });
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  render();
  loadBiases();
})();
