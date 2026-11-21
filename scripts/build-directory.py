"""Build the full K-Profiles directory from a Kprofiles crawl.

Inputs (in the scratch folder passed as argv[1]):
  queue.json    [{url, name, src}]  every profile URL from the Kprofiles lists
  facts.json    {url: {...}}        facts parsed from each profile page
  wiki.json     {url: {title, file, thumb, w, h}}  free Wikipedia lead images
  credits.json  {file: {a, l, lu}}  Commons author and license per image
Plus data/profiles.json (the hand-picked featured profiles, which keep their
own photos and details) and data/directory/featured-map.json (featured id ->
Kprofiles URL).

Outputs: data/directory/index.json and data/directory/<category>.json
"""
import json, re, sys, unicodedata, os, html

S = sys.argv[1]
load = lambda n: json.load(open(os.path.join(S, n)))
queue, facts, wiki = load('queue.json'), load('facts.json'), load('wiki.json')
credits = load('credits.json') if os.path.exists(os.path.join(S, 'credits.json')) else {}
featured = json.load(open('data/profiles.json'))['items']
fmap = json.load(open('data/directory/featured-map.json'))  # featured id -> kprofiles url

HANG = re.compile('[가-힣]')
CAT = {'girl-groups': 'girl-groups', 'girl-groups-disbanded': 'girl-groups', 'boy-groups': 'boy-groups',
       'boy-groups-disbanded': 'boy-groups', 'co-ed': 'co-ed', 'soloists-f': 'soloists', 'soloists-m': 'soloists',
       'k-actors': 'k-actors'}

def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:64]

def clean_name(n):
    n = html.unescape(n)
    n = re.sub(r'</?[a-z][^>]*>?', '', n, flags=re.I)
    n = re.sub(r'\s+(Members?\s+)?Profile.*$', '', n, flags=re.I)
    n = re.sub(r'\s*\((?:formerly|prev(?:iously)?\.?|ex-)[^)]*\)\s*$', '', n, flags=re.I)
    return n.strip(' -–')

def fandom(s):
    if not s or s.strip().upper() in ('N/A', 'NONE', 'TBA', '-'): return None
    s = re.split(r',\s*which|\s+\(meaning|\s+meaning\b', s)[0].strip()
    base = s.split('(')[0].strip()
    m = re.search(r'\(([^)]*)\)', s); p = m.group(1) if m else None
    if not base: return None
    if p and (HANG.search(p) or (len(p) <= 12 and 'former' not in p.lower())): return f'{base} ({p})'[:60]
    return base[:60]

def clean_bn(b):
    if not b: return None
    return re.split(r'\s+but\s+|\s*/\s*', b)[0].strip()[:60] or None

def height(h):
    if not h: return None
    h = re.split(r'\s*\(', h)[0].strip()
    m = re.match(r'^(\d{3}(?:\.\d)?)\s*cm', h)
    return f'{m.group(1)} cm' if m else None

def kp_id(url):
    s = url.rstrip('/').rsplit('/', 1)[-1]
    s = re.sub(r'-(members-)?(profile|facts)(-and-facts|-facts|-profile)?.*$', '', s)
    return s or url.rstrip('/').rsplit('/', 1)[-1]

featured_urls = {u: fid for fid, u in fmap.items()}
index, details, used = [], {c: {} for c in set(CAT.values())}, set()

# Featured profiles first, ranked by their order in profiles.json.
for rank, p in enumerate(featured, 1):
    d = p.get('details', {})
    cat = p['category']
    entry = {'i': p['id'], 'n': p['name'], 'c': cat, 'f': rank,
             'b': slug(p['name']), 'kp': d.get('kprofiles')}
    if d.get('koreanName'): entry['k'] = d['koreanName']
    if p.get('imageUrl'):
        entry['img'] = {'u': p['imageUrl'], 'w': p.get('width'), 'h': p.get('height'),
                        'cr': {'a': p.get('photographer'), 'l': p.get('license'), 'lu': p.get('licenseUrl'),
                               's': p.get('sourceUrl'), 'note': p.get('imageNote')}}
    mp = d.get('memberProfiles') or [{'name': m} for m in d.get('members', [])]
    if mp: entry['a'] = ' '.join(m['name'] for m in mp)
    det = {k: d[k] for k in ('koreanName', 'birthName', 'born', 'debutDate', 'debutYear', 'group', 'height',
                             'fandom', 'agency', 'labels', 'wikipedia') if d.get(k)}
    if mp: det['members'] = [{k2: v for k2, v in {'n': m.get('name'), 'b': m.get('birthName'), 'p': m.get('positions'),
                                                    'd': m.get('born'), 'c': m.get('nationality')}.items() if v} for m in mp]
    if entry.get('kp'): det['kp'] = entry.pop('kp')
    else: entry.pop('kp', None)
    if entry['b'] == entry['i']: entry.pop('b')
    details[cat][p['id']] = det
    index.append({k: v for k, v in entry.items() if v})
    used.add(p['id'])

