"""Look up coordinates of towns and codes of regions for storyboards.

  python3 tools/places.py <town> [country]        e.g.  python3 tools/places.py Pokrovsk UA
      -> candidates with [lon, lat] and the region (ISO 3166-2) they lie in — use the [lon, lat] as "loc" in the story
  python3 tools/places.py --region <name> [country] e.g.  python3 tools/places.py --region Donetsk UA
      -> region codes (UA-14 …) for tint / extrude / zone / tag / loc

Data: data/gazetteer.tsv.gz (GeoNames cities ≥ 1,000 inhabitants, CC BY 4.0, via github.com/lutangar/cities.json) and
data/regions.json (Natural Earth admin-1, public domain). Spellings differ (Kostiantynivka / Kostyantynivka): the search is
fuzzy, so check the region column and pick the one in the right place. Names in data/places.json work directly as loc."""
import gzip, json, os, re, sys, unicodedata, difflib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A3 = {}  # ISO2 -> ISO3 (from the region codes)


def norm(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r"[`'’ʼ]", '', s); s = re.sub(r'[^a-z0-9]+', ' ', s).strip()
    for a, b in (('iy', 'y'), ('yi', 'i'), ('ii', 'i'), ('ia', 'ya'), ('kh', 'h'), ('zh', 'z'), ('ts', 'c')): s = s.replace(a, b)
    return s


def regions():
    rs = json.load(open(os.path.join(ROOT, 'data', 'regions.json')))
    for r in rs: A3.setdefault(r['code'].split('-')[0], r['a3'])
    return rs


def inside(pt, ring):
    x, y = pt; c = False; n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]; x2, y2 = ring[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-12) + x1: c = not c
    return c


def region_of(pt, rs, iso2=None):
    for r in rs:
        if iso2 and not r['code'].startswith(iso2 + '-'): continue
        for ring in r['rings']:
            xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
            if min(xs) <= pt[0] <= max(xs) and min(ys) <= pt[1] <= max(ys) and inside(pt, ring): return r
    return None


def towns(q, cc=None):
    qn = norm(q); rows = []
    with gzip.open(os.path.join(ROOT, 'data', 'gazetteer.tsv.gz'), 'rt', encoding='utf-8') as f:
        for line in f:
            if line.startswith('#'): continue
            name, c2, a1, lon, lat = line.rstrip('\n').split('\t')
            if cc and c2 != cc: continue
            rows.append((name, c2, float(lon), float(lat)))
    exact = [r for r in rows if norm(r[0]) == qn]
    if exact: return exact
    names = sorted({norm(r[0]) for r in rows})
    close = set(difflib.get_close_matches(qn, names, n=8, cutoff=.82))
    return [r for r in rows if norm(r[0]) in close]


def main(a):
    if not a or a[0] in ('-h', '--help'): print(__doc__); return
    rs = regions()
    cc = None
    if len(a) > 1 and re.fullmatch(r'[A-Za-z]{2,3}', a[-1]):
        cc = a[-1].upper(); a = a[:-1]
        if len(cc) == 3: cc = next((k for k, v in A3.items() if v == cc), cc)
    if a[0] == '--region':
        q = norm(' '.join(a[1:])); hits = []
        for r in rs:
            if cc and not r['code'].startswith(cc + '-'): continue
            names = [r['name']] + r.get('alt', [])
            score = max(difflib.SequenceMatcher(None, q, norm(n)).ratio() for n in names)
            if q in norm(r['name']) or any(q == norm(n) for n in names) or score > .8: hits.append((score, r))
        for s, r in sorted(hits, key=lambda x: -x[0])[:10]: print(f"{r['code']:8} {r['name']}  ({r['a3']}, {r.get('type') or 'region'})")
        if not hits: print('no region found')
        return
    q = ' '.join(a); hits = towns(q, cc)
    if not hits: print('no town found — try another spelling, or take the coordinates from the source/Wikipedia'); return
    for name, c2, lon, lat in hits[:12]:
        r = region_of((lon, lat), rs, c2)
        print(f'{name:28} {c2}  [{lon:.3f}, {lat:.3f}]   ' + (f"{r['code']} {r['name']}" if r else ''))


if __name__ == '__main__':
    main(sys.argv[1:])
