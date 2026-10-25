"""Free / public-domain footage for long-form videos: search -> contact sheet -> pick -> download -> normalise -> credits.

Commands (run from the repo root):
  python3 tools/footage.py check                     which providers are reachable from this machine (for the report)
  python3 tools/footage.py candidates <story.json>   search every footage scene, download small previews,
                                                     write out/<id>/footage/candidates.json + sheet_*.jpg (look at them!)
  python3 tools/footage.py fetch <story.json>        download the picked candidate per scene (scene.pick, default 0),
                                                     normalise it, write out/<id>/footage/manifest.json + credits.json
  python3 tools/footage.py selftest                  offline test of parsers, licence filter and normalising

A footage scene in the story (see LONGFORM.md):
  {"type": "footage", "asset": "f03", "from": "ch1:tankers", "to": "ch1:Since -0.2",
   "query": "oil tanker at sea aerial", "kind": "video", "symbolic": true, "pick": 0, "lower": {...}}

Providers (all free; licences checked per item):
  pexels   OFF by default (no key) · videos + photos · Pexels License (free, no credit required) · key: env PEXELS_API_KEY or the
           environment's network secret for api.pexels.com (header Authorization)
  pixabay  videos + photos · Pixabay Content License (free, no credit; no logos/brands) · key: env PIXABAY_API_KEY
  commons  Wikimedia Commons photos/videos · ONLY public domain, CC0 or CC BY (credit in the description) · no key
           (Commons also holds the public-domain U.S. military photos from DVIDS)
  nasa     NASA Image and Video Library · NASA media, generally not copyrighted (credit NASA, no endorsement) · no key
Hosts the machine must reach: api.pexels.com, videos.pexels.com, images.pexels.com, pixabay.com, cdn.pixabay.com,
commons.wikimedia.org, upload.wikimedia.org, images-api.nasa.gov, images-assets.nasa.gov.
If nothing is reachable the video is still rendered: footage scenes then show the map underneath."""
import io, json, os, re, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from html import unescape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = 'GEOPOLITICS4YOU-bot/1.0 (+https://github.com/moesslacherjakob-commits/GEOPOLITICS)'
W, H = 1920, 1080
IMG_W, IMG_H = 2304, 1296          # photos keep 20 % headroom for the slow zoom/pan
MIN_W = 1280                       # never upscale smaller sources
MAX_CLIP = 14.0                    # seconds kept per clip (scenes are <= 8 s)
USED_PATH = os.path.join(ROOT, 'data', 'footage_used.json')
LABELS = {True: 'ILLUSTRATIVE', False: 'FILE'}


# Pexels is off by default (no key since 2026-10-25); add 'pexels:video' / 'pexels:image' in config.json to use it again.
DEFAULT_ORDER = ['pixabay:video', 'commons:image', 'nasa:image', 'pixabay:image', 'commons:video', 'nasa:video']


def cfg():
    try: c = json.load(open(os.path.join(ROOT, 'config.json')))
    except Exception: c = {}
    return c.get('longform', {}).get('footage', {}), c.get('longform', {})


# ------------------------------------------------------------------ http
class Unreachable(Exception): pass


