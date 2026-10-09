#!/usr/bin/env bash
# One command: story.json -> out/<id>/{short.mp4 (captions), short_clean.mp4, cover.png, upload.json}
# Usage: ./make.sh stories/<file>.json [parts]
set -euo pipefail
cd "$(dirname "$0")"
STORY=$(realpath "$1"); PARTS=${2:-$(nproc)}
ID=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['id'])" "$STORY")
OUT=out/$ID; mkdir -p "$OUT"; rm -f "$OUT"/seg_*.mp4
node engine/engine.mjs "$STORY" check
node engine/engine.mjs "$STORY" events "$OUT/events.json"
python3 engine/audio.py "$OUT/events.json" "$OUT/sound.wav"
NF=$(python3 -c "import json;print(json.load(open('$OUT/events.json'))['frames'])")
STEP=$(( (NF + PARTS - 1) / PARTS ))
echo "rendering $NF frames in $PARTS parts"
pids=()
for ((p=0; p<PARTS; p++)); do
  f0=$((p*STEP)); f1=$(( (p+1)*STEP < NF ? (p+1)*STEP : NF ))
  node engine/engine.mjs "$STORY" render "$OUT" $f0 $f1 $(printf "%02d" $p) > "$OUT/log_$p.txt" 2>&1 & pids+=($!)
done
for pid in "${pids[@]}"; do wait $pid; done
for v in caps clean; do ls "$OUT"/seg_${v}_*.mp4 | sort | sed "s|^$OUT/|file '|; s|$|'|" > "$OUT/$v.txt"; done
enc() { # $1 list, $2 output, $3 passlog
  ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/$1" -vf hqdn3d=1.5:1.5:6:6 -c:v libx264 -preset medium -b:v 3500k -maxrate 6000k -bufsize 7000k -profile:v high -pix_fmt yuv420p -pass 1 -passlogfile "$OUT/$3" -an -f mp4 /dev/null
  ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/$1" -i "$OUT/sound.wav" -map 0:v -map 1:a -vf hqdn3d=1.5:1.5:6:6 -c:v libx264 -preset medium -b:v 3500k -maxrate 6000k -bufsize 7000k -profile:v high -pix_fmt yuv420p -pass 2 -passlogfile "$OUT/$3" -c:a aac -b:a 160k -shortest -movflags +faststart "$OUT/$2"
}
enc caps.txt short.mp4 plcaps & e1=$!
enc clean.txt short_clean.mp4 plclean & e2=$!
wait $e1; wait $e2
COVER=$(python3 -c "import json;print(json.load(open('$OUT/events.json'))['cover'])")
ffmpeg -y -loglevel error -ss "$COVER" -i "$OUT/short.mp4" -frames:v 1 "$OUT/cover.png"
node engine/engine.mjs "$STORY" thumb "$OUT/thumb.jpg"
python3 - "$STORY" "$OUT" <<'PY'
import json, sys
s = json.load(open(sys.argv[1])); out = sys.argv[2]; ev = json.load(open(out + '/events.json'))
u = dict(s.get('upload', {})); u['coverMs'] = int(ev['cover'] * 1000); u['duration'] = ev['duration']; u['id'] = s['id']; u['thumbnailFile'] = 'thumb.jpg'
disc = json.load(open('config.json')).get('disclaimer')
if disc and disc not in u.get('description', ''):
    parts = u.get('description', '').rstrip().split('\n\n')
    tail = [parts.pop()] if parts and parts[-1].lstrip().startswith('#') else []
    u['description'] = '\n\n'.join(parts + [disc] + tail)
json.dump(u, open(out + '/upload.json', 'w'), indent=1, ensure_ascii=False)
PY
rm -f "$OUT"/seg_*.mp4 "$OUT"/pl*.log* "$OUT"/caps.txt "$OUT"/clean.txt
ls -la "$OUT"
