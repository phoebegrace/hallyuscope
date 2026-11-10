(() => {
  const modal = document.getElementById('concertCalendarModal');
  const openBtn = document.getElementById('openConcertCalendar');
  if (!modal || !openBtn) return;

  const grid = document.getElementById('concertMonthGrid');
  const list = document.getElementById('concertUpcomingList');
  const monthLabel = document.getElementById('concertMonthLabel');
  const count = document.getElementById('concertEventCount');
  const detail = document.getElementById('concertDetail');
  const detailBody = document.getElementById('concertDetailBody');
  const main = document.getElementById('concertCalendarMain');
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
    list.innerHTML = upcoming.length ? upcoming.map(cardHtml).join('') : '<p class="concert-empty">No verified upcoming Philippine concerts have been added yet.</p>';
  }

  function cardHtml(e){
    const d=localDate(e.date);
    return '<article class="concert-card" tabindex="0" role="button" data-event-id="'+esc(e.id)+'">' +
      '<div class="concert-card-date">'+fmt(d,{day:'2-digit'})+'<small>'+fmt(d,{month:'short'}).toUpperCase()+'</small></div>' +
      '<div><h3>'+esc(e.artist || e.title || 'Concert')+(e.tour?' — '+esc(e.tour):'')+'</h3>' +
      '<p>'+esc([e.venue,e.city].filter(Boolean).join(' · '))+'</p></div></article>';
  }

  function googleCalendarUrl(e){
    const d=String(e.date).replaceAll('-','');
    const title=encodeURIComponent((e.artist||e.title||'Concert')+(e.tour?' — '+e.tour:''));
    const details=encodeURIComponent(e.description||'');
    const location=encodeURIComponent([e.venue,e.city,'Philippines'].filter(Boolean).join(', '));
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+title+'&dates='+d+'/'+d+'&details='+details+'&location='+location;
  }

  function icsData(e){
    const d=String(e.date).replaceAll('-','');
    const next=new Date(localDate(e.date).getTime()+86400000);
    const nextD=[next.getFullYear(),String(next.getMonth()+1).padStart(2,'0'),String(next.getDate()).padStart(2,'0')].join('');
    const title=(e.artist||e.title||'Concert')+(e.tour?' — '+e.tour:'');
    return [
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//HallyuScope//Concert Calendar//EN',
      'BEGIN:VEVENT','UID:'+e.id+'@hallyuscope.com','DTSTART;VALUE=DATE:'+d,'DTEND;VALUE=DATE:'+nextD,
      'SUMMARY:'+title.replace(/[;,]/g,'\\$&'),
      'LOCATION:'+([e.venue,e.city,'Philippines'].filter(Boolean).join(', ')).replace(/[;,]/g,'\\$&'),
      'DESCRIPTION:'+(e.description||'').replace(/[;,]/g,'\\$&'),
      'END:VEVENT','END:VCALENDAR'
    ].join('\r\n');
  }

  function showEvent(e){
    if(!e) return;
    const d=localDate(e.date);
    const ticket = e.ticketUrl
      ? '<a class="concert-ticket-btn" href="'+esc(e.ticketUrl)+'" target="_blank" rel="noopener"><span>Buy Official Tickets</span><span>↗</span></a>'
      : '<span class="concert-ticket-btn is-disabled"><span>Ticket link coming soon</span><span>—</span></span>';
    const validImg = u => typeof u === 'string' && /^https?:\/\//.test(u);
    const poster = validImg(e.poster)
      ? '<figure class="concert-poster"><img src="'+esc(e.poster)+'" alt="'+esc((e.artist||'Concert')+' official poster')+'" loading="lazy"></figure>' : '';
    const seatPlan = validImg(e.seatPlan)
      ? '<figure class="concert-seatplan"><figcaption>Seat plan</figcaption><img src="'+esc(e.seatPlan)+'" alt="'+esc((e.artist||'Concert')+' seat plan')+'" loading="lazy"></figure>' : '';

    detailBody.innerHTML =
      '<div class="concert-detail-grid"><div>' +
      '<span class="eyebrow">'+esc((e.type||'Concert').toUpperCase())+'</span>' +
      '<h3>'+esc(e.artist||e.title||'Concert')+(e.tour?' — '+esc(e.tour):'')+'</h3>' +
      '<p class="concert-detail-dek">'+esc(e.description||'More details will be added as official information is confirmed.')+'</p>' +
      '<div class="concert-facts">' +
        fact('Date',fmt(d,{weekday:'long',month:'long',day:'numeric',year:'numeric'})) +
        fact('Venue',e.venue||'TBA') +
        fact('City',e.city||'Philippines') +
        fact('Status',e.status||'Tracking') +
        fact('Ticket range',e.ticketRange||'TBA') +
        fact('Promoter',e.promoter||'TBA') +
      '</div></div>' +
      '<div class="concert-detail-side">' + poster + seatPlan +
      '<aside class="concert-ticket-box"><span class="eyebrow">OFFICIAL TICKETING</span><h4>'+esc(e.ticketProvider||'Ticket details')+'</h4><p>HallyuScope links only to verified official ticketing or promoter destinations when available.</p>'+ticket+
      '<div class="concert-calendar-actions"><a href="'+googleCalendarUrl(e)+'" target="_blank" rel="noopener">Google Calendar</a><a href="#" data-download-ics="'+esc(e.id)+'">Apple / Outlook</a></div></aside></div></div>';

    main.hidden=true; detail.hidden=false;
  }

  function fact(label,value){ return '<div class="concert-fact"><b>'+esc(label)+'</b><span>'+esc(value)+'</span></div>'; }

  openBtn.addEventListener('click',openModal);
  modal.querySelectorAll('[data-calendar-close]').forEach(el=>el.addEventListener('click',closeModal));
  document.getElementById('concertPrevMonth').addEventListener('click',()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);render();});
  document.getElementById('concertNextMonth').addEventListener('click',()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);render();});
  document.getElementById('concertDetailBack').addEventListener('click',showMain);

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

  document.querySelectorAll('[data-concert-view]').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-concert-view]').forEach(b=>b.setAttribute('aria-pressed',b===btn?'true':'false'));
    main.classList.toggle('concert-list-mode',btn.dataset.concertView==='list');
  }));

  fetch('https://raw.githubusercontent.com/phoebegrace/hallyuscope/live-data/data/concerts-calendar.json?v='+Date.now(),{cache:'no-store'})
    .then(r=>r.ok?r.json():Promise.reject())
    .then(data=>{events=(data.items||[]).filter(e=>e.id&&e.date);render();})
    .catch(()=>{events=[];render();});
})();