def http(url, headers=None, timeout=25, binary=False, max_bytes=None):
    h = {'User-Agent': UA, 'Accept': '*/*' if binary else 'application/json'}
    h.update(headers or {})
    req = urllib.request.Request(url, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            if max_bytes and int(r.headers.get('Content-Length') or 0) > max_bytes:
                raise ValueError(f'file too large ({int(r.headers["Content-Length"]) // 1e6:.0f} MB)')
            data = r.read(max_bytes + 1 if max_bytes else -1)
            if max_bytes and len(data) > max_bytes: raise ValueError('file too large')
            return data if binary else json.loads(data)
    except urllib.error.HTTPError as e:
        if e.code in (401, 403): raise Unreachable(f'HTTP {e.code} (key missing or host not allowed)')
        raise
    except (urllib.error.URLError, OSError) as e:
        raise Unreachable(str(getattr(e, 'reason', e)))


def strip_html(s):
    return re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()


# ------------------------------------------------------------------ licence filter (Wikimedia Commons)
OK_LIC = re.compile(r'^(public domain|pd\b|pd-|cc0|cc[- ]zero|cc by \d|cc-by-\d|cc by$|attribution$|no restrictions)', re.I)
BAD_LIC = re.compile(r'(\bsa\b|share[- ]?alike|\bnc\b|non-?commercial|\bnd\b|no[- ]?deriv|\bgfdl\b|fair use|all rights reserved)', re.I)


def commons_licence_ok(short, terms=''):
    s = (short or '').strip()
    if not s or BAD_LIC.search(s) or BAD_LIC.search(terms or ''): return False
    return bool(OK_LIC.search(s))


# ------------------------------------------------------------------ providers -> unified candidates
def cand(**k):
    k.setdefault('duration', None); k.setdefault('preview', None); k.setdefault('author', ''); k.setdefault('title', '')
    return k


def parse_pexels_videos(j):
    out = []
    for v in j.get('videos', []):
        files = [f for f in v.get('video_files', []) if (f.get('file_type') or '').endswith('mp4') and (f.get('width') or 0) >= MIN_W]
        if not files: continue
        f = min(files, key=lambda f: abs((f.get('width') or 0) - 1920))  # closest to 1080p, not 4K
        user = (v.get('user') or {}).get('name', '')
        out.append(cand(provider='pexels', id=f"pexels-v{v['id']}", kind='video', url=f['link'], preview=v.get('image'),
                        width=f.get('width'), height=f.get('height'), duration=v.get('duration'), page=v.get('url'), author=user,
                        title=re.sub(r'[-/]', ' ', (v.get('url') or '').rstrip('/').split('/')[-1]).strip(),
                        license='Pexels License', credit=f'Pexels / {user}' if user else 'Pexels',
                        line=f"Video by {user} on Pexels (Pexels License) {v.get('url', '')}".replace('  ', ' ')))
    return out


def parse_pexels_photos(j):
    out = []
    for p in j.get('photos', []):
        if (p.get('width') or 0) < MIN_W: continue
        user = p.get('photographer', '')
        src = p.get('src') or {}
        out.append(cand(provider='pexels', id=f"pexels-p{p['id']}", kind='image', url=src.get('original') or src.get('large2x'),
                        preview=src.get('medium') or src.get('small'), width=p.get('width'), height=p.get('height'), page=p.get('url'),
                        author=user, title=p.get('alt', ''), license='Pexels License', credit=f'Pexels / {user}',
                        line=f"Photo by {user} on Pexels (Pexels License) {p.get('url', '')}"))
    return out


def parse_pixabay_videos(j):
    out = []
    for v in j.get('hits', []):
        vids = v.get('videos') or {}
        f = next((vids[k] for k in ('large', 'medium') if vids.get(k) and vids[k].get('url') and (vids[k].get('width') or 0) >= MIN_W), None)
        if not f: continue
        out.append(cand(provider='pixabay', id=f"pixabay-v{v['id']}", kind='video', url=f['url'], preview=f.get('thumbnail') or (vids.get('tiny') or {}).get('thumbnail'),
                        width=f.get('width'), height=f.get('height'), duration=v.get('duration'), page=v.get('pageURL'), author=v.get('user', ''),
                        title=v.get('tags', ''), license='Pixabay Content License', credit=f"Pixabay / {v.get('user', '')}",
                        line=f"Video by {v.get('user', '')} on Pixabay (Pixabay Content License) {v.get('pageURL', '')}"))
    return out


def parse_pixabay_photos(j):
    out = []
    for p in j.get('hits', []):
        if (p.get('imageWidth') or 0) < MIN_W: continue
        out.append(cand(provider='pixabay', id=f"pixabay-p{p['id']}", kind='image', url=p.get('largeImageURL'), preview=p.get('webformatURL') or p.get('previewURL'),
                        width=p.get('imageWidth'), height=p.get('imageHeight'), page=p.get('pageURL'), author=p.get('user', ''), title=p.get('tags', ''),
                        license='Pixabay Content License', credit=f"Pixabay / {p.get('user', '')}",
                        line=f"Photo by {p.get('user', '')} on Pixabay (Pixabay Content License) {p.get('pageURL', '')}"))
    return out


def parse_commons(j, kind):
    out = []
    for pg in (j.get('query') or {}).get('pages', {}).values():
        ii = (pg.get('imageinfo') or [{}])[0]; md = ii.get('extmetadata') or {}
        lic = (md.get('LicenseShortName') or {}).get('value', ''); terms = (md.get('UsageTerms') or {}).get('value', '')
        if not commons_licence_ok(lic, terms): continue
        mime = ii.get('mime', '')
        if kind == 'image' and not mime.startswith('image/'): continue
        if kind == 'video' and not mime.startswith('video/'): continue
        if (ii.get('width') or 0) < MIN_W: continue
        author = strip_html((md.get('Artist') or {}).get('value', ''))[:80] or 'Unknown author'
        title = re.sub(r'^File:', '', pg.get('title', '')).rsplit('.', 1)[0]
        full = ii.get('thumburl') if kind == 'image' and ii.get('thumburl') else ii.get('url')
        prev = re.sub(r'/(\d+)px-', '/480px-', ii['thumburl']) if ii.get('thumburl') else None
        page = ii.get('descriptionurl', '')
        out.append(cand(provider='commons', id=f"commons-{pg.get('pageid')}", kind='video' if mime.startswith('video/') else 'image', url=full, preview=prev,
                        width=ii.get('width'), height=ii.get('height'), duration=ii.get('duration'), page=page, author=author, title=title,
                        license=lic, credit=f'{author[:40]} / Wikimedia Commons ({lic})',
                        line=f'"{title[:70]}" by {author} ({lic}), via Wikimedia Commons {page}'))
    return out


def parse_nasa(j, kind):
    out = []
    for it in (j.get('collection') or {}).get('items', []):
        d = (it.get('data') or [{}])[0]
        if d.get('media_type') not in ('image', 'video') or (kind != 'any' and d.get('media_type') != kind): continue
        prev = next((l.get('href') for l in it.get('links', []) if l.get('rel') == 'preview' or l.get('render') == 'image'), None)
        who = d.get('photographer') or d.get('secondary_creator') or d.get('center') or 'NASA'
        nid = d.get('nasa_id', '')
        out.append(cand(provider='nasa', id=f'nasa-{nid}', kind=d.get('media_type'), url=None, manifest=it.get('href'), preview=prev,
                        width=None, height=None, page=f'https://images.nasa.gov/details/{urllib.parse.quote(nid)}', author=who,
                        title=d.get('title', ''), license='NASA (public domain, no endorsement)', credit=f'NASA / {who}'[:60],
                        line=f"\"{d.get('title', '')[:70]}\" — NASA / {who} (NASA media guidelines) https://images.nasa.gov/details/{urllib.parse.quote(nid)}"))
    return out


def search(provider, query, kind, n=8):
    """Returns a list of candidates; raises Unreachable when the provider cannot be used here."""
    q = urllib.parse.quote(query)
    if provider == 'pexels':
        hdr = {'Authorization': os.environ['PEXELS_API_KEY']} if os.environ.get('PEXELS_API_KEY') else {}
        if kind == 'video': return parse_pexels_videos(http(f'https://api.pexels.com/videos/search?query={q}&orientation=landscape&per_page={n * 2}', hdr))
        return parse_pexels_photos(http(f'https://api.pexels.com/v1/search?query={q}&orientation=landscape&per_page={n * 2}', hdr))
    if provider == 'pixabay':
        key = os.environ.get('PIXABAY_API_KEY')
        if not key: raise Unreachable('PIXABAY_API_KEY not set')
        if kind == 'video': return parse_pixabay_videos(http(f'https://pixabay.com/api/videos/?key={key}&q={q}&safesearch=true&per_page={max(3, n * 2)}'))
        return parse_pixabay_photos(http(f'https://pixabay.com/api/?key={key}&q={q}&image_type=photo&orientation=horizontal&min_width={MIN_W}&safesearch=true&per_page={max(3, n * 2)}'))
    if provider == 'commons':
        ft = 'filetype:video' if kind == 'video' else 'filetype:bitmap'
        u = ('https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6'
             f'&gsrsearch={urllib.parse.quote(query + " " + ft)}&gsrlimit={n * 3}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=2560')
        return parse_commons(http(u), kind)
    if provider == 'nasa':
        return parse_nasa(http(f'https://images-api.nasa.gov/search?q={q}&media_type={"video" if kind == "video" else "image"}'), kind)
    raise ValueError(provider)


def resolve_url(c):
    """NASA items point to an asset manifest; pick a large rendition."""
    if c.get('url') or not c.get('manifest'): return c.get('url')
    files = http(c['manifest'])
    files = [f for f in files if isinstance(f, str)]
    order = ['~large.mp4', '~medium.mp4', '~orig.mp4'] if c['kind'] == 'video' else ['~large.jpg', '~orig.jpg', '~medium.jpg']
    for suf in order:
        f = next((x for x in files if x.endswith(suf)), None)
        if f: return f.replace('http://', 'https://')
    return None


# ------------------------------------------------------------------ story helpers
def load_story(p):
    s = json.load(open(p)); scenes = [x for x in s.get('scenes', []) if x.get('type') == 'footage']
    for i, x in enumerate(scenes): x.setdefault('asset', f'f{i + 1:02d}')
    return s, scenes


def out_dir(s): d = os.path.join(ROOT, 'out', s['id'], 'footage'); os.makedirs(d, exist_ok=True); return d


def seg_text(s, anchor):
    seg = str(anchor or '').split(':')[0].split(' ')[0].rstrip('$')
    return next((x['text'] for x in s.get('script', []) if x['id'] == seg), '')


def used():
    try: return json.load(open(USED_PATH))
    except Exception: return {}


def providers_for(scene, fcfg):
    if scene.get('providers'): return [(p, k) for p in scene['providers'] for k in ([scene.get('kind')] if scene.get('kind') in ('video', 'image') else ['video', 'image'])]
    order = fcfg.get('providers') or DEFAULT_ORDER
    want = scene.get('kind', 'any')
    return [tuple(x.split(':')) for x in order if want == 'any' or x.endswith(':' + want)]


# ------------------------------------------------------------------ contact sheets
def make_sheets(s, scenes, cands, d):
    from PIL import Image, ImageDraw, ImageFont
    def font(sz, bold=True):
        for f in ['Inter-ExtraBold.otf' if bold else 'Inter-SemiBold.otf']:
            p = os.path.join(ROOT, 'assets', 'fonts', f)
            if os.path.exists(p): return ImageFont.truetype(p, sz)
        return ImageFont.load_default()
    TW, TH, COLS, PER = 320, 180, 5, 4
    sheets = []
    for b in range(0, len(scenes), PER):
        block = scenes[b:b + PER]
        img = Image.new('RGB', (COLS * (TW + 10) + 10, len(block) * (TH + 110) + 10), (8, 12, 20)); dr = ImageDraw.Draw(img)
        for r, sc in enumerate(block):
            y = 10 + r * (TH + 110); a = sc['asset']
            dr.text((10, y), f"{a}  ·  query: {sc.get('query', '')}  ·  kind: {sc.get('kind', 'any')}", font=font(20), fill=(246, 183, 60))
            dr.text((10, y + 28), ('“' + seg_text(s, sc.get('from'))[:150] + '”'), font=font(15, False), fill=(200, 210, 222))
            for k, c in enumerate(cands.get(a, [])[:COLS]):
                x = 10 + k * (TW + 10); yy = y + 56
                tile = Image.new('RGB', (TW, TH), (30, 40, 55))
                if c.get('_prev') and os.path.exists(c['_prev']):
                    try:
                        im = Image.open(c['_prev']).convert('RGB'); im.thumbnail((TW * 2, TH * 2)); sc_ = max(TW / im.width, TH / im.height)
                        im = im.resize((max(TW, int(im.width * sc_)), max(TH, int(im.height * sc_)))); tile.paste(im.crop((0, 0, TW, TH)))
                    except Exception: pass
                img.paste(tile, (x, yy)); td = ImageDraw.Draw(img)
                td.rectangle([x, yy, x + 34, yy + 30], fill=(246, 183, 60)); td.text((x + 9, yy + 3), str(k), font=font(20), fill=(8, 12, 20))
                info = f"{c['provider']} · {c['kind']}" + (f" · {c['duration']:.0f}s" if isinstance(c.get('duration'), (int, float)) else '')
                td.text((x, yy + TH + 4), info[:44], font=font(14), fill=(230, 235, 242))
                td.text((x, yy + TH + 22), (c.get('title') or '')[:46], font=font(13, False), fill=(150, 165, 185))
            if not cands.get(a): dr.text((10, y + 120), 'no candidates (provider unreachable or no licence-safe result) -> map stays visible', font=font(18), fill=(255, 90, 80))
        p = os.path.join(d, f'sheet_{b // PER + 1}.jpg'); img.save(p, quality=85); sheets.append(p)
    return sheets


# ------------------------------------------------------------------ normalise
def normalise_video(src, dst, start=0.0, fps=24):
    vf = f'scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={fps},eq=saturation=0.92:contrast=1.04,format=yuv420p'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{start:.2f}', '-i', src, '-t', f'{MAX_CLIP}', '-an', '-vf', vf,
                    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', dst], check=True)


def normalise_image(src, dst):
    from PIL import Image, ImageEnhance
    im = Image.open(src); im = im.convert('RGB')
    s = max(IMG_W / im.width, IMG_H / im.height); im = im.resize((int(im.width * s + .5), int(im.height * s + .5)), Image.LANCZOS)
    l, t = (im.width - IMG_W) // 2, (im.height - IMG_H) // 2; im = im.crop((l, t, l + IMG_W, t + IMG_H))
    im = ImageEnhance.Color(im).enhance(.92); im = ImageEnhance.Contrast(im).enhance(1.04)
    im.save(dst, quality=90)


# ------------------------------------------------------------------ commands
def cmd_check():
    tests = {'pexels': ('pexels', 'ship', 'video'), 'pixabay': ('pixabay', 'ship', 'video'), 'commons': ('commons', 'tanker ship', 'image'), 'nasa': ('nasa', 'earth', 'image')}
    on = {x.split(':')[0] for x in (cfg()[0].get('providers') or DEFAULT_ORDER)}
    status = {name: 'off (not in config.json → longform.footage.providers)' for name in tests if name not in on}
    for name, (p, q, k) in tests.items():
        if name not in on: continue
        try: r = search(p, q, k, 2); status[name] = f'ok ({len(r)} results)'
        except Unreachable as e: status[name] = f'unreachable: {e}'
        except Exception as e: status[name] = f'error: {e}'
    print(json.dumps(status, indent=1)); return status


def cmd_candidates(story_path, n=5):
    fcfg, lf = cfg(); s, scenes = load_story(story_path); d = out_dir(s); prevdir = os.path.join(d, 'prev'); os.makedirs(prevdir, exist_ok=True)
    seen = used(); dead = {}; cands = {}
    for sc in scenes:
        got = []
        for p, k in providers_for(sc, fcfg):
            if p in dead or len(got) >= n: continue
            try: res = search(p, sc.get('query') or '', k, n)
            except Unreachable as e: dead[p] = str(e); continue
            except Exception as e: print(f"  {sc['asset']}: {p} error {e}"); continue
            got += [c for c in res if c['id'] not in seen and c['id'] not in [g['id'] for g in got]]
        got = got[:n]
        for i, c in enumerate(got):
            if c.get('preview'):
                pp = os.path.join(prevdir, f"{sc['asset']}_{i}.jpg")
                try: open(pp, 'wb').write(http(c['preview'], binary=True, timeout=20, max_bytes=3_000_000)); c['_prev'] = pp
                except Exception: pass
        cands[sc['asset']] = got
        print(f"  {sc['asset']}: {len(got)} candidates for “{sc.get('query', '')}”")
    json.dump({'story': s['id'], 'unreachable': dead, 'candidates': cands}, open(os.path.join(d, 'candidates.json'), 'w'), indent=1)
    sheets = make_sheets(s, scenes, cands, d)
    print('unreachable providers:', json.dumps(dead) if dead else 'none')
    print('contact sheets (look at them, then set "pick" per scene if 0 is not the best match):'); [print('  ' + x) for x in sheets]


def cmd_fetch(story_path):
    fcfg, lf = cfg(); s, scenes = load_story(story_path); d = out_dir(s); fps = s.get('fps') or lf.get('fps', 24)
    cj = os.path.join(d, 'candidates.json')
    if not os.path.exists(cj): cmd_candidates(story_path)
    allc = json.load(open(cj)).get('candidates', {})
    manifest, credits, seen, rawdir = {'story': s['id'], 'assets': {}}, [], used(), os.path.join(d, 'raw')
    os.makedirs(rawdir, exist_ok=True); missing = []
    for sc in scenes:
        a = sc['asset']; cs = allc.get(a, [])
        if sc.get('pick') is False or not cs: missing.append(a); continue
        order = [int(sc.get('pick', 0))] + [i for i in range(len(cs)) if i != int(sc.get('pick', 0))]
        ok = False
        for i in order[:3]:  # picked one first, then fall back to the next candidates
            if i >= len(cs): continue
            c = cs[i]
            try:
                url = resolve_url(c)
                if not url: continue
                ext = '.mp4' if c['kind'] == 'video' and '.mp4' in url.lower() else ('.webm' if c['kind'] == 'video' else '.jpg')
                raw = os.path.join(rawdir, a + ext)
                open(raw, 'wb').write(http(url, binary=True, timeout=180, max_bytes=250_000_000))
                dst = os.path.join(d, a + ('.mp4' if c['kind'] == 'video' else '.jpg'))
                normalise_video(raw, dst, float(sc.get('start', 0)), fps) if c['kind'] == 'video' else normalise_image(raw, dst)
                sym = sc.get('symbolic', True)
                manifest['assets'][a] = {'file': os.path.relpath(dst, ROOT), 'kind': c['kind'], 'label': sc.get('label', LABELS[bool(sym)]),
                                         'credit': c.get('credit', ''), 'provider': c['provider'], 'id': c['id'], 'page': c.get('page'), 'license': c.get('license')}
                credits.append({'asset': a, 'provider': c['provider'], 'id': c['id'], 'title': c.get('title'), 'author': c.get('author'),
                                'license': c.get('license'), 'page': c.get('page'), 'line': c.get('line')})
                seen[c['id']] = time.strftime('%Y-%m-%d'); ok = True
                print(f"  {a}: {c['provider']} {c['kind']} ok ({c.get('license')})"); break
            except Exception as e:
                print(f"  {a}: candidate {i} failed: {e}")
        if not ok: missing.append(a)
    json.dump(manifest, open(os.path.join(d, 'manifest.json'), 'w'), indent=1, ensure_ascii=False)
    json.dump({'credits': credits}, open(os.path.join(d, 'credits.json'), 'w'), indent=1, ensure_ascii=False)
    try:
        cutoff = time.strftime('%Y-%m-%d', time.localtime(time.time() - 90 * 86400))
        json.dump({k: v for k, v in seen.items() if v >= cutoff}, open(USED_PATH, 'w'), indent=0, sort_keys=True)
    except Exception as e: print('could not update footage_used.json:', e)
    print(f"footage: {len(manifest['assets'])}/{len(scenes)} assets ready" + (f", missing {', '.join(missing)} (map stays visible there)" if missing else ''))


def cmd_selftest():
    """Offline: parsers on API-shaped fixtures, licence filter, normalising local test media."""
    assert commons_licence_ok('Public domain') and commons_licence_ok('CC BY 4.0') and commons_licence_ok('CC0')
    assert not commons_licence_ok('CC BY-SA 4.0') and not commons_licence_ok('CC BY-NC 2.0') and not commons_licence_ok('GFDL')
    assert not commons_licence_ok('CC BY 2.0', 'Creative Commons Attribution-Share Alike') and not commons_licence_ok('')
    assert commons_licence_ok('Public domain', 'Public domain and free to use') and not commons_licence_ok('CC BY-NC-ND 3.0')
    px = parse_pexels_videos({'videos': [{'id': 1, 'url': 'https://www.pexels.com/video/oil-tanker-at-sea-1/', 'duration': 12, 'image': 'https://i/p.jpg',
                                          'user': {'name': 'Ana'}, 'video_files': [{'file_type': 'video/mp4', 'width': 3840, 'height': 2160, 'link': 'https://v/4k.mp4'},
                                                                                  {'file_type': 'video/mp4', 'width': 1920, 'height': 1080, 'link': 'https://v/hd.mp4'},
                                                                                  {'file_type': 'video/mp4', 'width': 640, 'height': 360, 'link': 'https://v/sd.mp4'}]}]})
    assert px[0]['url'] == 'https://v/hd.mp4' and px[0]['credit'] == 'Pexels / Ana' and px[0]['title'] == 'oil tanker at sea 1'
    pb = parse_pixabay_videos({'hits': [{'id': 7, 'pageURL': 'https://pixabay.com/videos/id-7/', 'tags': 'ship, sea', 'duration': 9, 'user': 'bob',
                                         'videos': {'large': {'url': 'https://c/l.mp4', 'width': 1920, 'height': 1080, 'thumbnail': 'https://c/l.jpg'},
                                                    'small': {'url': 'https://c/s.mp4', 'width': 960, 'height': 540}}}]})
    assert pb[0]['url'] == 'https://c/l.mp4' and pb[0]['preview'] == 'https://c/l.jpg'
    cm = parse_commons({'query': {'pages': {'1': {'pageid': 1, 'title': 'File:USS Example (DDG-1).jpg', 'imageinfo': [{'url': 'https://u/o.jpg',
                        'thumburl': 'https://u/thumb/a/ab/x.jpg/2560px-x.jpg', 'width': 4000, 'height': 2600, 'mime': 'image/jpeg', 'descriptionurl': 'https://c/File:x',
                        'extmetadata': {'LicenseShortName': {'value': 'Public domain'}, 'Artist': {'value': '<a href="x">U.S. Navy</a> photo'}}}]},
                                                    '2': {'pageid': 2, 'title': 'File:SA.jpg', 'imageinfo': [{'url': 'u', 'width': 4000, 'height': 3000, 'mime': 'image/jpeg',
                        'extmetadata': {'LicenseShortName': {'value': 'CC BY-SA 4.0'}}}]}}}}, 'image')
    assert len(cm) == 1 and cm[0]['author'] == 'U.S. Navy photo' and cm[0]['preview'].endswith('/480px-x.jpg') and cm[0]['url'].endswith('2560px-x.jpg')
    na = parse_nasa({'collection': {'items': [{'href': 'https://images-assets.nasa.gov/image/iss1/collection.json', 'links': [{'href': 'https://p.jpg', 'rel': 'preview'}],
                                               'data': [{'nasa_id': 'iss1', 'title': 'Strait of Hormuz from ISS', 'media_type': 'image', 'center': 'JSC'}]}]}}, 'image')
    assert na[0]['manifest'] and na[0]['credit'] == 'NASA / JSC'
    # normalising with generated media
    with tempfile.TemporaryDirectory() as t:
        v, im = os.path.join(t, 'in.mp4'), os.path.join(t, 'in.png')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30', '-t', '4', v], check=True)
        from PIL import Image; Image.new('RGB', (3000, 2000), (40, 90, 160)).save(im)
        normalise_video(v, os.path.join(t, 'o.mp4'), 0, 24); normalise_image(im, os.path.join(t, 'o.jpg'))
        pr = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'csv=p=0', os.path.join(t, 'o.mp4')], capture_output=True, text=True).stdout.strip()
        assert pr.startswith('1920,1080,24'), pr
        assert Image.open(os.path.join(t, 'o.jpg')).size == (IMG_W, IMG_H)
    print('footage selftest ok')


if __name__ == '__main__':
    a = sys.argv[1:] or ['help']
    if a[0] == 'check': cmd_check()
    elif a[0] == 'candidates': cmd_candidates(a[1])
    elif a[0] == 'fetch': cmd_fetch(a[1])
    elif a[0] == 'selftest': cmd_selftest()
    else: print(__doc__)
