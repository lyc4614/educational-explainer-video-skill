---
name: educational-explainer-video
description: Use when educational scripts, SRT subtitles, or narrated explanations need to become original semantic explainer videos instead of fixed-template slides or decorative animation.
---

# Educational Explainer Video

## Core principle

Derive the visual system from the current manuscript. Every primary character, object, formula, data point, path, and metaphor must identify its source phrase and explanatory role. Reuse visual grammar and engineering infrastructure, never topic-specific decoration.

## Start here

1. Register input paths, hashes, approved references, aspect ratio, audio contract, and factual sources.
2. Read `references/content-to-visual.md` and create a schema-valid `production-brief.json` before scene code.
3. Read `references/production-workflow.md` to group cues into visual paragraphs and choose sample gate A, B, or C.
4. Read `references/visual-system.md` for 16:9 or 9:16 layout, continuity, captions, formulas, and motion.
5. Implement with frame-driven Remotion animation and tests first.
6. Read `references/qa-and-delivery.md`; deliver only after still, boundary, media-contract, and full-decode checks pass.

## Non-negotiable invariants

- Do not choose a topic template before semantic extraction.
- Do not invent formulas, data, causal claims, or unsupported neuroscience.
- Do not reproduce identifiable characters, layouts, brand assets, or shot sequences from a reference video.
- Do not treat one subtitle cue as one scene by default.
- Do not overwrite approved outputs; create a versioned filename.
- Do not move failed or partially decoded media into the delivery directory.
- Keep manuscript-specific SVG, characters, objects, and scenes in the current video project, outside this Skill starter.

## Deterministic helpers

Run from a copied Skill directory:

```powershell
node scripts/build-timeline.mjs input.srt timeline.json --fps 30
node scripts/validate-brief.mjs production-brief.json
node scripts/validate-media.mjs output.mp4 media-contract.json --ffprobe C:/tools/ffprobe.exe --ffmpeg C:/tools/ffmpeg.exe
```

The scripts validate mechanics; Codex remains responsible for semantic judgment and visual design.
