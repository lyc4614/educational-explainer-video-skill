# Layered assets and explanatory motion

Use this reference for generated illustrations with independently moving subjects, reusable PNG libraries, cards, and data graphics. This extends the canonical production brief; it does not replace its evidence, timing, audio, or sample-gate contracts. A 3D-looking PNG is a flat layer: moving it does not create a new camera angle, articulated pose, or physically opening gate.

## Plan before generating

Apply the semantic-fit, visual-quality and sequence-contribution checks in [explanation-design](explanation-design.md). Inspect action capability, poses and independent parts before declaring reuse sufficient or a generation queue empty. Transparency and resolution checks do not establish anatomy, art quality, diversity or explanatory value. Missing states may justify targeted generation; a familiar palette does not require all assets to be regenerated.

From each semantic unit, decide what the viewer must observe: a comparison, threshold, correspondence, accumulation, state change, or choice. Assign each subject a source phrase and role. A generic object can be reused in a different role if the visible form supports it; use a live label and do not treat the original filename as factual evidence.

Write a small project-local `asset-plan.json` before image generation. Include:

- `assets`: stable IDs; source phrase/role; `cutout` versus `scene`; reuse/generate/code decision and reason; dependencies; intended scale, lighting, text, and orientation.
- `generationQueue`: only missing subjects, in dependency order. Record the subject or style reference it needs. An empty queue is valid; do not regenerate suitable assets merely to fill a list.
- `scenes`: the canonical scene ID; asset IDs; primary action; reserved title/caption/data regions; enter, dock, data-reveal, hold, and exit frames as needed. Use actual cue frames, not one scene per subtitle.
- `intermediate`: which motion-only frames/clip establish silhouettes, paths, contact shadows and reserved data space; which later data overlays will be added.

Keep this companion plan separate from `production-brief.json`; do not add ad-hoc fields to its closed schema. Use reciprocal visual-element/scene references and a real `continuityAnchor` in the brief. Trace uncertain facts as pending using the existing verification contract.

Default dependency order for a layered scene: semantic plan and layout rectangles → inspect reusable assets → generate only missing subjects → inspect new assets → compose subject motion and shadows with data space reserved → add verified cards/charts/formulas → final captions and review. The subject-motion intermediate should not already depend on the completed data animation. A few rendered motion states suffice when the approved scope is small; do not require a full second video for every revision.

## Generate individual subjects

Use the available native image-generation tool for new subjects or extraction; request true transparent background for cutouts. If editing/extracting from a local source, inspect it and preserve its identity as required by that tool. Respect an explicit user tool choice. Do not assume that drawing a checkerboard produces transparency, or replace a requested raster subject with a geometric stand-in.

Generate one independently animated subject per asset. A coherent parent/student/table group may remain one subject if only its whole-group pose is needed. Separate limbs, doors, or props only when the planned explanation actually needs their independent movement. A full background image cannot provide independently moving objects until they are properly extracted.

Preserve consistent materials, light direction, viewing angle, and contrast from the approved reference. Ask for complete silhouettes and transparent padding. Keep labels, grades, dates, figures and formulas editable. Do not bake text into the original unless specifically requested.

For the user's requested dark 3D look, an applicable profile is slate blue #1F2833 → #0B0C10, warm-white type, ice-blue/cyan and restrained gold, matte/frosted materials and soft overhead light. This is an optional style profile, not a rule for unrelated videos. Existing approved styles and explicit preferences take precedence.

## Inspect and register the library

Locate the project's existing catalog before creating another library. Reuse by semantic fit, visual fit, silhouette and resolution—not just by filename or availability. Keep complete `scene` images distinct from `cutout` subjects. A mismatched family scene has no role in a passage with no people or family action.

Run `scripts/inspect-asset.mjs` on the actual PNG. It reads the source once, computes SHA-256, measures real alpha and visible bounds, and records a center anchor. It requires `sharp`; use the environment's dependency discovery or a project installation, or pass `--sharp-module` with a trusted installed module path. Do not hardcode the author's runtime location. Example:

```powershell
node scripts/inspect-asset.mjs public/report.png --id report --kind cutout --out qa/report-v001.json
```

The script rejects an opaque image passed as a cutout and entirely invisible images. Alpha presence is necessary but not sufficient: inspect edges on a dark and a light composite for baked checkerboards, fringes, clipping and unwanted shadows. Metadata supplied without the PNG is `metadata-only`, not a verified pixel inspection. Do not claim the tool ran if it did not.

Library records should retain the measured fields plus the useful semantic/provenance information:

```json
{
  "id": "report",
  "file": "assets/report.png",
  "kind": "cutout",
  "sha256": "<actual source-byte hash>",
  "width": 1200,
  "height": 1200,
  "bounds": {"x": 210, "y": 40, "width": 700, "height": 1100},
  "anchor": {"kind": "visible-center", "x": 560, "y": 590},
  "inspectionStatus": "metadata-only",
  "styleTags": ["approved-series"],
  "uses": ["results", "qualification checks"],
  "cautions": ["blank visual carrier; does not establish any actual grade"],
  "prompt": "retain the exact generation or edit prompt when available",
  "provenance": {"sourceKind": "generated", "sourceProject": "project-relative reference"}
}
```

