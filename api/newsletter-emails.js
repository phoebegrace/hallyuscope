// HallyuScope email design system and every email in The Weekly Scope.
// One place for the look (layout + components) and the words (welcome
// series, re-engagement, alerts, weekly issue), so Brevo templates and the
// weekly issue builder always match the site.
//
// Brand: navy #01229a, pink #fe0862, ink #0b0d17, white. Archivo with safe
// fallbacks. Table layout and inline styles so it renders in Gmail, Outlook,
// Apple Mail and Yahoo. Brevo merge tags: {{ unsubscribe }}, {{ update_profile }}.

export const SITE = 'https://hallyuscope.com';
const IMG = SITE + '/assets/email-';
const NAVY = '#01229a', PINK = '#fe0862', INK = '#0b0d17', MUTE = '#5b6178', HAIR = '#e3e5ee', TINT = '#f3f4f9';
const FONT = "'Archivo','Helvetica Neue',Helvetica,Arial,sans-serif";

export const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Adds campaign tracking so newsletter visits show up as such in analytics.
export const link = (path, campaign = 'weekly-scope') => {
  const url = path.startsWith('http') ? path : SITE + path;
  if (!url.startsWith(SITE)) return url;
  return url + (url.includes('?') ? '&' : '?') + 'utm_source=newsletter&utm_medium=email&utm_campaign=' + encodeURIComponent(campaign);
};

/* ---------- components ---------- */

export function button(text, href, { color = NAVY } = {}) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px"><tr><td bgcolor="${color}" style="background:${color};mso-padding-alt:15px 26px">
<a href="${esc(href)}" style="display:inline-block;padding:15px 26px;font:700 15px/1 ${FONT};color:#ffffff;text-decoration:none;letter-spacing:.01em">${esc(text)}&nbsp;&nbsp;&rarr;</a></td></tr></table>`;
}

export function eyebrow(text, color = PINK) {
  return `<p style="margin:0 0 10px;font:800 11px/1.2 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${color}">${esc(text)}</p>`;
}

export function h1(text) {
  return `<h1 style="margin:0 0 14px;font:800 30px/1.12 ${FONT};color:${INK};letter-spacing:-.01em">${text}</h1>`;
}

export function p(html, { size = 16, color = '#33384d', margin = '0 0 16px' } = {}) {
  return `<p style="margin:${margin};font:400 ${size}px/1.65 ${FONT};color:${color}">${html}</p>`;
}

export function heroImage(src, alt, href) {
  const img = `<img src="${esc(src)}" width="600" alt="${esc(alt)}" style="display:block;width:100%;max-width:600px;height:auto;border:0">`;
  return `<tr><td style="padding:0">${href ? `<a href="${esc(href)}">${img}</a>` : img}</td></tr>`;
}

// Section heading in the site's style: small Korean label, bold title, ink rule.
export function sectionHead(kr, title, more) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px"><tr>
<td style="padding:0 0 10px;border-bottom:2px solid ${INK}">
<span style="display:block;font:700 12px/1.2 ${FONT};color:${PINK};margin:0 0 6px">${esc(kr)}</span>
<span style="display:block;font:800 22px/1.15 ${FONT};color:${INK}">${esc(title)}</span></td>
${more ? `<td align="right" valign="bottom" style="padding:0 0 12px;border-bottom:2px solid ${INK}"><a href="${esc(more.href)}" style="font:700 13px/1 ${FONT};color:${NAVY};text-decoration:none;white-space:nowrap">${esc(more.text)} &rarr;</a></td>` : ''}
</tr></table>`;
}

