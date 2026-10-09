# Daily run — @GEOPOLITICS4YOU

You are producing today's 60-second geopolitics Short end to end. Work unattended: make reasonable calls yourself, note them in the final report. Settings live in `config.json`.

## 0. Setup (2 min)
1. Attach and clone the repo: `add_repo` → `moesslacherjakob-commits/geopolitics` (access `push`), then `git clone --depth 1 https://github.com/moesslacherjakob-commits/geopolitics /home/claude/geopolitics` (10-min timeout). Work in that folder.
2. Read `config.json`, `STORY_FORMAT.md`, and `log.md` (what was covered on previous days).
3. Sanity check: `node engine/engine.mjs stories/2026-10-09-ethiopia-eritrea.json check` must print a timing table.

## 1. Pick the story (10 min)
"Most-watched" is approximated by **most-covered in the last 24 h** across major outlets.
- Read today's roundups via WebSearch/WebFetch: Just Security "Early Edition: <Month D, YYYY>", Reuters World, AP Top News, BBC World, Al Jazeera. Search queries with today's date.
- Score candidates: number of major outlets leading with it · genuinely new development (not a rehash) · global stakes · can it be explained on a map in 60 s.
- Skip a topic covered in the last 2 entries of `log.md` unless there is a major escalation.
- Hard rule: the story must be supported by **≥ 2 independent outlets**. Otherwise take the next candidate.

## 2. Research (10 min)
- WebFetch 2–4 articles. Collect facts as *who says what*: numbers, places, dates, exact short quotes (≤ 15 words) only when the wording matters.
- Mark unverified items as claims in the video ("CLAIM BY …", "REPORTED", "WITNESSES"). Never present one side's claim as fact.
- Background knowledge (history, geography) is fine if stable and uncontroversial.

## 3. Script (English, ≤ 150 words)
`hook` (≤ 20 words: the twist, no throat-clearing) → `f1`, `f2`, `f3` (one fact block each, ~35–45 words) → `cta`: "Follow for the next update."
- Plain, neutral, attributed. No opinions, no loaded labels, no invented quotes, numbers exactly as sourced. Paraphrase — never copy article sentences.
- Check: `node engine/engine.mjs stories/<id>.json check` → speech must end before ~58 s.

## 4. Storyboard
Write `stories/<YYYY-MM-DD>-<slug>.json` following `STORY_FORMAT.md` (copy the closest example and adapt).
- Globe hook → 3D map (camera moves per fact) → optional data overlay (quote/counter/bars/gauge/facts) when the story has hard numbers → end globe with two punchlines.
- Vary the look day to day (different scene mixes, colours, overlays) — YouTube demonetises repetitive template content.
- Every on-screen number/claim needs a source line or label.

## 5. QA loop (max 3 rounds)
`node engine/engine.mjs stories/<id>.json stills /tmp/qa <~12 times across the video>` then `python3 tools/sheet.py /tmp/qa/sheet.png /tmp/qa/still_*.png` and **look at the sheet**. Fix: overlapping labels, text in caption zone (y 1240–1400) or under the right-hand buttons, things too small to read, empty frames, wrong countries highlighted. Zoom the camera in when a detail is too small.

## 6. Render (≈ 20–25 min)
`nohup ./make.sh stories/<id>.json 2 > /tmp/make.log 2>&1 &` and poll `tail /tmp/make.log` (tool calls time out after 10 min — never run it in the foreground). Output in `out/<id>/`: `short.mp4` (captions, < 30 MB), `short_clean.mp4`, `cover.png`, `upload.json`.
Verify: duration ≈ 60 s, size < 30 MB, extract 3 frames with ffmpeg and look at them.

## 7. Publish the video file
Metricool needs a public URL. Push the file to the orphan `media` branch (overwritten daily, keeps the repo small):
```
cd out/<id> && rm -rf /tmp/media && mkdir /tmp/media && cp short.mp4 /tmp/media/<id>.mp4 && cp cover.png /tmp/media/<id>.png
cd /tmp/media && git init -q -b media && git add . && git commit -qm "<id>" && git push -f https://github.com/moesslacherjakob-commits/geopolitics media:media
```
URL: `https://raw.githubusercontent.com/moesslacherjakob-commits/geopolitics/media/<id>.mp4` (repo must be public).

## 8. Schedule on YouTube via Metricool
`createScheduledPost` with `blogId` from `config.json`, `providers: [{"network":"youtube"}]`, `text` = description, `media: [<URL>]`, `youtubeData: {title, type: "short", privacy: "public", tags, category: "NEWS_POLITICS", madeForKids: false, isAiGeneratedContent: false}`, `autoPublish` from `config.json`, `publicationDate` = today at `config.postTime` (Europe/Vienna) or +20 min if that time has passed.
With `autoPublish: false` Jakob gets a push in the Metricool app and publishes with one tap — that is the approval step.

## 9. Wrap up
- Append one line to `log.md`: date · topic · title · sources · Metricool planner URL.
- Commit `stories/<id>.json` + `log.md` to `main` and push.
- Final message (and SendUserMessage): topic, why it won, title, the 3 facts, sources, anything flagged as uncertain, link to the Metricool post.
