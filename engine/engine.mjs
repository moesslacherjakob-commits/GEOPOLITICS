// geo-shorts engine: story.json -> 1080x1920 motion-graphic frames (piped to ffmpeg)
// Usage:
//   node engine/engine.mjs <story.json> check                 -> validate + print timing
//   node engine/engine.mjs <story.json> events <out.json>     -> audio cue list + word timings
//   node engine/engine.mjs <story.json> stills <outdir> t1,t2  -> PNG stills (with captions)
//   node engine/engine.mjs <story.json> render <outdir> f0 f1 tag -> two mp4 segments (clean + captions)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
// node packages: $NODE_TOOLS, else the repo's own node_modules (setup.sh), else the preinstalled /opt/npm-tools
const NM = process.env.NODE_TOOLS || [path.join(ROOT, 'node_modules/'), '/opt/npm-tools/node_modules/']
  .find(d => fs.existsSync(path.join(d, '@napi-rs/canvas'))) || '/opt/npm-tools/node_modules/';
const require = createRequire(NM);
const { createCanvas, GlobalFonts, Path2D } = require('@napi-rs/canvas');
const d3 = await import(path.join(NM, 'd3-geo/src/index.js'));
const [, , STORY_PATH, CMD, ...ARGS] = process.argv;
if (!STORY_PATH || !CMD) { console.error('usage: engine.mjs <story.json> <check|events|stills|render> ...'); process.exit(1); }
const story = JSON.parse(fs.readFileSync(STORY_PATH, 'utf8'));

// ---------------------------------------------------------------- fonts
const FONT = (f, n) => { if (fs.existsSync(f)) GlobalFonts.registerFromPath(f, n); };
FONT(path.join(ROOT, 'assets/fonts/Anton-Regular.ttf'), 'Anton');
const INTER = fs.existsSync(path.join(ROOT, 'assets/fonts/Inter-ExtraBold.otf')) ? path.join(ROOT, 'assets/fonts/') : '/usr/share/fonts/opentype/inter/';
FONT(INTER + 'InterDisplay-Black.otf', 'IBlack'); FONT(INTER + 'Inter-ExtraBold.otf', 'IXBold'); FONT(INTER + 'Inter-SemiBold.otf', 'ISemi');

// ---------------------------------------------------------------- utils
const W = 1080, H = 1920, FPS = story.fps || 30;
const DEG = Math.PI / 180;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
  inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  out: t => 1 - Math.pow(1 - t, 3), in: t => t * t * t,
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
const P = (t, a, d) => clamp((t - a) / d);
const win = (t, a, b, fin = .35, fout = .35) => Math.min(P(t, a, fin), 1 - P(t, b - fout, fout));
const hex = h => { if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]; return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; };
const rgba = (h, a = 1) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
const mix = (h1, h2, t) => { const a = hex(h1), b = hex(h2); const c = a.map((v, i) => Math.round(lerp(v, b[i], t))); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); };

// channel config: $GEO_CONFIG, else desks/<desk>/config.json for a story in desks/<desk>/stories/, else the root config.json (@GEOPOLITICS4YOU)
const CFG_PATH = process.env.GEO_CONFIG || (() => {
  const m = path.resolve(STORY_PATH).match(/^(.*[\/\\]desks[\/\\][^\/\\]+)[\/\\]stories[\/\\][^\/\\]+$/);
  return m && fs.existsSync(path.join(m[1], 'config.json')) ? path.join(m[1], 'config.json') : path.join(ROOT, 'config.json');
})();
const CFG = (() => { try { return JSON.parse(fs.readFileSync(CFG_PATH, 'utf8')); } catch { return {}; } })();
const THEME = Object.assign({
  ink: '#04080f', ocean1: '#05162e', ocean2: '#0b2d58', land: '#222f41', border: '#465d7c',
  text: '#F3F6FA', mute: '#93A4BA', accent: '#F6B73C', danger: '#FF4438', ally: '#E8A33A', oil: '#FFB020',
  info: '#5CC8FF', ok: '#2FE39A', neutral: '#7b8ba3', violet: '#A78BFA',
  heat: '#FF7A1A', cold: '#4FB3FF', storm: '#9BE7FF',
}, CFG.theme || {}, story.theme || {});
const col = c => !c ? THEME.text : c.startsWith('#') ? c : (THEME[c] || THEME.text);

