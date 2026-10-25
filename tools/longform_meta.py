"""Long-form upload metadata: out/<id>/upload.json with YouTube chapters, footage credits and the AI disclaimer.
Usage: python3 tools/longform_meta.py <story.json> <outdir>   (called by make.sh for "format": "long")

Description layout (YouTube limit 5,000 characters, Metricool the same):
  first paragraph of story.upload.description  ->  "Chapters:" list (0:00 first, from the real voice timing)
  -> rest of the description (context, sources)  ->  "Footage & images:" credits  ->  disclaimer  ->  hashtags"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
story_path, out = sys.argv[1], sys.argv[2]
s = json.load(open(story_path))
ev = json.load(open(os.path.join(out, 'events.json')))
cfg = json.load(open(os.environ.get('GEO_CONFIG') or os.path.join(ROOT, 'config.json')))
lf = cfg.get('longform', {})
up = dict(s.get('upload', {}))


def ts(sec):
    sec = int(round(sec)); h, m, x = sec // 3600, sec % 3600 // 60, sec % 60
    return f'{h}:{m:02d}:{x:02d}' if h else f'{m}:{x:02d}'


def chapter_name(sec):
    if sec.get('chapter'): return sec['chapter']
    n = (sec.get('name') or '').strip()
    return n.title() if n.isupper() else n


# chapters: YouTube needs >= 3 timestamps, the first at 0:00, each >= 10 s
chapters, secs = [], ev.get('sections') or []
first_name = up.get('introChapter', 'Intro')
if secs and secs[0]['a'] > 1.0: chapters.append((0.0, first_name))
for x in secs:
    t = 0.0 if not chapters else x['a']
    if chapters and t - chapters[-1][0] < 10: continue
    chapters.append((t, chapter_name(x)))
chapter_ok = len(chapters) >= 3
chapter_block = 'Chapters:\n' + '\n'.join(f'{ts(t)} {n}' for t, n in chapters) if chapter_ok else ''

# footage credits written by tools/footage.py
credits = []
cp = os.path.join(out, 'footage', 'credits.json')
if os.path.exists(cp):
    for c in json.load(open(cp)).get('credits', []):
        line = c.get('line') or ' · '.join(v for v in [c.get('title'), c.get('author'), c.get('provider'), c.get('license')] if v)
        if line and line not in credits: credits.append(line)

desc = up.get('description', '').rstrip()
parts = [p for p in desc.split('\n\n') if p.strip()]
tags_tail = [parts.pop()] if parts and parts[-1].lstrip().startswith('#') else []
disc = cfg.get('disclaimer', '')
if disc and disc in parts: parts.remove(disc)
body = parts[:1] + ([chapter_block] if chapter_block else []) + parts[1:]


def assemble(cr):
    blocks = list(body)
    if cr: blocks.append('Footage & images (free licences / public domain):\n' + '\n'.join(cr))
    if disc: blocks.append(disc)
    return '\n\n'.join(blocks + tags_tail)


text, shown = assemble(credits), len(credits)
while len(text) > 4900 and shown > 0:  # keep the description under YouTube's limit: shorten the credit list
    shown -= 1
    rest = len(credits) - shown
    text = assemble(credits[:shown] + [f'… and {rest} more (all free or public-domain licences, full list kept in the channel archive)'])

dur = ev['duration']
foot = [x for x in s.get('scenes', []) if x.get('type') == 'footage']
u = {
    'id': s['id'], 'format': 'long', 'title': up.get('title', ''), 'description': text, 'tags': up.get('tags', []),
    'type': 'video', 'youtubeCategory': up.get('category', lf.get('youtubeCategory', 'EDUCATION')),
    'duration': dur, 'videoFile': 'long.mp4', 'thumbnailFile': 'thumb.jpg',
    'bytes': os.path.getsize(os.path.join(out, 'long.mp4')) if os.path.exists(os.path.join(out, 'long.mp4')) else None,
    'voice': os.path.exists(os.path.join(out, 'voice.wav')) and bool(os.environ.get('VOICE_TIMING')),
    'chapters': [{'t': round(t, 2), 'ts': ts(t), 'name': n} for t, n in chapters], 'chaptersValid': chapter_ok,
    'footageCredits': len(credits), 'footageShots': len(foot),
    'channel': cfg.get('channel'), 'blogId': cfg.get('metricoolBlogId'), 'autoPublish': cfg.get('autoPublish', True),
    'postTime': lf.get('postTime', '17:30'), 'timezone': cfg.get('timezone', 'Europe/Vienna'),
    'firstComment': up.get('firstComment', ''),
}
json.dump(u, open(os.path.join(out, 'upload.json'), 'w'), indent=1, ensure_ascii=False)
print(f"upload.json ok · {len(chapters)} chapters{'' if chapter_ok else ' (too few for YouTube chapters)'} · {len(credits)} credits · description {len(text)} chars")
