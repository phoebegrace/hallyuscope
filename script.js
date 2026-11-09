const menuBtn=document.getElementById('menuBtn');
const mobileMenu=document.getElementById('mobileMenu');
if(menuBtn&&mobileMenu){
  menuBtn.addEventListener('click',()=>{const open=mobileMenu.classList.toggle('open');mobileMenu.setAttribute('aria-hidden',String(!open));menuBtn.textContent=open?'Close':'Menu';});
  mobileMenu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{mobileMenu.classList.remove('open');menuBtn.textContent='Menu';}));
}
const searchPanel=document.getElementById('searchPanel');
const searchBtn=document.getElementById('searchBtn');
const closeSearch=document.getElementById('closeSearch');
if(searchBtn&&searchPanel) searchBtn.addEventListener('click',()=>{searchPanel.classList.add('open');searchPanel.setAttribute('aria-hidden','false');});
if(closeSearch&&searchPanel) closeSearch.addEventListener('click',()=>{searchPanel.classList.remove('open');searchPanel.setAttribute('aria-hidden','true');});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&searchPanel)searchPanel.classList.remove('open');});

const escapeHtml=(value='')=>String(value).replace(/[&<>'"]/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

function relativeTime(iso){
  if(!iso) return 'LATEST';
  const t=new Date(iso).getTime();
  if(Number.isNaN(t)) return 'LATEST';
  const ms=Math.max(0,Date.now()-t);
  const mins=Math.max(1,Math.round(ms/60000));
  if(mins<60) return `${mins} MIN AGO`;
  const hours=Math.round(mins/60);
  if(hours<24) return `${hours} HOUR${hours===1?'':'S'} AGO`;
  const days=Math.round(hours/24);
  return `${days} DAY${days===1?'':'S'} AGO`;
}

function publishedDate(iso){
  if(!iso) return 'RECENT';
  const d=new Date(iso);
  if(Number.isNaN(d.getTime())) return 'RECENT';
  return d.toLocaleDateString('en-PH',{month:'short',day:'numeric'}).toUpperCase();
}

async function getJson(path){
  const res=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store'});
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function bindCard(card,item,index){
  if(!card||!item) return;
  const meta=card.querySelector('.story-meta');
  const title=card.querySelector('h3');
  const desc=card.querySelector('p');
  const label=card.querySelector('.story-media span');
  if(meta) meta.textContent=`${item.source||'K-POP'} · ${relativeTime(item.publishedAt)}`;
  if(title) title.textContent=item.title;
  if(desc) desc.textContent='Open the original report for full details and source context.';
  if(label) label.textContent=index===0?'TOP STORY':'LIVE';
  card.dataset.href=item.url;
  card.tabIndex=0;
  card.setAttribute('role','link');
  card.setAttribute('aria-label',item.title);
  const go=()=>window.open(item.url,'_blank','noopener,noreferrer');
  card.addEventListener('click',go);
  card.addEventListener('keydown',(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});
}

async function loadLiveNews(){
  try{
    const data=await getJson('data/latest.json');
    const items=(data.items||[]).slice(0,5);
    if(!items.length) return;
    [...document.querySelectorAll('[data-live-card]')].forEach((card,index)=>bindCard(card,items[index],index));
    const ticker=document.getElementById('tickerTrack');
    if(ticker) ticker.innerHTML=items.map((item,i)=>`<span>${escapeHtml(item.title.toUpperCase())}</span>${i<items.length-1?'<i></i>':''}`).join('');
  }catch(err){console.warn('Live K-pop data unavailable; showing editorial fallback.',err);}
}

function mediaClassFor(index){return ['media-pink','media-blue','media-white','media-dark','media-gradient'][index%5];}

async function loadLatestArchive(){
  const root=document.getElementById('latestArchive'); if(!root) return;
  try{
    const data=await getJson('data/latest.json');
    root.innerHTML=(data.items||[]).map((item,i)=>`<a class="archive-card" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer"><div class="story-media ${mediaClassFor(i)}"><span>${i===0?'TOP STORY':'LIVE'}</span></div><div class="story-meta">${escapeHtml(item.source||'K-POP')} · ${relativeTime(item.publishedAt)}</div><h2>${escapeHtml(item.title)}</h2></a>`).join('');
  }catch(e){root.innerHTML='<p class="data-note">Live stories are temporarily unavailable.</p>';}
}

async function loadComebackArchive(){
  const root=document.getElementById('comebackArchive'); if(!root) return;
  try{
    const data=await getJson('data/comeback-candidates.json');
    const items=data.items||[];
    root.innerHTML=items.map(item=>`<article class="release-item"><div class="release-date">${publishedDate(item.publishedAt)}</div><div><div class="story-meta">${escapeHtml(item.source||'SOURCE')}</div><h2>${escapeHtml(item.title)}</h2></div><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Source →</a></article>`).join('') || '<p class="data-note">No comeback announcements found right now.</p>';
  }catch(e){root.innerHTML='<p class="data-note">Comeback data is temporarily unavailable.</p>';}
}

async function loadConcertArchive(){
  const root=document.getElementById('concertArchive'); if(!root) return;
  try{
    const data=await getJson('data/concert-candidates.json');
    const items=data.items||[];
    root.innerHTML=items.map(item=>`<article class="concert-page-card"><div class="date-block"><b>${publishedDate(item.publishedAt).split(' ')[1]||'NEW'}</b><span>${publishedDate(item.publishedAt).split(' ')[0]||''}</span></div><div><span class="story-meta">${escapeHtml(item.source||'SOURCE')}</span><h2>${escapeHtml(item.title)}</h2><p>Live concert announcement matching Manila / Philippines.</p></div><a class="status-chip" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">SOURCE ↗</a></article>`).join('') || '<p class="data-note">No Philippine K-pop concert announcements found right now.</p>';
  }catch(e){root.innerHTML='<p class="data-note">Concert data is temporarily unavailable.</p>';}
}

async function loadHomeConcerts(){
  const root=document.getElementById('homeConcertList'); if(!root) return;
  try{
    const data=await getJson('data/concert-candidates.json');
    const items=(data.items||[]).slice(0,3);
    if(!items.length){root.innerHTML='<p class="data-note">No fresh Philippine concert announcements found right now.</p>';return;}
    root.innerHTML=items.map(item=>`<article class="concert-row"><div class="date-block"><b>${publishedDate(item.publishedAt).split(' ')[1]||'NEW'}</b><span>${publishedDate(item.publishedAt).split(' ')[0]||''}</span></div><div class="concert-name"><span>${escapeHtml(item.source||'LIVE')}</span><h3>${escapeHtml(item.title)}</h3></div><div class="concert-meta">PH concert announcement</div><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Source</a></article>`).join('');
  }catch(e){root.innerHTML='<p class="data-note">Concert feed is temporarily unavailable.</p>';}
}

async function loadHomeComebacks(){
  const root=document.getElementById('comebackGrid'); if(!root) return;
  try{
    const data=await getJson('data/comeback-candidates.json');
    const items=(data.items||[]).slice(0,4);
    if(!items.length) return;
    root.innerHTML=items.map((item,i)=>`<a class="calendar-card${i===1?' active':''}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer"><span class="calendar-date">${escapeHtml(item.source||'SOURCE')}</span><b>${publishedDate(item.publishedAt).split(' ')[1]||'NEW'}</b><h3>${escapeHtml(item.title)}</h3><p>Announcement published ${relativeTime(item.publishedAt).toLowerCase()}.</p></a>`).join('');
  }catch(e){console.warn('Comeback feed unavailable',e);}
}

loadLiveNews();
loadLatestArchive();
loadComebackArchive();
loadConcertArchive();
loadHomeConcerts();
loadHomeComebacks();


const newsletterForm=document.getElementById('newsletterForm');
if(newsletterForm){
  const emailInput=document.getElementById('newsletterEmail');
  const submitBtn=document.getElementById('newsletterSubmit');
  const signupMessage=document.getElementById('signupMessage');

  newsletterForm.addEventListener('submit',async(e)=>{
    e.preventDefault();

    const email=(emailInput?.value||'').trim();
    const website=(newsletterForm.elements.website?.value||'').trim();

    if(!email||!emailInput.checkValidity()){
      signupMessage.textContent='Please enter a valid email address.';
      emailInput?.focus();
      return;
    }

    submitBtn.disabled=true;
    submitBtn.textContent='Joining…';
    signupMessage.textContent='Adding you to the list…';

    try{
      const res=await fetch('/api/subscribe',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email,website})
      });

      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error||'Unable to subscribe right now.');

      signupMessage.textContent=data.message||'You’re on the list.';
      newsletterForm.reset();
    }catch(err){
      signupMessage.textContent=err.message||'Something went wrong. Please try again.';
    }finally{
      submitBtn.disabled=false;
      submitBtn.textContent='Join free';
    }
  });
}
