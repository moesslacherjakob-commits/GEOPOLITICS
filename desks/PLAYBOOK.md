# Daily run — desk channels (@CLIMATE4YOU, @ECONOMY4YOU, @SCITECH4YOU)

You are producing today's Short for **one desk** end to end. The desk is named in your routine prompt (`climate`, `economy` or `scitech`); below it is `<desk>`. Work unattended: make reasonable calls yourself and note them in the final report.

Everything desk-specific lives in `desks/<desk>/`:
- `config.json` — channel handle, Metricool `metricoolBlogId`, `postTime`, `days`, `youtubeCategory`, `mediaBranch`, disclaimer, colours (`theme`), voice and pronunciations (`voice.say`)
- `DESK.md` — where to look for stories, how to pick one, desk rules, visual grammar
- `stories/` — one JSON per episode · `log.md` — episode log

**Never touch** the root `stories/`, `log.md`, `config.json`, `PLAYBOOK.md` or `ROUTINE_PROMPT.md` (they belong to the live @GEOPOLITICS4YOU routine), and never touch another desk's folder or media branch.

## 0. Setup (2–5 min)
1. Repo: when this runs as a routine the repo is already cloned in the working directory (`git rev-parse --show-toplevel`). Work on `main`. If `git config user.email` is empty, set `git config user.name "4YOU bot"` and `git config user.email "bot@geopolitics4you.invalid"`.
2. `./setup.sh` — must end with `setup: all good`. Fix install problems yourself (apt, pip and npm are reachable).
3. Read `desks/<desk>/config.json`, `desks/<desk>/DESK.md`, `STORY_FORMAT.md` and `desks/<desk>/log.md`.
4. Check `days` in the config: `weekdays` means Monday–Friday (Europe/Vienna). On other days produce nothing and report "kein Sendetag".
5. Voice: the ElevenLabs key comes from the cloud environment's network secret for `api.elevenlabs.io` (attached by the proxy; you never see it). Never ask for, print or store a key. `/v1/user/*` returns 401 by design.

## 1. Pick the story (10 min)
Follow `DESK.md`: its sources, its scoring and its rules. Always:
- "Most-watched" is approximated by **most-covered in the last 24 h** by major newspapers, wire services and TV broadcasters.
- Hard rule: **≥ 2 independent outlets** support the story. Otherwise take the next candidate.
- Skip a topic covered in the last 2 entries of `desks/<desk>/log.md` unless there is a major new development.
- It must be global news (not a local story) and explainable on a map, chart or diagram in about a minute.

## 2. Research (10 min)
- WebFetch 2–4 articles. If an outlet can't be fetched, use another outlet's full article rather than search-result snippets; note in the report when you had to rely on snippets.
- Collect facts as *who says what*: numbers, places, dates. Exact short quotes (≤ 15 words) only when the wording matters.
- When outlets give different numbers, use the more recent one and name its source, or leave the number out.
- Mark unverified items as claims. Background knowledge (how El Niño works, what a central bank does) is fine when it is stable and uncontroversial.

## 3. Script (English, ≤ 150 words)
`hook` (≤ 20 words, the twist) → `f1`, `f2`, `f3` (one fact block each, ~35–45 words) → `cta`: "Follow for the next update."
- Written for the ear: short sentences, numbers as people say them, no parentheses or slashes. Calm pace (~125 wpm): ~145 words ≈ 73 s; videos run 70–78 s.
- Abbreviations the voice must spell go into `desks/<desk>/config.json → voice.say`.
- Plain, neutral, attributed. No opinions, no invented quotes, numbers exactly as sourced. Paraphrase — never copy article sentences.
- `node engine/engine.mjs desks/<desk>/stories/<id>.json check` → no WARNING.