skipped = 0
key = lambda c, n: (c, re.sub(r'[^a-z0-9]', '', slug(n)))
seen_names = {key(p['category'], p['name']) for p in featured}
for q in queue:
    url = q['url']
    if url in featured_urls: continue
    f = facts.get(url) or {}
    if f.get('err'): skipped += 1; continue
    cat = CAT[q['src']]
    name = clean_name(q['name'])
    if not name or re.search(r'Collaboration Stage|Special Stage', name, re.I): continue
    if key(cat, name) in seen_names: continue
    seen_names.add(key(cat, name))
    pid = kp_id(url)
    if pid in used: pid = (pid + '-' + cat)[:64]
    if pid in used: continue
    used.add(pid)
    entry = {'i': pid, 'n': name, 'c': cat, 'b': slug(pid) or slug(name), 'kp': url}
    if q['src'].endswith('disbanded'): entry['x'] = 1
    if f.get('koreanName'): entry['k'] = f['koreanName']
    w = wiki.get(url)
    # A redirect to some other page (a member to their group, a unit to its
    # main group) would show the wrong people, so the title must match the name.
    if w and w.get('title'):
        a, t = slug(name).replace('-', ''), slug(re.sub(r'\s*\(.*\)$', '', w['title'])).replace('-', '')
        if not (a and t and (a in t or t in a)): w = None
    if w and w.get('thumb'):
        cr = credits.get(w.get('file') or '', {})
        entry['img'] = {'u': w['thumb'], 'w': w.get('w'), 'h': w.get('h'),
                        'cr': {'a': cr.get('a'), 'l': cr.get('l'), 'lu': cr.get('lu'),
                               's': 'https://commons.wikimedia.org/wiki/File:' + (w.get('file') or '')}}
    det = {}
    if f.get('koreanName'): det['koreanName'] = f['koreanName']
    if f.get('debutDate'): det['debutDate'] = f['debutDate']
    if f.get('agency') and len(f['agency']) < 45: det['agency'] = f['agency']
    fd = fandom(f.get('fandom'))
    if fd: det['fandom'] = fd
    if w and w.get('title'): det['wikipedia'] = 'https://en.wikipedia.org/wiki/' + w['title'].replace(' ', '_')
    if f.get('members'):
        mem = [{k: v for k, v in {'n': m.get('n'), 'b': clean_bn(m.get('b')), 'p': m.get('p'), 'd': m.get('d'),
                                   'c': m.get('c') if m.get('c') and not re.match(r'^(south )?korean$', m['c'], re.I) else None}.items() if v}
               for m in f['members'] if m.get('n')]
        if mem:
            det['members'] = mem
            entry['a'] = ' '.join(m['n'] for m in mem)
    else:
        for k_src, k_dst in (('born', 'born'), ('positions', 'positions')):
            if f.get(k_src): det[k_dst] = f[k_src]
        bn = clean_bn(f.get('birthName'))
        if bn and slug(bn.split('(')[0]) != slug(name): det['birthName'] = bn
        h = height(f.get('height'))
        if h: det['height'] = h
        if f.get('nationality') and not re.match(r'^(south )?korean$', f['nationality'], re.I): det['nationality'] = f['nationality'][:40]
    det['kp'] = entry.pop('kp')
    if entry['b'] == entry['i']: entry.pop('b')
    details[cat][pid] = det
    index.append({k: v for k, v in entry.items() if v})

os.makedirs('data/directory', exist_ok=True)
json.dump({'source': 'Facts from kprofiles.com; photos from Wikimedia Commons under free licenses.',
           'items': index}, open('data/directory/index.json', 'w'), ensure_ascii=False, separators=(',', ':'))
for c, d in details.items():
    json.dump(d, open(f'data/directory/{c}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
from collections import Counter
print('profiles', len(index), 'skipped', skipped, dict(Counter(x['c'] for x in index)),
      'photos', sum(1 for x in index if x.get('img')), 'disbanded', sum(1 for x in index if x.get('x')))
