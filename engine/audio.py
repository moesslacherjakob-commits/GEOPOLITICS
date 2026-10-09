"""Sound design: tension bed (chord per section, pulse, bass) + SFX on the engine's cue list.
Usage: python3 engine/audio.py <events.json> <out.wav> [voice.wav]"""
import json, sys, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
spec = json.load(open(sys.argv[1])); OUT = sys.argv[2]; VOICE = sys.argv[3] if len(sys.argv) > 3 else None
DUR = spec['duration']; N = int(SR * DUR); ev = spec['events']; secs = spec.get('sections') or []
seed = abs(hash(json.dumps(ev[:5]))) % (2 ** 31); rng = np.random.default_rng(seed)
t_all = np.arange(N) / SR

def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def env(n, a, d):
    t = np.arange(n) / SR; e = np.exp(-t / d); ai = int(a * SR)
    if ai > 0: e[:ai] *= np.linspace(0, 1, ai)
    return e
def place(bus, sig, t, pan=0.0, g=1.0):
    i = int(t * SR)
    if i >= N or i < 0: return
    n = min(len(sig), N - i); l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    bus[0, i:i + n] += sig[:n] * l * g * 1.41; bus[1, i:i + n] += sig[:n] * r * g * 1.41
def saw(f, n, det=0.0): t = np.arange(n) / SR; return 2 * ((t * f * (1 + det)) % 1.0) - 1

music = np.zeros((2, N)); sfx = np.zeros((2, N))
# progressions (minor-key tension); pick one per story deterministically
PROGS = [
    [[73.42, 110.0, 146.83, 174.61], [58.27, 116.54, 146.83, 174.61], [73.42, 110.0, 155.56, 174.61], [49.0, 98.0, 146.83, 116.54]],
    [[65.41, 98.0, 130.81, 155.56], [51.91, 103.83, 130.81, 155.56], [58.27, 87.31, 116.54, 146.83], [49.0, 98.0, 123.47, 146.83]],
    [[55.0, 82.41, 110.0, 130.81], [43.65, 87.31, 110.0, 130.81], [49.0, 73.42, 98.0, 123.47], [41.2, 82.41, 103.83, 123.47]],
]
prog = PROGS[seed % len(PROGS)]
bounds = [0.0] + [s['a'] for s in secs] + [DUR]
bounds = sorted(set(round(b, 3) for b in bounds if 0 <= b <= DUR))
for i in range(len(bounds) - 1):
    a, b = bounds[i], bounds[i + 1]; ch = prog[i % len(prog)] if i < len(bounds) - 2 else prog[0]
    n = int((b - a + 1.2) * SR); sig = np.zeros(n)
    for k, f in enumerate(ch):
        for det in (-0.004, 0.0, 0.005): sig += saw(f, n, det) * (0.5 if k == 0 else 0.3)
    sig = lp(sig, 560, 4)
    e = np.minimum(1, np.arange(n) / (0.6 * SR)) * np.minimum(1, (n - np.arange(n)) / (1.2 * SR))
    place(music, sig * e * (0.85 + 0.15 * np.sin(2 * np.pi * 0.18 * np.arange(n) / SR)), max(0, a - 0.2), 0, 0.055)
music += np.sin(2 * np.pi * prog[0][0] / 2 * t_all) * 0.10 * np.minimum(1, t_all / 2)

BPM = 96; beat = 60 / BPM; start = secs[0]['a'] if secs else 5.0; stop = DUR - 2.0
kick_n = int(0.45 * SR); kt = np.arange(kick_n) / SR
kick = np.sin(2 * np.pi * (45 * kt + 80 * 0.04 * (1 - np.exp(-kt / 0.04)))) * env(kick_n, 0.002, 0.16)
hat = hp(rng.standard_normal(int(0.05 * SR)), 7000) * env(int(0.05 * SR), 0.0005, 0.012)
tick = bp(rng.standard_normal(int(0.03 * SR)), 2500, 5000) * env(int(0.03 * SR), 0.0003, 0.006)
t = 0.3
while t < start - 0.1: place(music, tick, t, 0.3, 0.35); t += beat / 2
t = start; i = 0
while t < stop:
    place(music, kick, t, 0, 0.55); place(music, hat, t + beat / 2, 0.25, 0.22)
    if i % 4 == 3: place(music, hat, t + beat * 0.75, -0.25, 0.14)
    t += beat; i += 1
for j in range(len(bounds) - 1):
    a, b = max(bounds[j], start), min(bounds[j + 1], stop); root = prog[j % len(prog)][0]; t = a
    while t < b: n = int(0.2 * SR); place(music, lp(saw(root, n), 300, 2) * env(n, 0.004, 0.09), t, 0, 0.16); t += beat / 2

def sweep_noise(dur, f0, f1, shape):
    n = int(dur * SR); x = rng.standard_normal(n); out = np.zeros(n); seg = 512
    for s in range(0, n, seg):
        f = f0 + (f1 - f0) * shape(s / n); out[s:s + seg] = bp(x[s:s + seg], max(80, f * .6), min(SR / 2 - 100, f * 1.4), 1)
    return out, x
def whoosh():
    out, x = sweep_noise(0.7, 300, 5300, lambda u: np.sin(np.pi * u) ** 2); n = len(out); w = np.sin(np.pi * np.arange(n) / n)
    return lp(x, 4000) * 0.15 * w ** 2 + out * w ** 3 * 0.9
