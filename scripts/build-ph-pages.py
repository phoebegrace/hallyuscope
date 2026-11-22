"""Builds tickets.html (PH ticket watch) and venues.html (PH concert venue guide)
from the features.html shell. Venue facts: Wikipedia infoboxes, checked 2026-11-22.
Run: python3 scripts/build-ph-pages.py"""
import re, html
shell = open('features.html').read()
head_end = shell.index('<main id="main" class="wrap">'); main_end = shell.index('</main>') + len('</main>')

def page(path, title, desc, kr, h1, sub, body, script):
    s = shell[:head_end] + f'''<main id="main" class="wrap">
<section class="page-head">
  <span class="kr">{kr}</span>
  <h1>{h1}</h1>
  <div class="page-sub"><p>{sub}</p></div>
</section>
{body}
</main>''' + shell[main_end:]
    s = s.replace('<title>Fan Guides | HallyuScope</title>', f'<title>{title}</title>')
    s = s.replace('content="Fan Guides | HallyuScope"', f'content="{title}"')
    s = s.replace('K-pop fan guides for the Philippines — ticketing, concerts, merch and more from HallyuScope.', desc)
    s = s.replace('https://hallyuscope.com/features"', f'https://hallyuscope.com/{path}"')
    s = s.replace('<a href="/features" aria-current="page">', '<a href="/features">')
    s = s.replace('<div class="nav-has-sub"><a href="/concerts">Concerts</a>', '<div class="nav-has-sub"><a href="/concerts" aria-current="page">Concerts</a>')
    s = s.replace('</body>', f'<link rel="stylesheet" href="/ph.css?v=20261122">\n<script>{script}</script>\n</body>')
    open(path + '.html', 'w').write(s)

COMMON = r'''
const DATA='https://raw.githubusercontent.com/phoebegrace/hallyuscope/live-data/data/concerts-calendar.json?v='+Math.floor(Date.now()/6e5);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date());
const fmt=d=>new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'}).format(new Date(d+'T12:00:00+08:00'));
const load=()=>fetch(DATA).then(r=>r.json()).then(d=>(d.items||[]).filter(x=>x.date>=today&&!/cancel|postpon/i.test(x.status||'')).sort((a,b)=>a.date.localeCompare(b.date)));
'''

# ---------- Ticket watch ----------
tickets_body = '''<div class="ph-tickets section" id="ticketWatch" style="padding-top:8px"><p class="meta">Checking ticket status…</p></div>
<section class="ph-note section"><h2>Before you buy</h2><ul>
<li>Buy only from the official seller linked on each show. Screenshot and resold tickets can be refused at the gate.</li>
<li>Log in to your ticketing account and save your payment details before the sale opens.</li>
<li>Prices shown are the published range and usually exclude online fees.</li>
<li>Status is checked against the official listings every 30 minutes, but a show can sell out between checks.</li></ul>
<p><a class="cta" href="/article/ticketing-day-minus-the-panic">Read the ticketing day guide <span class="arr">→</span></a></p></section>'''
tickets_js = COMMON + r'''
const group=e=>/sold out/i.test(e.status||'')?'sold':/on sale|available/i.test(e.status||'')?'now':'soon';
const row=e=>`<li class="ph-ticket"><a class="ph-ticket-main" href="/concert/${esc(e.id)}"><time>${esc(fmt(e.date))}</time><strong>${esc(e.artist)}</strong><span>${esc([e.venue,e.city].filter(Boolean).join(' · '))}</span></a><div class="ph-ticket-side"><b>${esc(e.ticketRange&&!/see official/i.test(e.ticketRange)?e.ticketRange:'Prices on the ticket page')}</b><small>${esc(e.ticketProvider||'Seller to be announced')}</small>${group(e)==='now'&&e.ticketUrl?`<a class="ph-buy" href="${esc(e.ticketUrl)}" target="_blank" rel="noopener">Get tickets ↗</a>`:''}</div></li>`;
load().then(items=>{const G={now:['On sale now','Tickets you can buy today.'],soon:['Selling soon','Announced shows. Ticket details are still coming.'],sold:['Sold out','Watch the official seller for released seats or added dates.']};
 document.getElementById('ticketWatch').innerHTML=Object.entries(G).map(([k,[t,s]])=>{const l=items.filter(e=>group(e)===k);return l.length?`<section class="ph-group ph-${k}"><header><h2>${t}<span>${l.length}</span></h2><p>${s}</p></header><ol>${l.map(row).join('')}</ol></section>`:''}).join('')||'<p class="meta">No upcoming shows right now.</p>';
}).catch(()=>{document.getElementById('ticketWatch').innerHTML='<p class="meta">Ticket status is unavailable right now. Please try again shortly.</p>'});
'''
page('tickets', 'K-pop Concert Tickets Philippines: What\'s On Sale Now | HallyuScope',
     'Which K-pop concert tickets are on sale in the Philippines right now, which shows are selling soon and which are sold out, with prices and official ticket links.',
     '티켓', 'Ticket watch <em>PH</em>',
     'Every upcoming K-pop show in the Philippines by ticket status: on sale now, selling soon and sold out, with peso prices and the official seller for each.',
     tickets_body, tickets_js)

