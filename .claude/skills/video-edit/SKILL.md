---
name: video-edit
description: Edit existing footage in this repository using audiovisual take selection, references, anchored graphics, captions and verified delivery. Use for a new edit or revisions to an existing project; preserve the user's requested scope.
---

# Footage editing

Read root `AGENTS.md` and follow its first-use welcome before creating a project. For an existing project, start with `vid resume <slug>` (compact, read-only); consult `docs/PIPELINE.md` for the current stage's contract and `vid status` when updating state. Do not create a parallel project for a revision unless requested. If asked only to analyze, use read-only tools and do not run artifact-producing commands.

## Choose the work that matters

Start with what the viewer should understand and the desired action. Keep existing preferences. A supplied website may inform topic or brand while the footage remains the deliverable. Load `video-references` for URLs/documents/images/reference videos. Ask only for missing information that affects a real editorial decision; continue independent work.

For a new organic social edit, load `video-strategy` to connect the audience's situation, content objective, promise, evidence and requested action. Establish direction before selecting takes and reconcile it with inspected footage. Reuse an existing strategy on revisions; technical/caption-only changes do not need a new marketing exercise. `strategy.json`, when present, is checked by `plan` and the exact-render review. Instructions and usage: [docs/MARKETING.md](../../../docs/MARKETING.md).

1. **Intake:** `vid new` supports canvas/fps/review policy and `--site`. Read `source.json`, BRIEF, glossary and references. Notice rotation, HDR, audio offset and variable cadence. Keep the source intact. Establish protected material and what counts as intentional performance in this recording.
2. **Understand:** `vid transcribe` (local default), `vid analyze`, then `video-editorial`. Read the entire transcript AND all overview sheets; inspect doubtful intervals. Resolve ASR errors in names, dimensions and context without rewriting the speaker's argument. Preserve `original_text` and timings; record substantive corrections in glossary.json.
3. **Select:** choose complete takes by clarity, delivery, gestures and narrative role. Compare plausible truthful openings when it helps. Fill edit-plan.json, run `vid editorial` and `vid cut --dry-run`, then `vid cut`. Listen/watch seams or declare the available inspection method. Do not manufacture emphasis by combining contradictory fragments.
4. **Explain:** load `video-visuals`, `vid plan --init`. Use word anchors, reference-derived theme and a small number of purposeful visuals. `vid plan`, `vid compose --media proxy`, then core/animation/keyframes/audio as needed. Start with an animatic using actual speech and rough visuals.
5. **Review and deliver:** `vid check`, `vid render --quality draft`, then `video-review`. Revise evidence-supported issues. Switch with `compose --media master`, check and render `--quality looks`; verify that exact render, review and finalize. Do not normalize audio repeatedly or denoise without evidence. Do not publish unless requested.

`review_policy` carries the chosen collaboration mode. In autonomous mode complete decisions with recorded evidence, without new permission loops. In assisted mode obtain the user's review of concrete cut/draft artifacts; a storyboard may be reviewed with the animatic instead of a separate interview. User instructions override generic vendor gates.

## Efficient iteration

Follow [efficiency](../../../docs/EFFICIENCY.md): read compact transcript text before selected word ranges; keep decisions in files; load domain skills on demand. Reuse intact transcription/evidence/media caches. Text changes still require editorial reassessment, even when pixels are reusable.

Iterate with `compose --media proxy` and `render --quality draft`. Before delivery use `compose --media master`, `check` and a high-quality render; inspect that exact file. Check/render logs are summarized by default; use `--verbose` only to diagnose. The pinned CLI has no general partial-render workflow exposed by this engine; do not invent one or impose a pass limit that leaves known defects.

Use the optional seek-safe [motion primitives](../../../docs/COMPONENTS.md) when their function fits; brand styling remains local. Record every animation in `motion-plan.json` when using incremental review. Let code calculate clocks/layout and the agent choose meaning and visual communication. A visual budget follows the explanation, never a mandatory cut/effect rate.

For unresolved creative choices, use `video-references` and [library/SOURCES.md](../../../library/SOURCES.md): local project materials and past feedback first, then a few relevant accessible examples. The agent can search public references within the authorized editing task without a new permission interview. Once a direction is supported, proceed to the animatic. Empty music/SFX/texture folders do not require filling them; select assets for actual functions and record provenance.