## 4. Storyboard
Write `desks/<desk>/stories/<YYYY-MM-DD>-<slug>.json` following `STORY_FORMAT.md` and the visual grammar in `DESK.md` (copy the desk's latest story and adapt it).
- Vary the look day to day (scene mix, camera, overlays) — YouTube demonetises repetitive template content.
- Every on-screen number/claim needs a source line or label; approximate geometry (tracks, areas) is labelled "approximate"/"illustrative".
- `thumbnail` block: `at` (a strong map/chart moment, not the hook), `kicker` (2–3 words), `lines` (2–3 punchy lines, ≤ 3 words each, one in `accent`). Check with `node engine/engine.mjs desks/<desk>/stories/<id>.json thumb /tmp/qa/thumb.jpg` and look at it.

## 5. QA loop (max 3 rounds)
`node engine/engine.mjs desks/<desk>/stories/<id>.json stills /tmp/qa <~12 times>` then `python3 tools/sheet.py /tmp/qa/sheet.png /tmp/qa/still_*.png` and **look at the sheet**. Fix overlapping labels, text in the caption zone (y 1240–1400) or under the right-hand buttons (x > 960 from y ≈ 900), details too small to read, empty frames, wrong places.

## 6. Voice + render (≈ 35–45 min)
`nohup ./make.sh desks/<desk>/stories/<id>.json 2 > /tmp/make.log 2>&1 &` and poll `tail /tmp/make.log` (tool calls time out after 10 min — never run it in the foreground). The first log line must read `config: …/desks/<desk>/config.json`.
Output in `out/<id>/`: `short.mp4`, `short_clean.mp4`, `cover.png`, `thumb.jpg`, `upload.json` (also carries `blogId`, `youtubeCategory`, `mediaBranch`, `postTime`, `autoPublish` from the desk config).
Verify: duration 70–78 s, size < 30 MB, `upload.json → voice` true (or explain why not), extract 3 frames with ffmpeg and look at them.

## 7. Publish the video file
Push to the desk's own media branch (`mediaBranch` in the config, e.g. `media-climate`; overwritten daily). Never push to `media` — that one belongs to @GEOPOLITICS4YOU.
```
B=<mediaBranch>; cd out/<id> && rm -rf /tmp/media && mkdir /tmp/media && cp short.mp4 /tmp/media/<id>.mp4 && cp cover.png /tmp/media/<id>.png && cp thumb.jpg /tmp/media/<id>-thumb.jpg
cd /tmp/media && git init -q -b $B && git add . && git commit -qm "<id>" && git push -f https://github.com/moesslacherjakob-commits/GEOPOLITICS $B:$B
```
URLs: `https://raw.githubusercontent.com/moesslacherjakob-commits/GEOPOLITICS/<mediaBranch>/<id>.mp4` and `…/<mediaBranch>/<id>-thumb.jpg`. Check with `curl -sI` that the mp4 URL answers 200 before scheduling.

## 8. Schedule on YouTube via Metricool
`createScheduledPost` with `blogId` = `metricoolBlogId` from the desk config, `providers: [{"network":"youtube"}]`, `text` = `description` from `out/<id>/upload.json` (already contains the desk disclaimer — never remove it), `media: [<mp4 URL>]`, `youtubeData: {title, type: "short", privacy: "public", tags, category: <youtubeCategory from the config>, madeForKids: false, isAiGeneratedContent: false}`, and — if `thumbnail` is true — `videoThumbnailUrl: <thumb URL>`. If Metricool answers `VIDEO_THUMBNAIL_NOT_APPLICABLE`, schedule again **without** `videoThumbnailUrl` and mention it. `autoPublish` from the config (currently `true` for every desk: Metricool publishes at the slot without human approval — research and QA are the only safety net). `publicationDate` = today at `postTime` (Europe/Vienna), or +20 min if that time has passed.

## 9. Wrap up
- Append one line to `desks/<desk>/log.md`: date · topic · title · sources · Metricool planner URL.
- Commit only `desks/<desk>/stories/<id>.json`, `desks/<desk>/log.md` (and `desks/<desk>/config.json` if you added pronunciations). Then `git pull --rebase origin main` and `git push origin main` (other routines push to main too; never force-push main).
- Final message (also via SendUserMessage if that tool exists), in German: channel, topic, why it won, title, the 3 facts, sources, anything flagged as uncertain, whether voice and thumbnail made it, link to the Metricool post.