// ---------------------------------------------------------------- script timing
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function intWords(n) {
  if (n < 20) return ONES[n]; if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + intWords(n % 100) : '');
  for (const [v, w] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]) if (n >= v) return intWords(Math.floor(n / v)) + ' ' + w + (n % v ? ' ' + intWords(n % v) : '');
  return '';
}
const SPELLED_OK = new Set(['nato', 'opec', 'asean', 'brics', 'nasa', 'unesco', 'isis', 'hamas', 'unicef', 'covid']);
function spoken(tok) {
  let t = tok.replace(/[“”"()]/g, '');
  const core = t.replace(/[.,!?:;]+$/, '');
  if (/\d/.test(core)) {
    let s = core.replace(/[$€£]/, m => { t += ' dollars'; return ''; });
    const pct = s.endsWith('%'); s = s.replace('%', '');
    const yr = /^(19|20)\d\d$/.test(s);
    if (yr) return intWords(+s.slice(0, 2)) + ' ' + intWords(+s.slice(2)) + (pct ? ' percent' : '');
    const [i, d] = s.replace(/,/g, '').split('.');
    let w = intWords(parseInt(i || '0', 10) || 0); if (d) w += ' point ' + d.split('').map(c => ONES[+c] || '').join(' ');
    return w + (pct ? ' percent' : '');
  }
  if (/^[A-Z]{2,5}s?$/.test(core) && !SPELLED_OK.has(core.toLowerCase())) return core.split('').map(c => c === 'W' ? 'dub ul you' : 'ee').join(' ');
  return core;
}
function syl(tok) {
  const w = spoken(tok).toLowerCase().replace(/[^a-z ]/g, ' '); let n = 0;
  for (const p of w.split(/\s+/)) { if (!p) continue; const m = p.match(/[aeiouy]+/g); let c = m ? m.length : 1; if (p.endsWith('e') && c > 1 && !p.endsWith('le')) c--; n += Math.max(1, c); }
  return Math.max(1, n);
}
const PACE = CFG.pace || {};
const MAXD = story.maxDuration || PACE.maxDuration || 78;
// optional real voice timing (from tools/tts_elevenlabs.py): {segments:[{id,a,b,words:[{text,t0,t1}]}]}
const VOICE = process.env.VOICE_TIMING && fs.existsSync(process.env.VOICE_TIMING) ? JSON.parse(fs.readFileSync(process.env.VOICE_TIMING, 'utf8')) : null;
const SEGS = story.script.map(s => ({ ...s }));
const WORDS = [];
{
  let cursor = story.start ?? PACE.start ?? 0.4; const RATE = story.rate || PACE.rate || 4.9;
  SEGS.forEach((s, si) => {
    const toks = s.text.trim().split(/\s+/);
    const items = toks.map((tk, i) => ({ tk, w: syl(tk) + .45, pause: i === toks.length - 1 ? 0 : /[.?!:]$/.test(tk) ? 1.7 : /[,;—]$/.test(tk) ? .8 : 0 }));
    const tot = items.reduce((a, b) => a + b.w + b.pause, 0);
    const vs = VOICE && VOICE.segments.find(v => v.id === s.id);
    if (vs) { s.a = vs.a; s.b = vs.b; } else { s.a = s.a ?? cursor; s.b = s.b ?? s.a + tot / (s.rate || (si === 0 && PACE.hookRate) || RATE); }
    const k = (s.b - s.a) / tot; let t = s.a; s.words = [];
    items.forEach((it, i) => {
      let t0 = t, t1 = t + it.w * k;
      if (vs && vs.words.length === toks.length) { t0 = vs.words[i].t0; t1 = vs.words[i].t1; }
      const wd = { seg: s.id, i, text: it.tk, t0: +t0.toFixed(3), t1: +t1.toFixed(3) }; t += (it.w + it.pause) * k; WORDS.push(wd); s.words.push(wd);
    });
    cursor = s.b + (s.gap ?? story.gap ?? PACE.gap ?? .6);
  });
}
const SPEECH_END = SEGS[SEGS.length - 1].b;
const DUR = Math.min(MAXD, story.duration || Math.ceil((SPEECH_END + (story.tail ?? PACE.tail ?? 2.6)) * 10) / 10);
const NF = Math.round(DUR * FPS);

// anchors: number | "seg" | "seg$" | "seg:word" | "seg:word#2" | "end" ; optional " +0.5"
const normW = s => s.toLowerCase().replace(/[“”"()]/g, '').replace(/[.,!?:;]+$/, '');
function A(x) {
  if (x === undefined || x === null) return undefined;
  if (typeof x === 'number') return x;
  const m = String(x).trim().match(/^(\S+?)(?:\s*([+-]\s*\d*\.?\d+))?$/); if (!m) throw new Error('bad anchor ' + x);
  const ref = m[1], off = m[2] ? parseFloat(m[2].replace(/\s/g, '')) : 0;
  if (/^-?\d*\.?\d+$/.test(ref)) return parseFloat(ref) + off;
  if (ref === 'end') return DUR + off;
  const mm = ref.match(/^([^:$]+)(\$)?(?::(.+?))?(?:#(\d+))?$/);
  const seg = SEGS.find(s => s.id === mm[1]); if (!seg) throw new Error(`anchor "${x}": no script segment "${mm[1]}"`);
  if (!mm[3]) return (mm[2] ? seg.b : seg.a) + off;
  const want = normW(mm[3]), occ = +(mm[4] || 0); let n = 0;
  for (const w of seg.words) if (normW(w.text) === want) { if (n === occ) return w.t0 + off; n++; }
  throw new Error(`anchor "${x}": word "${mm[3]}" (#${occ}) not found in segment "${seg.id}"`);
}

// captions
const CAP_FONT = '68px IBlack';
const meas = createCanvas(10, 10).getContext('2d');
const CHUNKS = [];
for (const s of SEGS) {
  let cur = []; const flush = () => { if (cur.length) CHUNKS.push({ seg: s, words: cur }); cur = []; };
  for (const w of s.words) {
    meas.font = CAP_FONT; const test = [...cur, w].map(x => x.text.toUpperCase()).join(' ');
    if (cur.length && (cur.length >= 3 || meas.measureText(test).width > 880)) flush();
    cur.push(w); if (/[.,?!:;]$/.test(w.text)) flush();
  }
  flush();
}
CHUNKS.forEach((c, i) => { c.t0 = c.words[0].t0 - .04; const nx = CHUNKS[i + 1]; c.t1 = nx && nx.seg === c.seg ? nx.words[0].t0 - .04 : c.seg.b + .35; });

// ---------------------------------------------------------------- geo data
const WORLD = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/world.json')));
const GLOBE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/globe.json')));
const PLACES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/places.json')));
const BY = {}, GBY = {};
for (const c of WORLD) {
  let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9, best = null, bestA = 0;
  c.rings = c.rings.map(r => {
    const a = new Float64Array(r.length * 2); let sx = 0, ar = 0;
    r.forEach((p, i) => { a[i * 2] = p[0]; a[i * 2 + 1] = p[1]; sx += p[0]; mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]); mny = Math.min(mny, p[1]); mxy = Math.max(mxy, p[1]); });
    for (let i = 0; i < r.length - 1; i++) ar += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
    a.mlon = sx / r.length; if (Math.abs(ar) > bestA) { bestA = Math.abs(ar); best = r; }
    return a;
  });
  // label point: area-weighted centroid of largest ring
  let cx = 0, cy = 0, aa = 0; for (let i = 0; i < best.length - 1; i++) { const f = best[i][0] * best[i + 1][1] - best[i + 1][0] * best[i][1]; aa += f; cx += (best[i][0] + best[i + 1][0]) * f; cy += (best[i][1] + best[i + 1][1]) * f; }
  c.center = aa ? [cx / (3 * aa), cy / (3 * aa)] : [(mnx + mxx) / 2, (mny + mxy) / 2];
  c.bb = [mnx, mny, mxx, mxy];
  for (const k of c.codes) if (!BY[k]) BY[k] = c;
}
for (const f of GLOBE.features) for (const k of f.properties.codes) if (!GBY[k]) GBY[k] = f;
function country(iso) { const c = BY[iso]; if (!c) throw new Error(`unknown country code "${iso}"`); return c; }
function loc(x) {
  if (Array.isArray(x)) return x;
  if (typeof x === 'string') {
    if (BY[x]) return BY[x].center;
    const p = PLACES[x.toLowerCase()]; if (p) return [p.lon, p.lat];
  }
  throw new Error(`unknown location ${JSON.stringify(x)} (use [lon,lat], an ISO3 code, or a place name)`);
}

// ---------------------------------------------------------------- 3D camera
let LON0 = 0, LAT0 = 0, CL = 1;
function setCenter(lon, lat) { LON0 = lon; LAT0 = lat; CL = Math.cos(LAT0 * DEG); }
const wx = lon => (lon - LON0) * CL, wy = lat => lat - LAT0;
const FOC = 1500, CX = 540, CY = 690;
function makeCam(k) {
  const T = [wx(k.lon), wy(k.lat), 0], th = k.pitch * DEG, ps = k.yaw * DEG;
  const d = [-Math.sin(th) * Math.sin(ps), -Math.sin(th) * Math.cos(ps), Math.cos(th)];
  const C = [T[0] + k.dist * d[0], T[1] + k.dist * d[1], T[2] + k.dist * d[2]];
  const f = [-d[0], -d[1], -d[2]], r = [Math.cos(ps), -Math.sin(ps), 0];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const cx = CX + (k.ox || 0), cy = CY + (k.oy || 0);
  const pw = (X, Y, Z) => { const vx = X - C[0], vy = Y - C[1], vz = Z - C[2]; const z = vx * f[0] + vy * f[1] + vz * f[2]; const s = FOC / z; return [cx + s * (vx * r[0] + vy * r[1] + vz * r[2]), cy - s * (vx * u[0] + vy * u[1] + vz * u[2]), z]; };
  return { C, k, pw, p: (lon, lat, h = 0) => pw(wx(lon), wy(lat), h), scale: (lon, lat) => FOC / pw(wx(lon), wy(lat), 0)[2] };
}
function camAt(keys, t) {
  if (t <= keys[0].t) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t <= b.t) {
      const e = E.inOut(clamp((t - a.t) / Math.max(.001, b.t - a.t))); const o = {};
      for (const k of ['lon', 'lat', 'pitch', 'yaw', 'ox', 'oy']) o[k] = lerp(a[k] || 0, b[k] || 0, e);
      o.dist = Math.exp(lerp(Math.log(a.dist), Math.log(b.dist), e)); return o;
    }
  }
  return keys[keys.length - 1];
}

// ---------------------------------------------------------------- canvas + primitives
const cv = createCanvas(W, H), ctx = cv.getContext('2d');
const grain = createCanvas(256, 256); { const g = grain.getContext('2d'); const im = g.createImageData(256, 256); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 22; } g.putImageData(im, 0, 0); }
const grainPat = ctx.createPattern(grain, 'repeat');
function SC(c) { const a = ctx.globalAlpha; if (c.startsWith('#')) return rgba(c, a); const m = c.match(/rgba\(([^,]+),([^,]+),([^,]+),([^)]+)\)/); return m ? `rgba(${m[1]},${m[2]},${m[3]},${(+m[4]) * a})` : c; }
function shadow(c, blur, oy = 0) { ctx.shadowColor = SC(c); ctx.shadowBlur = blur; ctx.shadowOffsetY = oy; }
function noShadow() { ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function text(str, x, y, font, color, align = 'left', ls = 0, base = 'alphabetic') { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base; ctx.letterSpacing = ls + 'px'; ctx.fillText(str, x, y); ctx.letterSpacing = '0px'; }
function tw(str, font, ls = 0) { ctx.font = font; ctx.letterSpacing = ls + 'px'; const w = ctx.measureText(str).width; ctx.letterSpacing = '0px'; return w; }
function fitFont(str, family, size, maxW, ls = 0) { let s = size; while (s > 20 && tw(str, `${s}px ${family}`, ls) > maxW) s -= 4; return `${s}px ${family}`; }
function glowDot(x, y, r, c, a = 1) {
  ctx.save(); ctx.globalAlpha = a; const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, rgba(c, .55)); g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r * .55, 0, 7); ctx.fill();
  ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.restore();
}
function pulse(x, y, t, t0, c, r0 = 10, r1 = 90, period = 1.4, a = 1) {
  if (t < t0) return; ctx.save();
  for (let k = 0; k < 3; k++) { if (t - t0 < k * period / 3) continue; const ph = ((t - t0) / period + k / 3) % 1; ctx.globalAlpha = a * (1 - ph) * .8; ctx.strokeStyle = c; ctx.lineWidth = 3 * (1 - ph) + 1; ctx.beginPath(); ctx.arc(x, y, lerp(r0, r1, E.out(ph)), 0, 7); ctx.stroke(); }
  ctx.restore();
}
function tag(x, y, label, c, a, o = {}) {
  if (a <= 0.003) return;
  const { dy = -70, dx = 0, sub = null, size = 30 } = o;
  ctx.save(); ctx.globalAlpha = a; const e = E.outBack(clamp(a)); const lx = x + dx, ly = y + dy * e;
  ctx.strokeStyle = rgba(c, .9); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lx, ly + (dy < 0 ? 8 : -size - 30)); ctx.stroke();
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill();
  const f = `${size}px IXBold`, w = tw(label, f, 2) + 36, hh = size + 22;
  const bx = clamp(lx - w / 2, 24, W - 24 - w), by = ly - hh;
  shadow('rgba(0,0,0,.6)', 18); rr(bx, by, w, hh, 10); ctx.fillStyle = 'rgba(6,11,20,.9)'; ctx.fill(); noShadow();
  ctx.lineWidth = 2; ctx.strokeStyle = rgba(c, .95); ctx.stroke(); ctx.fillStyle = c; ctx.fillRect(bx, by + 8, 5, hh - 16);
  text(label, bx + 20, by + hh / 2 + 1, f, THEME.text, 'left', 2, 'middle');
  if (sub) text(sub, bx + 20, by + hh + size * .85, `${Math.round(size * .72)}px ISemi`, c, 'left', 1.5);
  ctx.restore();
}
function icon(kind, x, y, s, c, lw = 4) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = lw / s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  switch (kind) {
    case 'check': ctx.moveTo(-.32, .02); ctx.lineTo(-.08, .26); ctx.lineTo(.36, -.24); ctx.stroke(); break;
    case 'x': ctx.moveTo(-.3, -.3); ctx.lineTo(.3, .3); ctx.moveTo(.3, -.3); ctx.lineTo(-.3, .3); ctx.stroke(); break;
    case 'eye': ctx.moveTo(-.42, 0); ctx.quadraticCurveTo(0, -.42, .42, 0); ctx.quadraticCurveTo(0, .42, -.42, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, .13, 0, 7); ctx.fill(); break;
    case 'jet': case 'plane': ctx.moveTo(.42, 0); ctx.lineTo(-.1, -.07); ctx.lineTo(-.28, -.36); ctx.lineTo(-.36, -.36); ctx.lineTo(-.24, -.06); ctx.lineTo(-.42, -.04); ctx.lineTo(-.46, -.16); ctx.lineTo(-.5, -.16); ctx.lineTo(-.48, 0); ctx.lineTo(-.5, .16); ctx.lineTo(-.46, .16); ctx.lineTo(-.42, .04); ctx.lineTo(-.24, .06); ctx.lineTo(-.36, .36); ctx.lineTo(-.28, .36); ctx.lineTo(-.1, .07); ctx.closePath(); ctx.fill(); break;
    case 'drop': ctx.moveTo(0, -.42); ctx.bezierCurveTo(.08, -.2, .3, .02, .3, .16); ctx.arc(0, .16, .3, 0, Math.PI); ctx.bezierCurveTo(-.3, .02, -.08, -.2, 0, -.42); ctx.fill(); break;
    case 'flame': ctx.moveTo(0, .44); ctx.bezierCurveTo(-.36, .44, -.4, .1, -.22, -.12); ctx.bezierCurveTo(-.18, .04, -.08, .06, -.06, -.02); ctx.bezierCurveTo(-.1, -.2, 0, -.34, .08, -.46); ctx.bezierCurveTo(.12, -.24, .38, -.1, .36, .16); ctx.bezierCurveTo(.34, .36, .18, .44, 0, .44); ctx.fill(); break;
    case 'flag': ctx.moveTo(-.3, .45); ctx.lineTo(-.3, -.42); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-.3, -.42); ctx.lineTo(.36, -.3); ctx.lineTo(-.3, -.06); ctx.fill(); break;
    case 'shield': ctx.moveTo(0, -.44); ctx.lineTo(.36, -.3); ctx.lineTo(.32, .1); ctx.quadraticCurveTo(.2, .36, 0, .46); ctx.quadraticCurveTo(-.2, .36, -.32, .1); ctx.lineTo(-.36, -.3); ctx.closePath(); ctx.stroke(); break;
    case 'money': ctx.arc(0, 0, .4, 0, 7); ctx.stroke(); ctx.font = 'bold .55px Anton'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 0, .03); break;
    case 'ship': ctx.moveTo(-.46, -.02); ctx.lineTo(.46, -.02); ctx.lineTo(.32, .26); ctx.lineTo(-.36, .26); ctx.closePath(); ctx.fill(); ctx.fillRect(-.2, -.3, .3, .24); break;
    case 'factory': ctx.moveTo(-.45, .4); ctx.lineTo(-.45, -.1); ctx.lineTo(-.15, .08); ctx.lineTo(-.15, -.1); ctx.lineTo(.15, .08); ctx.lineTo(.15, -.42); ctx.lineTo(.3, -.42); ctx.lineTo(.3, .08); ctx.lineTo(.45, .08); ctx.lineTo(.45, .4); ctx.closePath(); ctx.fill(); break;
    case 'people': ctx.arc(-.18, -.18, .13, 0, 7); ctx.arc(.2, -.18, .13, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(-.18, .3, .25, Math.PI, 0); ctx.arc(.2, .3, .25, Math.PI, 0); ctx.fill(); break;
    case 'chip': ctx.rect(-.28, -.28, .56, .56); ctx.stroke(); for (let i = -1; i <= 1; i++) { ctx.moveTo(i * .14, -.28); ctx.lineTo(i * .14, -.42); ctx.moveTo(i * .14, .28); ctx.lineTo(i * .14, .42); ctx.moveTo(-.28, i * .14); ctx.lineTo(-.42, i * .14); ctx.moveTo(.28, i * .14); ctx.lineTo(.42, i * .14); } ctx.stroke(); break;
    case 'barrel': ctx.roundRect(-.3, -.42, .6, .84, .1); ctx.fill(); break;
    case 'bolt': ctx.moveTo(.08, -.46); ctx.lineTo(-.26, .06); ctx.lineTo(-.02, .06); ctx.lineTo(-.1, .46); ctx.lineTo(.26, -.08); ctx.lineTo(.02, -.08); ctx.closePath(); ctx.fill(); break;
    case 'nuke': ctx.arc(0, 0, .44, 0, 7); ctx.stroke(); for (let k = 0; k < 3; k++) { const a0 = k * 2.094 - 1.57 - .5; ctx.moveTo(0, 0); ctx.arc(0, 0, .36, a0, a0 + 1); ctx.closePath(); } ctx.fill(); break;
    case 'wheat': ctx.moveTo(0, .46); ctx.lineTo(0, -.4); ctx.stroke(); for (let k = 0; k < 4; k++) { const yy = -.3 + k * .18; ctx.beginPath(); ctx.ellipse(-.1, yy, .09, .05, -.6, 0, 7); ctx.ellipse(.1, yy, .09, .05, .6, 0, 7); ctx.fill(); } break;
    case 'storm': stormShape(1); break;
    case 'thermo': ctx.roundRect(-.09, -.44, .18, .62, .09); ctx.stroke(); ctx.beginPath(); ctx.arc(0, .27, .17, 0, 7); ctx.fill(); ctx.fillRect(-.035, -.2, .07, .45); break;
    case 'rain': ctx.arc(-.14, -.12, .16, Math.PI * .9, Math.PI * 1.9); ctx.arc(.08, -.2, .2, Math.PI * 1.05, Math.PI * 1.95); ctx.arc(.24, -.06, .14, Math.PI * 1.5, Math.PI * .5); ctx.lineTo(-.14, .04); ctx.closePath(); ctx.fill(); for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(k * .16, .16); ctx.lineTo(k * .16 - .06, .38); ctx.stroke(); } break;
    default: ctx.arc(0, 0, .3, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function card(x, y, w, h, c, a, scale = 1) {
  ctx.globalAlpha = a; ctx.translate(x + w / 2, y + h / 2); ctx.scale(scale, scale); ctx.translate(-(x + w / 2), -(y + h / 2));
  shadow('rgba(0,0,0,.65)', 30, 8); rr(x, y, w, h, 18); const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, 'rgba(16,26,42,.95)'); g.addColorStop(1, 'rgba(7,12,22,.95)'); ctx.fillStyle = g; ctx.fill();
  noShadow(); ctx.lineWidth = 2; ctx.strokeStyle = rgba(c, .85); ctx.stroke();
}

