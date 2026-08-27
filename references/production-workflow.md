# Production workflow

## Intake contract

Before design, register input paths and declared SHA-256 hashes; the manuscript-to-SRT relationship and which source governs timing; approved references and exactly what was approved; target aspect, fps, duration, and audio contract; factual sources and unresolved facts; and the approved output/delivery boundary. Production source paths should be absolute. A portable relative path in `project.sourceFiles` requires an explicit `--source-root`; resolve it under that root, read the source bytes, and compare the actual SHA-256 before production. Record declared paths, absolute resolved paths, hashes, approvals, checks, artifacts, and omissions in the canonical `production-run.json` defined by `qa-and-delivery.md`.

## Ordered workflow

1. Stop on an empty cue, nonpositive duration (`end <= start`), non-monotonic cue order, overlap, or text/SRT mismatch; also require every declared source to resolve to a readable regular file whose actual byte SHA-256 matches the declaration.
2. Build `captions`, `semanticUnits`, `visualElements`, `scenes`, `sampleDecision` with executable `criteria`, and `verificationItems`; every pending formula/data element must be traced by a pending item whose `targetElementIds` includes it, then produce a schema-valid production brief.
3. Group cues into visual paragraphs by meaning; one cue is not one scene by default.
4. Give every scene one `visualThesis`, explicit enter/exit states, primary/supporting elements, timing, review frames, and a `continuityAnchor` into adjacent scenes.
5. Select the risk gate below and make the required sample or keyframes.
6. Obtain written approval of every Gate A sample and every Gate B micro-sample/keyframe set before full expansion. Gate C direct-full requires no sample approval, but its brief and keyframes remain mandatory.
7. Implement tests first, retain the failure-before-fix evidence, and drive all animation from frames.
8. Render representative stills, both sides of every boundary, and interval/boundary contact sheets for review.
9. Validate the media contract and perform a full decode; a probe result alone is not completion evidence.
10. Deliver only a verified, versioned artifact; record its absolute path, SHA-256 hash, approval, checks, and omissions in `production-run.json`.

## Sample risk gates

| Gate | Conditions | Executable `criteria` | Required deliverable |
| --- | --- | --- | --- |
| A | New topic or unapproved visual system | At least one of `new-topic`, `unapproved-visual-system` | 20–30s complete sample |
| B | Approved style with many new elements or a complex metaphor | At least one of `many-new-elements`, `complex-metaphor`; exclude both A criteria | 8–12s micro-sample or keyframes |
| C | Same approved series and low-risk reuse | Both `same-approved-series` and `low-risk-reuse`; exclude every A/B risk criterion | Direct-full is allowed, but a valid brief and keyframes remain mandatory |

Time pressure never justifies downgrading a gate. Record the exact `sampleDecision.level`, `reason`, and matching `deliverable` in the brief.

## Stop conditions

Apply the matching remediation before resuming:

- text/SRT mismatch: list differences and request the authoritative version.
- unclear formula, data, or causal evidence: mark it `pending` and stop final scene implementation until evidence is verified.
- meaning-changing metaphor: return to the brief and replace it with a neutral mapping that preserves the source claim.
- copyright-risky reference: retain only abstract rhythm, hierarchy, and transition rules; discard identifiable assets, compositions, and shot sequences.
- output already exists: choose a new versioned filename and never overwrite.
- render, audio, probe, or decode failure: keep the failed artifact outside the delivery directory and resolve the failure before delivery.

## Deterministic helpers

From the Skill root, use `scripts/build-timeline.mjs` for SRT/frame mechanics, `scripts/validate-brief.mjs production-brief.json --source-root <dir>` for the production-brief contract plus portable source-byte verification, and `scripts/validate-media.mjs` for media-contract and decode checks. Omit `--source-root` only when every declared source path is absolute. These scripts validate mechanics; they do not decide semantic fidelity, evidence sufficiency, visual hierarchy, originality, or approval.
