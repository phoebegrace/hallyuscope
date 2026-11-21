// Concerts page: the shows as horizontal poster cards (visible on the
// page, soonest first) plus the month calendar inline below it — no
// articles, no popup. Every show opens its own page at /concert/<id>:
// the card's poster and title link there, and so do the calendar's day
// dots, day cells and upcoming list. The detail (poster, seat plan,
// ticket box, Add to Calendar) lives on that page, not inline here.
(() => {
  const section = document.getElementById('concertCalendar');
  const grid = document.getElementById('concertGrid');
  const countEl = document.querySelector('.page-sub [data-count]');
  if (!section || !grid) return;

  const monthGrid = document.getElementById('concertMonthGrid');
  const list = document.getElementById('concertUpcomingList');
  const monthLabel = document.getElementById('concertMonthLabel');
  const count = document.getElementById('concertEventCount');
  const main = document.getElementById('concertCalendarMain');
  let events = [];
  let cursor = new Date();
  cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);

  const esc = (s='') => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (date, opts) => new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',...opts}).format(date);
  const localDate = (s) => new Date(String(s).slice(0,10) + 'T12:00:00+08:00');

  // If a poster fails to load, swap it for the initial-letter placeholder.
  window.concertPosterError = function (img) {
    const box = img.parentNode;
    box.classList.add('concert-show-poster--empty');
    img.remove();
    const s = document.createElement('span');
    s.setAttribute('aria-hidden', 'true');
    s.textContent = (img.alt || 'H').charAt(0);
    box.appendChild(s);
  };

  function posterHtml(e) {
    const initial = String(e.artist || 'H').trim().charAt(0).toUpperCase();
    if (e.poster && /^https?:\/\//.test(e.poster)) {
      return '<div class="concert-show-poster"><img src="' + esc(e.poster) + '" alt="' +
        esc((e.artist || 'Concert') + ' official poster') +
        '" loading="lazy" onerror="concertPosterError(this)"></div>';
    }
    return '<div class="concert-show-poster concert-show-poster--empty"><span aria-hidden="true">' + esc(initial) + '</span></div>';
  }

  function showCardHtml(e) {
    const d = localDate(e.date);
    const day = fmt(d, { day: '2-digit' });
    const mon = fmt(d, { month: 'short', year: 'numeric' }).toUpperCase();
    const ticket = e.ticketUrl&&!/cancelled|canceled|postponed/i.test(e.status||'')
      ? '<a class="concert-show-ticket" href="' + esc(e.ticketUrl) + '" target="_blank" rel="noopener"><span>Get tickets</span><span>↗</span></a>'
      : '<span class="concert-show-ticket is-disabled"><span>'+esc(/cancelled|canceled|postponed/i.test(e.status||'')?e.status:'Tickets soon')+'</span><span>—</span></span>';
    return '<div class="concert-show-card">' +
      '<a class="concert-show-poster-link" href="/concert/' + esc(e.id) + '" tabindex="-1" aria-hidden="true" aria-label="' + esc((e.artist || '') + ' — ' + (e.tour || '')) + '">' + posterHtml(e) + '</a>' +
      '<div class="concert-show-info">' +
      '<div class="concert-show-date">' + esc(day) + '<small>' + esc(mon) + '</small></div>' +
      '<h3><a class="concert-show-link" href="/concert/' + esc(e.id) + '">' + esc(e.artist || e.title || 'Concert') + '</a></h3>' +
      '<p class="concert-show-tour">' + esc(e.tour || '') + '</p>' +
      '<p class="concert-show-venue">' + esc([e.venue, e.city].filter(Boolean).join(' · ')) + '</p>' +
      '<p class="concert-show-price">' + esc(e.ticketRange || 'TBA') + ' · ' + esc(e.status || '') + '</p>' +
      ticket +
      '<p class="tracker-source"><a href="'+esc(e.sourceUrl||e.ticketUrl||'#')+'" target="_blank" rel="noopener">'+esc(e.sourceName||e.ticketProvider||'Event source')+' ↗</a>'+(e.lastCheckedAt?'<span class="tracker-source-time">Checked '+esc(new Date(e.lastCheckedAt).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric'}))+'</span>':'')+'</p>'+
      '</div></div>';
  }

  function renderGrid() {
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date());
    const sorted = [...events].filter(e=>e.date>=today).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (countEl) countEl.textContent = events.length + ' shows';
    // Event list as structured data, so search engines can read every show.
    try{
      let ld=document.getElementById('concertListLd');
      if(!ld){ld=document.createElement('script');ld.type='application/ld+json';ld.id='concertListLd';document.head.appendChild(ld);}
      ld.textContent=JSON.stringify({'@context':'https://schema.org','@type':'ItemList',name:'K-pop concerts in the Philippines',itemListElement:sorted.map((e,i)=>({'@type':'ListItem',position:i+1,url:'https://hallyuscope.com/concert/'+e.id,name:(e.artist||'Concert')+(e.tour?' — '+e.tour:'')}))}).replace(/</g,'\\u003c');
    }catch{}
    grid.innerHTML = sorted.length
      ? sorted.map(showCardHtml).join('')
      : '<p class="concert-empty">No verified Philippine concerts have been added yet.</p>';
  }

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
        dayEvents.map(ev=>'<a class="concert-dot" href="/concert/'+esc(ev.id)+'">'+esc(ev.artist||ev.title||'Concert')+'</a>').join('') +
        '</div>';
    }
    monthGrid.innerHTML=cells;

    const upcoming = events
      .filter(e => localDate(e.date) >= new Date(new Date().toDateString()))
      .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    count.textContent = upcoming.length + ' upcoming';
    list.innerHTML = upcoming.length ? upcoming.map(listCardHtml).join('') : '<p class="concert-empty">No verified upcoming Philippine concerts have been added yet.</p>';
  }

  function listCardHtml(e){
    const d=localDate(e.date);
    return '<a class="concert-card" href="/concert/'+esc(e.id)+'">' +
      '<div class="concert-card-date">'+fmt(d,{day:'2-digit'})+'<small>'+fmt(d,{month:'short'}).toUpperCase()+'</small></div>' +
      '<div><h3>'+esc(e.artist || e.title || 'Concert')+(e.tour?' — '+esc(e.tour):'')+'</h3>' +
      '<p>'+esc([e.venue,e.city].filter(Boolean).join(' · '))+'</p></div></a>';
  }

  document.getElementById('concertPrevMonth').addEventListener('click',()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);render();});
  document.getElementById('concertNextMonth').addEventListener('click',()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);render();});

  // Clicking a day cell opens that day's first show on its own page.
  section.addEventListener('click',e=>{
    if (e.target.closest('a')) return;
    const day=e.target.closest('[data-date]');
    if(day){
      const ev=events.find(x=>String(x.date).slice(0,10)===day.dataset.date);
      if(ev) window.location.href='/concert/'+ev.id;
    }
  });

  document.querySelectorAll('[data-concert-view]').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-concert-view]').forEach(b=>b.setAttribute('aria-pressed',b===btn?'true':'false'));
    main.classList.toggle('concert-list-mode',btn.dataset.concertView==='list');
  }));

  fetch('https://raw.githubusercontent.com/phoebegrace/hallyuscope/live-data/data/concerts-calendar.json?v='+Date.now(),{cache:'no-store'})
    .then(r=>r.ok?r.json():Promise.reject())
    .then(data=>{events=(data.items||[]).filter(e=>e.id&&e.date);renderGrid();render();})
    .catch(()=>{events=[];renderGrid();render();});
})();
