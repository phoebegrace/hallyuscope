// Comebacks page: the release schedule as Albums-style cards (visible on
// the page, latest first with an Upcoming tab, each linking to its /album/<id> page) plus the
// month calendar inline below it — no articles, no popup. The calendar
// keeps its month grid, upcoming list, list view and detail view (with
// Add to Calendar); it just lives on the page now instead of in a modal.
(() => {
  const section = document.getElementById('cbCalendar');
  const grid = document.getElementById('cbGrid');
  const countEl = document.querySelector('.page-sub [data-count]');
  if (!section || !grid) return;

  const monthGrid = document.getElementById('cbMonthGrid');
  const list = document.getElementById('cbUpcomingList');
  const monthLabel = document.getElementById('cbMonthLabel');
  const count = document.getElementById('cbEventCount');
  const detail = document.getElementById('cbDetail');
  const detailBody = document.getElementById('cbDetailBody');
  const main = document.getElementById('cbCalendarMain');
  let events = [];
  let cursor = new Date();
  cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);

  const esc = (s='') => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (date, opts) => new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',...opts}).format(date);
  const localDate = (s) => new Date(String(s).slice(0,10) + 'T12:00:00+08:00');
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());

  // Branded fallback tile for a missing or broken cover: navy tile with
  // the white HallyuScope wordmark and the album title in white.
  function fallbackHtml(e) {
    return '<img class="album-cover-fallback-logo" src="/assets/hallyuscope-logo-light.png" alt="" aria-hidden="true">' +
      '<span class="album-cover-fallback-title" aria-hidden="true">' + esc(e.title || e.artist || 'Release') + '</span>';
  }

  // If a cover image fails to load, swap it for the branded fallback tile.
  window.albumCoverError = function (img) {
    const box = img.parentNode;
    box.classList.add('album-cover--empty');
    img.remove();
    const title = box.dataset.albumTitle || '';
    const logo = document.createElement('img');
    logo.className = 'album-cover-fallback-logo';
    logo.src = '/assets/hallyuscope-logo-light.png';
    logo.alt = '';
    logo.setAttribute('aria-hidden', 'true');
    box.appendChild(logo);
    if (title) {
      const s = document.createElement('span');
      s.className = 'album-cover-fallback-title';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = title;
      box.appendChild(s);
    }
  };

  function coverHtml(e) {
    if (e.cover) {
      return '<div class="album-cover" data-album-title="' + esc(e.title || e.artist || 'Release') + '"><img src="' + esc(e.cover) + '" alt="' +
        esc((e.artist || 'Release') + ' - ' + (e.title || '') + ' album cover') +
        '" loading="lazy" onerror="albumCoverError(this)"></div>';
    }
    return '<div class="album-cover album-cover--empty">' + fallbackHtml(e) + '</div>';
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

  let tab = 'upcoming'; // Upcoming releases are the primary view.
  function renderGrid() {
    const released = events.filter(e => String(e.date).slice(0,10) <= todayStr)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const upcoming = events.filter(e => String(e.date).slice(0,10) > todayStr)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const list = tab === 'upcoming' ? upcoming : released;
    if (countEl) countEl.textContent = released.length + ' released \u00b7 ' + upcoming.length + ' upcoming';
    grid.innerHTML = list.length
      ? list.map(cardHtml).join('')
      : '<p class="album-empty">No ' + (tab === 'upcoming' ? 'upcoming' : 'released') + ' K-pop comebacks yet.</p>';
  }

  function showMain(){ detail.hidden=true; main.hidden=false; }
  function sameMonth(item){
    const d=localDate(item.date);
    return d.getFullYear()===cursor.getFullYear() && d.getMonth()===cursor.getMonth();
  }
  function monthEvents(){ return events.filter(sameMonth).sort((a,b)=>String(a.date).localeCompare(String(b.date))); }

  function render(){
    monthLabel.textContent = fmt(cursor,{month:'long',year:'numeric'});
    const first = new Date(cursor.getFullYear(),cursor.getMonth(),1);
    const last = new Date(cursor.getFullYear(),cursor.getMonth()+1,0);
    const start = first.getDay();
    let cells='';
    for(let i=0;i<start;i++) cells += '<div class="concert-day is-empty" aria-hidden="true"></div>';

    for(let day=1;day<=last.getDate();day++){
      const d = new Date(cursor.getFullYear(),cursor.getMonth(),day);
      const key = [
        d.getFullYear(),
        String(d.getMonth()+1).padStart(2,'0'),
        String(day).padStart(2,'0')
      ].join('-');
      const dayEvents = events.filter(e => String(e.date).slice(0,10)===key);
      const isToday = new Date().toDateString()===d.toDateString();
      cells += '<div class="concert-day ' +
        (dayEvents.length?'has-event ':'') + (dayEvents.length>1?'has-many ':'') + (isToday?'is-today':'') +
        '" data-date="'+key+'">' +
        '<span class="concert-day-num">'+day+'</span>' +
        dayEvents.map(ev=>'<button type="button" class="concert-dot" data-event-id="'+esc(ev.id)+'">'+esc(ev.artist||ev.title||'Comeback')+'</button>').join('') +
        '</div>';
    }
    monthGrid.innerHTML=cells;

    const upcoming = events
      .filter(e => localDate(e.date) >= new Date(new Date().toDateString()))
      .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    count.textContent = upcoming.length + ' upcoming';
    list.innerHTML = upcoming.length ? upcoming.map(listCardHtml).join('') : '<p class="concert-empty">No verified upcoming K-pop comebacks have been added yet.</p>';
  }

  function listCardHtml(e){
    const d=localDate(e.date);
    return '<article class="concert-card" tabindex="0" role="button" data-event-id="'+esc(e.id)+'">' +
      '<div class="concert-card-date">'+fmt(d,{day:'2-digit'})+'<small>'+fmt(d,{month:'short'}).toUpperCase()+'</small></div>' +
      '<div><h3>'+esc(e.artist || 'Comeback')+(e.title?' — '+esc(e.title):'')+'</h3>' +
      '<p>'+esc(e.type||'Release')+'</p></div></article>';
  }

  function googleCalendarUrl(e){
    const d=String(e.date).replaceAll('-','');
    const title=encodeURIComponent((e.artist||'Comeback')+(e.title?' - '+e.title:''));
    const details=encodeURIComponent(e.description||'');
    const location=encodeURIComponent('K-pop release');
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+title+'&dates='+d+'/'+d+'&details='+details+'&location='+location;
  }

  function icsData(e){
    const d=String(e.date).replaceAll('-','');
    const next=new Date(localDate(e.date).getTime()+86400000);
    const nextD=[next.getFullYear(),String(next.getMonth()+1).padStart(2,'0'),String(next.getDate()).padStart(2,'0')].join('');
    const title=(e.artist||'Comeback')+(e.title?' - '+e.title:'');
    return [
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//HallyuScope//Comeback Calendar//EN',
      'BEGIN:VEVENT','UID:'+e.id+'@hallyuscope.com','DTSTART;VALUE=DATE:'+d,'DTEND;VALUE=DATE:'+nextD,
      'SUMMARY:'+title.replace(/[;,]/g,'\\$&'),
      'LOCATION:K-pop release',
      'DESCRIPTION:'+(e.description||'').replace(/[;,]/g,'\\$&'),
      'END:VEVENT','END:VCALENDAR'
    ].join('\r\n');
  }

  function showEvent(e){
    if(!e) return;
    const d=localDate(e.date);

    detailBody.innerHTML =
      '<div class="concert-detail-grid"><div>' +
      '<span class="eyebrow">'+esc((e.type||'Release').toUpperCase())+'</span>' +
      '<h3>'+esc(e.artist||'Comeback')+'</h3>' +
      '<p class="concert-detail-dek"><b>'+esc(e.title||'')+'</b> '+esc(e.description||'More details will be added as official information is confirmed.')+'</p>' +
      '<div class="concert-facts">' +
        fact('Date',fmt(d,{weekday:'long',month:'long',day:'numeric',year:'numeric'})) +
        fact('Release',e.type||'Release') +
        fact('Status',e.status||'Scheduled') +
        (e.sourceUrl?'<p class="tracker-source">Schedule source: <a href="'+esc(e.sourceUrl)+'" target="_blank" rel="noopener">'+esc(e.sourceName||'Source')+' ↗</a> · '+esc(e.sourceClass||'reported')+'</p>':'') +
      '</div></div>' +
      '<div class="concert-detail-side">' +
      '<aside class="concert-ticket-box"><span class="eyebrow">ADD TO CALENDAR</span><h4>Save the date</h4><p>Add this comeback to your calendar so you do not miss release day.</p>' +
      '<div class="concert-calendar-actions"><a href="'+googleCalendarUrl(e)+'" target="_blank" rel="noopener">Google Calendar</a><a href="#" data-download-ics="'+esc(e.id)+'">Apple / Outlook</a></div></aside></div></div>';

    main.hidden=true; detail.hidden=false;
  }

  function fact(label,value){ return '<div class="concert-fact"><b>'+esc(label)+'</b><span>'+esc(value)+'</span></div>'; }

  document.querySelectorAll('[data-cb-tab]').forEach(btn => btn.addEventListener('click', () => {
    tab = btn.dataset.cbTab;
    document.querySelectorAll('[data-cb-tab]').forEach(b => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
    renderGrid();
  }));
  document.getElementById('cbPrevMonth').addEventListener('click',()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);render();});
  document.getElementById('cbNextMonth').addEventListener('click',()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);render();});
  document.getElementById('cbDetailBack').addEventListener('click',showMain);

  section.addEventListener('click',e=>{
    const card=e.target.closest('[data-event-id]');
    if(card){ showEvent(events.find(x=>x.id===card.dataset.eventId)); return; }
    const day=e.target.closest('[data-date]');
    if(day){
      const ev=events.find(x=>String(x.date).slice(0,10)===day.dataset.date);
      if(ev) showEvent(ev);
      return;
    }
    const ics=e.target.closest('[data-download-ics]');
    if(ics){
      e.preventDefault();
      const ev=events.find(x=>x.id===ics.dataset.downloadIcs);
      if(!ev) return;
      const blob=new Blob([icsData(ev)],{type:'text/calendar;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url; a.download=(ev.id||'comeback')+'.ics'; a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  });

  section.addEventListener('keydown',e=>{
    if((e.key==='Enter'||e.key===' ') && e.target.matches('[data-event-id]')){
      e.preventDefault(); showEvent(events.find(x=>x.id===e.target.dataset.eventId));
    }
  });

  document.querySelectorAll('[data-cb-view]').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-cb-view]').forEach(b=>b.setAttribute('aria-pressed',b===btn?'true':'false'));
    main.classList.toggle('concert-list-mode',btn.dataset.cbView==='list');
  }));

  fetch('https://raw.githubusercontent.com/phoebegrace/hallyuscope/live-data/data/comebacks-calendar.json?v='+Date.now(),{cache:'no-store'})
    .then(r=>r.ok?r.json():Promise.reject())
    .then(data=>{events=(data.items||[]).filter(e=>e.id&&e.date);renderGrid();render();})
    .catch(()=>{events=[];renderGrid();render();});
})();
