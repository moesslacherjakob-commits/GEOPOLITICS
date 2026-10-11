# Engagement rules — first second, hook, CTA, title, thumbnail (all four channels)

Why: most Shorts views come from the Shorts feed, which shows **no thumbnail** — only the video, starting at frame 0. A viewer decides within about a second whether to swipe. Custom Shorts thumbnails (rolled out July 2026) appear only on the home page and the channel page, and only for channels in the YouTube Partner Program. So the **first frame does the job of the thumbnail**, and the engine now makes them the same picture.

## 1. First second (engine does this automatically)
- Frame 0 = the designed thumbnail (the `thumbnail` block), held ~1 s while the voice already starts the hook, then it zooms away into the globe. No fade from black.
- Turn off only with `"thumbnail": {"opener": false, …}`; length via `openerDur` (default 1.0 s).
- Captions start right after the opener. The globe `headline` should land within the first ~2.5 s of the hook (anchor it on the 3rd–5th hook word), not at the end of the hook.

## 2. Hook (spoken, first segment)
- **≤ 14 words.** One or two short sentences.
- It must answer **"why should I care?"** — stakes for ordinary people (prices, safety, a record, a first) — and open a question the video answers later (in f2 or f3).
- Lead with the most concrete thing: a number, a place, a consequence. No dates, no "On Friday…", no "Washington has a new idea…".
- Neutral and accurate: the tension comes from the facts, never from loaded words or a claim stated as fact.
- Good (style only — every fact still comes from today's sources): "The Iran war just opened a second front. And your heating bill is the target." · "Two hundred missiles and drones in one night. Now Washington wants a truce."
- Bad: "Washington has a new idea for Ukraine: stop striking each other's power grids. Moscow has already pushed back." (no stakes, too long, the answer is given away)

## 3. Middle
- Every fact block starts with its strongest word or number. Something new on screen at least every ~2 s (camera move, marker, overlay row).
- Resolve the hook's open question in f2 or f3 — not before.

## 4. CTA (last segment, ≤ 14 words)
- A **neutral yes/no question** about what happens next, so commenting takes one word. Then nothing else.
- Format: "<question>? Yes or no?" — e.g. "Will an energy truce hold through winter? Yes or no?" · "Should more countries build sea walls? Yes or no?"
- Never ask people to take a side in a conflict ("Who is right?"), never ask about violence, never ask for medical or investment decisions. Ask about outcomes and timing.
- The `end` scene's punchlines can repeat the question on screen.
- Loop: when it fits naturally, let the CTA question echo the hook so the replay feels like an answer.

## 5. Title (`upload.title`)
- ≤ 60 characters plus " #shorts". Names the key place/actor (searchable) and the twist.
- Must **not** repeat the thumbnail text word for word — title and thumbnail complement each other.

## 6. Thumbnail block (= the first frame)
```json
"thumbnail": {
  "at": "f2:Reports",               // a strong, readable moment: arcs, highlighted region, storm track, chart/ticker
  "focus": "Kiev",                  // place/ISO3/[lon,lat] or {"x":540,"y":700} on screen — zoomed in and placed above the text
  "number": "200",                  // optional: the one big number of the story (exactly as sourced)
  "numberColor": "danger",
  "lines": [["MISSILES & DRONES", "text"], ["NOW A TRUCE?", "accent"]],
  "source": "OCT 7 · PER UKRAINE"   // required whenever there is a number or a claim
}
```
- **One sharp motif** (`focus`) — never a plain dark map. Info boxes, cards and overlays are left out automatically; for a chart/ticker motif set `"overlays": true` and give `focus` as `{x, y}` on the key row.
- **A big number** whenever the story has one that carries the stakes (count, %, $, record year). Exactly as sourced, attributed in `source`.
- `lines`: 1–2 lines, ≤ 3 words each, that **add** to the title (consequence, question, contrast) — never just the title again. One line in `accent`.
- `kicker` (small pill) only if the place is not obvious from the motif; skip it when there is a `number`.
- Check it: `node engine/engine.mjs <story> thumb /tmp/qa/thumb.jpg` and look at it **at small size** — would you understand it at 150 px wide? Also check stills at `0,0.5,1.2,2.5` for the opener.
