Daily production run for the YouTube channel @GEOPOLITICS4YOU (owner: Jakob Mösslacher, Vienna — write your report to him in German; the videos themselves are in English).

1. Get today's date and time with `TZ=Europe/Vienna date`. The repository moesslacherjakob-commits/GEOPOLITICS is already cloned for you (find it with `git rev-parse --show-toplevel`; if it is missing, clone https://github.com/moesslacherjakob-commits/GEOPOLITICS). Work in that folder on the main branch. Run `./setup.sh` — it must end with "setup: all good"; fix install problems yourself. Then read PLAYBOOK.md, STORY_FORMAT.md, config.json and log.md.

2. Follow PLAYBOOK.md step by step to produce today's Short:
   - pick the most-covered geopolitics story of the last 24 hours (supported by at least 2 independent major outlets, not a repeat of the last two entries in log.md unless it escalated sharply);
   - research it, write the narration script (≤150 words, written for the ear, neutral, every claim attributed) and the story JSON including the thumbnail block;
   - run the QA stills loop and actually look at the contact sheet and the thumbnail; fix overlaps and unreadable details;
   - run make.sh in the background and poll the log (never in the foreground — tool calls time out after 10 minutes). It generates the ElevenLabs voiceover first (the key comes from this environment's network secret — never ask for or print it); if the voice fails it renders captions-only and you must say so in the report;
   - verify the MP4 (70–78 s, <30 MB, voice present, look at 3 extracted frames);
   - push video + thumbnail to the media branch, schedule it in Metricool exactly as the playbook says (YouTube: blogId, autoPublish and thumbnail settings from config.json; if the thumbnail is rejected with VIDEO_THUMBNAIL_NOT_APPLICABLE, schedule again without it), then schedule the same video at the same time on TikTok as playbook step 8b says (skipped automatically while TikTok is not connected in Metricool; a TikTok problem never stops the YouTube post);
   - append the episode to log.md and push stories/ + log.md directly to main (not to a claude/ branch).

3. You run unattended: make reasonable decisions yourself and note them in the report. Never publish to any network other than YouTube and, via playbook step 8b, TikTok. Never change autoPublish in config.json. If you can't confirm a story with two independent sources, take the next candidate. If something breaks that you can't fix (render error, Metricool error, repo access), do not schedule anything — report what happened instead.

4. Send the short German report to Jakob as soon as the Short is scheduled (via SendUserMessage if that tool exists, otherwise as your final message): topic and why it won, video title, the three key facts, sources, anything flagged as uncertain, whether voice and thumbnail made it, the Metricool planner link, and the TikTok status (scheduled + link / skipped – not connected / error).

5. Long-form (only on **Sunday** and **Wednesday**, Europe/Vienna, and only if `config.json → longform.enabled` is true): after the Short is done and reported, produce the long video exactly as LONGFORM.md says — Sunday the weekly recap, Wednesday an explainer. It is a separate job: it never changes or delays the Short. Same rules: unattended, two independent sources minimum, automatic QA with an independent review agent, no publishing if facts, policy checks or the voice fail. Finish with a second German report (LONGFORM.md step 9; on Sundays including the YPP status). On other days skip this step.
