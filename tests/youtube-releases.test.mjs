import assert from 'node:assert/strict';
import {parseYouTubeReleases,mergeCalendar} from '../scripts/lib/trackers.mjs';
const e=(t,u,p)=>`<entry><title>${t}</title><link rel="alternate" href="${u}"/><published>${p}</published></entry>`;
const xml='<feed>'+[
 e("NCT DREAM 엔시티 드림 'Boogie Woogie' MV",'https://www.youtube.com/watch?v=a','2026-11-09T09:00:20+00:00'),
 e("NCT DREAM 엔시티 드림 'Boogie Woogie' MV Teaser",'https://www.youtube.com/watch?v=b','2026-11-06T15:00:12+00:00'),
 e("TXT (투모로우바이투게더) ‘Angel Bite’ Official MV",'https://www.youtube.com/shorts/c','2026-11-16T09:00:27+00:00'),
 e("TXT (투모로우바이투게더) 'Angel Bite' Official MV",'https://www.youtube.com/watch?v=d','2026-11-16T08:58:08+00:00'),
 e("#ENHYPEN (#엔하이픈) 'I Want You' Official MV",'https://www.youtube.com/watch?v=x','2026-11-13T15:00:28+00:00'),
 e("ENHYPEN (엔하이픈) 'I Want You' Official MV",'https://www.youtube.com/watch?v=e','2026-11-13T14:57:11+00:00'),
 e("YAOCHEN(야오천) - &quot;WONDERFUL&quot; M/V",'https://www.youtube.com/watch?v=f','2026-11-16T04:00:27+00:00'),
 e("GIRLSET &quot;young &amp; dumb&quot; MV Trailer 2",'https://www.youtube.com/watch?v=g','2026-11-12T01:30:03+00:00'),
 e("[MV] WE GO-6 _ First and Last(처음이자 마지막으로)",'https://www.youtube.com/watch?v=h','2026-11-19T11:00:14+00:00'),
 e("[MV] Joseonhiphop(조선힙합), BEN(벤) _ Forest of the Mind(마음의 숲) (Live Clip)",'https://www.youtube.com/watch?v=i','2026-11-16T09:00:26+00:00'),
 e("[Teaser] sunwoojunga(선우정아) _ A Long Walk(동반)",'https://www.youtube.com/watch?v=j','2026-11-17T09:00:34+00:00'),
 e("BLACKPINK - ‘GO’ (Official Audio)",'https://www.youtube.com/watch?v=k','2026-03-01T05:03:00+00:00'),
 e("BLACKPINK - 'GO' M/V Behind the Scenes",'https://www.youtube.com/watch?v=l','2026-03-09T09:00:03+00:00'),
].join('')+'</feed>';
const r=parseYouTubeReleases(xml,['NCT DREAM','TXT','ENHYPEN','BLACKPINK','TOMORROW X TOGETHER'],'Test');
const got=r.map(x=>x.artist+'|'+x.title+'|'+x.date);
assert.deepEqual(got.sort(),['ENHYPEN|I Want You|2026-11-13','NCT DREAM|Boogie Woogie|2026-11-09','TXT|Angel Bite|2026-11-16','WE GO-6|First and Last|2026-11-19','YAOCHEN|WONDERFUL|2026-11-16'].sort());
// A channel MV for "NAYEON" must not duplicate KPOP OFFICIAL's "NAYEON (TWICE)" entry.
const m=mergeCalendar([{id:'n',artist:'NAYEON (TWICE)',title:'NA-sty',date:'2026-11-20',sourceUrl:'u',sourceClass:'publisher'}],[{id:'z',artist:'NAYEON',title:'NA-sty',date:'2026-11-20',sourceUrl:'v',sourceClass:'official'}],'comebacks','now');
assert.equal(m.items.length,1); assert.equal(m.added,0);
console.log('youtube releases: all checks passed ('+got.length+' releases)');
const t=mergeCalendar([{id:'p',artist:'TXT',title:'PERFECT STORM',date:'2026-11-16',type:'Mini Album',sourceUrl:'u',sourceClass:'publisher'}],[{id:'q',artist:'TXT',title:'Angel Bite',date:'2026-11-16',type:'Music video release',sourceUrl:'https://www.youtube.com/watch?v=d',sourceClass:'official'}],'comebacks','now');
assert.equal(t.items.length,1); assert.equal(t.items[0].titleTrack,'Angel Bite');
console.log('title track attaches to its album: ok');
