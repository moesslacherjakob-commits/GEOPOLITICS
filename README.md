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
