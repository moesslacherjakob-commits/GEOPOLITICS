"""Build data/regions.json (first-level subdivisions: provinces, states, oblasts) from Natural Earth (public domain).
Usage: python3 data/prep_regions.py <ne_10m_admin_1_states_provinces.geojson> data/regions.json
Source: https://github.com/nvkelso/natural-earth-vector (geojson/ne_10m_admin_1_states_provinces.geojson).
Each region: code (ISO 3166-2, e.g. UA-14), name, a3 (country), alt (other names for lookup), rings (simplified)."""
import json, sys, numpy as np
sys.path.insert(0, __file__.rsplit('/', 1)[0])
SRC, OUT = sys.argv[1], sys.argv[2]

def rdp(pts, eps):
    pts = np.asarray(pts, float)
    if len(pts) < 4: return pts
    keep = np.zeros(len(pts), bool); keep[0] = keep[-1] = True; stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1: continue
        p, q = pts[a], pts[b]; seg = pts[a + 1:b]; d = q - p; L = np.hypot(*d)
        dist = np.hypot(*(seg - p).T) if L == 0 else np.abs(d[0] * (seg[:, 1] - p[1]) - d[1] * (seg[:, 0] - p[0])) / L
        i = int(np.argmax(dist))
        if dist[i] > eps: k = a + 1 + i; keep[k] = True; stack += [(a, k), (k, b)]
    return pts[keep]
def area(r):
    x, y = np.asarray(r).T; return 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))
def polys(g): return [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']

out, nv = [], 0
for f in json.load(open(SRC))['features']:
    p = f['properties']; code = p.get('iso_3166_2') or ''
    if not code or code.endswith('~') or not f.get('geometry'): continue
    rings = []
    for poly in polys(f['geometry']):
        r = poly[0]  # outer ring only (holes are rare at this level)
        s = rdp(r, 0.015)
        if len(s) < 4 or area(s) < 0.0015: continue
        rings.append(np.round(s, 3).tolist()); nv += len(s)
    if not rings: continue
    alt = set()
    for k in ('name', 'name_en', 'gn_name', 'woe_name', 'name_local', 'abbrev', 'postal'):
        v = p.get(k)
        if v: alt.add(v)
    for v in (p.get('name_alt') or '').split('|'):
        if v.strip(): alt.add(v.strip())
    name = p.get('name_en') or p.get('name')
    out.append({'code': code, 'name': name, 'a3': p.get('adm0_a3'), 'type': p.get('type_en'), 'alt': sorted(a for a in alt if a and a != name), 'rings': rings})
json.dump(out, open(OUT, 'w'), separators=(',', ':'), ensure_ascii=False)
print(len(out), 'regions,', nv, 'vertices')
