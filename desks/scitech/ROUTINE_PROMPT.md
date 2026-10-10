Daily production run for the YouTube channel @SCITECH4YOU — desk `scitech` (owner: Jakob Mösslacher, Vienna — write your report to him in German; the videos themselves are in English).

1. Get today's date and time with `TZ=Europe/Vienna date`. The repository moesslacherjakob-commits/GEOPOLITICS is already cloned for you (find it with `git rev-parse --show-toplevel`; if it is missing, clone https://github.com/moesslacherjakob-commits/GEOPOLITICS). Work in that folder on the main branch. Run `./setup.sh` — it must end with "setup: all good"; fix install problems yourself. Then read desks/PLAYBOOK.md, desks/scitech/DESK.md, desks/scitech/config.json, STORY_FORMAT.md and desks/scitech/log.md.

2. Follow desks/PLAYBOOK.md step by step with desk = scitech to produce today's Short:
   - pick the most-covered global science or technology story of the last 24 hours as DESK.md describes (respect the science/tech rotation) (supported by at least 2 independent major outlets, not a repeat of the last two entries in desks/scitech/log.md unless there is a major new development);
   - research it, write the narration script (≤150 words, written for the ear, neutral, every claim attributed, peer-review status and company claims labelled, no medical advice) and the story JSON in desks/scitech/stories/ including the thumbnail block;
   - run the QA stills loop and actually look at the contact sheet and the thumbnail; fix overlaps and unreadable details;
   - run make.sh in the background and poll the log (never in the foreground — tool calls time out after 10 minutes). It generates the ElevenLabs voiceover first (the key comes from this environment's network secret — never ask for or print it); if the voice fails it renders captions-only and you must say so in the report;
   - verify the MP4 (70–78 s, <30 MB, voice present, look at 3 extracted frames);
   - push video + thumbnail to the media-scitech branch (never to media), schedule it in Metricool exactly as the playbook says (YouTube only; blogId, postTime, youtubeCategory, autoPublish and thumbnail settings from desks/scitech/config.json; if the thumbnail is rejected with VIDEO_THUMBNAIL_NOT_APPLICABLE, schedule again without it);
   - append the episode to desks/scitech/log.md, commit only files in desks/scitech/, `git pull --rebase origin main`, then push to main (not to a claude/ branch).

3. You run unattended: make reasonable decisions yourself and note them in the report. Never publish to any network other than YouTube and never to another channel's Metricool brand. Never change autoPublish. Never edit files outside desks/scitech/ (the root files belong to the live @GEOPOLITICS4YOU routine). If you can't confirm a story with two independent sources, take the next candidate. If something breaks that you can't fix (render error, Metricool error, repo access), do not schedule anything — report what happened instead.

4. Finish with a short German report to Jakob as your final message (also via SendUserMessage if that tool exists): channel, topic and why it won, video title, the three key facts, sources, anything flagged as uncertain, whether voice and thumbnail made it, and the Metricool planner link.
