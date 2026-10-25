# Long-form videos — @GEOPOLITICS4YOU (16:9, 9–12 min)

Why: from 1 Feb 2027 the YouTube Partner Program needs **1,000 subscribers + 8,000 hours of long-form watch time in 12 months** (Shorts watch time never counts). Two long videos a week build that library; the daily Shorts stay as the funnel. Everything runs unattended — the only manual step Jakob keeps is linking matching Shorts to the long video in YouTube Studio (the report gives him the list).

Schedule (Europe/Vienna, `config.json → longform`):
- **Sunday — weekly recap** "This Week in Geopolitics": the five biggest stories of the week as a countdown.
- **Wednesday — explainer**: one evergreen question behind the news ("Why…", "Who are…", "What happens if…").
- Produced by the daily routine **after** the Short is scheduled (ROUTINE_PROMPT.md step 5). Published at `longform.postTime` (17:30).
- A failed long-form run never touches the Short. If you cannot finish safely, schedule nothing and report.

Example of every building block: `longform/examples/hormuz-explained-example.json` (format demo only — never publish it).

---

## 1. Pick the topic (10 min)
**Explainer (Wednesday)**
- Start from the story families that perform: call Metricool `getAnalyticsDataByMetrics` (brand `metricoolBlogId`, last 30 days, metrics `YTVP01, YTVP17, YTVP06, YTVP08`) and see which topics got the most views and the longest average view duration.
- Pick ONE question a viewer would type into YouTube search, tied to this week's news: `longform/topics.md` holds a backlog; add new ideas there.
- Not covered in `longform/log.md` during the last 8 weeks. Must be explainable with maps, numbers and a timeline.

**Recap (Sunday)**
- The week's five biggest geopolitical stories = this week's Shorts in `log.md` (Mon–Sun), re-checked for new developments. Replace a Short's story if something bigger happened.
- Order as a countdown #5 → #1; #1 is the story with the biggest consequences — promise it in the intro.

## 2. Research (20 min)
- ≥ 3 independent sources per explainer (wire services, major papers, broadcasters) plus primary sources for evergreen numbers (EIA, IEA, UN, World Bank, SIPRI, IISS, official statements). Recap: ≥ 2 independent outlets per story.
- Collect facts as *who says what* with dates. Mark unverified items as claims on screen ("CLAIM", "REPORTED", "PER …"). Never state one side's claim as fact. No invented quotes.
- Paraphrase, never copy article sentences. Quotes on screen ≤ 15 words and only when the exact wording matters.
- Collect 1–3 **primary texts** for `document` scenes: the exact wording of an official statement, resolution, treaty clause, law or filing (copy it word-for-word from the official page, keep the URL and date). Never use a news article's own sentences as a document.

## 3. Script (English, 1,300–1,700 words ≈ 9–12 min at ~145 wpm)
Segment ids are fixed so chapters, timing and checks work:

| id | words | job |
|---|---|---|
| `hook` | 20–40 | 0:00–0:12. One concrete, surprising fact that proves the title, plus the stakes. No greeting, no channel name, no "in this video". |
| `promise` | 40–70 | to ~0:30. Why it matters to the viewer, the 3 questions the video answers, and **one open loop** kept until the end ("…and the one number traders fear most"). |
| `ch1` | 200–280 | first payoff: answers question 1 within the first ~2 minutes. May end with one natural subscribe line ("If you want one of these every Wednesday, subscribing is how you get it.") — the only call to action before the end. |
| `ch2`…`ch4` (`ch5`) | 200–300 each | each opens with a mini-hook (a question or a tension), delivers one "aha" visual, and around the middle of the video comes a twist. |
| `outlook` | 150–250 | "What happens next": 2–3 scenarios **as stated by sources or analysts** (no own predictions). Resolve the open loop here. |
| `next` | 25–40 | teaser of a related video ("watch next"). Never "in conclusion", "thanks for watching" or a recap — those signals make people leave. |

