"""Voiceover with ElevenLabs (text-to-speech *with timestamps*), one request per script segment.
Writes <outdir>/voice.wav (48 kHz mono) and <outdir>/voice_timing.json ({segments:[{id,a,b,words:[{text,t0,t1}]}]})
so captions and animations follow the real voice exactly.

Usage: python3 tools/tts_elevenlabs.py <story.json> <outdir>
Auth:  the cloud environment's network secret for api.elevenlabs.io (header `xi-api-key`) — or env ELEVENLABS_API_KEY.
Exit code != 0 on any failure; make.sh then renders captions-only."""
import json, os, re, sys, base64, subprocess, tempfile, urllib.request
import numpy as np
from scipy.io import wavfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
story = json.load(open(sys.argv[1])); OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
cfg = json.load(open(os.path.join(ROOT, 'config.json'))); vc = cfg['voice']; pace = cfg.get('pace', {})
SAY = vc.get('say', {}); SR = 48000

def say_token(tok):
    m = re.match(r'^([“"(]*)(.*?)([.,!?:;”")]*)$', tok)
    pre, core, post = m.groups()
    return pre + SAY.get(core, core) + post

def tts(text):
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{vc['voiceId']}/with-timestamps?output_format=mp3_44100_128"
    body = {"text": text, "model_id": vc.get('model', 'eleven_multilingual_v2'),
            "voice_settings": {"stability": vc.get('stability', .5), "similarity_boost": vc.get('similarity', .75), "speed": vc.get('speed', 1.0)}}
    hdr = {'Content-Type': 'application/json', 'Accept': 'application/json'}
    if os.environ.get('ELEVENLABS_API_KEY'): hdr['xi-api-key'] = os.environ['ELEVENLABS_API_KEY']
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=hdr, method='POST')
    with urllib.request.urlopen(req, timeout=180) as r: return json.load(r)

def mp3_to_wav(b64):
    with tempfile.TemporaryDirectory() as d:
        src, dst = os.path.join(d, 'a.mp3'), os.path.join(d, 'a.wav')
        open(src, 'wb').write(base64.b64decode(b64))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-ar', str(SR), dst], check=True)
        sr, x = wavfile.read(dst)
    return x.astype(np.float32) / 32768.0

def word_times(tokens, align):
    """Map character timestamps onto our whitespace tokens (same token count as the caption text)."""
    chars, st, en = align['characters'], align['character_start_times_seconds'], align['character_end_times_seconds']
    text = ''.join(chars); spans, pos = [], 0
    for tok in tokens:
        i = text.find(tok, pos)
        if i < 0: return None
        spans.append((i, i + len(tok))); pos = i + len(tok)
    return [{'t0': float(st[a]), 't1': float(en[b - 1])} for a, b in spans]

segs, clips, cursor, gap = [], [], pace.get('start', 0.4), vc.get('gap', 0.35)
for s in story['script']:
    cap_tokens = s['text'].strip().split()
    tokens = [say_token(t) for t in cap_tokens]
    res = tts(' '.join(tokens))
    audio = mp3_to_wav(res['audio_base64'])
    wt = word_times(tokens, res.get('alignment') or {}) or word_times(tokens, res.get('normalized_alignment') or {})
    dur = len(audio) / SR
    if not wt:  # proportional fallback by token length
        w = np.array([len(t) + 2 for t in tokens], float); edges = np.concatenate([[0], np.cumsum(w)]) / w.sum() * dur
        wt = [{'t0': float(edges[i]), 't1': float(edges[i + 1])} for i in range(len(tokens))]
    words = [{'text': cap_tokens[i], 't0': round(cursor + wt[i]['t0'], 3), 't1': round(cursor + wt[i]['t1'], 3)} for i in range(len(tokens))]
    segs.append({'id': s['id'], 'a': words[0]['t0'], 'b': words[-1]['t1'], 'words': words})
    clips.append((cursor, audio)); cursor += dur + gap
    print(f"voice {s['id']}: {dur:.2f}s, {len(words)} words")

total = cursor + 0.5; mix = np.zeros(int(total * SR), np.float32)
for t0, a in clips: i = int(t0 * SR); mix[i:i + len(a)] += a
peak = float(np.max(np.abs(mix))) or 1.0; mix = mix / peak * 0.95
wavfile.write(os.path.join(OUT, 'voice.wav'), SR, (mix * 32767).astype(np.int16))
json.dump({'provider': 'elevenlabs', 'voiceId': vc['voiceId'], 'segments': segs}, open(os.path.join(OUT, 'voice_timing.json'), 'w'), indent=1)
print('voice ok', f'{total:.1f}s')
