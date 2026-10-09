# Story format (`stories/<id>.json`)

One file = one Short. The engine renders it with `./make.sh stories/<id>.json`.
Two full examples: `stories/2026-10-09-second-front.json` (Gulf / oil) and `stories/2026-10-09-ethiopia-eritrea.json` (Horn of Africa).

## Top level
| key | meaning |
|---|---|
| `id` | `YYYY-MM-DD-slug` — also the output folder and video file name |
| `script` | list of segments `{id, text}` — narrated and captioned text. Timing comes from the voiceover (or is estimated at ~125 wpm without one). |
| `rate`, `gap`, `start` | pacing overrides — normally leave them out; defaults come from `config.json → pace` (calm ~125 wpm). With a voiceover the real voice timing replaces the estimate. |
| `sections` | progress-bar chapters `{n, name, seg, color, to?}` — usually one per fact segment |
| `scenes` | ordered list of scenes (below) |
| `theme` | optional colour overrides |
| `upload` | `{title, description, tags[], cover}` → `out/<id>/upload.json` |
| `thumbnail` | `{at, kicker, kickerColor, lines: [[text, color]]}` → `out/<id>/thumb.jpg` (designed 9:16 thumbnail; text kept inside the central 3:2 band YouTube shows everywhere) |

Keep the script **≤ 150 words** so speech ends before ~75 s (videos run 70–78 s). `node engine/engine.mjs <story> check` prints timing and warns if too long.

## Anchors (`at`, `until`, `from`, `to`)
Every time value can be a number (seconds) or an anchor string:
- `"f1"` start of segment f1 · `"f1$"` end of segment f1 · `"end"` end of video
- `"f1:Trump"` the moment the word *Trump* is spoken in f1 (case-insensitive, trailing punctuation ignored, but write it as in the text when it carries punctuation, e.g. `"f1:Yemen."` works too)
- `"f2:Hormuz#1"` second occurrence · any anchor `+ 0.5` / `- 0.2` offset (space before the sign)

## Colours
`text, mute, accent (gold), danger (red), ally (orange), oil (amber), info (cyan), ok (green), neutral (grey), violet` or any `#hex`.

## Locations
`[lon, lat]`, an ISO-3 country code (uses its centre), or a place name from `data/places.json` (capitals, big cities, straits, seas, hotspots: e.g. `"Strait of Hormuz"`, `"Bab al-Mandab"`, `"Gaza"`, `"Donbas"`, `"Taiwan Strait"`, `"Mekele"`). Unknown names throw an error — fall back to coordinates.

## Scene types
### `globe` (hook) / `end` (outro)
`view: [{at, lon, lat, R, cy?}]` keyframes · `highlights: [{iso, color, at?, until?, alpha?}]` · `markers: [{loc, color, at?, label?, sub?, dx?, dy?, big?}]`
globe only: `exit: "zoom"` (zooms into the map scene — make the map's first camera key the same lon/lat with `dist 43, pitch 0`), `chip {text, at}`, `headline {at, lines: [[text, color, size]]}`, `card {at, icon, kicker, title, color, iconColor, reticle}`
end only: `lines: [[text, color]]` (2 short punchlines), `sources: [..]` (small print)

### `map` (the 3D map, usually from hook end to CTA)
`center: [lon, lat]` (projection centre — middle of the region) · `camera: [{at, lon, lat, dist, pitch, yaw, oy}]`
- `dist` ≈ zoom (15 = close-up of a border town, 40 = a country, 90 = a whole region); `pitch` 0 = top-down, 45–55 = cinematic tilt; `yaw` rotates; `oy` shifts the map down on screen (use 120–250 so content sits between the header and captions).

`layers` — each has `kind`, `at`, `until` (defaults to the scene span):
| kind | fields |
|---|---|
| `tint` | `iso, color, alpha?, fill?, glow?` — coloured fill/outline |
| `extrude` | `iso, color, height (0.3–0.9), rise?, flatten: [{at, to}]` — country rises as a 3D block |
| `zone` | `clip (iso), poly [[lon,lat]..], color, fill?, hatch?, pulse?, outline?` — area inside a country (occupied zone, buffer). `python3 tools/border_band.py ETH ERI 60 south` builds an "N km inside the border" band. |
| `tag` | `loc, text, sub?, color, dx?, dy?, size?, on? (iso of an extrusion to sit on)` — label with leader line |
| `arc` | `from, to, color, height?, width?, dur?, headColor?` — 3D arc (attacks, support, flows) |
| `route` | `path [..locs], style solid|dash|flow, color, width?, on?, label {text, sub, loc, dx, dy, at, until}` — pipelines, corridors, coastlines |
| `movers` | `path, icon ship|plane, count, speed, spacing, offset, stopAt, blockAt` — ships/planes moving, stopping at a blockade |
| `barrier` | `path, text, sub, stampLoc, stampUntil` — dashed red line + stamp (blockade, front line) |
| `marker` | `loc, style pulse|x|dot, color, label {text, sub, dx, dy, until}` |
| `column` | `loc, value, display "≈{v}%", label, color, scale?, dur?` — 3D data column on the map |
| `callout` | `loc, place, icon, screen [x,y], reply {at, color}` — arc from the map to an off-map actor (Washington, UN, Beijing) |
| `stamp` | `text, icon?, color, screen [x,y], note?` — big slam stamp (GREEN LIGHT, 1993, ALL DENY IT) |
| `bubble` | `screen [x,y,w], kicker, text, color` — quote/claim bubble |
| `card` | `screen [x,y,w], title, badge?, color, rows [{icon, text, at}]` — fact card |
| `note` | `text, sub?, y` — small centred caption line |

Icons: `check x eye jet plane drop flame flag shield money ship factory people chip barrel bolt nuke wheat`.

### Data overlays (full-screen, over a dimmed backdrop)
- `quote` — `at, lines [[text, color]], by` (only real, sourced quotes)
- `counter` — `label, sublabel?, icon barrel|<icon>, value, start?, prefix, suffix, doneSuffix, decimals, format money?, at, doneAt, note, source`
- `bars` — `label, sublabel, format money?, bars [{label, sub, value, display?, color, at, dur}], badge {text, at}, source`
- `gauge` — `label, value, max?, prefix, suffix, icon, at, doneAt, note, source`
- `facts` — `items [{icon, big, text, color, at}], source` (up to 3 stacked fact cards)

## Screen layout (1080×1920, YouTube Shorts safe zones)
- 0–150: platform UI · 168–245: section header · 250–1150: stage · 1270–1360: captions · 1500+: platform UI (title, buttons). Right edge x > 960 is covered by buttons from y ≈ 900.
