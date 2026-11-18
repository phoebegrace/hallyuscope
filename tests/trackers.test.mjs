import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dateKey,parseComebacks,parseSmTickets,mergeCalendar} from '../scripts/lib/trackers.mjs';
test('dates must be explicit and valid',()=>{assert.equal(dateKey('November 20, 2026'),'2026-11-20');assert.equal(dateKey('February 30, 2026'),null);assert.equal(dateKey('coming soon'),null);});
test('comeback extraction reads date and source without copying article text',()=>{
 const html='<li class="gspbgrid_item type-album"><a title="KIIRAS 2nd Digital Single Album – OVER U (2026)" href="https://kpopofficial.com/album/kiiras-over-u/"></a><p>November 26, 2026</p></li>';
 const [x]=parseComebacks(html);assert.equal(x.artist,'KIIRAS');assert.equal(x.title,'OVER U');assert.equal(x.date,'2026-11-26');assert.equal(x.sourceClass,'publisher');assert.equal(x.description,undefined);
});
test('non-K-pop ticket listings are excluded and cancelled events stay labelled',()=>{
 const html='<li><a href="https://www.smtickets.com/events/view/123"><h1>BTS Concert CANCELLED</h1></a><p class="text-overflow">Philippine Arena</p><div class="o-date">Mar 13, 2027</div></li><li><a href="https://www.smtickets.com/events/view/124"><h1>Basketball match</h1></a><div class="o-date">Mar 14, 2027</div></li>';
 const data=parseSmTickets(html,['BTS']);assert.equal(data.length,1);assert.equal(data[0].status,'Cancelled');
});
test('refresh preserves IDs, tracks and affiliate links and never deletes missing listings',()=>{
 const old=[{id:'stable',artist:'Yves',title:'Cute & Anxiety',date:'2026-11-20',tracks:[{name:'Song'}],buyLinks:[{url:'https://shopee.ph/test'}]},{id:'keep',artist:'Other',date:'2027-01-01'}];
 const incoming=[{id:'different',artist:'YVES',title:'Cute & Anxiety',date:'2026-11-20',sourceUrl:'https://example.com',sourceClass:'publisher'}];
 const result=mergeCalendar(old,incoming,'comebacks','2026-11-19T00:00:00Z');assert.equal(result.items.length,2);assert.equal(result.items[0].id,'stable');assert.equal(result.items[0].tracks.length,1);assert.equal(result.items[0].buyLinks.length,1);
});
test('a conflicting secondary date is flagged rather than replacing an existing date',()=>{
 const result=mergeCalendar([{id:'a',artist:'Yves',title:'Cute & Anxiety',date:'2026-11-20'}],[{artist:'YVES',title:'Cute & Anxiety',date:'2026-11-21',sourceUrl:'https://example.com',sourceClass:'publisher'}],'comebacks','2026-11-19T00:00:00Z');assert.equal(result.items[0].date,'2026-11-20');assert.equal(result.items[0].dateConflict.reportedDate,'2026-11-21');
});

test('artist aliases sharing an album ID cannot create duplicate releases',()=>{
 const old=[{id:'txt-perfect-storm-2026',artist:'TOMORROW X TOGETHER',title:'PERFECT STORM',date:'2026-11-16',cover:'cover.jpg'},{id:'txt-perfect-storm-2026',artist:'TXT',title:'PERFECT STORM',date:'2026-11-16'}];
 const incoming=[{id:'txt-perfect-storm-2026',artist:'TXT',title:'PERFECT STORM',date:'2026-11-16',sourceUrl:'https://example.com',sourceClass:'publisher'}];
 const merged=mergeCalendar(old,incoming,'comebacks','2026-11-19T00:00:00Z');assert.equal(merged.items.length,1);assert.equal(merged.items[0].cover,'cover.jpg');
});
