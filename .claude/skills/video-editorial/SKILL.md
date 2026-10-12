---
name: video-editorial
description: Select and order takes from transcript plus video evidence, including preparation, failed starts, interruptions and post-performance footage. Use before cutting existing footage in this workspace.
---

# Audiovisual take selection

Inputs: BRIEF, transcript.raw.json/md, evidence.json and the actual media listed in it. Candidate windows are heuristics, not decisions. The agent supplies the judgment; the CLI validates provenance and executes it.

Read the compact transcript first and use `vid words --from N --to M` for exact boundaries. Overview/detail caches are shared by media identity and sampling; reusing pixels after a text correction does not revalidate the old interpretation. Preserve existing observations as a starting point, check their evidence hashes and reassess semantic decisions. Repeated-start candidates help compare takes without automatically preferring or deleting any of them.

When `strategy.json` exists, read its audience, promise, payoff and evidence before choosing takes. Prefer a complete, credible delivery of that value; protect the demonstration or qualification needed to support it. If the available performance cannot fulfill the promise, revise the promise or identify missing material. A retention tactic is not a reason to remove the answer, distort a statement or cut an informative gesture. A strategy change can require a new selection even when the existing cut is technically valid.

Read all speech and examine all overview sheets. Then use `vid inspect <slug> --from S --to E` for each suspected non-performance interval and around proposed seams. Open its dense frame sequence; use continuous playback/audio if supported. Record whether observations came from playback or sampled imagery. Do not infer prosody from a waveform or stills.

When available, read `01-analysis/SIGNALS.md` following [SIGNALS.md](../../../docs/SIGNALS.md). Silero measures probable speech on the original audio before cleanup; compare gaps with meaningful silent actions and ASR disagreements. Use `inspect --face` only in uncertain intervals, and `signals --face --boundaries` after choosing takes. Add `--pose` only when locating a gesture helps. Head orientation is not gaze or intent; detection loss and large deltas are inspection cues, never removal criteria. Do not shorten by VAD alone, enforce angle thresholds or add detector JSON to `evidence_ids`. `editorial` and `cut --dry-run` only warn from valid cached measurements; no warnings does not certify a boundary.

Use [cut finishing](../../../docs/CUTTING.md) when refining take boundaries. Separate the end of useful speech, useful action and the onset of a recording reset. Evaluate expressions in temporal context: neither a downward glance nor an isolated articulation frame justifies removal. Preserve the participant's expressive style; neutral faces and constant eye contact are not quality targets. Classify pauses and noise by function, protect word attacks/endings and review the assembled opening, seams and ending before graphics. Record the evidence, decision and method/limits per boundary in the cut review; the guide provides commands and remedies when audio and visual needs differ.

Assess the combination of cues:

- Preparation: adjusting recording equipment/clothing/hair followed by a clear start, testing mic, speaking to crew, reaching to start/stop recording. A relevant demonstration can look similar; context decides.
- Retakes: repeated propositions, abandoned sentences, explicit self-correction, reset posture followed by a more complete version. Compare all viable versions. The last take is not automatically best.
- End: completed message followed by relaxing, checking the phone or interacting with the recording setup. Keep intentional closing expression and a natural tail.
- Intentional performance: looking toward an object while explaining it, gestural demonstration, thoughtful pause, natural laughter or a reaction that carries meaning. Preserve these when useful, even without words.
- Continuity: match gestures, gaze direction, sentence meaning and breathing across seams. Prefer moving the cut or a meaningful cutaway over arbitrary zooms that hide a broken sentence.

Use edit-plan.json schema in docs/PIPELINE.md. `segments` are keeps in FINAL order; `discarded` explains the rest of the source. Include narrative role/take_id, reason, evidence_ids and observations. For non-performance removal the validator requires a detailed motion clip covering the removed interval. Examining a clip's dense sequence is allowed when playback is unavailable, but record that limitation and preserve ambiguous action.

Before rendering: cover every source interval with a keep/remove decision, preserve protected segments, resolve uncertainties and avoid cutting word boundaries. Acoustic suggestions may inform boundaries, but never replace the visual review. Keep enough lead/tail for a complete gesture; silence is allowed. Use the local comparison of re-transcribed final speech as a second opinion, not an authority on numbers or technical facts.
