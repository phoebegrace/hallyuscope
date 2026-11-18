(() => {
 const panel=document.querySelector('#trackerSourceHealth');if(!panel)return;
 const kind=document.body.dataset.page==='concerts'?'concerts':'comebacks';
 const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=value=>new Date(value).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
 fetch('https://raw.githubusercontent.com/phoebegrace/hallyuscope/live-data/data/tracker-health.json?v='+Math.floor(Date.now()/300000),{cache:'no-store'})
 .then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
  const sources=(data.sources||[]).filter(x=>x.kind===kind);
  const successful=sources.filter(x=>x.ok);
  const stale=Date.now()-Date.parse(data.checkedAt)>90*60000;
  panel.querySelector('[data-tracker-updated]').textContent='Last source check: '+fmt(data.checkedAt)+' PHT. Automatic checks are scheduled every 30 minutes.'+(stale?' The latest scheduled check is delayed.':'')+(successful.length<sources.length?' Some sources are unavailable; last known listings are retained.':'');
  panel.querySelector('[data-tracker-sources]').innerHTML=sources.map(x=>'<li class="'+(x.ok?'':'source-unavailable')+'"><a href="'+esc(x.url)+'" target="_blank" rel="noopener">'+esc(x.name)+'</a> · '+esc(x.sourceClass)+' · '+(x.ok?x.count+' records read':'Unavailable to the automatic checker')+'</li>').join('');
 }).catch(()=>{panel.querySelector('[data-tracker-updated]').textContent='Source-check information is temporarily unavailable. Check the event source for the latest announcement.';});
})();
