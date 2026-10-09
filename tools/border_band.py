"""Band polygon along the border of country A with country B, extending `km` into A (for 'up to N km inside' visuals).
Usage: python3 tools/border_band.py <A iso> <B iso> <km> [north|south|east|west]  -> JSON poly (clip it with A in a 'zone' layer)"""
import json, sys, numpy as np
A, B, km = sys.argv[1], sys.argv[2], float(sys.argv[3]); side = sys.argv[4] if len(sys.argv) > 4 else 'south'
W = {c['iso']: c for c in json.load(open('data/world.json'))}
ra = max(W[A]['rings'], key=len); rb = np.array([p for r in W[B]['rings'] for p in r])
pts = [p for p in ra if np.min(np.hypot(rb[:, 0] - p[0], rb[:, 1] - p[1])) < 0.04]
# order along A's ring, then cut at the largest gap so the line is contiguous
idx = [i for i, p in enumerate(ra) if p in pts]
if not idx: sys.exit('no shared border found')
gaps = [(idx[(k + 1) % len(idx)] - idx[k]) % len(ra) for k in range(len(idx))]; s = (int(np.argmax(gaps)) + 1) % len(idx)
line = [ra[idx[(s + k) % len(idx)]] for k in range(len(idx))]
d = km / 111.0; v = {'south': (0, -1), 'north': (0, 1), 'east': (1, 0), 'west': (-1, 0)}[side]
inner = [[round(p[0] + v[0] * d, 3), round(p[1] + v[1] * d, 3)] for p in line]
outer = [[round(p[0] - v[0] * 0.5, 3), round(p[1] - v[1] * 0.5, 3)] for p in line]
print(json.dumps(outer + inner[::-1]))
print(f'# {len(line)} border points, from {line[0]} to {line[-1]}', file=sys.stderr)
