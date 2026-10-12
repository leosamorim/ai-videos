---
name: video-strategy
description: Direct organic social video edits around audience, purpose, evidence, promise and an appropriate next action. Use for Reels, TikTok or Shorts with a marketing objective, and for learning from supplied post analytics. Works within video-edit; plain caption-only tasks do not need a strategy artifact.
---

# Organic editing direction

Read [direction.md](references/direction.md) when choosing a content angle, hook, narrative or CTA. Read [platforms-and-learning.md](references/platforms-and-learning.md) when adapting distribution or interpreting results. [sources.md](references/sources.md) records what was adopted from community repositories, what was rejected and why. These are editorial hypotheses and dated platform observations, not promises of reach.

`video-edit` remains the orchestrator. Use existing BRIEF, reference direction, brand materials and any audience/analytics evidence before asking questions. A website establishes what a brand says about itself; it does not establish viewer intent or prove demand. Record missing audience knowledge as an assumption. Do not expand an edit into a posting calendar, competitor scraping, account access or publication.

For a missing reference, use [library/SOURCES.md](../../../library/SOURCES.md) and `vid discover` to locate actual examples and remembered feedback. Borrow the function that serves the audience need. Ad libraries provide selected paid examples; do not treat their metrics as organic benchmarks or their assets as licensed for reuse.

For a new organic edit, establish a provisional objective before selecting takes. After inspecting speech AND footage, fill `strategy.json` using `vid strategy SLUG --init`; the schema and a fictional example are in [docs/MARKETING.md](../../../docs/MARKETING.md). Reconcile its promise with material actually available. Select one primary content job and one primary metric per destination. A user-requested CTA takes precedence over generic platform advice; explain its connection to the value delivered. `none` is a valid CTA.

Connect evidence → audience need → editing decision. Each beat records a function, a viewer need, the decision and evidence IDs. A beat can be an uninterrupted demonstration. Preserve voice, gestures, useful uncertainty, breathing room and real examples. Avoid mandatory hook formulas, effect counts, loops, trending music, punch-ins or cut intervals. Spoken/text/visual hook channels should agree when present; all three are not required.

Run `vid strategy SLUG`. In `03-plan/storyboard.json`, add timed `beats` with the same IDs as strategy beats; use source-word anchors for speech or explicit times for silent action. Cards/reframes carry a `beat_id`. A beat annotation produces no graphic on its own. `vid plan` checks mapping and timing. Review whether the actual cut still supports the strategy; revise the selection when it does not. Do not preserve an unsupported promise just to keep a hook.

On the exact render, review audience relevance, hook/payoff honesty, evidence visibility, unnecessary distraction and CTA fit under `review.checks.strategy`. Code validates structure and provenance links, not persuasion or truth. If strategy changes, storyboard/composition/review become stale; ASR and raw media analysis remain reusable. Plain caption work and existing projects without a strategy retain their existing workflow.

When results are supplied, separate measured observations, possible explanations and a next test. Use the learning guide's metric definitions and comparable cohorts. No automatic winner, fabricated baseline or causal claim from a pair of organic posts. Store retrospective notes separately from render inputs, in `06-review/learning.md`; an analytics update alone should not invalidate an approved export.
