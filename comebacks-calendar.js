(() => {
  const modal = document.getElementById('cbCalendarModal');
  const openBtn = document.getElementById('openCbCalendar');
  if (!modal || !openBtn) return;

  const grid = document.getElementById('cbMonthGrid');
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

  function openModal(){
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
  }
  function closeModal(){
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
    showMain();
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
        dayEvents.map(ev=>'<button type="button" class="concert-dot" data-event-id="'+esc(ev.id)+'">'+esc(ev.artist||ev.title||'Concert')+'</button>').join('') +
        '</div>';
    }
    grid.innerHTML=cells;

    const upcoming = events
      .filter(e => localDate(e.date) >= new Date(new Date().toDateString()))
      .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    count.textContent = upcoming.length + ' upcoming';
    list.innerHTML = upcoming.length ? upcoming.map(cardHtml).join('') : '<p class="concert-empty">No verified upcoming K-pop comebacks have been added yet.</p>';
  }

  function cardHtml(e){
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
        fact('Status','Announced') +
      '</div></div>' +
      '<div class="concert-detail-side">' +
      '<aside class="concert-ticket-box"><span class="eyebrow">ADD TO CALENDAR</span><h4>Save the date</h4><p>Add this comeback to your calendar so you do not miss release day.</p>' +
      '<div class="concert-calendar-actions"><a href="'+googleCalendarUrl(e)+'" target="_blank" rel="noopener">Google Calendar</a><a href="#" data-download-ics="'+esc(e.id)+'">Apple / Outlook</a></div></aside></div></div>';

    main.hidden=true; detail.hidden=false;
  }

  function fact(label,value){ return '<div class="concert-fact"><b>'+esc(label)+'</b><span>'+esc(value)+'</span></div>'; }

  openBtn.addEventListener('click',openModal);
  modal.querySelectorAll('[data-calendar-close]').forEach(el=>el.addEventListener('click',closeModal));
  document.getElementById('cbPrevMonth').addEventListener('click',()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);render();});
  document.getElementById('cbNextMonth').addEventListener('click',()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);render();});
  document.getElementById('cbDetailBack').addEventListener('click',showMain);

  modal.addEventListener('click',e=>{
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
      const a=document.createElement('a'); a.href=url; a.download=(ev.id||'concert')+'.ics'; a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  });

  modal.addEventListener('keydown',e=>{
    if(e.key==='Escape') closeModal();
    if((e.key==='Enter'||e.key===' ') && e.target.matches('[data-event-id]')){
      e.preventDefault(); showEvent(events.find(x=>x.id===e.target.dataset.eventId));
    }
  });

  document.querySelectorAll('[data-cb-view]').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-cb-view]').forEach(b=>b.setAttribute('aria-pressed',b===btn?'true':'false'));
    main.classList.toggle('concert-list-mode',btn.dataset.concertView==='list');
  }));

  fetch('https://raw.githubusercontent.com/phoebegrace/hallyuscope/live-data/data/comebacks-calendar.json?v='+Date.now(),{cache:'no-store'})
    .then(r=>r.ok?r.json():Promise.reject())
    .then(data=>{events=(data.items||[]).filter(e=>e.id&&e.date);render();})
    .catch(()=>{events=[];render();});
})();