Recap: `hook` (the week's biggest moment) → `promise` ("five stories — number one could change…") → `ch5` … `ch1` (countdown, ~230 words each) → `outlook` (what to watch next week) → `next`. Each chapter starts straight with the story ("Number five: Alberta voted…") — the ranking is shown, never justified. The only allowed hint is **once, in `promise`, three words: "ranked by impact"** (e.g. "Five stories, ranked by impact.") — nothing more, no criteria, no per-story reasons.

**No meta talk (Jakob, 2026-10-25 — nobody cares):** never explain how the topics were chosen, how or why they are ranked or ordered (the single exception: "ranked by impact" once in the recap `promise`) ("the order is editorial", "I rank them by…", "why does this rank fifth? Because…", "this ranks second because…"), what the video will do or show ("I will count them down", "for each you will see who said what"), or refer back to the script itself ("that is the window I promised", "here is the summary"). Every sentence is about the world, not about the video. Attribution ("according to AP", "a claim that could not be verified") stays — that is content, not meta talk. `check` warns on typical phrases.

Rules: write for the ear (short sentences, numbers as spoken, no parentheses or slashes); address the viewer as "you"; concrete examples over abstractions; neutral and attributed; vary sentence openings; no filler or AI clichés ("delve", "let's dive in", "buckle up", "in today's video", "game-changer"). Add `"pauseBefore": 0.4` to each chapter's first segment. Abbreviations the voice must spell go into `config.json → voice.say`.
Check: `node engine/engine.mjs longform/<id>.json check` → no WARNING.

**Audience — make the viewer play along (Jakob, 2026-10-25):**
- **One quiz per video** (`quiz` scene), between 30 % and 60 % of the runtime, on a fact the next sentence reveals: the script asks it ("Quick question: how much of Donetsk does Russia hold today? Take a guess."), the quiz shows 3 plausible options and a 3-second countdown, the narration gives the sourced answer at `revealAt`. Never a trick question, never an unsourced answer.
- **One comment prompt** (`prompt` scene) in `outlook`: a direct yes/no or A/B question ("Will talks start before mid-November? Tell us in the comments: yes or no."). `upload.firstComment` asks the same question.
- **Why it matters to you:** each chapter has one sentence on what the story means for the viewer — prices, energy, travel, security — stated as facts with attribution, never as our prediction.
- **Pull forward:** a chapter may end with a one-line teaser about the next story's content ("Next: the vote that split a province."), never about how the video is made or ranked.

## 4. Storyboard (`longform/<YYYY-MM-DD>-<slug>.json`, `"format": "long"`)
Same story format as the Shorts (`STORY_FORMAT.md`), rendered at **1920×1080, 24 fps**. Differences:
- `sections` = YouTube chapters: one per chapter segment (`ch1`, `ch2`, …, `outlook`, `next`), with `n`, an on-screen `name` (CAPS, ≤ 4 words) and a `chapter` title for the description (a question or tension, not a label). The intro (hook + promise) becomes chapter `0:00` automatically (`upload.introChapter`).
- **Visual rhythm:** a new visual element every 4–8 s (camera move, marker, label, overlay row); a format change every 45–60 s (map → footage → overlay → map …). Per chapter: one `map` scene with 5–10 camera keys, at least one data overlay (`facts`, `bars`, `chart` with real data only, `timeline`, `scale`, `chain`, `quote`, `ticker`, `counter`, `gauge`) and 1–3 footage shots.
- **Annotated beat in every chapter:** at least one moment where a graphic points at something *while the voice says it* — a `document` excerpt whose key phrase gets highlighted/underlined/circled, or a footage shot with `marks` (circle around the ship, arrow to the terminal, zoom into the paragraph, highlight on the line). This is what keeps eyes on the screen; a still photo without a mark is the weakest shot in the video. Formats and fields: `STORY_FORMAT.md` → `document` and *Footage marks*.
- **Show what is said — action on screen (Jakob, 2026-10-25: "too little action, often only the country is marked and then nothing"):** the map tells the story sentence by sentence. Every sentence that names a place, an actor, a number, a demand, an attack, a movement or a date gets its own visual **on its key word**. Highlighting a whole country and then talking for 20 seconds is the failure to avoid. Translate:

  | the script says | show it with |
  |---|---|
  | X demands / claims / annexed region R | `tint` on the region code (`UA-14`) with `hatch` + `pulse`, `tag` "MOSCOW DEMANDS ALL OF IT" |
  | front line, who holds what, "has not captured" | `front` along the towns the source names (labelled "APPROX. FRONT LINE · ISW, 24 Oct"), occupied regions `tint hatch`, towns still held as `marker` + label |
  | offensive, advance, troops move, pressure on a city | `push` arrow from where to where, city `marker` |
  | attack, strike, drone wave, explosion | `arc` from launch area to target + `marker` style `x`, `column`/`counter` for numbers |
  | talks, meeting, envoy, summit | `marker` on the venue + `callout` to the capitals involved, `card` with who met whom |
  | vote, referendum, election result | region `tint` by result, `bars` with the numbers, `tag` with turnout |
  | ships, oil, trade route, blockade | `route`/`movers`/`barrier`, `column` with the volume |
  | a number | on screen the moment it is spoken (`column`, `counter`, `stamp`, lower third) |
  | a date / deadline | `timeline` or a `stamp` with the date |
  Camera: move with the story — close-up (`dist` 6–8) on the region being discussed, `detail: ["UKR"]` for internal borders, pull back for the overview. **`check` must report 0 gaps > 6 s** ("nothing new on screen …" lists the exact sentence to fix) and ≥ 12 visual beats per minute. Keep ≤ 3 labels visible at once (end old ones with `until`; labels step aside automatically, but fewer is cleaner).
- **Chapter cards** are automatic in long-form: at each chapter start a big number + chapter name slams in for ~1.7 s (recap: the countdown 05 … 01). `"card": false` on a section turns one off.
- **Mix:** own maps/graphics ≥ 55 % of the runtime, footage ≤ 35 % (`check` warns above 40 %), no footage shot longer than 8 s, never more than two shots in a row. Pure stock footage under an AI voice is exactly what YouTube refuses to monetise — the maps carry the video.
- **Every footage shot lies on top of a map scene covering the same time.** If an asset is missing the map shows instead, so the video never breaks.
- Screen (1920×1080): chapter label top left (0–130), footage label/credit top right, stage 130–880, lower thirds 820–940, captions ~950–1010. Screen-space layers use 1920×1080 coordinates (cards x 70 y 170, stamps x 960 y 260, notes centred). Overlays are drawn in a centred panel automatically. Map camera `oy` 20–60.
- **Camera holds:** the camera interpolates between keys, so a key 20 s later means a 20-second drift that pushes labels into each other. Add a hold key at the end of a beat (same view, slightly different `dist`) and let big moves take 1–2 s.
- Globe hook: `R` 360–420 so the headline (y 150) stays readable; `exit: "zoom"` into the map like the Shorts.
- `end` scene = the `next` teaser: two lines naming the next video, sources small.

**Footage scene**
```json
{"type": "footage", "asset": "f03", "from": "ch1:Every -0.2", "to": "ch1$ +0.3",
 "query": "oil tanker at sea aerial", "kind": "video", "symbolic": true,
 "move": "in", "focus": [0.5, 0.45], "start": 0, "pick": 0,
 "lower": {"kicker": "EVERY DAY · EIA, 2024", "text": "≈ 20 MILLION BARRELS THROUGH HORMUZ", "at": "ch1:twenty"}}
```
- `query`: 2–5 concrete English nouns ("container ship port night", "Tehran skyline", "drone strike damage power plant" ✗ — no violence). `kind`: `video` (preferred), `image` or `any`.
- `symbolic: true` (default) → on-screen label **ILLUSTRATIVE**: stock footage that only *represents* the subject. `false` → **FILE**: only when the asset really shows the subject (the actual ship, the actual summit) and its date is known — mention the date in `lower`.
- `move`: `in`, `out`, `left`, `right`, `up`, `down`, `none` (photos default to a slow zoom/pan, videos to a gentle zoom-in). `focus`: point in the picture to keep in frame. `start`: seconds into the clip.
- `lower`: optional lower third (kicker + one line). `label`/`credit` come from the manifest automatically.
- `marks`: motion graphics on the picture, e.g. `[{"type": "zoom", "rect": [0.28, 0.30, 0.67, 0.46], "at": "ch1:narrowest -0.4"}, {"type": "highlight", "x": [0.279, 0.409], "y": 0.391, "at": "ch1:twenty-one"}]` or `[{"type": "circle", "c": [0.72, 0.63], "r": 0.17, "ry": 0.13, "label": "LNG CARRIER", "at": "ch2:gas"}]`. Coordinates come from the grid image (section 5), never guessed. Photos are the best canvas; on video only static shots.

**Document scene** (verbatim primary text, see `STORY_FORMAT.md`):
```json
{"type": "document", "from": "ch3:statement -0.3", "to": "ch3$ +0.2", "kicker": "JOINT STATEMENT", "source": "mofa.gov.xx · 21 Oct 2026",
 "title": "…", "paragraphs": ["<exact wording, ≤ 120 words>"],
 "marks": [{"text": "<phrase exactly as in the text>", "style": "highlight", "at": "ch3:principle"}, {"text": "…", "style": "underline", "at": "ch3:after"}]}
```
Keep it on screen ≥ 4 s per mark; the narration paraphrases or reads the marked phrase at the same moment.
- **Never:** real violence, casualties, weapons fired at people, anything distressing; TV/agency/social-media material; recognisable logos or brands (Pixabay forbids them commercially); photos of real people from stock sites. Politicians only from public-domain official photos on Wikimedia Commons, never altered.

**Thumbnail block** (16:9, written as 1280×720): `at` (a sharp map or footage moment), `focus` (place/ISO3/[lon,lat] or `{x,y}` — pushed to the right third), `number` (the one big number, exactly as sourced), `lines` (max 2 lines, ≤ 3 words each, one in `accent`), `source` (required with a number or claim), optional `kicker`. Text must not repeat the title. Check it at small size: `node engine/engine.mjs longform/<id>.json thumb /tmp/qa/thumb.jpg`.

**Title** (`upload.title`, ≤ 60 characters, no `#shorts`): specific (a number, a place, an actor) + curiosity, honest, not all caps. **Description**: first paragraph = what the video answers, with the search terms; then `Sources:` list; hashtags last. Chapters, footage credits and the AI disclaimer are added automatically. `upload.firstComment`: a "Watch next: <title> <URL>" line pointing to the best matching earlier long video (URL via Metricool `YTVV05`/`YTVV17`), if any.

## 5. Footage (10–15 min)
```
python3 tools/footage.py check                      # which providers this machine reaches — put the result in the report
python3 tools/footage.py candidates longform/<id>.json
```
Look at every `out/<id>/footage/sheet_*.jpg` (Read the images). For each scene: does candidate 0 really match the sentence being spoken? If not, set `"pick": <index>`; if none fits, change `query`/`kind` and run `candidates` again (max 2 rounds), or set `"pick": false` (the map stays). Then:
```
python3 tools/footage.py fetch longform/<id>.json   # downloads, normalises, writes manifest.json + credits.json
python3 tools/footage.py grid longform/<id>.json    # coordinate grid per asset: out/<id>/footage/grid_<asset>.jpg
python3 tools/footage.py grid longform/<id>.json f03 0.2 0.3 0.7 0.5   # zoomed grid of a region (exact text lines)
```
Now place the `marks`: Read each `grid_<asset>.jpg`, pick the object or text line the sentence is about and copy its coordinates (x gold, y blue). For text: highlight `y` = middle of the line, underline `y` = just below the letters, `x` = first and last letter. A scene with a `zoom` mark gets a larger image on fetch, so run `fetch` again if you added a zoom afterwards.
Providers and licences: Pixabay (free licence, no credit required — credited anyway), Wikimedia Commons (only public domain, CC0 or CC BY — the tool filters), NASA (public domain, no endorsement). Key: env `PIXABAY_API_KEY`. Pexels is supported but **off** (no key, since 2026-10-25) — it is only used when `config.json → longform.footage.providers` lists it; never switch it on yourself. Hosts the environment must allow: see the top of `tools/footage.py`. If providers are unreachable, render anyway and say so in the report ("Footage: x/y — <provider>: <reason>").
Assets used in the last 90 days are skipped automatically (`data/footage_used.json`), so the same clip never repeats.

## 6. QA — automatic, two passes (no human approval)
1. **Stills:** `node engine/engine.mjs longform/<id>.json stills /tmp/qa <18–24 times across the video, incl. 0,3,8,15, and every mark time + 0.8 s>` → `python3 tools/sheet.py /tmp/qa/sheet.png /tmp/qa/still_*.png` → look. Fix overlaps, empty frames, unreadable labels, wrong countries, footage that doesn't match the words, **marks that miss their target** (ring not around the ship, highlight off the line) — adjust the coordinates and render the still again.
2. **Independent review:** start a sub-agent with the Agent tool (fresh context, it has not seen your work). Give it: the story path, the list of sources you used (URLs), the footage sheets, `longform/log.md` and this checklist — it must answer PASS or a numbered list of fixes:
   - every number/claim in the script is backed by a listed source and attributed; claims are labelled as claims; nothing presented as fact that a source only reports as allegation;
   - no own predictions; scenarios are attributed;
   - footage: each shot matches its sentence, licence is allowed, label correct (ILLUSTRATIVE/FILE), nothing violent or distressing, no logos;
   - marks: each mark sits on the object/words it claims, its label is true (an "ILLUSTRATIVE" ship is never labelled as a specific named ship), no person is marked or named without a source caption;
   - documents: every `document` text is word-for-word identical to the official source (open the URL and compare), it is a primary text (not a news article), the marked phrase says what the narration says at that moment;
   - variety: hook type, chapter structure and look are not a copy of the last 3 entries in `longform/log.md`;
   - title and thumbnail are honest (the video delivers them) and don't repeat each other;
   - action: `check` shows no "nothing new on screen" gap; every demand/front/offensive/attack/number in the script is visible on the map at its word; front lines are labelled approximate with source and date; regions are the right ones (look at the stills);
   - audience: one quiz (question in the script, sourced answer, plausible options) and one comment prompt that matches `upload.firstComment`;
   - script has no filler, no AI clichés, no meta talk (how topics were picked, why they rank where they rank, what the video will show, "as promised"), the open loop from `promise` is resolved, chapter titles match their content.
   Fix everything, then run the review once more. If it still fails on facts or policy: **do not publish** — report why.

## 7. Voice + render (≈ 45–60 min for 10 min of video)
```
nohup ./make.sh longform/<id>.json 2 > /tmp/make_long.log 2>&1 &
```
Poll `tail /tmp/make_long.log` (never foreground; tool calls time out after 10 min). The voice uses `config.json → longform.voice` on top of `voice` (same ElevenLabs voice, speed 1.0). If the voice fails the video renders captions-only — then **do not publish** a long video (an 11-minute caption-only video hurts the channel); report instead.
Output in `out/<id>/`: `long.mp4` (1920×1080, < 90 MB), `thumb.jpg` (1280×720), `upload.json` (chapters, credits, description ≤ 4,900 characters).
Verify: duration 8–13 min, size < 95 MB, `upload.json → voice` true, `chaptersValid` true, extract 4 frames (`ffmpeg -ss <t> -i long.mp4 -frames:v 1 /tmp/qa/f<t>.png`) and look at them.

## 8. Publish
Metricool needs a public URL. Long videos go to their own orphan branch `media-long` (overwritten each time; Metricool copies the file when the post is scheduled):
```
cd out/<id> && rm -rf /tmp/media-long && mkdir /tmp/media-long && cp long.mp4 /tmp/media-long/<id>.mp4 && cp thumb.jpg /tmp/media-long/<id>-thumb.jpg
cd /tmp/media-long && git init -q -b media-long && git add . && git commit -qm "<id>" && git push -f https://github.com/moesslacherjakob-commits/GEOPOLITICS media-long:media-long
```
URLs: `https://raw.githubusercontent.com/moesslacherjakob-commits/GEOPOLITICS/media-long/<id>.mp4` and `…/<id>-thumb.jpg`.
`createScheduledPost`: `blogId` from `config.json`, `providers: [{"network": "youtube"}]`, `text` = `upload.description` (never remove the disclaimer), `media: [<mp4 URL>]`, `youtubeData: {title, type: "video", privacy: "public", tags, category: upload.youtubeCategory, madeForKids: false, isAiGeneratedContent: false}`, `videoThumbnailUrl: <thumb URL>`, `firstCommentText: upload.firstComment` (only if not empty), `autoPublish` from `config.json`, `publicationDate` = today at `longform.postTime` (Europe/Vienna).
Errors: category rejected → retry with `NEWS_POLITICS` (valid values include `EDUCATION` and `NEWS_POLITICS`); `VIDEO_THUMBNAIL_NOT_APPLICABLE` → retry without the thumbnail and tell Jakob the channel needs phone verification for custom thumbnails. No TikTok for long videos (the Shorts already go there).

## 9. Wrap up + report
- Append one line to `longform/log.md`: date · type (recap/explainer) · topic · title · duration · footage x/y · Metricool URL.
- Commit `longform/<id>.json`, `longform/log.md`, `data/footage_used.json` and push to `main`.
- Report to Jakob in German (SendUserMessage), separate from the Short report: topic and why, title, chapter list, sources, footage status, QA verdict, voice yes/no, Metricool link, and **"Shorts zum Verknüpfen"**: this week's Shorts that fit the video (title + YouTube URL from Metricool `YTVP17`/`YTVP05`) — Jakob links them in Studio (Short → Related video).
- **Sundays additionally — YPP status** (Metricool, brand `metricoolBlogId`): subscribers (`YTEV01`), long-form watch hours since 2026-11-01 (sum of `YTVV07` watch minutes ÷ 60 over videos whose title has no `#shorts`), compared with `data/ypp_plan.json` for the current month (on track / behind by x %), best and worst long video by average view duration (`YTVV08`), and one concrete change for next week. End of February: if long-form hours are below half the plan, change topics, length or thumbnail style before continuing and say what you changed.
