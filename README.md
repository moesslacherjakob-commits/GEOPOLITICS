# GEOPOLITICS — automated geopolitics Shorts

Daily 60-second motion-graphic Shorts for **@GEOPOLITICS4YOU**.

- `engine/engine.mjs` — renders a story file (script + scene list) into 1080×1920 frames: 3D globe, tilted 3D maps with extruded countries, arcs, routes, ships, blockades, data scenes, word-by-word captions.
- `engine/audio.py` — music bed + sound effects, cued from the story.
- `make.sh` — one command: `./make.sh stories/<id>.json` → `out/<id>/short.mp4`, `short_clean.mp4`, `cover.png`, `upload.json`.
- `data/` — Natural Earth (public domain) countries, globe and gazetteer, prebuilt by `data/prep.py`.
- `stories/` — one JSON per episode. See `STORY_FORMAT.md` and `PLAYBOOK.md`.

Runtime: Node 22 with `@napi-rs/canvas` + `d3-geo`, Python 3 with numpy/scipy/pillow, ffmpeg — `./setup.sh` installs whatever is missing on a fresh machine.
Voice: ElevenLabs (`tools/tts_elevenlabs.py`), key supplied by the cloud environment's network secret for `api.elevenlabs.io`.
Fonts: Anton and Inter (both SIL OFL, in `assets/fonts`).
Daily run: a routine on claude.ai/code (environment **Default**, repo GEOPOLITICS, connector Metricool) follows `PLAYBOOK.md`.
TikTok: every channel's video also goes to one shared TikTok account at the same time (`config.json → tiktok`, PLAYBOOK step 8b); the step skips itself until TikTok is connected in Metricool to brand `tiktok.blogId`.

**Long-form** (YPP goal: 8,000 h long-form watch time): `"format": "long"` stories in `longform/` render 9–12-minute 16:9 videos with chapters, free/public-domain footage (`tools/footage.py`: Pexels, Pixabay, Wikimedia Commons, NASA) and a 1280×720 thumbnail. The daily routine makes them on Sundays (weekly recap) and Wednesdays (explainer) after the Short — see `LONGFORM.md`.

**Sister channels** (@CLIMATE4YOU, @ECONOMY4YOU, @SCITECH4YOU) share the same engine and live in `desks/` — see `desks/README.md` and `desks/PLAYBOOK.md`. A story inside `desks/<desk>/stories/` automatically renders with that desk's `config.json`.
