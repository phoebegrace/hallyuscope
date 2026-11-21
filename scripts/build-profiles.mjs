// Rebuild the server-rendered directory after updating data/profiles.json.
import fs from 'node:fs';
const {items}=JSON.parse(fs.readFileSync('data/profiles.json','utf8'));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories=[['girl-groups','Girl groups','artist'],['boy-groups','Boy groups','artist'],['soloists','Soloists','artist'],['k-actors','K-actors','actor']];
const HEART='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.9 4.5c2.1 0 3.6 1.1 5.1 3 1.5-1.9 3-3 5.1-3 3.9 0 6 3.9 4.5 7.3C19.5 16.4 12 21 12 21z"/></svg>';
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const longDate=s=>{const [y,m,d]=String(s).split('-').map(Number);return months[m-1]+' '+d+', '+y;};
const plural=(n,noun)=>n+' '+noun+(n===1?'':'s');

// Photo credit lives behind a small circled "!" that opens on hover, focus or tap.
const credit=x=>`<span class="photo-credit" tabindex="0" role="button" aria-label="Photo credit for ${esc(x.name)}" aria-describedby="credit-${esc(x.id)}" data-photo-credit><span aria-hidden="true">!</span><span class="photo-credit-tip" role="tooltip" id="credit-${esc(x.id)}"><b>Photo</b> ${esc(x.photographer)}<br><a href="${esc(x.sourceUrl)}" target="_blank" rel="noopener">Wikimedia Commons</a> · <a href="${esc(x.licenseUrl||x.sourceUrl)}" target="_blank" rel="noopener">${esc(x.license)}</a>${x.imageNote?`<br><small>${esc(x.imageNote)}</small>`:''}</span></span>`;

// The dropdown carries short, sourced facts about the artist or actor.
const shortDate=s=>{const [y,m,d]=String(s).split('-').map(Number);return months[m-1].slice(0,3)+' '+d+', '+y;};
function about(x){
 const d=x.details||{};const rows=[];
 if(d.koreanName&&d.koreanName!==x.name)rows.push(['Korean name',d.koreanName]);
 if(d.birthName)rows.push(['Birth name',d.birthName]);
 if(d.born)rows.push(['Born',longDate(d.born)]);
 if(d.debutDate)rows.push([x.category==='k-actors'?'Acting debut':'Debut',longDate(d.debutDate)]);
 else if(d.debutYear)rows.push([x.category==='k-actors'?'Acting debut':'Debut',d.debutYear]);
 if(d.group)rows.push(['Group',d.group]);
 if(d.height)rows.push(['Height',d.height]);
 if(d.fandom)rows.push(['Fandom',d.fandom]);
 if(d.agency)rows.push(['Agency',d.agency]);
 if(d.labels?.length)rows.push(['Labels',d.labels.join(', ')]);
 const mp=d.memberProfiles?.length?d.memberProfiles:(d.members||[]).map(name=>({name}));
 const members=mp.length?`<div class="profile-members"><h4>${esc(plural(mp.length,'member'))}</h4><ul>${mp.map(m=>`<li><b>${esc(m.name)}</b>${m.positions||m.born?`<span>${[m.positions,m.born&&shortDate(m.born)].filter(Boolean).map(esc).join(' · ')}</span>`:''}${m.birthName?`<small>${esc(m.birthName)}</small>`:''}</li>`).join('')}</ul></div>`:'';
 if(!rows.length&&!members&&!d.wikipedia)return '';
 const links=[d.kprofiles&&`<a class="profile-more" href="${esc(d.kprofiles)}" target="_blank" rel="noopener">Full profile on Kprofiles ↗</a>`,d.wikipedia&&`<a class="profile-more" href="${esc(d.wikipedia)}" target="_blank" rel="noopener">Wikipedia ↗</a>`].filter(Boolean).join('');
 return `<details class="profile-about"><summary>About ${esc(x.name)}</summary><dl>${rows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${members}${links?`<p class="profile-links">${links}</p>`:''}</details>`;
}

const card=(x,id,i)=>`<article class="artist-card" data-artist="${esc(x.name)}" data-category="${id}"><div class="profile-media"><button type="button" class="profile-photo" data-enlarge-profile aria-label="Enlarge ${esc(x.name)} photo"><img src="${esc(x.imageUrl)}" alt="${esc(x.name)}" width="${x.width}" height="${x.height}" loading="${id==='girl-groups'&&i<4?'eager':'lazy'}" decoding="async"></button>${credit(x)}</div><h3>${esc(x.name)}</h3>${about(x)}</article>`;

const sections=categories.map(([id,label,noun])=>{
 const list=items.filter(x=>x.category===id).sort((a,b)=>a.name.localeCompare(b.name));
 return `<section class="artist-section" id="${id}" data-artist-section data-noun="${noun}" aria-labelledby="${id}-heading"><div class="artist-section-head"><h2 id="${id}-heading">${label}</h2><span data-section-count>${plural(list.length,noun)}</span></div><div class="profile-grid">${list.map((x,i)=>card(x,id,i)).join('\n')}</div></section>`;
}).join('\n');

const html=`<!-- PROFILE_DIRECTORY_START -->
<section class="profile-directory" id="kpop-artists" aria-label="K-pop artist and K-actor directory"><div id="profileDirectory"><div class="profile-tools"><div class="profile-filters" role="group" aria-label="Profile category"><button type="button" data-profile-filter="all" aria-pressed="true">All</button>${categories.map(([id,label])=>`<button type="button" data-profile-filter="${id}" aria-pressed="false">${label}</button>`).join('')}<button type="button" data-profile-filter="most-biased" aria-pressed="false" class="bias-filter">♥ Most biased</button></div><label class="profile-search" for="profileSearch">Search<input id="profileSearch" type="search" placeholder="Find an artist, group or actor" autocomplete="off"></label></div><p class="bias-total">${HEART}<span id="biasTotal">Counting fan hearts…</span></p><p class="profile-summary" id="profileResults" role="status" aria-live="polite">${items.length} profiles. Select a photo to enlarge it.</p>${sections}<p id="profileEmpty" class="profile-no-results" hidden>No profiles found. Try another name or category.</p></div></section><dialog id="profilePhotoDialog" class="profile-lightbox" aria-label="Profile photo"><button type="button" class="profile-lightbox-close">Close photo</button><figure><img alt=""><figcaption></figcaption></figure></dialog>
<!-- PROFILE_DIRECTORY_END -->`;
let page=fs.readFileSync('profiles.html','utf8');
if(page.includes('<!-- PROFILE_DIRECTORY_START -->')) page=page.replace(/<!-- PROFILE_DIRECTORY_START -->[\s\S]*?<!-- PROFILE_DIRECTORY_END -->/,html);
else page=page.replace(/<section class="profile-section" id="kpop-artists"[\s\S]*?<\/section>/,html);
fs.writeFileSync('profiles.html',page);
console.log('Built '+items.length+' profile cards.');
