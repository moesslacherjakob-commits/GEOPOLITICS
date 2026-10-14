# Daily run — @GEOPOLITICS4YOU

You are producing today's 60-second geopolitics Short end to end. Work unattended: make reasonable calls yourself, note them in the final report. Settings live in `config.json`.

## 0. Setup (2–5 min)
1. Repo: when this runs as a routine on claude.ai/code the repo is already cloned in the working directory — use it (`git rev-parse --show-toplevel`). Otherwise attach it with `add_repo` → `moesslacherjakob-commits/geopolitics` (access `push`) and `git clone --depth 1 https://github.com/moesslacherjakob-commits/geopolitics` (10-min timeout). Work on `main`. If `git config user.email` is empty, set `git config user.name "GEOPOLITICS4YOU bot"` and `git config user.email "bot@geopolitics4you.invalid"`.
2. `./setup.sh` — installs ffmpeg, numpy/scipy/pillow and the node packages if the machine lacks them and must end with `setup: all good`. Fix install problems yourself (apt, pip and npm are reachable).
3. Read `config.json`, `STORY_FORMAT.md`, `ENGAGEMENT.md` (hook, CTA, title, thumbnail = first frame), and `log.md` (what was covered on previous days).
4. Voice: the ElevenLabs key comes from the cloud environment's network secret for `api.elevenlabs.io` (it is attached by the proxy; you never see it). Never ask for, print or store a key. The key is restricted to Text-to-Speech, so `/v1/user/*` endpoints return 401 — that is expected and not an error.

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
`hook` (≤ 14 words: stakes + an open question, see `ENGAGEMENT.md`) → `f1`, `f2`, `f3` (one fact block each, ~35–45 words, answer the hook's question in f2/f3) → `cta`: a neutral yes/no question about what happens next ("…? Yes or no?").
- **Follow `ENGAGEMENT.md`** for hook, CTA, title and thumbnail — it is the reason people stop swiping.
- The video is narrated: write for the ear — short sentences, numbers as people say them, no parentheses or slashes. Pacing is calm (~125 wpm), so a 145-word script runs ~73 s; videos are 70–78 s.
- Abbreviations the voice must spell (US, UN, IEA …) go in `config.json → voice.say`; add new ones there if needed.
- Plain, neutral, attributed. No opinions, no loaded labels, no invented quotes, numbers exactly as sourced. Paraphrase — never copy article sentences.
- Check: `node engine/engine.mjs stories/<id>.json check` → no WARNING (speech must end before ~75 s).

## 4. Storyboard
Write `stories/<YYYY-MM-DD>-<slug>.json` following `STORY_FORMAT.md` (copy the closest example and adapt — but write hook, CTA and thumbnail fresh per `ENGAGEMENT.md`; older stories use the old style).
- Globe hook → 3D map (camera moves per fact) → optional data overlay (quote/counter/bars/gauge/facts) when the story has hard numbers → end globe with two punchlines.
- Vary the look day to day (different scene mixes, colours, overlays) — YouTube demonetises repetitive template content.
- Every on-screen number/claim needs a source line or label.
- Globe `headline`: anchor it on the 3rd–5th hook word so it lands within ~2.5 s.
- Add a `thumbnail` block per `ENGAGEMENT.md` §6: `at` (strong map moment), `focus` (the sharp motif), `number` (if the story has one) + `source`, `lines` (1–2 lines, ≤ 3 words, adding to the title — never repeating it). **It is also the first second of the video** (opener). Check: `node engine/engine.mjs stories/<id>.json thumb /tmp/qa/thumb.jpg`, look at it at small size, and include `0,0.5,1.2,2.5` in the QA stills.

## 5. QA loop (max 3 rounds)
`node engine/engine.mjs stories/<id>.json stills /tmp/qa <~12 times across the video>` then `python3 tools/sheet.py /tmp/qa/sheet.png /tmp/qa/still_*.png` and **look at the sheet**. Fix: overlapping labels, text in caption zone (y 1240–1400) or under the right-hand buttons, things too small to read, empty frames, wrong countries highlighted. Zoom the camera in when a detail is too small.

## 6. Voice + render (≈ 35–45 min)
`make.sh` first generates the voiceover (ElevenLabs, `tools/tts_elevenlabs.py`) and re-times captions and animations to the real voice; QA stills from step 5 use estimated timing, so expect small shifts. If the voice fails (e.g. ElevenLabs unreachable or out of credits) it renders captions-only and prints a WARNING — say so in the report.
`nohup ./make.sh stories/<id>.json 2 > /tmp/make.log 2>&1 &` and poll `tail /tmp/make.log` (tool calls time out after 10 min — never run it in the foreground). Output in `out/<id>/`: `short.mp4` (captions, < 30 MB), `short_clean.mp4`, `cover.png`, `thumb.jpg` (designed thumbnail), `upload.json`.
Verify: duration 70–78 s, size < 30 MB, `upload.json → voice` is true (or explain why not), extract 3 frames with ffmpeg and look at them.

## 7. Publish the video file
Metricool needs a public URL. Push the file to the orphan `media` branch (overwritten daily, keeps the repo small):
```
cd out/<id> && rm -rf /tmp/media && mkdir /tmp/media && cp short.mp4 /tmp/media/<id>.mp4 && cp cover.png /tmp/media/<id>.png && cp thumb.jpg /tmp/media/<id>-thumb.jpg
cd /tmp/media && git init -q -b media && git add . && git commit -qm "<id>" && git push -f https://github.com/moesslacherjakob-commits/GEOPOLITICS media:media
```
URLs: `https://raw.githubusercontent.com/moesslacherjakob-commits/GEOPOLITICS/media/<id>.mp4` and `.../media/<id>-thumb.jpg` (repo must be public).

## 8. Schedule on YouTube via Metricool
`createScheduledPost` with `blogId` from `config.json`, `providers: [{"network":"youtube"}]`, `text` = `description` from `out/<id>/upload.json` (already contains the AI disclaimer from `config.json` — never remove it), `media: [<URL>]`, `youtubeData: {title, type: "short", privacy: "public", tags, category: "NEWS_POLITICS", madeForKids: false, isAiGeneratedContent: false}`, and — if `config.thumbnail` is true — `videoThumbnailUrl: <thumb URL>`. If Metricool rejects the post with `VIDEO_THUMBNAIL_NOT_APPLICABLE` (channel not yet eligible for custom Shorts thumbnails), schedule it again **without** `videoThumbnailUrl` and mention it in the report. Never let the thumbnail block the upload. `autoPublish` from `config.json`, `publicationDate` = today at `config.postTime` (Europe/Vienna) or +20 min if that time has passed.
`autoPublish: true` (current setting): Metricool publishes automatically at the slot — there is no human approval, so the research and QA steps above are the only safety net. Your report reaches Jakob before the slot, so he can still pull a video in Metricool if he spots a problem.

## 8b. Same video on TikTok (shared 4YOU TikTok account)
One TikTok account carries the videos of all four channels. Its settings come from the root `config.json → tiktok` and are copied by `make.sh` into `out/<id>/upload.json → tiktok` (`enabled`, `blogId`, `privacyOption`, `isAigc`, `title`, `caption`). Do this **only after the YouTube post is scheduled**:
1. If `tiktok.enabled` is false → skip. Otherwise call `getBrandSettings`: if the brand whose `id` is `tiktok.blogId` has no TikTok entry in `networksData` (a key containing "tiktok") → skip and write "TikTok: übersprungen – noch nicht in Metricool verbunden" in the report. Check this on every run; as soon as Jakob connects TikTok, the step starts by itself.
2. Otherwise schedule a **separate** `createScheduledPost` — never put TikTok into the YouTube post, a TikTok error must never block or change the YouTube post: `blogId` = `tiktok.blogId`, `providers: [{"network":"tiktok"}]`, `text` = `tiktok.caption` (title + description with sources, hashtags and the AI disclaimer, no `#shorts`, ≤ 2,200 characters — never remove the disclaimer), `media: [<the same mp4 URL>]`, `tiktokData: {privacyOption: <tiktok.privacyOption>, disableComment: false, disableDuet: false, disableStitch: false, commercialContentThirdParty: false, commercialContentOwnBrand: false, autoAddMusic: false, isAigc: <tiktok.isAigc>}`, and — if `thumbnail` is true — `videoThumbnailUrl: <the same thumb URL>` (TikTok uses it only on Business accounts). Same `autoPublish` and the **same `publicationDate`** as the YouTube post.
3. Errors: on `VIDEO_THUMBNAIL_NOT_APPLICABLE` schedule again without `videoThumbnailUrl`; if Metricool asks for a TikTok title, schedule again with `tiktokData.title` = `tiktok.title`. Any other error: leave YouTube as it is, don't retry more than once, and put the error message in the report.
4. `tiktok.blogId` may be another channel's Metricool brand (currently @GEOPOLITICS4YOU). Posting the TikTok post there is allowed and expected; never post YouTube there for another channel and never edit or delete other posts in that planner.

## 9. Wrap up
- Append one line to `log.md`: date · topic · title · sources · Metricool planner URL (YouTube), followed in the same cell by ` · TikTok: <planner URL>` or ` · TikTok: skipped`.
- Commit `stories/<id>.json` + `log.md` to `main` and push.
- Final message (also via SendUserMessage if that tool exists), in German: topic, why it won, title, the 3 facts, sources, anything flagged as uncertain, whether voice and thumbnail made it, link to the Metricool post, and the TikTok status (scheduled + link / skipped – not connected / error).
