---
name: video-visuals
description: Plan purposeful diagrams, supporting footage, reframing and readable captions for edited speech, using a project theme and word anchors. Includes an interiors-specific explanation method.
---

# Explain visually

For natural talking-head edits or revisions of an overly automatic-looking result, read [editorial craft](../../../docs/CRAFT.md). Start by removing redundant information and preserving performance before adding another effect. Caption phrase starts and selective emphasis are source-anchored configuration, not hand-edited generated HTML.

When visual direction is underspecified or repetitive, consult [reference discovery](../../../library/SOURCES.md) through `vid discover`. Look at real editing/typography in context, then search the pinned catalog for the chosen function. Separate a creative reference from code or media licensed for reuse. For web UI examples, adapt the visual behavior to a seek-safe timeline instead of importing hover/scroll/state machinery. Keep language coherent within a piece; variation between pieces follows brand, subject and intent, not random novelty.

Read the edited transcript and reference direction. Design what the viewer needs to SEE to understand each point. Describe purpose in every storyboard entry. Use `anchor.source_word` and optionally `end_source_word`, segment_id, duration/offset/tail; avoid guessing fresh timestamps. Compilation rejects missing or ambiguous words after a cut changes.

If `strategy.json` exists, map its beats to `storyboard.beats` using identical IDs and actual timing. Cards/reframes include a `beat_id` and overlap the function they support. The mapping can contain uninterrupted footage with no overlay: marketing intent does not require visible effects. Use the promise and audience need to choose what to emphasize, not a preset cut cadence.

Use the same visual object through related ideas: reveal detail, scale, compare, return to the speaker. This is optional continuity, not a mandate to build a 3D world. For interiors, read references/interiors.md. For other domains choose the corresponding useful visual language.

For motion, diagrams or competing focal elements, consult [choreography](../../../docs/CHOREOGRAPHY.md). Choose performance/explanation/motion per beat; declare focus, takeaway and attention order only where helpful. The guide provides three adaptable explanation structures, optional stable-text windows (`reads`) and shared visual/audio `events` with `sound_cues`. Use the same resolved event in GSAP and sound; measure the attack in the frozen asset. Vendor density/movement quotas are not requirements. Prototype an uncertain technique before repeating it across the piece.

Theme belongs to the project, not to a vendor preset. Use source_ids and local fonts. Preserve face, gestures and meaningful objects when reframing. The master retains original resolution. Caption zones can move/hide captions during a diagram; split blocks around zone boundaries. Use phrase-length, mixed-case captions by default, preserve number+unit and highlight selectively. Text behind a person is an optional effect requiring a clear benefit and matte review.

Author cards in the composition with IDs matching storyboard.cards. Derive animation times from `window.editorialTimeline`, e.g. `const beat = beats.cards.find(b => b.id === 'width'); tl.fromTo('#width-inner', {...}, {...}, beat.start);`. The generated reframe function owns #video-wrap movement; do not also animate it manually. Animate inner nodes of timed clips. Use core/animation/keyframes contracts for implementation.

Before fixing how long an insert stays, read the sentence playing under it: the insert leaves when the sentence's subject changes, and a spoken comparison may be clearer with both things in frame. Implementation techniques already verified in renders here (script-built compositions, motion layered over speech, draw-on strokes, supporting video, texture, sound effects) and their pitfalls are in [composition notes](../../../docs/COMPOSITION.md). They are a toolbox for when the edit calls for one, not a house style; a look approved for one brand lives in `brand/` and remembered references.

Review an animatic with actual voice before polishing. Check the first, middle and last frames of transitions AND motion playback or dense samples. Compare the concept against the user's references. A registry sample or skill catalog entry is not a verified render in this project.
