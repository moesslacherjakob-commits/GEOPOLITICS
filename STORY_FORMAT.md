# Story format (`stories/<id>.json`, `desks/<desk>/stories/<id>.json`)

One file = one Short. The engine renders it with `./make.sh stories/<id>.json` (@GEOPOLITICS4YOU) or `./make.sh desks/<desk>/stories/<id>.json` (other channels).
Two full examples: `stories/2026-10-09-second-front.json` (Gulf / oil) and `stories/2026-10-09-ethiopia-eritrea.json` (Horn of Africa). Climate example with `track` + `field`: `desks/climate/stories/2026-10-10-isaias-late-hurricane.json`. Markets example with `ticker`, `counter`, `chain`, `quote`: `desks/economy/stories/2026-10-09-spacex-spectrum-telecoms.json`.

**Channel config:** a story inside `desks/<desk>/stories/` automatically uses `desks/<desk>/config.json` (channel handle on the thumbnail, accent colour via `theme`, voice, disclaimer, pronunciations); everything else uses the root `config.json`. `$GEO_CONFIG` overrides both.

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
`text, mute, accent (gold — each desk config overrides it with the channel colour), danger (red), ally (orange), oil (amber), info (cyan), ok (green), neutral (grey), violet, heat (orange), cold (blue), storm (pale cyan)` or any `#hex`.

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
| `track` | `points [{loc, cat?, label?, dx?, dy?, big?, until?}], steps? [{at, to, dur?}], dur?, forecast?, now?, cone?, coneStart?, coneGrow?, name?, sub?, nameDx?, nameDy?, nameUntil?, eyeSize?, color?` — storm path. `cat` colours the dot (`TD TS 1 2 3 4 5 EX`, Saffir-Simpson colours). Points from index `forecast` on are dashed/hollow (with an optional widening `cone`). A spinning hurricane symbol + `name` tag sits on point `now`. Without `steps` the line draws once over `dur`; with `steps` it advances to point `to` at each anchor — use this to follow the narration. Point `until` hides its label. |
| `field` | `blobs [{loc, r (degrees), v (0–1)}], palette heat\|fire\|rain\|cold\|drought\|[#hex..], clip? (iso, [isos] or "land"), alpha?, grow?, blend?, pulse?, legend? {title, low, high, screen [x,y], w}` — soft heat-map area (heatwave, rain totals, fire zone, warm ocean). Always label it "illustrative" or "approximate" unless it is drawn from real gridded data. |

Icons: `check x eye jet plane drop flame flag shield money ship factory people chip barrel bolt nuke wheat storm thermo rain`.

### Data overlays (full-screen, over a dimmed backdrop)
- `quote` — `at, lines [[text, color]], by` (only real, sourced quotes)
- `counter` — `label, sublabel?, icon barrel|<icon>, value, start?, prefix, suffix, doneSuffix, decimals, format money?, at, doneAt, note, source`
- `bars` — `label, sublabel, format money?, bars [{label, sub, value, display?, color, at, dur}], badge {text, at}, source`
- `gauge` — `label, value, max?, prefix, suffix, icon, at, doneAt, note, source`
- `facts` — `items [{icon, big, text, color, at}], source` (up to 3 stacked fact cards)
- `chart` — line chart: `label, sublabel, color, series [{values [..], color?, label?, width?}]` (or just `values`), `xLabels [..]` (same length, "" to skip), `prefix, suffix, decimals, axisDecimals, format money?, yMin?, yMax?`, `at, dur` (draw time), `events [{i, text, sub?, color, at, y?}]` (dashed marker at index i), `band {from, to, color, text, at}` (shaded range), `change` + `changeFormat {decimals, suffix, prefix}` (pill next to the end value), `endText?`, `endLabel false?`, `area false?`, `upColor/downColor`, `note, source`. **Only real data points** — never invent or smooth values.
- `ticker` — market board: `label, sublabel, rows [{name, sub?, value?, change (number, %), display?, color?, icon?, at}]` (≤ 3 rows render large, up to 6), `format {decimals, suffix}`, `upColor/downColor`, `note, source`. Green/red and the arrow follow the sign of `change`.
- `chain` / `flow` — cause → effect or how-it-works diagram: `label, color, steps [{icon, title, sub?, color?, dir? up|down, dirColor?, at}]` (2–5 steps, arrows draw between them), `source`.
- `timeline` — vertical timeline: `label, color, items [{date, title, sub?, color?, big?, at}]` (≤ 5 items), `source`.
- `scale` — size comparison: `label, sublabel, color, items [{name, value, display, color?, icon?, at}]` (2–4 circles, area ∝ value), `maxRadius?, prefix/suffix/decimals` (for values without `display`), `note, source`.

## Screen layout (1080×1920, YouTube Shorts safe zones)
- 0–150: platform UI · 168–245: section header · 250–1150: stage · 1270–1360: captions · 1500+: platform UI (title, buttons). Right edge x > 960 is covered by buttons from y ≈ 900.