The numbers above illustrate an off-center subject, not measured output for an included image. Replace them with actual inspection data. Record missing original prompts honestly; never invent one. Deduplicate by byte hash, preserve source originals, and derive project-specific labels/composites as separate files. A searchable local HTML view is useful for a larger library; it should open relative assets offline and distinguish transparency types. It is optional for a small collection.

The catalog may hold private provenance locally. Publishing a skill does not imply permission to publish project media, source manuscripts, library images, personal paths or credentials. Export generic instructions/helpers and explicitly selected assets only; preserve existing repository licensing rather than inventing new rights.

## Position by visible geometry

Use the visible bounds, not the square PNG canvas, for apparent subject size and center. For visible width `w`, scale `r = w / bounds.width`; image left is `centerX - (bounds.x + bounds.width/2)*r`, image top is the analogous Y expression. The rotation pivot is that same visible center in scaled image coordinates.

`assets/layered-primitives/motion.mjs` implements this as `placeImage(asset, pose)`. `VisibleAsset.tsx` uses the result for the image and contact shadow. Copy these into the current video project and adapt them; do not import from another user's absolute path. Copy the chosen PNG unchanged into the project's `public` directory and set its relative `file` value accordingly.

For an already moving scene, compute labels, connectors, overlays and shadows from the same pose. A label should not jump from centered to left-aligned at a docking threshold. Do not stretch an asset to fill a data card. Inspect the actual subject bounds—including rotated extents when rotation is appreciable—against title/caption regions.

## Give motion an explanatory job

Prefer these mappings when the source supports them:

| Meaning | Useful action | Avoid |
| --- | --- | --- |
| Basic eligibility versus extra conditions | A grade/token passes the basic check, then waits for the next condition | A general rejection inferred from one institution's rule |
| One record used by successive rules | Keep its asset ID and pose continuous while surrounding conditions change | Re-entering or duplicating the same subject at each subtitle |
| Multiple sources contribute to a total | Establish sources, dock them, then reveal proportional data | Bars moving before the viewer knows their referents |
| Six values averaged | Six symbolic or supplied values converge into the literal sum ÷ 6 | Invented student grades, or multiplying an already weighted result again |
| Unresolved direction | Branches remain available; current decision stays at the junction | A path drawn as guaranteed admission or success |

Define event poses and readable holds: establish → anticipate/commit → travel → check/contact → settle → data focus → hold. Not every scene needs every phase. Use frame-driven pure functions, stagger secondary actions when useful, and keep identity, position and velocity continuous across boundaries unless making an intentional cut. Generic perpetual floating and identical bounce on every object weaken explanation.

`travelPose(frame, {start, end, from, to, lift})` provides a deterministic eased arc with visible-center poses; successive phases share endpoints. `LayeredExample.tsx` is one complete source-object/dock/data example with caller-supplied timing, asset and verified data. Its `intermediate` prop reserves data space without the final overlay. The example contains no topic image or default factual number; a final composition must use `intermediate=false`.

For longer passages, vary the explanatory focus: contextual group → relevant document/model detail → relationship/choice view. Cropping or enlarging an existing asset changes framing, not its underlying pose. Generate another view only if that new view is needed and authorized. Do not force a camera change on a fixed timer.

## Cards, captions and visual hierarchy

Use one dominant action at a time. Cards support information; they need not contain every subject. Pick layout from the relation: a short single row for ordering; a balanced 2×2 group for four conversions; direct connectors for correspondence; a real shared scale for quantitative comparisons.

For light glass cards, a small category/grade badge plus a large value often reads better than two competing large labels. Keep border/shadow strength subordinate to content. Highlight the current item and let completed items settle. When a formula becomes the takeaway, reduce or compact the cards to give it room. Never dim necessary information below legibility during its reading hold.

Keep source subtitles on their own layer. Insert semantic line breaks without deleting characters or changing cue timing. Use a layout budget for two lines where needed. Avoid simultaneous motion in title, subject, chart and subtitle. Preserve useful negative space instead of filling it with unrelated icons.

## Review the new behavior

For a quantitative chart overlay, consult the chart-motion reference. Import only the graph into the reserved data rectangle, suppress the previous same-region card, and preserve the source labels and qualifiers while animating geometry. Keep code-based motion components distinct from the static PNG catalog; neither a material filename nor a demo value establishes a current fact.

Honor existing approval evidence using the A/B/C rules in the production workflow. An old palette approval alone does not prove the current topic/system was approved. Conversely, a same-topic refinement of previously approved assets and relationships should not trigger repeated style questions merely because it has a new filename.

Review subject-motion states before final data overlays, then review the composite: entrances, maximum travel, docking, data reveals, readable holds, and both sides of each changed boundary. Test pure math/state that matters: same pose at shared boundaries, no early result before its source phrase, a pending general condition versus an institution-specific result, true alpha, bounds and exact image-copy hashes. Do not replace behavioral verification with a test that merely finds headings in this reference.

Run the normal final technical gate against the final versioned bytes. Preserve approved previous versions. Record actual inspections, checks and omissions; a catalog, metadata probe, screenshot or passing unit test alone is not a fully verified video.
