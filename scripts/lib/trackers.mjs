export const clean=s=>String(s||'').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&#x([\da-f]+);/gi,(_,v)=>String.fromCodePoint(parseInt(v,16))).replace(/&#(\d+);/g,(_,v)=>String.fromCodePoint(+v)).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;|&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
export const norm=s=>clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\([^)]*\)/g,'').replace(/[^\p{L}\p{N}]/gu,'');
export const slug=s=>clean(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
export function dateKey(text){
 const s=clean(text),m=s.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(20\d{2})\b/);
 if(!m)return null;const month=months.findIndex(x=>x.startsWith(m[1].toLowerCase()));
 if(month<0)return null;const key=`${m[3]}-${String(month+1).padStart(2,'0')}-${m[2].padStart(2,'0')}`;
 const parsed=new Date(key+'T12:00:00Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===key?key:null;
}
export function parseComebacks(html){
 const found=new Map();
 for(const match of html.matchAll(/<li\b[^>]*class=["'][^"']*type-album[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)){
  const block=match[1];
  const a=block.match(/<a\b[^>]*title="([^"]+)"[^>]*href="([^"]+)"/i);
  if(!a)continue;const label=clean(a[1]);
  const info=label.match(/^(.*?)\s+((?:(?:\d+(?:st|nd|rd|th)|Japanese|Winter|Special|Spinoff)\s+)*(?:Digital Single Album|Digital Single|Single Album|Mini Album(?: \(EP\))?|Full Album|Album|EP|Single|OST))\s+[–—-]\s+(.+?)(?:\s+\(20\d{2}\))?$/i);
  const date=dateKey(block);
  if(!info||!date)continue;
  const [,artist,type,title]=info;
  const key=norm(artist)+'|'+norm(title);
  found.set(key,{id:slug(artist+'-'+title+'-'+date.slice(0,4)),artist,title,date,type,sourceUrl:clean(a[2]),sourceName:'KPOP OFFICIAL',sourceClass:'publisher',status:'Scheduled'});
 }
 return [...found.values()];
}
export function parseSmTickets(html,artistNames){
 const results=new Map();
 const names=[...artistNames,'LEE MINHYUK','HUTA','PENTAGON','ROCKY','PARK JINYOUNG','DOH KYUNG SOO','KATSEYE','YOUNG K','DAY6','N.FLYING','BTOB','INFINITE','CNBLUE','B.I'].sort((a,b)=>b.length-a.length);
 for(const m of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)){
  const block=m[1],title=clean(block.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  if(!title)continue;
  const artist=names.find(name=>new RegExp('(^|[^a-z0-9])'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'([^a-z0-9]|$)','i').test(title));
  if(!artist)continue;
  const date=dateKey(block.match(/<div\b[^>]*class="o-date"[^>]*>([\s\S]*?)<\/div>/i)?.[1]);
  const ticketUrl=block.match(/href="(https:\/\/(?:www\.)?smtickets.com\/events\/view\/\d+)"/i)?.[1];
  if(!date||!ticketUrl)continue;
  const venue=clean(block.match(/<p\b[^>]*class="text-overflow"[^>]*>([\s\S]*?)<\/p>/i)?.[1]);
  const status=/cancelled|canceled/i.test(title)?'Cancelled':/postponed/i.test(title)?'Postponed':/sold out/i.test(block)?'Sold out':'Ticket listing available';
  const poster=block.match(/<img\b[^>]*src="(https:[^"]+)"/i)?.[1];
  const x={id:slug(artist+'-'+date),artist,tour:title,date,venue:venue||'See official event page',city:/Cebu/i.test(venue)?'Cebu':/Araneta|New Frontier|Skydome/i.test(venue)?'Quezon City':/Mall Of Asia/i.test(venue)?'Pasay':'Philippines',type:'Concert',status,ticketUrl,ticketProvider:'SM Tickets',sourceUrl:ticketUrl,sourceName:'SM Tickets',sourceClass:'official',...(poster?{poster}:{} )};
  results.set(norm(artist)+'|'+date,x);
 }
 return [...results.values()];
}
export function parseJsonLdEvents(html,artistNames,base){
 const out=[];
 const visit=v=>{
  if(Array.isArray(v)){v.forEach(visit);return;}if(!v||typeof v!=='object')return;
  if(/Event/.test([v['@type']].flat().join(' '))&&v.startDate&&v.name){
   const name=clean(v.name),artist=artistNames.find(x=>norm(name).includes(norm(x)));
   const address=v.location?.address;
   const country=typeof address==='object'?address.addressCountry:'';
   if(artist&&(!country||/^(PH|Philippines)$/i.test(country))){
    const url=new URL(v.url||base,base).href;
    out.push({id:slug(artist+'-'+String(v.startDate).slice(0,10)),artist,tour:name,date:String(v.startDate).slice(0,10),venue:clean(v.location?.name),city:clean(address?.addressLocality)||'Philippines',status:/Cancelled/i.test(v.eventStatus)?'Cancelled':/Postponed/i.test(v.eventStatus)?'Postponed':'Announced',ticketUrl:v.offers?.url||url,sourceUrl:url,sourceClass:'official',sourceName:new URL(base).hostname});
   }
  }
  if(v['@graph'])visit(v['@graph']);if(v.itemListElement)for(const x of v.itemListElement)visit(x.item||x);
 };
 for(const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))try{visit(JSON.parse(m[1]));}catch{}
 return out;
}
export function mergeCalendar(existing,incoming,kind,checkedAt){
 const items=existing.map(x=>({...x}));let added=0,changed=0;
 for(const record of incoming){
  if(!record.artist||!record.date||!/^20\d{2}-\d{2}-\d{2}$/.test(record.date)||!record.sourceUrl)continue;
  const match=items.find(x=>norm(x.artist)===norm(record.artist)&&(kind==='concerts'?x.date===record.date:norm(x.title)===norm(record.title)));
  const next={...record,lastCheckedAt:checkedAt};
  if(match){
   const oldDate=match.date;
   // A secondary listing cannot silently overrule a conflicting verified date.
   if(oldDate!==record.date&&record.sourceClass!=='official'){
    match.dateConflict={reportedDate:record.date,sourceUrl:record.sourceUrl,detectedAt:checkedAt};continue;
   }
   if(match.date!==next.date||match.status!==next.status||match.sourceUrl!==next.sourceUrl)changed++;
   Object.assign(match,next,{id:match.id});
  }else{items.push(next);added++;}
 }
 return {items:items.sort((a,b)=>String(a.date).localeCompare(String(b.date))),added,changed};
}