// A dated row, like the cards on the concert and comeback calendars.
export function dateRow({ day, mon, title, sub, tag, href }) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="62" valign="top" style="padding:16px 0;border-bottom:1px solid ${HAIR}">
<span style="display:block;font:800 26px/1 ${FONT};color:${PINK}">${esc(day)}</span>
<span style="display:block;font:800 10px/1.4 ${FONT};letter-spacing:.12em;color:${MUTE};margin-top:4px">${esc(mon)}</span></td>
<td valign="top" style="padding:16px 0;border-bottom:1px solid ${HAIR}">
<a href="${esc(href)}" style="font:800 16px/1.3 ${FONT};color:${INK};text-decoration:none">${esc(title)}</a>
${sub ? `<span style="display:block;font:400 14px/1.5 ${FONT};color:${MUTE};margin-top:4px">${esc(sub)}</span>` : ''}
${tag ? `<span style="display:inline-block;margin-top:8px;padding:4px 7px;border:1px solid ${tag.color || NAVY};font:800 10px/1 ${FONT};letter-spacing:.1em;text-transform:uppercase;color:${tag.color || NAVY}">${esc(tag.text)}</span>` : ''}
</td></tr></table>`;
}

// A numbered story row (the "This week's issue" look from the site).
export function storyRow(n, { title, dek, href, kicker }) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="38" valign="top" style="padding:16px 0;border-bottom:1px solid ${HAIR};font:800 13px/1.6 ${FONT};color:${PINK}">${String(n).padStart(2, '0')}</td>
<td valign="top" style="padding:16px 0;border-bottom:1px solid ${HAIR}">
${kicker ? `<span style="display:block;font:800 10px/1.4 ${FONT};letter-spacing:.12em;text-transform:uppercase;color:${NAVY};margin-bottom:4px">${esc(kicker)}</span>` : ''}
<a href="${esc(href)}" style="font:800 16px/1.35 ${FONT};color:${INK};text-decoration:none">${esc(title)}</a>
${dek ? `<span style="display:block;font:400 14px/1.55 ${FONT};color:${MUTE};margin-top:5px">${esc(dek)}</span>` : ''}
</td></tr></table>`;
}

// Three quick links to the trackers, as tiles.
export function trackerTiles(campaign) {
  const tile = (href, label, text, lead) => `<td width="33%" valign="top" bgcolor="${lead ? NAVY : '#ffffff'}" style="background:${lead ? NAVY : '#ffffff'};border:1px solid ${lead ? NAVY : HAIR};padding:16px 14px">
<a href="${esc(link(href, campaign))}" style="display:block;text-decoration:none">
<span style="display:block;font:800 15px/1.25 ${FONT};color:${lead ? '#ffffff' : INK}">${label}</span>
<span style="display:block;font:400 12px/1.5 ${FONT};color:${lead ? 'rgba(255,255,255,.8)' : MUTE};margin-top:6px">${text}</span>
<span style="display:block;font:800 13px/1 ${FONT};color:${lead ? '#ffffff' : PINK};margin-top:10px">&rarr;</span></a></td>`;
  const gap = '<td width="10" style="width:10px;font-size:0;line-height:0">&nbsp;</td>';
  return `<table role="presentation" class="stack" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${tile('/concerts', 'Concert calendar', 'Every PH show and official ticket link', true)}${gap}
${tile('/comebacks', 'Comeback calendar', 'Albums, singles and MV drops')}${gap}
${tile('/profiles', 'K&#8209;Profiles', 'Facts on idols and K&#8209;actors')}
</tr></table>`;
}

export function callout(html) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px"><tr>
<td style="background:${TINT};border-left:4px solid ${PINK};padding:16px 18px;font:400 15px/1.6 ${FONT};color:#33384d">${html}</td></tr></table>`;
}

export function checklist(items) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px">${items.map(([t, d]) => `<tr>
<td width="28" valign="top" style="padding:7px 0;font:800 15px/1.5 ${FONT};color:${PINK}">&#10003;</td>
<td valign="top" style="padding:7px 0;font:400 15px/1.55 ${FONT};color:#33384d"><b style="color:${INK}">${t}</b> ${d}</td></tr>`).join('')}</table>`;
}

/* ---------- layout ---------- */

