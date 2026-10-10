# Desks — the 4YOU channel family

One repo, one engine, one folder per channel. @GEOPOLITICS4YOU still runs from the repo root (`PLAYBOOK.md`, `config.json`, `stories/`, `log.md`, branch `media`); the other channels live here and follow `desks/PLAYBOOK.md`.

| desk | channel | Metricool blogId | post (Vienna) | days | media branch | status |
|---|---|---|---|---|---|---|
| `climate` | @CLIMATE4YOU | 7344931 | 20:30 | daily | `media-climate` | live — map layers `track` + `field`, `DESK.md`, `ROUTINE_PROMPT.md` (routine daily 18:30) |
| `economy` | @ECONOMY4YOU | 7344911 | 14:45 | weekdays | `media-economy` | live — overlays `ticker`, `chart`, `chain`, `DESK.md`, `ROUTINE_PROMPT.md` (routine Mon–Fri 12:45) |
| `scitech` | @SCITECH4YOU | 7344936 | 17:00 | daily | `media-scitech` | live — overlays `flow`, `timeline`, `scale`, `DESK.md`, `ROUTINE_PROMPT.md` (routine daily 14:55) |

All desks publish automatically (`autoPublish: true`, Jakob's decision 2026-10-10).

## Per desk
- `config.json` — channel, Metricool brand, post time, days, YouTube category, media branch, disclaimer (base text + desk line), `theme.accent`, pace, voice + `voice.say`
- `DESK.md` — sources, story selection, desk rules, visual grammar, upload conventions
- `ROUTINE_PROMPT.md` — the prompt for the desk's daily routine on claude.ai/code/routines (environment **Default**, repo GEOPOLITICS, connector Metricool)
- `stories/`, `log.md`

## Routine
All three routines exist (created 2026-10-10). Their prompt only points to the desk's `ROUTINE_PROMPT.md`, so the daily run is changed in the repo, not in the routine. To add a desk: create one routine per desk on claude.ai/code/routines: environment **Default** (it holds the ElevenLabs network secret), repo GEOPOLITICS, connector Metricool only, prompt = the desk's `ROUTINE_PROMPT.md`, schedule two hours before the post time (climate: daily 18:30 Vienna). Stagger desks so no two runs push at the same time.
