"""Build compact geo datasets for the engine from Natural Earth (public domain).
Usage: python3 data/prep.py <natural-earth-geojson-dir> <out-dir>
Produces world.json (10m, simplified, for 3D maps), globe.json (50m, for globes), places.json (gazetteer)."""
import json, sys, numpy as np
SRC, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2].rstrip('/') + '/'

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
def codes(p):
    out = []
    for k in ('ADM0_A3', 'ISO_A3', 'ISO_A3_EH', 'SOV_A3', 'GU_A3'):
        v = p.get(k)
        if v and v != '-99' and v not in out: out.append(v)
    return out

# world (10m) for 3D maps
g10 = json.load(open(SRC + 'ne_10m_admin_0_countries.geojson'))
world, nv = [], 0
for f in g10['features']:
    p = f['properties']; rings = []
    for poly in polys(f['geometry']):
        for r in poly:
            s = rdp(r, 0.015)
            if len(s) < 4 or area(s) < 0.003: continue
            rings.append(np.round(s, 3).tolist()); nv += len(s)
    if rings: world.append({'iso': p['ADM0_A3'], 'codes': codes(p), 'name': p.get('NAME_EN') or p.get('NAME'), 'rings': rings})
json.dump(world, open(OUT + 'world.json', 'w'), separators=(',', ':'))

# globe (50m)
g50 = json.load(open(SRC + 'ne_50m_admin_0_countries.geojson'))
feats = []
for f in g50['features']:
    p = f['properties']; out = []
    for poly in polys(f['geometry']):
        rings = [np.round(s, 3).tolist() for s in (rdp(r, 0.05) for r in poly) if len(s) >= 4 and area(s) > 0.02]
        if rings: out.append(rings)
    if out: feats.append({'type': 'Feature', 'properties': {'iso': p['ADM0_A3'], 'codes': codes(p)}, 'geometry': {'type': 'MultiPolygon', 'coordinates': out}})
json.dump({'type': 'FeatureCollection', 'features': feats}, open(OUT + 'globe.json', 'w'), separators=(',', ':'))

# gazetteer: capitals + big cities + hand-picked geopolitical places
pp = json.load(open(SRC + 'ne_10m_populated_places_simple.geojson'))
places = {}
for f in pp['features']:
    p = f['properties']; cap = 'capital' in (p.get('featurecla') or '').lower(); big = (p.get('pop_max') or 0) >= 1_000_000
    if not (cap or big): continue
    key = (p.get('nameascii') or p['name']).lower()
    if key in places and not cap: continue
    places[key] = {'name': p['name'], 'lon': round(p['longitude'], 3), 'lat': round(p['latitude'], 3), 'iso': p.get('adm0_a3'), 'capital': cap}
EXTRA = {
 'strait of hormuz': (56.45, 26.55), 'bab el-mandeb': (43.33, 12.62), 'bab al-mandab': (43.33, 12.62), 'suez canal': (32.35, 30.6),
 'strait of malacca': (101.0, 2.6), 'taiwan strait': (119.6, 24.3), 'bosporus': (29.05, 41.12), 'strait of gibraltar': (-5.6, 35.95),
 'panama canal': (-79.7, 9.1), 'kerch strait': (36.55, 45.3), 'oresund': (12.7, 55.9), 'strait of dover': (1.45, 51.0),
 'red sea': (38.5, 20.5), 'persian gulf': (51.0, 27.3), 'gulf of aden': (48.0, 12.6), 'gulf of oman': (58.5, 24.5), 'black sea': (34.0, 43.3),
 'south china sea': (114.0, 13.0), 'east china sea': (125.5, 29.5), 'baltic sea': (19.5, 57.5), 'mediterranean sea': (18.0, 34.5),
 'arabian sea': (63.0, 16.0), 'spratly islands': (114.3, 10.0), 'paracel islands': (112.0, 16.5), 'gaza': (34.4, 31.45), 'west bank': (35.25, 31.95),
 'golan heights': (35.8, 33.0), 'crimea': (34.1, 45.3), 'donbas': (38.0, 48.0), 'kashmir': (75.5, 34.3), 'nagorno-karabakh': (46.7, 39.8),
 'sahel': (2.0, 15.0), 'kaliningrad': (20.5, 54.7), 'zaporizhzhia npp': (34.59, 47.51), 'abqaiq': (49.68, 25.94), 'ras tanura': (50.16, 26.64),
 'yanbu': (38.06, 24.09), 'kharg island': (50.32, 29.24), 'chabahar': (60.64, 25.29), 'gwadar': (62.33, 25.13), 'djibouti': (43.14, 11.59),
 'sevastopol': (33.52, 44.6), 'odesa': (30.73, 46.48), 'hodeidah': (42.95, 14.8), 'aden': (45.03, 12.79), 'jizan': (42.57, 16.89),
}
for k, (lo, la) in EXTRA.items(): places[k] = {'name': k.title(), 'lon': lo, 'lat': la, 'iso': None, 'capital': False}
json.dump(places, open(OUT + 'places.json', 'w'), separators=(',', ':'))
print(f'world: {len(world)} countries, {nv} vertices | globe: {len(feats)} | places: {len(places)}')