// Wraps content rows in the full branded email: preheader, stripe, logo
// header, white body, navy footer with the legal links Brevo needs.
export function layout({ title, preheader, label = 'The Weekly Scope', rows, campaign = 'weekly-scope' }) {
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(title)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;700;800&display=swap" rel="stylesheet">
<style>
body{margin:0;padding:0;background:${TINT}}
a{color:${NAVY}}
@media (max-width:620px){
 .container{width:100%!important}
 .pad{padding-left:22px!important;padding-right:22px!important}
 .stack td{display:block!important;width:auto!important;margin:0 0 10px!important}
 .stack td[width="10"]{display:none!important}
 h1{font-size:26px!important}
}
</style>
</head>
<body style="margin:0;padding:0;background:${TINT}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${TINT}">${esc(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${TINT}" style="background:${TINT}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff">
<tr><td style="height:6px;line-height:6px;font-size:0;background:${NAVY}">&nbsp;</td></tr>
<tr><td style="height:4px;line-height:4px;font-size:0;background:${PINK}">&nbsp;</td></tr>
<tr><td align="center" class="pad" style="padding:30px 40px 22px">
<a href="${esc(link('/', campaign))}"><img src="${IMG}logo.png" width="190" alt="HallyuScope" style="display:block;width:190px;height:auto;border:0"></a>
<p style="margin:14px 0 0;font:700 11px/1 ${FONT};letter-spacing:.16em;text-transform:uppercase;color:${MUTE}"><span style="color:${PINK}">한류</span>&nbsp;&nbsp;${esc(label)}</p>
</td></tr>
${rows}
<tr><td class="pad" bgcolor="${NAVY}" style="background:${NAVY};padding:34px 40px 30px">
<img src="${IMG}logo-light.png" width="150" alt="HallyuScope" style="display:block;width:150px;height:auto;border:0;margin:0 0 16px">
<p style="margin:0 0 18px;font:400 14px/1.6 ${FONT};color:rgba(255,255,255,.78)">Philippine K-pop concerts, comebacks and artist profiles, with news and guides to keep you in the loop.</p>
<p style="margin:0 0 22px;font:700 13px/1.9 ${FONT}">
<a href="${esc(link('/concerts', campaign))}" style="color:#ffffff;text-decoration:none">Concerts</a>&nbsp;&nbsp;<span style="color:${PINK}">&bull;</span>&nbsp;&nbsp;<a href="${esc(link('/comebacks', campaign))}" style="color:#ffffff;text-decoration:none">Comebacks</a>&nbsp;&nbsp;<span style="color:${PINK}">&bull;</span>&nbsp;&nbsp;<a href="${esc(link('/profiles', campaign))}" style="color:#ffffff;text-decoration:none">K&#8209;Profiles</a>&nbsp;&nbsp;<span style="color:${PINK}">&bull;</span>&nbsp;&nbsp;<a href="${esc(link('/features', campaign))}" style="color:#ffffff;text-decoration:none">Guides</a>&nbsp;&nbsp;<span style="color:${PINK}">&bull;</span>&nbsp;&nbsp;<a href="${esc(link('/latest', campaign))}" style="color:#ffffff;text-decoration:none">News</a></p>
<p style="margin:0;padding-top:18px;border-top:1px solid rgba(255,255,255,.18);font:400 12px/1.7 ${FONT};color:rgba(255,255,255,.62)">You're getting this because you joined The Weekly Scope at hallyuscope.com. Independent fan publication, not affiliated with any entertainment agency.<br>
<a href="{{ unsubscribe }}" style="color:#ffffff;text-decoration:underline">Unsubscribe</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="{{ update_profile }}" style="color:#ffffff;text-decoration:underline">Update preferences</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="${SITE}/privacy" style="color:#ffffff;text-decoration:underline">Privacy</a></p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

// A padded white content block.
export const block = (html, { pad = '30px 40px', bg = '#ffffff' } = {}) =>
  `<tr><td class="pad" style="padding:${pad};background:${bg}">${html}</td></tr>`;

const signoff = (extra = '') => p(`${extra}See you in the next one,<br><b style="color:${INK}">The HallyuScope team</b>`, { margin: '8px 0 0' });

/* ---------- welcome series ---------- */

export const welcome = [
  {
    key: 'welcome-1',
    delay: 'Right after they join',
    subject: "You're in! Welcome to The Weekly Scope",
    preheader: 'Concerts, comebacks and the week in K-pop, made for fans in the Philippines.',
    html: () => layout({
      title: 'Welcome to The Weekly Scope', label: 'Welcome', campaign: 'welcome-1',
      preheader: 'Concerts, comebacks and the week in K-pop, made for fans in the Philippines.',
      rows: heroImage(IMG + 'welcome-crowd.jpg', 'A K-pop concert crowd waving lightsticks', link('/concerts', 'welcome-1'))
        + block(
          eyebrow('Welcome to the fandom')
          + h1('Annyeong! You just joined The Weekly Scope.')
          + p("Thank you for signing up. Every week we'll send one email with everything Filipino K-pop fans need to know, so you never have to dig through ten tabs again.")
          + checklist([
            ['Comebacks.', 'Release dates and teasers the moment they drop.'],
            ['PH concerts.', 'Every Manila show, ticket sale and venue in one list.'],
            ['Top stories.', "The week's must-reads in a 3-minute read."],
          ])
          + button('Explore HallyuScope', link('/', 'welcome-1'))
        )
        + block(sectionHead('바로가기', 'Start with your fan calendar') + `<div style="height:16px;line-height:16px">&nbsp;</div>` + trackerTiles('welcome-1'), { pad: '6px 40px 30px' })
        + block(
          callout(`<b style="color:${INK}">One quick favour:</b> add <b>hello@hallyuscope.com</b> to your contacts so The Weekly Scope lands in your inbox, not Promotions or spam.`)
          + p("Who's your bias? Hit reply and tell us. We read every message, and it helps us decide what to cover next.")
          + signoff(), { pad: '0 40px 34px' }),
    }),
  },
  {
    key: 'welcome-2',
    delay: '2 days later',
    subject: 'Never miss a ticket sale again',
    preheader: "Every K-pop show in the Philippines, plus the checklist to finish before tickets drop.",
    html: () => layout({
      title: 'Never miss a ticket sale again', label: 'Welcome · 2 of 4', campaign: 'welcome-2',
      preheader: 'Every K-pop show in the Philippines, plus the checklist to finish before tickets drop.',
      rows: heroImage(IMG + 'ticketing.jpg', 'A fan getting ready for a ticket sale on a phone and laptop', link('/article/ticketing-day-minus-the-panic', 'welcome-2'))
        + block(
          eyebrow('Concert calendar')
          + h1('Every K-pop show in the Philippines, in one place.')
          + p('The HallyuScope concert calendar lists every announced show, with the date, venue, seat plan and a link to the <b>official</b> ticket seller. If a ticket link is not on the calendar, we have not verified it, so you never have to wonder if a link is safe.')
          + button('Open the concert calendar', link('/concerts', 'welcome-2'))
        )
        + block(
          sectionHead('가이드', 'Ticketing day, minus the panic')
          + `<div style="height:14px;line-height:14px">&nbsp;</div>`
          + checklist([
            ['Find the official seller.', 'Ticketmaster PH, SM Tickets, TicketNet and the others are linked on every show.'],
            ['Make your account the night before.', 'Log in once so you know the password works.'],
            ['Sort out payment early.', 'Most failed checkouts are a declined card, not a sold-out section.'],
            ['Pick your section and price ceiling.', 'Decide before the queue opens, not while the clock runs.'],
          ])
          + button('Read the full guide', link('/article/ticketing-day-minus-the-panic', 'welcome-2'), { color: PINK })
          + signoff(), { pad: '4px 40px 34px' }),
    }),
  },
  {
    key: 'welcome-3',
    delay: '4 days after joining',
    subject: 'Your comeback calendar is ready',
    preheader: 'Albums, singles and MV drops, day by day. Plus what POBs actually are.',
    html: () => layout({
      title: 'Your comeback calendar is ready', label: 'Welcome · 3 of 4', campaign: 'welcome-3',
      preheader: 'Albums, singles and MV drops, day by day. Plus what POBs actually are.',
      rows: heroImage(IMG + 'albums.jpg', 'K-pop album, photocards and inclusions laid out on a table', link('/comebacks', 'welcome-3'))
        + block(
          eyebrow('Comeback calendar')
          + h1('Know every comeback before it drops.')
          + p('The comeback calendar tracks upcoming albums, singles and music video releases day by day, checked against official channels. Hover any artist on the calendar for the title track and release type, or add the date straight to your phone calendar.')
          + button('See this month’s comebacks', link('/comebacks', 'welcome-3'))
        )
        + block(
          callout(`<b style="color:${INK}">New to buying albums?</b> Versions, POBs and inclusions can get confusing fast. Our plain-language guide explains what you are actually paying for, and how to pick the right shop.`)
          + button('Album versions, POBs and inclusions', link('/article/album-versions-pobs-and-inclusions', 'welcome-3'), { color: PINK })
          + `<div style="height:10px;line-height:10px">&nbsp;</div>`
          + p(`Prefer browsing by release? <a href="${esc(link('/albums', 'welcome-3'))}" style="color:${NAVY};font-weight:700">Album releases</a> shows covers and tracklists for every new and upcoming album.`)
          + signoff(), { pad: '0 40px 34px' }),
    }),
  },
  {
    key: 'welcome-4',
    delay: '7 days after joining',
    subject: 'Who are you biasing?',
    preheader: 'Heart your bias on K-Profiles and see who Filipino fans love most.',
    html: () => layout({
      title: 'Who are you biasing?', label: 'Welcome · 4 of 4', campaign: 'welcome-4',
      preheader: 'Heart your bias on K-Profiles and see who Filipino fans love most.',
      rows: heroImage(IMG + 'concert-stage.jpg', 'A K-pop group performing on a lit-up arena stage', link('/profiles', 'welcome-4'))
        + block(
          eyebrow('K-Profiles')
          + h1('Heart your bias. Watch the ranking move.')
          + p('K-Profiles has quick, sourced facts on girl groups, boy groups, soloists and K-actors: debut year, members, agency and more. Tap the heart on your bias and they climb the <b>Most biased</b> ranking for every fan to see.')
          + button('Heart your bias', link('/profiles', 'welcome-4'), { color: PINK })
        )
        + block(
          sectionHead('첫 콘서트', 'Going to your first concert?')
          + `<div style="height:12px;line-height:12px">&nbsp;</div>`
          + p('Venues, entry times, lightsticks and the etiquette nobody tells you. Our first-concert guide covers the whole day, from the bag check to the ride home.')
          + button('Your first K-pop concert in Manila', link('/article/your-first-k-pop-concert-in-manila', 'welcome-4'))
          + `<div style="height:10px;line-height:10px">&nbsp;</div>`
          + p("That's the tour! From here on, look out for The Weekly Scope in your inbox once a week.")
          + signoff(), { pad: '4px 40px 34px' }),
    }),
  },
];

/* ---------- re-engagement ---------- */

export const reengage = [
  {
    key: 'reengage-1',
    delay: 'After 90 days without an open',
    subject: 'Still a fan? We saved your seat',
    preheader: "We haven't seen you in a while. Here's what you missed.",
    html: () => layout({
      title: 'Still a fan?', label: 'We miss you', campaign: 'reengage-1',
      preheader: "We haven't seen you in a while. Here's what you missed.",
      rows: block(
        eyebrow('It’s been a while')
        + h1('Still a fan? We saved your seat.')
        + p("We noticed you haven't opened The Weekly Scope in a while. No pressure, inboxes get busy. Here's what's been happening on HallyuScope since you last checked in:")
        + checklist([
          ['New shows on the concert calendar,', 'with official ticket links for every one.'],
          ['Fresh comebacks every week,', 'from surprise singles to full albums.'],
          ['A bias ranking,', 'where your hearts decide who Filipino fans love most.'],
        ])
        + button('Yes, keep me on the list', link('/?stay=1', 'reengage-1'), { color: PINK })
        + `<div style="height:14px;line-height:14px">&nbsp;</div>`
        + trackerTiles('reengage-1')
        + `<div style="height:18px;line-height:18px">&nbsp;</div>`
        + p('Opening this email or tapping any link is enough to keep you subscribed. If K-pop is not your thing right now, you can <a href="{{ unsubscribe }}" style="color:' + NAVY + ';font-weight:700">unsubscribe here</a>, no hard feelings.', { size: 14, color: MUTE })
        + signoff()),
    }),
  },
  {
    key: 'reengage-2',
    delay: '7 days later, if still no open',
    subject: 'Last call before we say annyeong',
    preheader: "We'll stop emailing soon unless you tell us to stay.",
    html: () => layout({
      title: 'Last call', label: 'Last call', campaign: 'reengage-2',
      preheader: "We'll stop emailing soon unless you tell us to stay.",
      rows: block(
        eyebrow('Last call')
        + h1('Before we say annyeong…')
        + p("We only want to send The Weekly Scope to fans who enjoy it. Since we haven't heard from you, we'll take you off the list in a few days.")
        + p('Want to stay? One tap is all it takes.')
        + button('Keep me subscribed', link('/?stay=1', 'reengage-2'), { color: PINK })
        + `<div style="height:16px;line-height:16px">&nbsp;</div>`
        + callout(`You can always come back. The <a href="${esc(link('/concerts', 'reengage-2'))}" style="color:${NAVY};font-weight:700">concert calendar</a> and <a href="${esc(link('/comebacks', 'reengage-2'))}" style="color:${NAVY};font-weight:700">comeback calendar</a> are free to use any time, no signup needed.`)
        + signoff('Thank you for being part of the fandom. ')),
    }),
  },
];

/* ---------- alerts ---------- */

const fmtDate = (iso, opts) => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', ...opts }).format(new Date(String(iso).slice(0, 10) + 'T12:00:00+08:00'));

// Tickets are on sale (or about to be) for a Philippine show.
export function ticketAlert(show) {
  const campaign = 'alert-tickets';
  const when = fmtDate(show.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const subject = `Tickets are live: ${show.artist} in ${show.city || 'the Philippines'}`;
  const detail = (k, v) => v ? `<tr><td width="110" style="padding:9px 0;border-bottom:1px solid ${HAIR};font:800 11px/1.4 ${FONT};letter-spacing:.1em;text-transform:uppercase;color:${MUTE}">${k}</td><td style="padding:9px 0;border-bottom:1px solid ${HAIR};font:700 15px/1.4 ${FONT};color:${INK}">${esc(v)}</td></tr>` : '';
  return {
    subject,
    preheader: `${show.tour || show.artist} · ${when} · ${show.venue}`,
    html: layout({
      title: subject, label: 'Ticket alert', campaign,
      preheader: `${show.tour || show.artist} · ${when} · ${show.venue}`,
      rows: (show.poster ? heroImage(show.poster, `${show.artist} official poster`, link('/concert/' + show.id, campaign)) : '')
        + block(
          eyebrow('Ticket alert')
          + h1(`${esc(show.artist)} is coming to ${esc(show.city || 'the Philippines')}`)
          + p(esc(show.tour || ''), { size: 17, color: INK })
          + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px">${detail('Date', when)}${detail('Venue', [show.venue, show.city].filter(Boolean).join(', '))}${detail('Tickets', show.ticketRange)}${detail('Seller', show.ticketProvider)}${detail('Status', show.status)}</table>`
          + button('See seat plan and official ticket link', link('/concert/' + show.id, campaign), { color: PINK })
          + `<div style="height:14px;line-height:14px">&nbsp;</div>`
          + callout(`<b style="color:${INK}">Buying today?</b> Make your account and sort out payment before the queue opens. Our <a href="${esc(link('/article/ticketing-day-minus-the-panic', campaign))}" style="color:${NAVY};font-weight:700">ticketing checklist</a> takes five minutes.`)
          + signoff('Good luck in the queue! ')),
    }),
  };
}

// Comebacks out today: one alert for the day, one or several releases.
export function comebackAlert(input) {
  const list = (Array.isArray(input) ? input : [input]).filter(Boolean);
  const campaign = 'alert-comeback';
  const leadOf = r => r.titleTrack || (r.tracks || []).filter(t => t.titleTrack).map(t => t.name).join(', ');
  const first = list[0];
  const subject = list.length === 1
    ? `Out now: ${first.artist}, '${first.title}'`
    : `Out today: ${list.slice(0, 3).map(r => r.artist).join(', ')}${list.length > 3 ? ` + ${list.length - 3} more` : ''}`;
  const preheader = list.length === 1
    ? `${first.type || 'New release'}${leadOf(first) ? ` · title track '${leadOf(first)}'` : ''}`
    : `${list.length} new releases today. Here's what to stream first.`;
  const card = r => {
    const href = link('/album/' + r.id, campaign);
    const lead = leadOf(r);
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${r.cover ? `<td width="96" valign="top" style="padding:16px 16px 16px 0;border-bottom:1px solid ${HAIR}"><a href="${esc(href)}"><img src="${esc(r.cover)}" width="96" alt="${esc(r.artist + ' ' + r.title + ' cover')}" style="display:block;width:96px;height:96px;object-fit:cover;border:0"></a></td>` : ''}
<td valign="top" style="padding:16px 0;border-bottom:1px solid ${HAIR}">
<span style="display:block;font:800 10px/1.4 ${FONT};letter-spacing:.12em;text-transform:uppercase;color:${PINK};margin-bottom:4px">${esc(r.type || 'New release')}</span>
<a href="${esc(href)}" style="display:block;font:800 17px/1.3 ${FONT};color:${INK};text-decoration:none">${esc(r.artist)} · ${esc(r.title)}</a>
${lead ? `<span style="display:block;font:400 14px/1.5 ${FONT};color:${MUTE};margin-top:4px">Title track: <b style="color:${INK}">${esc(lead)}</b>${r.tracks?.length ? ` · ${r.tracks.length} songs` : ''}</span>` : ''}
<a href="${esc(href)}" style="display:inline-block;margin-top:8px;font:700 13px/1 ${FONT};color:${NAVY};text-decoration:none">Listen and see the tracklist &rarr;</a>
</td></tr></table>`;
  };
  return {
    subject, preheader,
    html: layout({
      title: subject, label: 'Comeback alert', campaign, preheader,
      rows: (list.length === 1 && first.cover ? `<tr><td align="center" style="padding:0 40px 6px"><a href="${esc(link('/album/' + first.id, campaign))}"><img src="${esc(first.cover)}" width="300" alt="${esc(first.artist + ' ' + first.title + ' cover')}" style="display:block;width:300px;max-width:100%;height:auto;border:0"></a></td></tr>` : '')
        + block(
          eyebrow('Comeback alert')
          + h1(list.length === 1 ? `${esc(first.artist)} is back with '${esc(first.title)}'` : `${list.length} comebacks just dropped`)
          + p(list.length === 1 ? (first.description ? esc(first.description) : 'It’s out now on every streaming platform. Here’s everything you need to know.') : 'Fresh releases are out today. Tap any one for the tracklist and where to stream.')
          + (list.length === 1 ? button('Listen and see the tracklist', link('/album/' + first.id, campaign), { color: PINK }) : list.map(card).join(''))
          + `<div style="height:16px;line-height:16px">&nbsp;</div>`
          + p(`More drops coming this month: <a href="${esc(link('/comebacks', campaign))}" style="color:${NAVY};font-weight:700">open the comeback calendar</a>.`)
          + signoff('Happy streaming! ')),
    }),
  };
}

/* ---------- the weekly issue ---------- */

const inNextDays = (iso, from, days) => { const d = String(iso).slice(0, 10); return d >= from && d <= addDays(from, days); };
function addDays(ymd, n) { const d = new Date(ymd + 'T12:00:00+08:00'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const isPhoto = u => typeof u === 'string' && /^https?:\/\//.test(u) && !/\.svg(\?|$)/i.test(u) && !u.includes('/api/social-card');

// Builds one issue from the site's own data. Every link stays on HallyuScope.
export function weeklyIssue({ today, articles = [], comebacks = [], concerts = [], issueNo }) {
  const campaign = 'weekly-scope-' + today;
  const published = articles.filter(a => a.status === 'published')
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  const weekAgo = addDays(today, -7);
  const recent = published.filter(a => String(a.publishedAt).slice(0, 10) >= weekAgo);
  const pool = recent.length >= 5 ? recent : published;
  const top = pool.find(a => isPhoto(a.imageUrl)) || pool[0];
  const stories = pool.filter(a => a !== top).slice(0, 5);
  const releases = comebacks.filter(c => inNextDays(c.date, today, 7)).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 8);
  const shows = concerts.filter(c => String(c.date).slice(0, 10) >= today && !/cancel/i.test(c.status || ''))
    .sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 5);
  const guide = published.find(a => /guide|checklist|first k-pop concert|versions, pobs/i.test(a.headline || '')) || null;
  const day = iso => fmtDate(iso, { day: '2-digit' });
  const mon = iso => fmtDate(iso, { month: 'short' }).toUpperCase();
  const dateLine = fmtDate(today, { month: 'long', day: 'numeric', year: 'numeric' });

  const subject = top ? `The Weekly Scope: ${top.headline}` : `The Weekly Scope · ${dateLine}`;
  const preheader = [releases.length && `${releases.length} comebacks this week`, shows.length && `${shows.length} PH shows coming up`, 'and the stories fans are talking about'].filter(Boolean).join(', ');

  let rows = '';
  rows += block(`<p style="margin:0;font:700 12px/1.4 ${FONT};letter-spacing:.12em;text-transform:uppercase;color:${MUTE};text-align:center">${issueNo ? `Issue ${issueNo} · ` : ''}${esc(dateLine)}</p>`, { pad: '0 40px 22px' });
  if (top) {
    const href = link('/article/' + (top.slug || top.id), campaign);
    if (isPhoto(top.imageUrl)) rows += heroImage(top.imageUrl, top.headline, href);
    rows += block(eyebrow('Top story · ' + (top.category || 'Hallyu news').toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase()))
      + `<h1 style="margin:0 0 12px;font:800 28px/1.15 ${FONT};color:${INK}"><a href="${esc(href)}" style="color:${INK};text-decoration:none">${esc(top.headline)}</a></h1>`
      + p(esc(top.dek || ''))
      + button('Read the story', href));
  }
  if (releases.length) {
    rows += block(sectionHead('컴백', 'Comeback watch', { text: 'Full calendar', href: link('/comebacks', campaign) })
      + releases.map(r => dateRow({ day: day(r.date), mon: mon(r.date), title: `${r.artist} · ${r.title}`, sub: r.type, href: link('/album/' + r.id, campaign), tag: String(r.date).slice(0, 10) <= today ? { text: 'Out now', color: PINK } : null })).join(''), { pad: '8px 40px 30px' });
  }
  if (shows.length) {
    rows += `<tr><td class="pad" style="padding:30px 40px;background:${NAVY}">
<span style="display:block;font:700 12px/1.2 ${FONT};color:${PINK};margin:0 0 6px">콘서트</span>
<span style="display:block;font:800 22px/1.15 ${FONT};color:#ffffff;padding-bottom:10px;border-bottom:2px solid #ffffff">Concert radar PH</span>
${shows.map(s => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="62" valign="top" style="padding:16px 0;border-bottom:1px solid rgba(255,255,255,.18)"><span style="display:block;font:800 26px/1 ${FONT};color:${PINK}">${esc(day(s.date))}</span><span style="display:block;font:800 10px/1.4 ${FONT};letter-spacing:.12em;color:rgba(255,255,255,.7);margin-top:4px">${esc(mon(s.date))}</span></td>
<td valign="top" style="padding:16px 0;border-bottom:1px solid rgba(255,255,255,.18)"><a href="${esc(link('/concert/' + s.id, campaign))}" style="font:800 16px/1.3 ${FONT};color:#ffffff;text-decoration:none">${esc(s.artist)}</a>
<span style="display:block;font:400 14px/1.5 ${FONT};color:rgba(255,255,255,.75);margin-top:4px">${esc([s.venue, s.city].filter(Boolean).join(', '))}</span>
<span style="display:inline-block;margin-top:8px;padding:4px 7px;border:1px solid ${/sold/i.test(s.status || '') ? 'rgba(255,255,255,.5)' : PINK};font:800 10px/1 ${FONT};letter-spacing:.1em;text-transform:uppercase;color:${/sold/i.test(s.status || '') ? 'rgba(255,255,255,.7)' : '#ffffff'};background:${/sold/i.test(s.status || '') ? 'transparent' : PINK}">${esc(s.status || 'Announced')}</span></td></tr></table>`).join('')}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0"><tr><td bgcolor="#ffffff" style="background:#ffffff"><a href="${esc(link('/concerts', campaign))}" style="display:inline-block;padding:14px 22px;font:700 14px/1 ${FONT};color:${NAVY};text-decoration:none">Every show and ticket link &rarr;</a></td></tr></table>
</td></tr>`;
  }
  if (stories.length) {
    rows += block(sectionHead('뉴스', 'Also this week', { text: 'All news', href: link('/latest', campaign) })
      + stories.map((s, i) => storyRow(i + 1, { title: s.headline, dek: s.dek, kicker: (s.category || '').toLowerCase(), href: link('/article/' + (s.slug || s.id), campaign) })).join(''), { pad: '30px 40px 26px' });
  }
  if (guide) {
    rows += block(callout(`<span style="display:block;font:800 11px/1.2 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${PINK};margin-bottom:6px">Fan guide</span><a href="${esc(link('/article/' + (guide.slug || guide.id), campaign))}" style="font:800 17px/1.3 ${FONT};color:${INK};text-decoration:none">${esc(guide.headline)}</a><span style="display:block;margin-top:5px">${esc(guide.dek || '')}</span>`), { pad: '0 40px 14px' });
  }
  rows += block(p(`Got a tip, a correction or a bias to brag about? Just hit reply.`, { margin: '0 0 6px' }) + signoff(), { pad: '10px 40px 34px' });

  return { subject: subject.length > 90 ? subject.slice(0, 87).replace(/\s+\S*$/, '') + '…' : subject, preheader, html: layout({ title: subject, preheader, campaign, rows }) };
}
