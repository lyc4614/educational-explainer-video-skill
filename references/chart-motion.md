# Source-faithful chart motion

Use for line, bar, pie/donut graphics and chart overlays in an existing explainer. Reuse the approved visual grammar, not the demo's numbers or complete poster layout. A request for richer motion is not a requirement to use every chart type.

## Choose the relationship first

| Source relationship | Useful graphic | Do not infer |
| --- | --- | --- |
| Ordered observations on a consistent time/measurement axis | Line drawn in source order, with a following cursor | A trend from unrelated categories, or a trajectory between different exams/scales |
| Comparable categories with the same unit, year, batch and population basis | Bars on one explicit scale, normally starting at zero | A ranking from mixed denominators; a truncated baseline that exaggerates small differences |
| Parts of a defined whole, or a stated percentage with an identifiable population | Front-facing pie/donut, revealed through its actual angular share | A whole from an isolated count, or a denominator from a different nearby statistic |
| A count without a valid whole or comparison | Exact number/card | A rate, pie slice, or success probability |

Check the source window as well as the source value. Reveal each result after its source cue begins; a multi-item comparison should follow introduction of its referents. If the source lacks a time series, omit the line chart and use the supported graphic. Do not invent intermediate years to fill a design.

## Preserve the claim and its precision

Carry unit, year, category/batch, population, approximation and source status into the visible chart. An examination threshold, a headcount and a control-line rate are different measures even when they appear in the same sentence. Keep independent measures separate; do not use an unrelated headcount as a rate's numerator or reconstruct missing totals/complement counts.

Keep differently scoped rates in separate single-population views unless comparability has been established. Emphasize the current subject, rather than implying that highlighting is a validated outcome ranking. A chart's scale maximum is a coordinate choice; do not relabel it as an examination's maximum score without evidence.

Apply the existing pending-evidence stop to factual assertions. A faithful quotation is a different claim: the evidence may establish that a source reports a value without establishing that the value is true. Only use an attributed-quotation treatment when that fits the user's requested reproduction; verify transcription and scope, keep the attribution and uncertainty visible with the data, and record the unresolved underlying truth. Do not silently turn a pending assertion into a verified fact, or use attribution as a substitute for verification when the user asks for a factual answer.

## Animate geometry, keep factual labels exact

For historical scores, thresholds, dates and reported counts/rates, keep the displayed source value fixed during the entrance. Grow the bar, draw the path or reveal the sector; do not display fabricated intermediate scores by counting from zero. A literal accumulation or an explicitly labeled counter demo may animate values when that is the intended meaning. It is not the default for a historical record.

Use source precision and qualifiers, including “about/约”. If a source numeric string preserves significant trailing zeros, keep that display string; do not add precision or round it away by accident. Keep value labels attached to the same geometry/pose as their marks.

For line motion, trace the actual polyline and move the cursor along that same path; avoid smooth-curve overshoot that invents extrema. For pie/donut motion, compute final sector angles from the complete whole once, then truncate those fixed sectors with a reveal sweep. Never renormalize only the currently visible categories to 100%. Use an equal-radius, front-facing circle; highlight a sector by color or a modest translation without changing its area, angle or population. Do not bounce past quantitative endpoints.

Stage the motion: establish axes/meaning, reveal marks, emphasize the selected fact, then hold for reading. Derive every frame independently, including fractional frames. The time budget follows the cue envelope and reading load; there is no universal chart count, duration or chart-to-model ratio.

## Composite into the existing scene

Use a project-local data rectangle in the asset plan. Keep subject identity and docking pose stable while the chart becomes the primary action. Reuse theme, typography and light/material cues, but retain mathematical shape accuracy. A whole demo scene is not a data overlay: remove its large background, title and footer when importing only its graph.

Suppress the old card/number in the same region before showing its replacement. Use mutually exclusive scene windows and inspect both sides of every new boundary. Keep subtitles in their original independent band; place attribution outside it, and check maximum label lengths, moving marks, shadows and any displaced sector against the model and safe area. Return the data region cleanly to the next scene.

## Portable primitives

`assets/chart-primitives/geometry.mjs` provides zero-baseline bars, literal value labels, explicit-domain line points, distance-based polyline tracing and fixed-sector pie/donut reveals. It supports nonnegative series/parts; signed series or bars require a corresponding domain/baseline implementation. `donutArcs` treats its inputs as the complete composition; `shareArcs` requires an explicit whole and leaves any unreported remainder neutral. A lone reported percentage must not be normalized into a full circle. The supplied line points and overlay assume equally spaced observations; irregular time or measurement gaps require an explicit x-coordinate mapping before use. Category labels alone do not establish that spacing. Geometry checks do not decide whether the manuscript's categories or populations are comparable.

`assets/chart-primitives/ChartLayer.tsx` is an adaptable SVG overlay, not a full video template. Copy both files into the current project; the starter's TypeScript configuration enables `allowJs` for the adjacent `.mjs`. Supply the data, timing, labels, rectangle, title and visible `sourceNote`; line/bar modes require an explicit `maximum`, and donut mode requires an explicit `whole`. For a stated percentage use `whole={100}`: that is its percentage scale, not an inferred cohort headcount. For counts the whole must be sourced in the same unit. `valueLabels` overrides default numeric formatting, so include its unit/qualifier and check agreement with the numeric geometry. The caller owns source verification, semantic layout, cue timing and exit windows. The example intentionally has no topic data, school assets or default denominator. Dense or long legends need project-specific layout and phone-size inspection.

```tsx
// rows, frame, timings and rect come from the current source-traceable project.
<ChartLayer
  kind="bar" values={rows.map(row => row.value)}
  labels={rows.map(row => row.label)} valueLabels={rows.map(row => row.sourceLabel)}
  maximum={axisMaximum} unit={unit} frame={frame}
  startFrame={revealStart} endFrame={revealEnd} box={dataRect}
  title={comparisonTitle} sourceNote={scopeAndAttribution}
/>
```

## Review an addition proportionately

Reuse written approvals within their scope and keep the original output. Same-topic, approved-component reuse may qualify for Gate C; the existing A/B/C and review-profile criteria still decide this. Compare changed entrances, readable holds and boundary pairs. Stable same-environment image/hash comparisons can cheaply detect unintended changes elsewhere; they are not a substitute for checking new chart behavior.

Run the final regression after the last source change and the complete media gate on the actual exported bytes. Record which intermediate frames were refreshed after a fix, and which source/render parameters produced them. Inspect the exported video moving forward through changed sections and the ending; describe the range honestly if playback started from a chapter rather than zero.

For handoff, give an existing local library/preview entry and its restart method when available. A localhost URL needs its service running. Studio provides frame inspection and code-driven adjustment; do not present it as a drag-and-drop editor unless the project implements that capability. Reload and verify a stale hot-reload preview before claiming it works. An interactive preview, a rendered still and a decoded delivery MP4 are distinct artifacts.