# ---------- Venues ----------
V = [
 ('moa-arena', 'SM Mall of Asia Arena', 'Pasay, Metro Manila', ['mall of asia arena'], '15,000 seated, up to 20,000 full house', 'Indoor arena, opened 2012',
  'The arena is inside the Mall of Asia Complex by Manila Bay. The nearest train stops are LRT-1 EDSA and MRT-3 Taft Avenue; from there, take a jeep, bus or the EDSA Carousel to MOA.',
  'The mall is next door, so food and restrooms before the show are easy. After big shows, ride pick-ups around the complex are slow. Agree on a meeting spot before you go in.'),
 ('araneta-coliseum', 'Smart Araneta Coliseum', 'Araneta City, Cubao, Quezon City', ['araneta coliseum'], 'Up to about 16,000 for a full house', 'Indoor arena, opened 1960',
  'The "Big Dome" is one of the easiest venues to reach by train: both MRT-3 Araneta Center-Cubao and LRT-2 Araneta Center-Cubao stations are a short walk away.',
  'Araneta City malls surround the venue for food and waiting. Trains get packed right after a show, so have a backup ride plan.'),
 ('new-frontier-theater', 'New Frontier Theater', 'Araneta City, Cubao, Quezon City', ['new frontier'], '2,325', 'Indoor theater, reopened 2015',
  'It sits in Araneta City, a short walk from the MRT-3 and LRT-2 Araneta Center-Cubao stations and across from the Araneta Coliseum.',
  'A smaller theater, so even the back rows feel close compared with an arena. Popular for fan meetings and solo tours.'),
 ('philippine-arena', 'Philippine Arena', 'Ciudad de Victoria, Bulacan', ['philippine arena'], '55,000 seats', 'Indoor arena, the largest in the country',
  'The arena is in Ciudad de Victoria in Bulacan, reached by NLEX. There is no train, so most fans go by car, a booked van or the shuttle buses that organizers and fan groups arrange per show.',
  'Getting out after a show can take a long time. Book your ride home in advance, bring water and snacks, and expect a late night.'),
 ('philippine-sports-stadium', 'Philippine Sports Stadium', 'Ciudad de Victoria, Bulacan', ['philippine sports stadium'], '25,000 seated', 'Open-air stadium, opened 2014',
  'It is beside the Philippine Arena in Ciudad de Victoria, reached by NLEX. There is no train, so plan a car, a booked van or an event shuttle.',
  'This is an outdoor stadium, so check the weather and follow the organizer\'s rules on rain gear. Leaving the complex after a show is slow, so arrange your ride home early.'),
 ('aliw-theater', 'Aliw Theater', 'CCP Complex, Pasay', ['aliw theater'], '1,275 since its 2022 reopening', 'Indoor theater',
  'The theater is in the CCP Complex near Roxas Boulevard. The closest train stop is LRT-1 Vito Cruz; from there it is a short jeep or ride-hailing trip.',
  'An intimate venue where every seat is fairly close to the stage. Weekend traffic along the bay builds up early.'),
 ('picc-plenary-hall', 'PICC Plenary Hall', 'CCP Complex, Pasay', ['picc'], None, 'Convention center hall, PICC opened 1976',
  'The Philippine International Convention Center is in the CCP Complex in Pasay. LRT-1 Vito Cruz is the nearest train stop, followed by a short jeep or ride-hailing trip.',
  'A seated hall often used for fan meetings. Food options inside the complex are limited, so eat before you arrive.'),
 ('skydome', 'SM North EDSA Skydome', 'SM City North EDSA, Quezon City', ['skydome'], None, 'Event hall inside SM City North EDSA',
  'The Skydome is inside SM City North EDSA at EDSA corner North Avenue, beside the MRT-3 North Avenue station.',
  'A small hall inside a mall, so food, restrooms and a place to wait are all close by.'),
 ('samsung-hall', 'Samsung Hall, SM Aura', 'Bonifacio Global City, Taguig', ['samsung hall', 'sm aura'], None, 'Event hall inside SM Aura',
  'Samsung Hall is inside SM Aura at 26th Street corner McKinley Parkway in BGC. There is no train in BGC, so take the BGC Bus from the Ayala area or book a ride.',
  'A compact hall used for fan meetings and fan concerts. BGC traffic is heavy on weekends, so leave early.'),
 ('music-museum', 'Music Museum', 'Greenhills, San Juan', ['music museum'], None, 'Indoor theater',
  'The Music Museum is in the Greenhills area of San Juan. There is no train station close by, so a taxi or ride-hailing car is the simplest way in.',
  'A small theater suited to showcases and solo acts, with Greenhills shops and restaurants nearby.'),
 ('seaside-cebu-arena', 'SM Seaside Cebu Arena', 'South Road Properties, Cebu City', ['seaside cebu arena', 'seaside arena'], '16,000 seated, up to 25,000 full capacity', 'Indoor arena, opened July 2026',
  'The arena is at South Coast City in the South Road Properties, beside SM Seaside City Cebu. Take a taxi, a ride-hailing car or the buses that serve SM Seaside.',
  'Cebu\'s newest big venue, and the reason more tours can add a Visayas stop. The mall next door covers food before the show.'),
 ('smdc-festival-grounds', 'SMDC Festival Grounds', 'Aseana City, Parañaque', ['smdc festival grounds'], None, 'Open-air concert grounds',
  'The grounds are in Aseana City, Parañaque, near the bay area. There is no train stop nearby, so plan a ride-hailing car, taxi or bus along the coastal roads.',
  'An outdoor venue, so check the weather and the organizer\'s rules on bags, rain gear and seating. Standing sections mean comfortable shoes matter.'),
 ('fym-hall', 'FYM Hall, EVM Convention Center', 'Quezon City', ['fym hall', 'evm convention'], None, 'Convention center hall',
  'FYM Hall is inside the EVM Convention Center in Quezon City. Check the organizer\'s map for the entrance your ticket uses, and plan a taxi or ride-hailing car.',
  'Check the official seat map before buying, because sections differ from the bigger arenas.'),
]
e = html.escape
cards = ''.join(f'''<article class="ph-venue" id="{i}" data-match="{e('|'.join(m))}">
<header><h2>{e(n)}</h2><p class="meta">{e(loc)}</p></header>
<dl><div><dt>Type</dt><dd>{e(kind)}</dd></div>{f'<div><dt>Capacity</dt><dd>{e(cap)}</dd></div>' if cap else ''}</dl>
<h3>Getting there</h3><p>{e(go)}</p>
<h3>Good to know</h3><p>{e(tip)}</p>
<div class="ph-venue-shows" data-shows><h3>Upcoming K-pop shows here</h3><p class="meta">Checking the calendar…</p></div>
</article>''' for i, n, loc, m, cap, kind, go, tip in V)
toc = '<nav class="ph-toc" aria-label="Venues">' + ''.join(f'<a href="#{i}">{e(n)}</a>' for i, n, *_ in V) + '</nav>'
venues_js = COMMON + r'''
load().then(items=>{document.querySelectorAll('.ph-venue').forEach(v=>{const keys=v.dataset.match.split('|');const l=items.filter(x=>keys.some(k=>String(x.venue||'').toLowerCase().includes(k)));const box=v.querySelector('[data-shows]');
 box.innerHTML='<h3>Upcoming K-pop shows here</h3>'+(l.length?'<ul>'+l.map(x=>`<li><a href="/concert/${esc(x.id)}"><time>${esc(fmt(x.date))}</time><strong>${esc(x.artist)}</strong><span>${esc(x.status||'')}</span></a></li>`).join('')+'</ul>':'<p class="meta">No K-pop shows announced here right now.</p>')})}).catch(()=>document.querySelectorAll('[data-shows] .meta').forEach(m=>m.textContent='The calendar is unavailable right now.'));
'''
page('venues', 'K-pop Concert Venues in the Philippines: Getting There, Capacity and Tips | HallyuScope',
     'A fan guide to the Philippine venues that host K-pop concerts: MOA Arena, Araneta Coliseum, Philippine Arena, New Frontier Theater and more, with capacity, how to get there and upcoming shows.',
     '공연장', 'Venue guide <em>PH</em>',
     'Where K-pop shows happen in the Philippines. For each venue: where it is, how big it is, how to get there, what to expect and which shows are coming up.',
     toc + '<div class="ph-venues section" style="padding-top:8px">' + cards + '</div>', venues_js)
print('built tickets.html, venues.html')