// ---------------------------------------------------------------- map renderer
function ringPath(cam, ring, h, p) {
  const n = ring.length / 2; const sh = Math.round((LON0 - ring.mlon) / 360) * 360;
  for (let i = 0; i < n; i++) { const q = cam.p(ring[i * 2] + sh, ring[i * 2 + 1], h); i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]); }
  p.closePath();
}
function visible(cam, c) {
  const [a, b, x2, y2] = c.bb; let sh = Math.round((LON0 - (a + x2) / 2) / 360) * 360;
  let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
  for (const p of [[a, b], [x2, b], [a, y2], [x2, y2], [(a + x2) / 2, (b + y2) / 2]]) { const q = cam.p(p[0] + sh, p[1]); if (q[2] <= 2) return false; mnx = Math.min(mnx, q[0]); mxx = Math.max(mxx, q[0]); mny = Math.min(mny, q[1]); mxy = Math.max(mxy, q[1]); }
  return !(mxx < -200 || mnx > W + 200 || mxy < -300 || mny > H + 200);
}
function countryPath(cam, iso, h = 0) { const c = country(iso), p = new Path2D(); for (const r of c.rings) ringPath(cam, r, h, p); return p; }
function drawMapBase(cam) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#030a16'); g.addColorStop(.3, THEME.ocean1); g.addColorStop(.7, THEME.ocean2); g.addColorStop(1, '#061a36'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.strokeStyle = 'rgba(120,170,230,.09)'; ctx.lineWidth = 1.2; ctx.beginPath();
  const seg = (a, b) => { if (a[2] < 2 || b[2] < 2) return; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); };
  const l0 = Math.round(LON0 / 5) * 5;
  for (let lon = l0 - 90; lon <= l0 + 90; lon += 5) for (let lat = -75; lat < 80; lat += 2.5) seg(cam.p(lon, lat), cam.p(lon, lat + 2.5));
  for (let lat = -75; lat <= 80; lat += 5) for (let lon = l0 - 90; lon < l0 + 90; lon += 2.5) seg(cam.p(lon, lat), cam.p(lon + 2.5, lat));
  ctx.stroke(); ctx.restore();
  const top = new Path2D(), base = new Path2D();
  for (const c of WORLD) { if (!visible(cam, c)) continue; for (const r of c.rings) { ringPath(cam, r, 0, top); ringPath(cam, r, -.32, base); } }
  ctx.fillStyle = '#060b13'; ctx.fill(base);
  ctx.save(); shadow('rgba(80,140,210,.25)', 24); ctx.fillStyle = THEME.land; ctx.fill(top); ctx.restore();
  const lg = ctx.createLinearGradient(0, 200, 0, 1500); lg.addColorStop(0, 'rgba(70,95,125,0)'); lg.addColorStop(1, 'rgba(70,95,125,.3)'); ctx.fillStyle = lg; ctx.fill(top);
  ctx.strokeStyle = rgba(THEME.border, .9); ctx.lineWidth = 1.3; ctx.stroke(top);
}
function extrude(cam, iso, h, topCol, a = 1, glow = 0) {
  if (h <= .002 || a <= 0) return;
  const c = country(iso), walls = [], L = [-.55, -.83], wallCol = mix(topCol, '#000000', .42);
  for (const ring of c.rings) {
    const n = ring.length / 2, sh = Math.round((LON0 - ring.mlon) / 360) * 360; let sa = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; sa += ring[i * 2] * ring[j * 2 + 1] - ring[j * 2] * ring[i * 2 + 1]; }
    const sg = sa > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, a0 = ring[i * 2] + sh, a1 = ring[i * 2 + 1], b0 = ring[j * 2] + sh, b1 = ring[j * 2 + 1];
      const nx = sg * (wy(b1) - wy(a1)), ny = -sg * (wx(b0) - wx(a0)), mx = (wx(a0) + wx(b0)) / 2, my = (wy(a1) + wy(b1)) / 2;
      if (nx * (cam.C[0] - mx) + ny * (cam.C[1] - my) <= 0) continue;
      const Ba = cam.p(a0, a1, 0), Bb = cam.p(b0, b1, 0), Ta = cam.p(a0, a1, h), Tb = cam.p(b0, b1, h);
      const lam = (nx * L[0] + ny * L[1]) / (Math.hypot(nx, ny) || 1);
      walls.push({ q: [Ba, Bb, Tb, Ta], z: (Ba[2] + Bb[2]) / 2, s: .35 + .65 * (.5 + .5 * lam) });
    }
  }
  walls.sort((x, y) => y.z - x.z);
  ctx.save(); ctx.globalAlpha = a;
  for (const wl of walls) { ctx.beginPath(); ctx.moveTo(wl.q[0][0], wl.q[0][1]); for (let k = 1; k < 4; k++) ctx.lineTo(wl.q[k][0], wl.q[k][1]); ctx.closePath(); const cc = mix('#000000', wallCol, wl.s); ctx.fillStyle = cc; ctx.fill(); ctx.strokeStyle = cc; ctx.lineWidth = .8; ctx.stroke(); }
  const tp = countryPath(cam, iso, h), b = cam.p(c.bb[0], c.bb[3], h), d = cam.p(c.bb[2], c.bb[1], h);
  const g = ctx.createLinearGradient(b[0], b[1], d[0], d[1]); g.addColorStop(0, mix(topCol, '#ffffff', .25)); g.addColorStop(1, mix(topCol, '#000000', .25));
  if (glow) shadow(topCol, glow); ctx.fillStyle = g; ctx.fill(tp); noShadow();
  ctx.strokeStyle = mix(topCol, '#ffffff', .55); ctx.lineWidth = 1.6; ctx.stroke(tp); ctx.restore();
}
function polyline3(cam, pts, prog, c, lw, o = {}) {
  const pr = pts.map(p => cam.p(p[0], p[1], p[2] || 0));
  const L = [0]; for (let i = 1; i < pr.length; i++) L.push(L[i - 1] + Math.hypot(pr[i][0] - pr[i - 1][0], pr[i][1] - pr[i - 1][1]));
  const tgt = L[L.length - 1] * clamp(prog); ctx.beginPath(); ctx.moveTo(pr[0][0], pr[0][1]); let head = pr[0];
  for (let i = 1; i < pr.length; i++) {
    if (L[i] <= tgt) { ctx.lineTo(pr[i][0], pr[i][1]); head = pr[i]; }
    else { const k = (tgt - L[i - 1]) / (L[i] - L[i - 1]); head = [lerp(pr[i - 1][0], pr[i][0], k), lerp(pr[i - 1][1], pr[i][1], k)]; ctx.lineTo(head[0], head[1]); break; }
  }
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; if (o.dash) ctx.setLineDash(o.dash); if (o.dashOff) ctx.lineDashOffset = o.dashOff; if (o.glow) shadow(c, o.glow);
  ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.stroke(); ctx.restore(); return { head };
}
function along(pts, f) {
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot((pts[i][0] - pts[i - 1][0]) * CL, pts[i][1] - pts[i - 1][1]));
  const tg = L[L.length - 1] * clamp(f);
  for (let i = 1; i < pts.length; i++) if (L[i] >= tg) { const k = (tg - L[i - 1]) / (L[i] - L[i - 1] || 1); return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k), Math.atan2(-(pts[i][1] - pts[i - 1][1]), (pts[i][0] - pts[i - 1][0]) * CL)]; }
  const n = pts.length - 1; return [pts[n][0], pts[n][1], 0];
}
function arc3(cam, a, b, prog, c, lw, hMul = .3, alpha = 1) {
  const dist = Math.hypot((b[0] - a[0]) * CL, b[1] - a[1]), hh = dist * hMul, N = 48, n = Math.max(2, Math.ceil(N * clamp(prog)));
  const pts = []; for (let i = 0; i <= n; i++) { const tt = Math.min(prog, i / N); pts.push(cam.p(lerp(a[0], b[0], tt), lerp(a[1], b[1], tt), 4 * hh * tt * (1 - tt))); }
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 1; i < pts.length; i++) { ctx.globalAlpha = alpha * (.15 + .85 * (i / pts.length)); ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); }
  ctx.restore(); return pts[pts.length - 1];
}
function vehicle(kind, x, y, ang, s, c, a = 1) {
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(ang); shadow('rgba(0,0,0,.7)', 8);
  if (kind === 'plane') { noShadow(); icon('plane', 0, 0, s * 1.1, '#e9eef5'); }
  else {
    const L = s, Wd = s * .3; ctx.beginPath(); ctx.moveTo(-L / 2, -Wd / 2); ctx.lineTo(L * .32, -Wd / 2); ctx.quadraticCurveTo(L * .56, 0, L * .32, Wd / 2); ctx.lineTo(-L / 2, Wd / 2); ctx.closePath();
    ctx.fillStyle = '#e9eef5'; ctx.fill(); noShadow(); ctx.fillStyle = c; ctx.fillRect(-L * .42, -Wd * .18, L * .62, Wd * .36); ctx.fillStyle = '#2b3646'; ctx.fillRect(-L * .5, -Wd * .42, L * .14, Wd * .84);
  }
  ctx.restore();
}
function column(cam, lon, lat, h, c, a, label, val) {
  if (a <= 0) return; const X = wx(lon), Y = wy(lat), s = .85;
  const V = [[X - s, Y - s], [X + s, Y - s], [X + s, Y + s], [X - s, Y + s]], top = V.map(v => cam.pw(v[0], v[1], h)), bot = V.map(v => cam.pw(v[0], v[1], 0));
  ctx.save(); ctx.globalAlpha = a;
  const gp = cam.p(lon, lat), gr = ctx.createRadialGradient(gp[0], gp[1], 0, gp[0], gp[1], 120); gr.addColorStop(0, rgba(c, .55)); gr.addColorStop(1, rgba(c, 0)); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(gp[0], gp[1], 120, 60, 0, 0, 7); ctx.fill();
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, nx = V[j][1] - V[i][1], ny = -(V[j][0] - V[i][0]), mx = (V[i][0] + V[j][0]) / 2, my = (V[i][1] + V[j][1]) / 2; if (nx * (cam.C[0] - mx) + ny * (cam.C[1] - my) <= 0) continue; const q = [bot[i], bot[j], top[j], top[i]], shd = i % 2 ? .62 : .82; ctx.beginPath(); q.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); const g = ctx.createLinearGradient(0, q[2][1], 0, q[0][1]); g.addColorStop(0, mix(c, '#000000', 1 - shd)); g.addColorStop(1, mix(c, '#000000', 1 - shd * .55)); ctx.fillStyle = g; ctx.fill(); }
  ctx.beginPath(); top.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); shadow(c, 30); ctx.fillStyle = mix(c, '#ffffff', .35); ctx.fill(); noShadow();
  const tc = cam.p(lon, lat, h);
  if (label) { text(val, tc[0], tc[1] - 34, '96px Anton', THEME.text, 'center'); text(label, tc[0], tc[1] - 140, '26px IXBold', c, 'center', 3); }
  ctx.restore();
}