def impact():
    n = int(1.8 * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * (34 * tt + 60 * 0.08 * (1 - np.exp(-tt / 0.08)))) * env(n, 0.002, 0.55) + lp(rng.standard_normal(n), 2500) * env(n, 0.001, 0.05) * 0.6
def stamp():
    n = int(0.6 * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * (70 * tt + 90 * 0.03 * (1 - np.exp(-tt / 0.03)))) * env(n, 0.001, 0.12) * 0.9 + bp(rng.standard_normal(n), 700, 3000) * env(n, 0.0005, 0.03) * 0.7
def blip():
    n = int(0.16 * SR); tt = np.arange(n) / SR; f = 1250 + 500 * np.minimum(1, tt / 0.04)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.045) * 0.5
def lock():
    out = np.zeros(int(0.5 * SR))
    for k in range(3): b = blip(); i = int(k * 0.11 * SR); out[i:i + len(b)] += b
    return out
def rise(dur=1.1):
    n = int(dur * SR); tt = np.arange(n) / SR; f = 180 + 700 * (tt / dur) ** 1.5
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.35 + bp(rng.standard_normal(n), 800, 6000) * 0.25) * np.sin(np.pi * tt / dur * 0.5) ** 2
def riser():
    out, _ = sweep_noise(1.2, 400, 7400, lambda u: u ** 2); n = len(out); return out * (np.arange(n) / n) ** 2 * 0.8
def ticks(dur=1.3, k=14):
    out = np.zeros(int((dur + .1) * SR))
    for j in range(k):
        i = int(dur * (j / k) ** 0.8 * SR); c = bp(rng.standard_normal(int(0.012 * SR)), 3000, 7000) * env(int(0.012 * SR), 0.0002, 0.003); out[i:i + len(c)] += c * 0.9
    return out
def flow(dur=1.8):
    n = int(dur * SR); tt = np.arange(n) / SR; return bp(rng.standard_normal(n), 300, 1400) * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * tt)) * np.sin(np.pi * tt / dur) * 0.5

FX = {'whoosh': whoosh, 'impact': impact, 'stamp': stamp, 'blip': blip, 'lock': lock, 'rise': rise, 'riser': riser, 'ticks': ticks, 'flow': flow}
GAIN = {'whoosh': .45, 'impact': .9, 'stamp': .75, 'blip': .35, 'lock': .35, 'rise': .4, 'riser': .4, 'ticks': .35, 'flow': .3}
LEAD = {'riser': 1.2, 'whoosh': 0.35}
for e in ev:
    if e['type'] not in FX: continue
    pan = rng.uniform(-.5, .5) if e['type'] in ('whoosh', 'blip') else 0
    place(sfx, FX[e['type']](), max(0, e['t'] - LEAD.get(e['type'], 0)), pan, GAIN[e['type']] * e.get('g', 1))
ir_n = int(1.4 * SR); ir = lp(rng.standard_normal(ir_n) * np.exp(-np.arange(ir_n) / SR / 0.35), 5000); ir /= np.sqrt((ir ** 2).sum())
for c in range(2): sfx[c] += fftconvolve(sfx[c], ir, mode='full')[:N] * 0.22
duck = np.ones(N)
for e in ev:
    if e['type'] in ('impact', 'stamp'):
        i = int(e['t'] * SR); n = max(0, min(int(0.8 * SR), N - i))
        if n: duck[i:i + n] = np.minimum(duck[i:i + n], 1 - 0.45 * np.exp(-np.arange(n) / SR / 0.25))
if VOICE:
    vsr, v = wavfile.read(VOICE); v = v.astype(np.float32) / 32768.0
    if v.ndim > 1: v = v.mean(1)
    if vsr != SR: v = np.interp(np.arange(int(len(v) * SR / vsr)) / SR, np.arange(len(v)) / vsr, v)
    vv = np.zeros(N, np.float32); vv[:min(N, len(v))] = v[:N]
    env = lp(np.abs(vv), 6, 2); env = np.clip(env / (np.percentile(env[env > 1e-4], 90) if (env > 1e-4).any() else 1), 0, 1)
    music *= 1 - 0.68 * env; sfx *= 1 - 0.35 * env
    mix = music * duck * 0.8 + sfx * 0.75
    mix /= max(np.sqrt((mix ** 2).mean()), 1e-6) / 10 ** (-24 / 20)            # bed around -24 dBFS RMS
    vrms = np.sqrt((vv[np.abs(vv) > 0.01] ** 2).mean()) if (np.abs(vv) > 0.01).any() else 1
    mix = mix + np.stack([vv, vv]) * (10 ** (-15 / 20) / vrms)                  # voice around -15 dBFS RMS
else:
    mix = music * duck * 0.8 + sfx * 0.9
mix *= np.minimum(1, t_all / 0.3) * np.minimum(1, (DUR - t_all) / 0.6)
mix = np.tanh(mix * 1.2) / np.tanh(1.2); mix /= np.max(np.abs(mix)) / 0.89
wavfile.write(OUT, SR, (mix.T * 32767).astype(np.int16))
print('audio ok', OUT, f'{DUR:.1f}s', 'with voice' if VOICE else 'no voice')