// ---------------------------------------------------------------- globe renderer
const grat = d3.geoGraticule10();
function drawGlobe(o) {
  const { lon, lat, R, cx = 540, cy = 800, hl = [], a = 1 } = o;
  const proj = d3.geoOrthographic().rotate([-lon, -lat]).scale(R).translate([cx, cy]).clipAngle(90).precision(.6), pth = d3.geoPath(proj, ctx);
  ctx.save(); ctx.globalAlpha = a;
  const bg = ctx.createRadialGradient(cx, cy, R * .5, cx, cy, Math.max(W, H)); bg.addColorStop(0, '#0a1a33'); bg.addColorStop(1, '#02050a'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const at = ctx.createRadialGradient(cx, cy, R * .96, cx, cy, R * 1.22); at.addColorStop(0, 'rgba(92,180,255,.55)'); at.addColorStop(.25, 'rgba(70,140,255,.18)'); at.addColorStop(1, 'rgba(40,90,200,0)'); ctx.fillStyle = at; ctx.beginPath(); ctx.arc(cx, cy, R * 1.22, 0, 7); ctx.fill();
  const og = ctx.createRadialGradient(cx - R * .35, cy - R * .45, R * .05, cx, cy, R); og.addColorStop(0, '#16407a'); og.addColorStop(.6, '#0a2347'); og.addColorStop(1, '#040f22');
  ctx.beginPath(); pth({ type: 'Sphere' }); ctx.fillStyle = og; ctx.fill();
  ctx.beginPath(); pth(grat); ctx.strokeStyle = 'rgba(150,200,255,.10)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); for (const f of GLOBE.features) pth(f); ctx.fillStyle = '#22324a'; ctx.fill(); ctx.strokeStyle = 'rgba(110,145,190,.55)'; ctx.lineWidth = 1; ctx.stroke();
  for (const h of hl) { if (h.a <= 0 || !GBY[h.iso]) continue; ctx.globalAlpha = a * h.a; ctx.beginPath(); pth(GBY[h.iso]); ctx.fillStyle = rgba(h.c, .75); ctx.fill(); shadow(h.c, 18); ctx.strokeStyle = h.c; ctx.lineWidth = 2.5; ctx.stroke(); noShadow(); ctx.globalAlpha = a; }
  const sh = ctx.createRadialGradient(cx - R * .3, cy - R * .35, R * .2, cx, cy, R * 1.02); sh.addColorStop(0, 'rgba(255,255,255,.06)'); sh.addColorStop(.7, 'rgba(0,0,0,.05)'); sh.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.beginPath(); pth({ type: 'Sphere' }); ctx.fillStyle = sh; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(140,200,255,.35)'; ctx.stroke();
  ctx.restore();
  return { proj, vis: p => d3.geoDistance(p, [lon, lat]) < Math.PI / 2 - .05 };
}

// ================================================================ scene compilation
const EVENTS = [];
const ev = (t, type, g = 1) => { if (t === undefined || isNaN(t)) return; if (EVENTS.some(e => e.type === type && Math.abs(e.t - t) < .12)) return; EVENTS.push({ t: +t.toFixed(3), type, g }); };
const SCENES = story.scenes.map((s, i) => {
  const sc = { ...s, idx: i, from: A(s.from ?? 0), to: A(s.to ?? 'end') };
  return sc;
});
function tw2(o, sc, defUntil) { return { at: A(o.at ?? sc.from), until: A(o.until ?? defUntil ?? sc.to) }; }
// pre-resolve
for (const sc of SCENES) {
  if (sc.type === 'globe' || sc.type === 'end') {
    sc.views = (sc.view || [{ at: sc.from, lon: 30, lat: 25, R: 420 }]).map(v => ({ ...v, t: A(v.at ?? sc.from) }));
    sc.hls = (sc.highlights || []).map(h => ({ ...h, ...tw2(h, sc) }));
    sc.mks = (sc.markers || []).map(m => ({ ...m, ...tw2(m, sc), ll: loc(m.loc) }));
    sc.hls.forEach(h => h.sfx !== false && sc.type === 'globe' && ev(h.at, 'blip', .6));
    sc.mks.forEach(m => sc.type === 'globe' && ev(m.at, 'blip', .7));
    if (sc.headline) { sc.headline.t = A(sc.headline.at ?? sc.from); ev(sc.headline.t, 'impact', 1); }
    if (sc.card) { sc.card.t = A(sc.card.at); sc.card.u = A(sc.card.until ?? sc.to); ev(sc.card.t, 'lock', .8); }
    if (sc.chip) { sc.chip.t = A(sc.chip.at ?? sc.from); sc.chip.u = A(sc.chip.until ?? sc.to); }
    if (sc.lines) sc.lines.forEach((l, i) => l.t = A(l[3] ?? (sc.from + .7 + i * .45)));
    if (sc.type === 'end') { ev(sc.from - .3, 'whoosh', 1); ev(sc.from + .4, 'impact', .6); }
    if (sc.exit === 'zoom') ev(sc.to - .55, 'whoosh', 1);
  } else if (sc.type === 'map') {
    const keys = sc.camera.map(k => ({ ...k, t: A(k.at) })); keys.sort((a, b) => a.t - b.t); sc.keys = keys;
    sc.center = sc.center || [keys[0].lon, keys[0].lat];
    ev(sc.from, 'impact', .5);
    for (let i = 1; i < keys.length; i++) if (Math.abs(Math.log(keys[i].dist / keys[i - 1].dist)) > .45 || Math.hypot(keys[i].lon - keys[i - 1].lon, keys[i].lat - keys[i - 1].lat) > 6) ev(keys[i - 1].t, 'whoosh', .6);
    sc.L = (sc.layers || []).map(l => {
      const o = { ...l, ...tw2(l, sc) };
      for (const k of ['from', 'to', 'loc']) if (o[k] !== undefined && k !== 'from' && k !== 'to') o[k + 'LL'] = loc(o[k]);
      if (o.kind === 'arc') { o.a = loc(l.from); o.b = loc(l.to); ev(o.at, 'blip', .6); }
      if (o.path) o.pts = l.path.map(loc);
      if (o.kind === 'track') {
        o.P = (l.points || []).map(p => ({ ...p, ll: loc(p.loc), u: p.until !== undefined ? A(p.until) : undefined }));
        o.S = (l.steps || []).map(s => ({ ...s, t: A(s.at) })).sort((a, b) => a.t - b.t);
        if (l.nameUntil !== undefined) o.nameU = A(l.nameUntil);
        (o.S.length ? o.S.map(s => s.t) : [o.at]).forEach(tt => ev(tt, 'flow', .6));
      }
      if (o.kind === 'field') { o.B = (l.blobs || []).map(b => ({ ...b, ll: loc(b.loc) })); ev(o.at, 'rise', .5); }
      if (o.kind === 'extrude') { ev(o.at, 'rise', .6); o.flat = (l.flatten || []).map(f => ({ t: A(f.at), to: f.to })); }
      if (o.kind === 'stamp' || o.kind === 'barrier') ev(o.at, 'stamp', 1);
      if (o.kind === 'column') ev(o.at, 'rise', .8);
      if (o.kind === 'route' && o.style === 'flow') ev(o.at, 'flow', .6);
      if (o.kind === 'marker') { if (o.style === 'x') ev(o.at, 'impact', .6); else ev(o.at, 'blip', .6); }
      if (o.kind === 'card') { o.rows = (l.rows || []).map(r => ({ ...r, t: A(r.at ?? l.at) })); o.rows.forEach(r => ev(r.t, 'blip', .6)); }
      if (o.kind === 'callout') { ev(o.at, 'blip', .7); if (l.reply) o.replyT = A(l.reply.at); }
      if (o.kind === 'bubble') ev(o.at, 'blip', .5);
      if (o.kind === 'movers' && l.blockAt) o.blockT = A(l.blockAt);
      if (o.kind === 'barrier' && l.stampUntil) o.stampU = A(l.stampUntil);
      if (o.kind === 'tag' || o.kind === 'marker') { if (o.label && o.label.until) o.label.u = A(o.label.until); }
      if (o.kind === 'route' && o.label) { o.label.t = A(o.label.at ?? l.at); o.label.u = A(o.label.until ?? l.until ?? sc.to); }
      return o;
    });
  } else if (sc.type === 'quote') { sc.t = A(sc.at ?? sc.from); ev(sc.t - .6, 'riser', .7); ev(sc.t, 'impact', 1); }
  else if (sc.type === 'counter') { sc.t = A(sc.at ?? sc.from); sc.done = A(sc.doneAt ?? (sc.t + 1.2)); ev(sc.t, 'ticks', .8); ev(sc.done, 'stamp', .8); ev(sc.from - .3, 'whoosh', .7); }
  else if (sc.type === 'bars') { sc.bars.forEach((b, i) => b.t = A(b.at ?? (sc.from + .3 + i * .4))); sc.bars.forEach(b => ev(b.t, 'rise', .7)); if (sc.badge) { sc.badge.t = A(sc.badge.at); ev(sc.badge.t, 'blip', .7); } ev(sc.from - .3, 'whoosh', .7); }
  else if (sc.type === 'gauge') { sc.t = A(sc.at ?? sc.from); sc.done = A(sc.doneAt ?? (sc.t + 1.4)); ev(sc.t, 'ticks', .7); ev(sc.done, 'stamp', .9); ev(sc.from - .3, 'whoosh', .7); }
  else if (sc.type === 'facts') { sc.items.forEach((it, i) => it.t = A(it.at ?? (sc.from + .3 + i * .6))); sc.items.forEach(it => ev(it.t, 'blip', .7)); ev(sc.from - .3, 'whoosh', .7); }
}
const SECTIONS = (story.sections || []).map((s, i, arr) => ({ ...s, a: A(s.from ?? s.seg), b: A(s.to ?? (arr[i + 1] ? (arr[i + 1].from ?? arr[i + 1].seg) : SEGS[SEGS.length - 1].id + '$')) }));
SECTIONS.forEach(s => ev(s.a - .45, 'whoosh', .9));
for (const e of story.sfx || []) ev(A(e.at), e.type, e.gain ?? 1);
const FLASHES = [...SECTIONS.map(s => s.a), ...SCENES.filter(s => s.type === 'end').map(s => s.from)];

// ---------------------------------------------------------------- scene renderers
function globeScene(sc, t) {
  const v = sc.views; let o = v[0];
  for (let i = 0; i < v.length - 1; i++) if (t >= v[i].t) { const e = E.inOut(clamp((t - v[i].t) / Math.max(.01, v[i + 1].t - v[i].t))); o = { lon: lerp(v[i].lon, v[i + 1].lon, e), lat: lerp(v[i].lat, v[i + 1].lat, e), R: lerp(v[i].R, v[i + 1].R, e), cy: lerp(v[i].cy ?? 800, v[i + 1].cy ?? 800, e) }; }
  if (t >= v[v.length - 1].t) o = v[v.length - 1];
  let { lon, lat, R } = o, cy = o.cy ?? 800;
  const zoom = sc.exit === 'zoom' ? E.in(P(t, sc.to - .95, .95)) : 0;
  R = lerp(R, 2000, zoom); cy = lerp(cy, CY, zoom);
  const intro = sc.idx === 0 ? E.out(P(t, sc.from, .6)) : 1;
  const hl = sc.hls.map(h => ({ iso: h.iso, c: col(h.color), a: E.out(P(t, h.at, .4)) * (1 - P(t, h.until - .3, .3)) * (h.alpha ?? .9) }));
  const G = drawGlobe({ lon, lat, R: R * lerp(.85, 1, intro), cy, a: intro, hl });
  const fade = 1 - zoom;
  for (const m of sc.mks) {
    if (t < m.at || t > m.until || !G.vis(m.ll)) continue; const q = G.proj(m.ll), c = col(m.color);
    ctx.save(); ctx.globalAlpha = fade; pulse(q[0], q[1], t, m.at, c, 8, m.big ? 130 : 80, m.big ? 1.2 : 1.6, .9); glowDot(q[0], q[1], 9, c); ctx.restore();
    if (m.label) tag(q[0], q[1], m.label, c, E.out(P(t, m.at, .35)) * fade * (1 - P(t, m.until - .3, .3)), { dy: m.dy ?? -90, dx: m.dx ?? 0, sub: m.sub });
  }
  if (sc.chip) {
    const ba = win(t, sc.chip.t, sc.chip.u, .3, .3) * fade;
    if (ba > 0) { const w = tw(sc.chip.text, '26px IXBold', 3) + 80; ctx.save(); ctx.globalAlpha = ba; rr(60, 196, w, 54, 27); ctx.fillStyle = rgba(col(sc.chip.color || 'danger'), .16); ctx.fill(); ctx.strokeStyle = rgba(col(sc.chip.color || 'danger'), .9); ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = col(sc.chip.color || 'danger'); ctx.globalAlpha = ba * (.5 + .5 * Math.sin(t * 9)); ctx.beginPath(); ctx.arc(90, 223, 8, 0, 7); ctx.fill(); ctx.globalAlpha = ba; text(sc.chip.text, 110, 224, '26px IXBold', THEME.text, 'left', 3, 'middle'); ctx.restore(); }
  }
  if (sc.headline) {
    const hd = sc.headline, hs = P(t, hd.t - .05, .28);
    if (hs > 0) {
      const a = clamp(hs * 3) * (1 - P(t, A(hd.until ?? sc.to) - .45, .3)) * fade, s = lerp(1.45, 1, E.outExpo(hs)), y0 = hd.y ?? 360;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(540, y0); ctx.scale(s, s); shadow('rgba(0,0,0,.8)', 30);
      let y = -10; hd.lines.forEach(([str, c, size = 120], i) => { const f = fitFont(str, 'Anton', size, 960); if (i) y += parseInt(f) * .92; text(str, 0, y, f, col(c), 'center'); });
      ctx.restore();
    }
  }
  if (sc.card) {
    const cd = sc.card, hb = P(t, cd.t - .1, .3);
    if (hb > 0) {
      const a = clamp(hb * 2) * (1 - P(t, cd.u - .25, .25)) * fade, y = cd.y ?? 1060, w = 600, x = 240, h = 150;
      ctx.save(); card(x, y, w, h, col(cd.color || 'danger'), a, lerp(.9, 1, E.outBack(hb)));
      icon(cd.icon || 'flame', x + 72, y + h / 2, 70, col(cd.iconColor || 'oil'));
      text(cd.kicker || '', x + 130, y + 62, fitFont(cd.kicker || '', 'IXBold', 30, 440, 3), THEME.mute, 'left', 3);
      text(cd.title || '', x + 130, y + 112, fitFont(cd.title || '', 'Anton', 44, 440, 1), THEME.text, 'left', 1);
      ctx.restore();
      if (cd.reticle !== false) { const rc = E.out(P(t, cd.t, .55)), cxr = x + 72, cyr = y + h / 2, rad = lerp(220, 62, rc); ctx.save(); ctx.globalAlpha = a; ctx.translate(cxr, cyr); ctx.rotate(lerp(1.2, 0, rc)); ctx.strokeStyle = col(cd.color || 'danger'); ctx.lineWidth = 4; for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(rad, -rad * .35); ctx.lineTo(rad, -rad); ctx.lineTo(rad * .35, -rad); ctx.stroke(); } ctx.restore(); }
    }
  }
  if (sc.type === 'end') {
    (sc.lines || []).forEach(([str, c, size = 120], i) => { const l = sc.lines[i], s = E.outExpo(P(t, l.t, .5)); if (s <= 0) return; ctx.save(); ctx.globalAlpha = clamp(s * 2); shadow('rgba(0,0,0,.85)', 30); text(str, 540, (sc.y ?? 330) + i * 130 + (1 - s) * 40, fitFont(str, 'Anton', size, 960), col(c), 'center', 1); ctx.restore(); });
    const sa = E.out(P(t, sc.from + 1.6, .6)); ctx.save(); ctx.globalAlpha = sa; (sc.sources || []).forEach((s, i) => text(s, 540, 1170 + i * 30, fitFont(s, 'ISemi', 20, 940, 1.5), THEME.mute, 'center', 1.5)); ctx.restore();
  }
}
// ---------------------------------------------------------------- climate layers: field (heat/rain/fire areas) + track (storm paths)
const PALETTES = {
  heat: ['#FFE08A', '#FFB020', '#FF7A1A', '#FF4438', '#C2187A'],
  fire: ['#FFE08A', '#FF9F1C', '#FF5A1F', '#E0201B'],
  rain: ['#9BE7FF', '#4FB3FF', '#2E6BFF', '#5B3BE8', '#A23BEA'],
  cold: ['#E6F7FF', '#9BE7FF', '#4FB3FF', '#2E6BFF'],
  drought: ['#F2D59B', '#E0A458', '#C0692F', '#8C3B1F'],
};
const palette = p => Array.isArray(p) ? p.map(col) : (PALETTES[p] || PALETTES.heat);
function palAt(pal, v) { v = clamp(v); const x = v * (pal.length - 1), i = Math.min(pal.length - 2, Math.floor(x)); return mix(pal[i], pal[i + 1], x - i); }
const CAT_COL = { TD: '#7FDBFF', TS: '#2FE39A', 1: '#FFE066', 2: '#FFB020', 3: '#FF7A1A', 4: '#FF4438', 5: '#D63AF9', EX: '#93A4BA', L: '#93A4BA' };
const catCol = c => CAT_COL[c] || CAT_COL[String(c).toUpperCase()] || '#FFE066';
function landPath(cam, clip) {
  const p = new Path2D(), list = clip === 'land' ? WORLD.filter(c => visible(cam, c)) : [].concat(clip).map(country);
  for (const c of list) for (const r of c.rings) ringPath(cam, r, 0, p);
  return p;
}
function fieldLayer(cam, o, t, a) {
  const pal = palette(o.palette || 'heat'), g = E.out(P(t, o.at, o.grow ?? 1.4));
  ctx.save(); if (o.clip) ctx.clip(landPath(cam, o.clip));
  ctx.globalCompositeOperation = o.blend || 'screen';
  for (const b of o.B) {
    const [lon, lat] = b.ll, q = cam.p(lon, lat); if (q[2] <= 2) continue;
    const r = b.r ?? 3, qx = cam.p(lon + r / CL, lat), qy = cam.p(lon, lat + r);
    const rx = Math.hypot(qx[0] - q[0], qx[1] - q[1]) * g, ry = Math.hypot(qy[0] - q[0], qy[1] - q[1]) * g; if (rx < 1 || ry < 1) continue;
    const c = palAt(pal, b.v ?? .8), sh = o.pulse === false ? 1 : .9 + .1 * Math.sin(t * 2.2 + lon * .7);
    ctx.save(); ctx.globalAlpha = a * (o.alpha ?? .9) * sh; ctx.translate(q[0], q[1]); ctx.scale(1, ry / rx);
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, rgba(c, .95)); gr.addColorStop(.5, rgba(c, .5)); gr.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, rx, 0, 7); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}
function fieldLegend(o, a) {
  const L = o.legend, pal = palette(o.palette || 'heat'), [x, y] = L.screen || [90, 1070], w = L.w ?? 420;
  ctx.save(); ctx.globalAlpha = a; rr(x - 24, y - 56, w + 48, 124, 14); ctx.fillStyle = 'rgba(6,11,20,.88)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1.5; ctx.stroke();
  text(L.title || '', x, y - 20, fitFont(L.title || '', 'IXBold', 22, w, 3), THEME.mute, 'left', 3);
  const gr = ctx.createLinearGradient(x, 0, x + w, 0); pal.forEach((c, i) => gr.addColorStop(i / (pal.length - 1), c));
  rr(x, y, w, 18, 9); ctx.fillStyle = gr; ctx.fill();
  text(L.low || '', x, y + 50, '24px IXBold', THEME.text, 'left', 1); text(L.high || '', x + w, y + 50, '24px IXBold', THEME.text, 'right', 1); ctx.restore();
}
function stormShape(s, eye = '#03070e') { // classic hurricane symbol: solid core, dark eye, two sweeping arms (draws at the current origin)
  const R = s * .2;
  for (let k = 0; k < 2; k++) {
    ctx.save(); ctx.rotate(k * Math.PI); ctx.beginPath(); ctx.moveTo(R, 0); ctx.arc(0, 0, R, 0, -Math.PI * .5, true);
    ctx.bezierCurveTo(-R * .2, -R * 2.0, R * 1.6, -R * 2.6, R * 2.4, -R * 2.0); ctx.bezierCurveTo(R * 1.4, -R * 1.9, R * 1.1, -R * .9, R, 0);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, R * 1.18, 0, 7); ctx.fill();
  ctx.fillStyle = eye; ctx.beginPath(); ctx.arc(0, 0, R * .5, 0, 7); ctx.fill();
}
function cyclone(x, y, s, c, rot, a = 1) {
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(rot); shadow(c, 22); ctx.fillStyle = c; stormShape(s); noShadow(); ctx.restore();
}
function trackLayer(cam, o, t, a, c) {
  const pts = o.P, n = pts.length; if (n < 2) return;
  const ll = pts.map(p => [p.ll[0], p.ll[1], 0]), fc = Math.min(o.forecast ?? n - 1, n - 1), now = Math.min(o.now ?? fc, n - 1);
  const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot((ll[i][0] - ll[i - 1][0]) * CL, ll[i][1] - ll[i - 1][1]));
  const tot = cum[n - 1] || 1, split = cum[fc] / tot;
  // progress: one sweep over `dur`, or step keyframes [{at, to: pointIndex, dur}] that advance the line point by point with the narration
  let pr = E.inOut(P(t, o.at, o.dur ?? 2.4)), eyeT = o.at + (o.dur ?? 2.4) * (cum[now] / tot);
  if (o.S && o.S.length) {
    let prev = 0; pr = 0;
    for (const s of o.S) { const f = cum[Math.min(s.to, n - 1)] / tot; if (t < s.t) break; pr = lerp(prev, f, E.inOut(P(t, s.t, s.dur ?? 1.6))); prev = f; }
    const se = o.S.find(s => s.to >= now); eyeT = se ? se.t + (se.dur ?? 1.6) * .85 : 1e9;
  }
  const fpr = split >= 1 ? 0 : clamp((pr - split) / (1 - split));
  // forecast cone: widens along the forecast part
  if (o.cone !== false && fc < n - 1 && fpr > 0) {
    const f = ll.slice(fc), L = [], R = [];
    f.forEach((p, i) => {
      const a0 = f[Math.max(0, i - 1)], b0 = f[Math.min(f.length - 1, i + 1)], dx = (b0[0] - a0[0]) * CL, dy = b0[1] - a0[1], len = Math.hypot(dx, dy) || 1;
      const w = (o.coneStart ?? .4) + (o.coneGrow ?? .9) * i, nx = -dy / len * w, ny = dx / len * w;
      L.push([p[0] + nx / CL, p[1] + ny]); R.push([p[0] - nx / CL, p[1] - ny]);
    });
    const poly = [...L, ...R.reverse()], cp = new Path2D(); poly.forEach((p, i) => { const q = cam.p(p[0], p[1]); i ? cp.lineTo(q[0], q[1]) : cp.moveTo(q[0], q[1]); }); cp.closePath();
    ctx.save(); ctx.globalAlpha = a * fpr * .9; ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fill(cp); ctx.setLineDash([10, 10]); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2; ctx.stroke(cp); ctx.restore();
  }
  ctx.save(); ctx.globalAlpha = a;
  polyline3(cam, ll.slice(0, fc + 1), split > 0 ? clamp(pr / split) : 1, c, o.width ?? 6, { glow: 16 });
  if (fpr > 0) polyline3(cam, ll.slice(fc), fpr, c, (o.width ?? 6) - 1, { dash: [14, 12], dashOff: -t * 30, glow: 10 });
  ctx.restore();
  pts.forEach((p, i) => {
    const f = cum[i] / tot; if (pr < f - 1e-6 || i === now) return;
    const q = cam.p(p.ll[0], p.ll[1]), cc = p.cat !== undefined ? catCol(p.cat) : c, da = a * clamp((pr - f + .015) / .015), r = p.big ? 13 : 10, la = da * (p.u !== undefined ? 1 - P(t, p.u - .3, .3) : 1);
    ctx.save(); ctx.globalAlpha = da; ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 7);
    if (i > fc) { ctx.fillStyle = 'rgba(3,7,14,.85)'; ctx.fill(); ctx.strokeStyle = cc; ctx.lineWidth = 3.5; ctx.stroke(); } else { shadow(cc, 12); ctx.fillStyle = cc; ctx.fill(); noShadow(); ctx.strokeStyle = 'rgba(3,7,14,.9)'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.restore();
    if (p.label && la > 0) { ctx.save(); ctx.globalAlpha = la; ctx.font = '22px IXBold'; ctx.letterSpacing = '1.5px'; ctx.textAlign = p.dx < 0 ? 'right' : 'left'; ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(3,7,14,.9)'; ctx.strokeText(p.label, q[0] + (p.dx ?? 20), q[1] + (p.dy ?? 8)); ctx.fillStyle = THEME.text; ctx.fillText(p.label, q[0] + (p.dx ?? 20), q[1] + (p.dy ?? 8)); ctx.letterSpacing = '0px'; ctx.restore(); }
  });
  const fn = cum[now] / tot; if (pr >= fn - 1e-6 && o.eye !== false) {
    const p = pts[now], q = cam.p(p.ll[0], p.ll[1]), cc = p.cat !== undefined ? catCol(p.cat) : c, ea = a * clamp((pr - fn + .015) / .015);
    const s = clamp(cam.scale(p.ll[0], p.ll[1]) * 1.9, 70, 130) * (o.eyeSize ?? 1), dir = p.ll[1] >= 0 ? -1 : 1;
    pulse(q[0], q[1], t, eyeT, cc, s * .3, s * 1.2, 1.6, ea * .8);
    cyclone(q[0], q[1], s, cc, dir * t * 2.6, ea);
    if (o.name) tag(q[0], q[1] - s * .35, o.name, cc, ea * E.out(P(t, eyeT, .5)) * (o.nameUntil !== undefined ? 1 - P(t, o.nameU - .3, .3) : 1), { dx: o.nameDx ?? 0, dy: o.nameDy ?? -90, sub: o.sub, size: o.nameSize ?? 30 });
  }
}
function heightOf(o, t) {
  let h = (o.height ?? .6) * E.out(P(t, o.at - .15, o.rise ?? 1.1)) * (1 - E.inOut(P(t, o.until - .8, .8)));
  let m = 1; for (const f of o.flat) m = lerp(m, f.to, E.inOut(P(t, f.t, 1.2))); return h * m;
}
function mapScene(sc, t) {
  setCenter(sc.center[0], sc.center[1]);
  const cam = makeCam(camAt(sc.keys, t));
  drawMapBase(cam);
  const H = {}; // current extrusion heights
  for (const o of sc.L) if (o.kind === 'extrude') H[o.iso] = heightOf(o, t);
  const zOf = o => o.on ? (H[o.on] || 0) + .03 : (o.z || 0);
  const fade = o => win(t, o.at, o.until, o.fin ?? .4, o.fout ?? .4);
  // pass 1: tints + zones + extrusions (sorted by depth)
  for (const o of sc.L) if (o.kind === 'tint') { const a = fade(o); if (a > 0) { const p = countryPath(cam, o.iso), c = col(o.color); ctx.save(); ctx.globalAlpha = a * (o.alpha ?? .55); ctx.fillStyle = rgba(c, o.fill ?? .3); ctx.fill(p); if (o.glow) shadow(c, o.glow); ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.stroke(p); ctx.restore(); } }
  for (const o of sc.L) if (o.kind === 'zone') {
    const a = fade(o); if (a <= 0) continue; const c = col(o.color || 'danger');
    const z = new Path2D(); o.poly.forEach((p, i) => { const q = cam.p(p[0], p[1]); i ? z.lineTo(q[0], q[1]) : z.moveTo(q[0], q[1]); }); z.closePath();
    ctx.save(); if (o.clip) ctx.clip(countryPath(cam, o.clip)); ctx.globalAlpha = a * (o.pulse === false ? .8 : .75 + .25 * Math.sin(t * 4.5)); ctx.fillStyle = rgba(c, o.fill ?? .7); ctx.fill(z);
    if (o.hatch !== false) { ctx.clip(z); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2; ctx.beginPath(); for (let k = -1400; k < 1400; k += 16) { ctx.moveTo(540 + k, 0); ctx.lineTo(540 + k + 900, 1900); } ctx.stroke(); }
    ctx.restore();
    if (o.outline !== false && o.clip) { ctx.save(); ctx.globalAlpha = a; shadow(c, 20); ctx.strokeStyle = rgba(c, .95); ctx.lineWidth = 2.5; ctx.stroke(countryPath(cam, o.clip)); ctx.restore(); }
  }
  for (const o of sc.L) if (o.kind === 'field') { const a = fade(o); if (a > 0) fieldLayer(cam, o, t, a); }
  const ex = sc.L.filter(o => o.kind === 'extrude' && H[o.iso] > .002).map(o => ({ o, z: cam.p(...country(o.iso).center)[2] })).sort((a, b) => b.z - a.z);
  for (const { o } of ex) extrude(cam, o.iso, H[o.iso], col(o.color), 1, o.glow ?? 12);
  // pass 2: routes, barriers, movers, arcs, markers, columns
  for (const o of sc.L) {
    const a = fade(o); if (a <= 0) continue; const c = col(o.color);
    if (o.kind === 'route') {
      const z = zOf(o), pts = o.pts.map(p => [p[0], p[1], z]), pr = E.inOut(P(t, o.at, o.dur ?? 1.6));
      ctx.save(); ctx.globalAlpha = a;
      if (o.style === 'flow') { polyline3(cam, pts, pr, 'rgba(20,10,0,.55)', 16); polyline3(cam, pts, pr, c, 4); const r = polyline3(cam, pts, pr, '#fff3d0', 6, { dash: [2, 22], dashOff: -t * 110, glow: 12 }); if (pr < 1) glowDot(r.head[0], r.head[1], 8, c); }
      else if (o.style === 'dash') { const r = polyline3(cam, pts, pr, c, o.width ?? 5, { dash: [16, 12], dashOff: -t * 40, glow: 14 }); if (pr < 1) glowDot(r.head[0], r.head[1], 7, c); }
      else { const r = polyline3(cam, pts, pr, c, o.width ?? 5, { glow: 14 }); if (pr < 1) glowDot(r.head[0], r.head[1], 7, c); }
      ctx.restore();
      if (o.label) { const lp = o.label.loc ? loc(o.label.loc) : along(o.pts, .5); const q = cam.p(lp[0], lp[1], z); tag(q[0], q[1], o.label.text, c, a * win(t, o.label.t, o.label.u, .4, .4), { dx: o.label.dx ?? 0, dy: o.label.dy ?? -110, sub: o.label.sub, size: o.label.size ?? 24 }); }
    } else if (o.kind === 'barrier') {
      ctx.save(); ctx.globalAlpha = a; polyline3(cam, o.pts, E.out(P(t, o.at, .9)), c || THEME.danger, 7, { dash: [18, 12], dashOff: -t * 40, glow: 22 }); ctx.restore();
      if (o.text) {
        const sa = a * win(t, o.at, o.stampU ?? o.until, .2, .4), mp = o.stampLoc ? loc(o.stampLoc) : along(o.pts, .5), q = cam.p(mp[0], mp[1]);
        const zs = clamp(cam.scale(mp[0], mp[1]) / 55, .6, 1.05), s = lerp(1.7, 1, E.outExpo(P(t, o.at, .3))) * zs;
        if (sa > 0) { ctx.save(); ctx.globalAlpha = sa; ctx.translate(q[0] + (o.sdx ?? -40) * zs, q[1] + (o.sdy ?? -80) * zs); ctx.scale(s, s); ctx.rotate(-.05); const f = fitFont(o.text, 'Anton', 56, 600, 4), w = tw(o.text, f, 4) + 60; rr(-w / 2, -42, w, 84, 12); ctx.fillStyle = 'rgba(40,5,5,.85)'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = c || THEME.danger; ctx.stroke(); text(o.text, 0, 18, f, c || THEME.danger, 'center', 4); ctx.restore(); if (o.sub) { ctx.save(); ctx.globalAlpha = sa * E.out(P(t, o.at + .4, .4)) * clamp((zs - .6) * 4); text(o.sub, q[0] + (o.sdx ?? -40), q[1] + 18, '22px IXBold', THEME.text, 'center', 2.5); ctx.restore(); } }
      }
    } else if (o.kind === 'movers') {
      const n = o.count ?? 3;
      for (let i = 0; i < n; i++) {
        let f = (o.offset ?? .08) + i * (o.spacing ?? .13) + (t - o.at) * (o.speed ?? .045);
        const stop = o.stopAt !== undefined ? o.stopAt - i * (o.stopGap ?? .05) : 2; f = Math.min(f, stop); if (f > 1 || f < 0) continue;
        const [lo, la, ang] = along(o.pts, f), q = cam.p(lo, la), q2 = cam.p(lo + Math.cos(ang) * .3, la - Math.sin(ang) * .3);
        const blocked = o.blockT !== undefined && t > o.blockT + .3 && f >= stop - .001, sz = clamp(cam.scale(lo, la) * (o.size ?? 1.3), 16, 46);
        vehicle(o.icon || 'ship', q[0], q[1], Math.atan2(q2[1] - q[1], q2[0] - q[0]), sz, blocked ? THEME.danger : c, a);
        if (blocked) { ctx.save(); ctx.globalAlpha = a * (.5 + .5 * Math.sin(t * 10)); ctx.strokeStyle = THEME.danger; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q[0], q[1], sz * .9, 0, 7); ctx.stroke(); ctx.restore(); }
      }
    } else if (o.kind === 'arc') {
      const pp = E.inOut(P(t, o.at, o.dur ?? 1.0)); if (pp <= 0) continue;
      const h = arc3(cam, o.a, o.b, pp, c, o.width ?? 5, o.height ?? .32, a);
      if (pp < 1) glowDot(h[0], h[1], 7, o.headColor ? col(o.headColor) : c, a); else if (o.landPulse !== false) pulse(h[0], h[1], t, o.at + (o.dur ?? 1), c, 4, 40, .9, a);
    } else if (o.kind === 'marker') {
      const q = cam.p(o.locLL[0], o.locLL[1], zOf(o)), mk = P(t, o.at, .35);
      ctx.save(); ctx.globalAlpha = a;
      if (o.style === 'x') { pulse(q[0], q[1], t, o.at, c, 10, 90, 1.3, .9); const s = lerp(2, 1, E.outExpo(mk)); ctx.translate(q[0], q[1]); ctx.scale(s, s); ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.fillStyle = 'rgba(40,5,5,.9)'; ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.stroke(); icon('x', 0, 0, 40, c, 6); }
      else if (o.style === 'dot') glowDot(q[0], q[1], 8, c);
      else { pulse(q[0], q[1], t, o.at, c, 8, 80, 1.4, .9); glowDot(q[0], q[1], 8, c); }
      ctx.restore();
      if (o.label) tag(q[0], q[1], o.label.text, c, a * win(t, o.at + .1, o.label.u ?? o.until, .3, .3), { dx: o.label.dx ?? 0, dy: o.label.dy ?? -80, sub: o.label.sub, size: o.label.size ?? 24 });
    } else if (o.kind === 'track') {
      trackLayer(cam, o, t, a, col(o.color || 'storm'));
    } else if (o.kind === 'column') {
      const g = E.out(P(t, o.at - .1, o.dur ?? 1.2)), v = (o.value ?? 10) * g, dec = o.decimals ?? 0;
      const h = (o.value ?? 10) * (o.scale ?? .42) * g, val = (o.display || '{v}').replace('{v}', v.toFixed(dec));
      column(cam, o.locLL[0], o.locLL[1], h, c, a * clamp(g * 4), o.label, val);
    }
  }
  // pass 3: tags + screen-space overlays
  for (const o of sc.L) {
    const a = fade(o); if (a <= 0) continue; const c = col(o.color);
    if (o.kind === 'field' && o.legend) fieldLegend(o, a);
    if (o.kind === 'tag') { const q = cam.p(o.locLL[0], o.locLL[1], zOf(o)); tag(q[0], q[1], o.text, c, a, { dx: o.dx ?? 0, dy: o.dy ?? -70, sub: o.sub, size: o.size ?? 30 }); }
    else if (o.kind === 'callout') {
      const pr = cam.p(o.locLL[0], o.locLL[1], zOf(o)), [sx, sy] = o.screen || [120, 330], c1 = [lerp(pr[0], sx, .3), Math.min(pr[1], sy) - 160];
      const bez = (p0, p1, prog, cc, dash) => { ctx.save(); ctx.strokeStyle = cc; ctx.lineWidth = 4; ctx.setLineDash(dash || []); ctx.lineDashOffset = -t * 60; shadow(cc, 14); ctx.beginPath(); const N = 40; for (let i = 0; i <= N * prog; i++) { const s = i / N, x = (1 - s) ** 2 * p0[0] + 2 * (1 - s) * s * c1[0] + s * s * p1[0], y = (1 - s) ** 2 * p0[1] + 2 * (1 - s) * s * c1[1] + s * s * p1[1]; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore(); };
      ctx.save(); ctx.globalAlpha = a; bez([pr[0], pr[1] - 10], [sx, sy + 30], E.inOut(P(t, o.at, .8)), c, [14, 12]);
      if (o.replyT !== undefined && t > o.replyT - .05) bez([sx, sy + 30], [pr[0], pr[1] - 10], E.inOut(P(t, o.replyT - .05, .5)), col(o.reply.color || 'ok'));
      const ca = clamp(E.outBack(P(t, o.at + .2, .4))), lbl = o.place || '', w = tw(lbl, '30px IXBold', 3) + 110;
      ctx.globalAlpha = a * ca; rr(sx - 60, sy - 40, w, 70, 14); ctx.fillStyle = 'rgba(6,11,20,.92)'; ctx.fill(); ctx.strokeStyle = rgba(THEME.text, .7); ctx.lineWidth = 2; ctx.stroke();
      icon(o.icon || 'flag', sx - 20, sy - 5, 44, THEME.text, 3); text(lbl, sx + 15, sy - 4, '30px IXBold', THEME.text, 'left', 3, 'middle'); ctx.restore();
    } else if (o.kind === 'stamp') {
      const gl = P(t, o.at - .05, .3); if (gl <= 0) continue; const [sx, sy] = o.screen || [540, 430], s = lerp(1.6, 1, E.outExpo(gl));
      const f = fitFont(o.text, 'Anton', o.size ?? 72, 600, 2), tw0 = tw(o.text, f, 2), w = tw0 + (o.icon ? 190 : 100);
      ctx.save(); ctx.globalAlpha = a * clamp(gl * 3); ctx.translate(sx, sy); ctx.scale(s, s); ctx.rotate(o.rotate ?? -.06);
      rr(-w / 2, -62, w, 124, 18); ctx.fillStyle = rgba(c, .14); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = c; shadow(c, 24); ctx.stroke(); noShadow();
      if (o.icon) { icon(o.icon, -w / 2 + 75, 0, 90, c, 10); text(o.text, -w / 2 + 140 + tw0 / 2, parseInt(f) * .25, f, c, 'center', 2); } else text(o.text, 0, parseInt(f) * .25, f, c, 'center', 2);
      ctx.restore();
      if (o.note) { ctx.save(); ctx.globalAlpha = a * E.out(P(t, o.at + .3, .3)); text(o.note, sx, sy + 98, '24px ISemi', THEME.mute, 'center', 3); ctx.restore(); }
    } else if (o.kind === 'bubble') {
      const [x, y, w] = o.screen || [400, 410, 600]; ctx.save(); ctx.globalAlpha = a; rr(x, y, w, 92, 16); ctx.fillStyle = rgba(c, .14); ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke();
      text(o.kicker || '', x + 26, y + 36, '24px IXBold', c, 'left', 3); text(o.text || '', x + 26, y + 74, fitFont(o.text || '', 'IXBold', 30, w - 52, 1), THEME.text, 'left', 1); ctx.restore();
    } else if (o.kind === 'card') {
      const [x, y, w] = o.screen || [60, 290, 560], h = 100 + 73 * o.rows.length;
      ctx.save(); card(x, y, w, h, c, a, lerp(.94, 1, E.outBack(P(t, o.at, .4))));
      text(o.title || '', x + 30, y + 58, '40px Anton', THEME.text, 'left', 2);
      if (o.badge) { const bw = tw(o.badge, '20px IXBold', 3) + 40, bx = x + 50 + tw(o.title || '', '40px Anton', 2); rr(bx, y + 26, bw, 40, 20); ctx.fillStyle = rgba(c, .16); ctx.fill(); text(o.badge, bx + bw / 2, y + 47, '20px IXBold', c, 'center', 3, 'middle'); }
      o.rows.forEach((r, i) => { const ra = E.out(P(t, r.t - .1, .35)); ctx.globalAlpha = a * ra; icon(r.icon || 'dot', x + 62, y + 125 + i * 73, 60, c, 5); text(r.text, x + 115 + (1 - ra) * 20, y + 137 + i * 73, fitFont(r.text, 'IXBold', 36, w - 140, 2), THEME.text, 'left', 2); });
      ctx.restore();
    } else if (o.kind === 'note') {
      ctx.save(); ctx.globalAlpha = a; text(o.text, 540, o.y ?? 1150, fitFont(o.text, 'IXBold', 28, 940, 3), THEME.text, 'center', 3); if (o.sub) text(o.sub, 540, (o.y ?? 1150) + 36, fitFont(o.sub, 'ISemi', 20, 940, 2), THEME.mute, 'center', 2); ctx.restore();
    }
  }
}
function backdrop(a) {
  ctx.save(); ctx.globalAlpha = a * .95; ctx.fillStyle = '#03070e'; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = a * .5; ctx.strokeStyle = 'rgba(120,170,230,.07)'; ctx.lineWidth = 1; ctx.beginPath(); for (let x = 0; x <= W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); } for (let y = 0; y <= H; y += 60) { ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke(); ctx.restore();
}
function fmtNum(v, o) {
  if (o.format === 'money') { const a = Math.abs(v); const s = a >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : a >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : a >= 1e3 ? Math.round(v / 1e3) + 'K' : Math.round(v) + ''; return (o.prefix ?? '$') + s + (o.suffix ?? ''); }
  return (o.prefix ?? '') + v.toFixed(o.decimals ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (o.suffix ?? '');
}
function overlayScene(sc, t) {
  const a = win(t, sc.from - .25, sc.to + .25, .4, .45); if (a <= 0) return;
  if (sc.type === 'quote') {
    ctx.save(); ctx.globalAlpha = a * .9; ctx.fillStyle = '#02050b'; ctx.fillRect(0, 0, W, H); ctx.restore();
    ctx.save(); ctx.globalAlpha = a; text('“', 120, 500, '220px Anton', rgba(col(sc.color || 'oil'), .5), 'left');
    sc.lines.forEach(([s, c], i) => { const p = E.outExpo(P(t, sc.t + .1 + i * .22, .45)); if (p <= 0) return; ctx.save(); ctx.beginPath(); ctx.rect(0, 470 + i * 150, W, 150); ctx.clip(); text(s, 540, 600 + i * 150 + (1 - p) * 150, fitFont(s, 'Anton', 150, 960, 1), col(c), 'center', 1); ctx.restore(); });
    const q = E.out(P(t, sc.t + .4, .5)); ctx.globalAlpha = a * q; ctx.fillStyle = col(sc.color || 'oil'); ctx.fillRect(540 - 60 * q, 510 + sc.lines.length * 150, 120 * q, 5);
    text(sc.by || '', 540, 570 + sc.lines.length * 150, fitFont(sc.by || '', 'IXBold', 28, 940, 3), THEME.mute, 'center', 3); ctx.restore(); return;
  }
  backdrop(a); ctx.save(); ctx.globalAlpha = a;
  if (sc.label) text(sc.label, 540, 330, fitFont(sc.label, 'IXBold', 32, 940, 4), THEME.mute, 'center', 4);
  if (sc.sublabel) text(sc.sublabel, 540, 378, fitFont(sc.sublabel, 'ISemi', 26, 940, 3), col(sc.color || 'oil'), 'center', 3);
  const c = col(sc.color || 'oil');
  if (sc.type === 'counter') {
    const fl = E.inOut(P(t, sc.t, sc.done - sc.t)), bx = 540, by = 640;
    if (sc.icon === 'barrel') {
      const body = new Path2D(); body.moveTo(bx - 112, by - 160); body.quadraticCurveTo(bx - 150, by, bx - 112, by + 160); body.ellipse(bx, by + 160, 112, 26, 0, Math.PI, 0, true); body.quadraticCurveTo(bx + 150, by, bx + 112, by - 160); body.ellipse(bx, by - 160, 112, 26, 0, 0, Math.PI, true); body.closePath();
      ctx.save(); ctx.fillStyle = rgba(c, .06); ctx.fill(body); ctx.lineWidth = 6; ctx.strokeStyle = c; ctx.stroke(body); ctx.clip(body);
      const lvl = by + 170 - 340 * fl * .92, og = ctx.createLinearGradient(0, lvl, 0, by + 170); og.addColorStop(0, mix(c, '#ffffff', .2)); og.addColorStop(1, mix(c, '#000000', .5)); ctx.fillStyle = og;
      ctx.beginPath(); ctx.moveTo(bx - 160, by + 190); for (let x = -160; x <= 160; x += 8) ctx.lineTo(bx + x, lvl + Math.sin(x * .05 + t * 6) * 8); ctx.lineTo(bx + 160, by + 190); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba(mix(c, '#ffffff', .2), .55); ctx.lineWidth = 6; ctx.beginPath(); for (const hy of [-62, 62]) { ctx.moveTo(bx - 140, by + hy); ctx.quadraticCurveTo(bx, by + hy + 26, bx + 140, by + hy); } ctx.stroke(); ctx.restore();
      ctx.lineWidth = 6; ctx.strokeStyle = c; ctx.beginPath(); ctx.ellipse(bx, by - 160, 112, 26, 0, 0, 7); ctx.stroke();
    } else if (sc.icon) {
      ctx.save(); const r = 170; ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.stroke(); ctx.strokeStyle = c; shadow(c, 20 * fl); ctx.beginPath(); ctx.arc(bx, by, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fl); ctx.stroke(); noShadow(); icon(sc.icon, bx, by, 150, c, 8); ctx.restore();
    }
    const v = lerp(sc.start ?? 0, sc.value, E.out(P(t, sc.t - .1, sc.done - sc.t + .1))), done = t >= sc.done, s = done ? lerp(1.25, 1, E.outExpo(P(t, sc.done, .3))) : 1;
    const str = fmtNum(v, sc) + (done && sc.doneSuffix ? sc.doneSuffix : '');
    ctx.save(); ctx.translate(540, 1000); ctx.scale(s, s); shadow('rgba(0,0,0,.8)', 20); text(str, 0, 60, fitFont(str, 'Anton', 190, 980), done ? c : THEME.text, 'center'); ctx.restore();
    if (sc.note) text(sc.note, 540, 1110, fitFont(sc.note, 'IXBold', 24, 940, 3), THEME.mute, 'center', 3);
    if (sc.source) text(sc.source, 540, 1148, '20px ISemi', THEME.mute, 'center', 3);
  } else if (sc.type === 'bars') {
    const baseY = 1110, maxH = 540, dx = 28, dy = -20, n = sc.bars.length, mx = Math.max(...sc.bars.map(b => b.value)), gap = n > 2 ? 40 : 150;
    const bw = Math.min(240, (780 - gap * (n - 1)) / n), x0 = 540 - (n * bw + (n - 1) * gap) / 2;
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(110, baseY); ctx.lineTo(970, baseY); ctx.stroke();
    sc.bars.forEach((b, i) => {
      const g = E.inOut(P(t, b.t, b.dur ?? 1.2)); if (g <= 0.01) return; const bc = col(b.color || (i === n - 1 ? sc.color || 'oil' : 'neutral'));
      const v = lerp(sc.from0 ?? (i ? sc.bars[0].value : 0), b.value, g), h = Math.max(4, maxH * v / mx), x = x0 + i * (bw + gap);
      const gr = ctx.createLinearGradient(0, baseY - h, 0, baseY); gr.addColorStop(0, mix(bc, '#ffffff', .15)); gr.addColorStop(1, mix(bc, '#000000', .35)); ctx.fillStyle = gr; ctx.fillRect(x, baseY - h, bw, h);
      ctx.beginPath(); ctx.moveTo(x + bw, baseY - h); ctx.lineTo(x + bw + dx, baseY - h + dy); ctx.lineTo(x + bw + dx, baseY + dy); ctx.lineTo(x + bw, baseY); ctx.closePath(); ctx.fillStyle = mix(bc, '#000000', .55); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, baseY - h); ctx.lineTo(x + dx, baseY - h + dy); ctx.lineTo(x + bw + dx, baseY - h + dy); ctx.lineTo(x + bw, baseY - h); ctx.closePath(); ctx.fillStyle = mix(bc, '#ffffff', .4); ctx.fill();
      const vs = b.display && g >= 1 ? b.display : fmtNum(v, sc); text(vs, x + bw / 2 + dx / 2, baseY - h - 40, fitFont(vs, 'Anton', 78, bw + 60), THEME.text, 'center');
      text(b.label || '', x + bw / 2, baseY + 50, fitFont(b.label || '', 'IXBold', 28, bw + 40, 3), bc, 'center', 3); if (b.sub) text(b.sub, x + bw / 2, baseY + 86, fitFont(b.sub, 'ISemi', 20, bw + 60, 2), THEME.mute, 'center', 2);
    });
    if (sc.badge) { const xb = E.outBack(P(t, sc.badge.t, .4)); if (xb > 0) { ctx.save(); ctx.translate(sc.badge.x ?? 410, sc.badge.y ?? 640); ctx.scale(xb, xb); ctx.rotate(-.08); ctx.beginPath(); ctx.arc(0, 0, 88, 0, 7); ctx.fillStyle = col(sc.badge.color || 'danger'); shadow(col(sc.badge.color || 'danger'), 30); ctx.fill(); noShadow(); text(sc.badge.text, 0, 26, fitFont(sc.badge.text, 'IBlack', 74, 150), '#fff', 'center'); ctx.restore(); } }
    if (sc.source) text(sc.source, 540, 1210, '20px ISemi', THEME.mute, 'center', 3);
  } else if (sc.type === 'gauge') {
    const gx = 540, gy = 720, R = 290, g = E.inOut(P(t, sc.t - .15, sc.done - sc.t + .2)), frac = clamp(sc.value / (sc.max ?? 100));
    ctx.lineCap = 'round'; ctx.lineWidth = 46; ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.arc(gx, gy, R, Math.PI * .75, Math.PI * 2.25); ctx.stroke();
    const gg = ctx.createLinearGradient(gx - R, gy, gx + R, gy); gg.addColorStop(0, col(sc.color2 || 'oil')); gg.addColorStop(1, col(sc.color || 'danger')); ctx.strokeStyle = gg; shadow(col(sc.color || 'danger'), 30 * g);
    if (g > 0) { ctx.beginPath(); ctx.arc(gx, gy, R, Math.PI * .75, Math.PI * .75 + Math.PI * 1.5 * frac * g); ctx.stroke(); } noShadow();
    for (let k = 0; k <= 10; k++) { const an = Math.PI * .75 + Math.PI * 1.5 * k / 10; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(gx + Math.cos(an) * (R - 50), gy + Math.sin(an) * (R - 50)); ctx.lineTo(gx + Math.cos(an) * (R - 66), gy + Math.sin(an) * (R - 66)); ctx.stroke(); }
    if (sc.icon) icon(sc.icon, gx, gy - 175, 80, col(sc.color2 || 'oil'));
    const v = sc.value * g, done = g >= 1, s = done ? lerp(1.2, 1, E.outExpo(P(t, sc.done, .3))) : 1, str = fmtNum(v, sc);
    ctx.save(); ctx.translate(gx, gy + 70); ctx.scale(s, s); text(str, 0, 0, fitFont(str, 'Anton', 180, 500), done ? col(sc.color || 'danger') : THEME.text, 'center'); ctx.restore();
    if (sc.note) text(sc.note, 540, 1080, fitFont(sc.note, 'IXBold', 26, 940, 2.5), THEME.text, 'center', 2.5);
    if (sc.source) text(sc.source, 540, 1118, '20px ISemi', THEME.mute, 'center', 3);
  } else if (sc.type === 'facts') {
    sc.items.forEach((it, i) => {
      const p = E.out(P(t, it.t, .45)); if (p <= 0) return; const y = 470 + i * 200, ic = col(it.color || sc.color || 'oil');
      ctx.save(); ctx.globalAlpha = a * p; ctx.translate((1 - p) * 60, 0); card(90, y, 900, 160, ic, a * p);
      ctx.beginPath(); ctx.arc(180, y + 80, 52, 0, 7); ctx.fillStyle = rgba(ic, .16); ctx.fill(); icon(it.icon || 'dot', 180, y + 80, 60, ic, 5);
      text(it.big || '', 260, y + 92, fitFont(it.big || '', 'Anton', 72, 700), THEME.text, 'left', 1); if (it.text) text(it.text, 262, y + 130, fitFont(it.text, 'ISemi', 24, 690, 1.5), THEME.mute, 'left', 1.5);
      ctx.restore();
    });
    if (sc.source) text(sc.source, 540, 1150, '20px ISemi', THEME.mute, 'center', 3);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- chrome
function sectionHeader(t) {
  if (!SECTIONS.length) return;
  const vis = win(t, SECTIONS[0].a - .1, SECTIONS[SECTIONS.length - 1].b + .2, .4, .4); if (vis <= 0) return;
  ctx.save(); ctx.globalAlpha = vis; const x0 = 60, x1 = 1020, gap = 14, n = SECTIONS.length, bw = (x1 - x0 - gap * (n - 1)) / n, y = 168;
  SECTIONS.forEach((s, i) => { const x = x0 + i * (bw + gap); rr(x, y, bw, 7, 4); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill(); const p = P(t, s.a, s.b - s.a); if (p > 0) { rr(x, y, bw * p, 7, 4); ctx.fillStyle = col(s.color || 'accent'); ctx.fill(); } });
  const cur = SECTIONS.find(s => t >= s.a && t < s.b) || (t < SECTIONS[0].a ? SECTIONS[0] : SECTIONS[n - 1]), ap = E.out(P(t, cur.a, .45));
  ctx.globalAlpha = vis * ap; text(cur.n || '', 60, 238, '44px Anton', col(cur.color || 'accent'), 'left'); text(cur.name || '', 60 + 62 + (1 - ap) * 30, 236, fitFont(cur.name || '', 'IXBold', 30, 840, 4), THEME.text, 'left', 4);
  ctx.restore();
}
function captions(t) {
  const ch = CHUNKS.find(c => t >= c.t0 && t < c.t1); if (!ch) return;
  const pop = E.outBack(P(t, ch.t0, .16)), y = 1335; ctx.save(); ctx.font = CAP_FONT; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const words = ch.words.map(w => w.text.toUpperCase()), sp = 22, ws = words.map(w => ctx.measureText(w).width), tot = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
  let x = W / 2 - tot / 2; ctx.translate(W / 2, y - 24); ctx.scale(.86 + .14 * pop, .86 + .14 * pop); ctx.translate(-W / 2, -(y - 24)); ctx.globalAlpha = clamp(pop * 1.5);
  ch.words.forEach((w, i) => {
    const active = t >= w.t0 - .03 && (i === ch.words.length - 1 ? t < ch.t1 : t < ch.words[i + 1].t0 - .03), cxw = x + ws[i] / 2;
    ctx.save(); if (active) { const s = 1 + .06 * E.out(P(t, w.t0, .1)); ctx.translate(cxw, y - 24); ctx.scale(s, s); ctx.translate(-cxw, -(y - 24)); }
    ctx.lineJoin = 'round'; ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(2,4,9,.92)'; ctx.strokeText(words[i], x, y); ctx.fillStyle = active ? '#FFC93D' : '#FFFFFF'; ctx.fillText(words[i], x, y);
    ctx.restore(); x += ws[i] + sp;
  });
  ctx.restore();
}
function finishFrame() {
  const v = ctx.createRadialGradient(W / 2, H * .42, H * .28, W / 2, H * .5, H * .78); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  const tg = ctx.createLinearGradient(0, 0, 0, 330); tg.addColorStop(0, 'rgba(2,5,10,.85)'); tg.addColorStop(1, 'rgba(2,5,10,0)'); ctx.fillStyle = tg; ctx.fillRect(0, 0, W, 330);
  const bg = ctx.createLinearGradient(0, 1130, 0, H); bg.addColorStop(0, 'rgba(2,5,10,0)'); bg.addColorStop(.35, 'rgba(2,5,10,.72)'); bg.addColorStop(1, 'rgba(2,5,10,.92)'); ctx.fillStyle = bg; ctx.fillRect(0, 1130, W, H - 1130);
  ctx.save(); ctx.globalAlpha = .55; ctx.translate(Math.random() * 256, Math.random() * 256); ctx.fillStyle = grainPat; ctx.fillRect(-256, -256, W + 512, H + 512); ctx.restore();
}
function shakeAt(t) { let s = 0; for (const e of EVENTS) if (e.type === 'impact' || e.type === 'stamp') { const d = t - e.t; if (d >= 0 && d < .35) s = Math.max(s, (1 - d / .35) * 9 * e.g); } return s; }
let THUMB = false;
function renderFrame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = THEME.ink; ctx.fillRect(0, 0, W, H);
  const sh = THUMB ? 0 : shakeAt(t); if (sh > 0) ctx.translate((Math.random() - .5) * sh, (Math.random() - .5) * sh);
  for (const sc of SCENES) {
    if (sc.type === 'globe') { if (t >= sc.from - .3 && t < sc.to + .4) globeScene(sc, t); }
    else if (sc.type === 'map') { const a = E.inOut(P(t, sc.from - .2, .5)) * (1 - P(t, sc.to - .2, .5)); if (a > 0) { ctx.save(); ctx.globalAlpha = a; mapScene(sc, t); ctx.restore(); } }
    else if (sc.type === 'end') { const a = E.out(P(t, sc.from - .35, .7)); if (a > 0) { ctx.save(); ctx.globalAlpha = a; globeScene(sc, t); ctx.restore(); } }
    else overlayScene(sc, t);
  }
  for (const ft of THUMB ? [] : FLASHES) { const d = t - ft; if (d > -.05 && d < .25) { ctx.save(); ctx.globalAlpha = (1 - Math.abs(d - .05) / .2) * .18; ctx.fillStyle = '#fff'; ctx.fillRect(-20, -20, W + 40, H + 40); ctx.restore(); } }
  ctx.setTransform(1, 0, 0, 1, 0, 0); if (!THUMB) sectionHeader(t); finishFrame();
  const fo = THUMB ? 0 : Math.max(1 - P(t, 0, .35), P(t, DUR - .45, .45)); if (fo > 0) { ctx.globalAlpha = fo; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}


// ---------------------------------------------------------------- thumbnail (9:16, key content inside the central 3:2 band)
function renderThumb(out) {
  THUMB = true;
  const th = story.thumbnail || {}, hd = SCENES.find(s => s.headline), mp = SCENES.find(s => s.type === 'map');
  const t = A(th.at ?? (mp ? mp.from + 4 : 3));
  renderFrame(t);
  const tmp = createCanvas(W, H); tmp.getContext('2d').drawImage(cv, 0, 0);
  ctx.save(); ctx.filter = 'blur(2px) saturate(1.25)'; ctx.drawImage(tmp, 0, 0); ctx.filter = 'none'; ctx.restore();
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(2,5,10,.8)'); g.addColorStop(.28, 'rgba(2,5,10,.2)'); g.addColorStop(.5, 'rgba(2,5,10,.42)'); g.addColorStop(.72, 'rgba(2,5,10,.2)'); g.addColorStop(1, 'rgba(2,5,10,.85)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const lines = th.lines || (hd ? hd.headline.lines : [[story.upload?.title || '', 'text']]);
  // fit everything into the central band (y 560..1360): kicker 70 + gap 26, lines, gap 34, brand 54
  let sizes = lines.map(([str, c, size]) => parseInt(fitFont(str, 'Anton', size ? size * 1.5 : 220, 980)));
  const lh = sz => sz * .9, gap = 6, KH = th.kicker ? 96 : 0, BH = 88, maxLines = 730 - KH - BH;
  let tot = sizes.reduce((a, b) => a + lh(b), 0) + gap * (lines.length - 1);
  if (tot > maxLines) { const k = maxLines / tot; sizes = sizes.map(z => Math.floor(z * k)); tot = sizes.reduce((a, b) => a + lh(b), 0) + gap * (lines.length - 1); }
  const block = KH + tot + BH; let y = 960 - block / 2;
  if (th.kicker) {
    const kc = col(th.kickerColor || 'danger'), f = '40px IXBold', w = tw(th.kicker, f, 4) + 70;
    rr(540 - w / 2, y, w, 70, 35); ctx.fillStyle = kc; shadow('rgba(0,0,0,.6)', 20); ctx.fill(); noShadow();
    text(th.kicker, 540, y + 36, f, '#ffffff', 'center', 4, 'middle'); y += KH;
  }
  lines.forEach(([str, c], i) => {
    const sz = sizes[i], f = `${sz}px Anton`; y += lh(sz); ctx.save(); ctx.font = f; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const base = y - sz * .1; ctx.lineWidth = sz * .1; ctx.strokeStyle = 'rgba(2,4,9,.95)'; ctx.strokeText(str, 540, base);
    shadow('rgba(0,0,0,.7)', 40); ctx.fillStyle = col(c); ctx.fillText(str, 540, base); ctx.restore(); y += gap;
  });
  const by = y + 28; ctx.save();
  const brand = story.brand || CFG.channel || '@GEOPOLITICS4YOU', bf = '30px IXBold', bw = tw(brand, bf, 5) + 64;
  rr(540 - bw / 2, by, bw, 54, 27); ctx.fillStyle = 'rgba(6,11,20,.88)'; ctx.fill(); ctx.strokeStyle = rgba(THEME.accent, .9); ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = THEME.accent; ctx.beginPath(); ctx.arc(540 - bw / 2 + 28, by + 27, 8, 0, 7); ctx.fill();
  text(brand, 540 + 10, by + 28, bf, THEME.text, 'center', 5, 'middle'); ctx.restore();
  fs.writeFileSync(out, cv.toBuffer('image/jpeg', 88));
  THUMB = false;
}

// ================================================================ CLI
if (CMD === 'check') {
  console.log(`duration ${DUR}s (${NF} frames), speech ends ${SPEECH_END.toFixed(2)}s, ${WORDS.length} words, ${(WORDS.length / (SPEECH_END - SEGS[0].a) * 60).toFixed(0)} wpm`);
  for (const s of SEGS) console.log(`  ${s.id.padEnd(8)} ${s.a.toFixed(2)} → ${s.b.toFixed(2)}  ${s.words.map(w => w.text + '@' + w.t0.toFixed(1)).join(' ')}`);
  for (const sc of SCENES) console.log(`  scene ${sc.type.padEnd(7)} ${sc.from.toFixed(2)} → ${sc.to.toFixed(2)}`);
  if (DUR >= MAXD && SPEECH_END + 1.5 > DUR) console.log('WARNING: script too long for the max duration — shorten it');
  console.log(VOICE ? 'timing: real voice' : 'timing: estimated (no voice)');
} else if (CMD === 'events') {
  const hd = SCENES.find(s => s.headline); const cover = A(story.upload?.cover ?? (hd ? hd.headline.t + .4 : 2));
  fs.writeFileSync(ARGS[0], JSON.stringify({ id: story.id, duration: DUR, frames: NF, fps: FPS, cover, events: EVENTS.sort((a, b) => a.t - b.t), sections: SECTIONS.map(s => ({ a: s.a, b: s.b })), words: WORDS }, null, 1));
  console.log('events', EVENTS.length);
} else if (CMD === 'thumb') {
  renderThumb(ARGS[0]); console.log('thumb ok', ARGS[0]);
} else if (CMD === 'stills') {
  const out = ARGS[0]; fs.mkdirSync(out, { recursive: true });
  for (const t of ARGS[1].split(',').map(Number)) { renderFrame(t); captions(t); fs.writeFileSync(path.join(out, `still_${t.toFixed(2)}.png`), cv.toBuffer('image/png')); }
  console.log('stills ok');
} else if (CMD === 'render') {
  const [out, f0s, f1s, tg] = ARGS, f0 = +f0s, f1 = Math.min(+f1s, NF);
  const enc = name => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), name], { stdio: ['pipe', 'inherit', 'inherit'] });
  const clean = enc(path.join(out, `seg_clean_${tg}.mp4`)), capd = enc(path.join(out, `seg_caps_${tg}.mp4`));
  const write = (p, buf) => new Promise(res => { if (!p.stdin.write(buf)) p.stdin.once('drain', res); else res(); });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const t = f / FPS; renderFrame(t); await write(clean, Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer));
    captions(t); await write(capd, Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer));
    if ((f - f0) % 90 === 0) console.log(`[${tg}] ${f}/${f1} ${((Date.now() - t0) / (f - f0 + 1)).toFixed(0)}ms/f`);
  }
  clean.stdin.end(); capd.stdin.end(); await Promise.all([clean, capd].map(p => new Promise(r => p.on('close', r)))); console.log(`[${tg}] done`);
} else { console.error('unknown command ' + CMD); process.exit(1); }
