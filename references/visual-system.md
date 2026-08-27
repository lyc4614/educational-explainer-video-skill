# Visual system

## Explanatory grammar

Each scene has one primary explanatory action. Establish hierarchy through geometry, scale, color, contrast, and motion so the viewer sees that action before support. Animation must be frame-driven and deterministic: no timers, runtime randomness, or CSS runtime animation.

Carry a declared `continuityAnchor` across adjacent scenes and make enter/exit states compatible. Keep captions on a separate layer and out of explanatory geometry. Typeset real formulas literally and display only verified data. Reuse design tokens, motion grammar, layout rules, and code infrastructure; manuscript-specific characters, objects, SVGs, formulas, data graphics, and scenes remain in the video project.

## Aspect contracts

### 16:9

Use 1920×1080 at 30fps. The wide canvas may use lateral comparisons, split paths, and side-by-side relationships. Safe-area values are executable in `assets/remotion-starter/src/config/aspect.mjs`; scene code must consume those values instead of inventing local margins.

### 9:16

Use 1080×1920 at 30fps. Keep the primary explanatory action in the central safe area, reserve the bottom caption band, and limit captions to at most two lines. Reflow wide material into vertical stacks, staged reveals, or focus moves. Never shrink a 16:9 scene as one bitmap. Repositioning may change layout, but it must preserve semantic relations and action order. Safe-area and caption-band values also come from `assets/remotion-starter/src/config/aspect.mjs`.

## Continuity review

Review every boundary as a pair: the last meaningful frame before the cut and the first meaningful frame after it. Confirm that the anchor keeps its identity and plausible position/state, cause precedes consequence, object ownership does not jump, and the next scene starts from the previous exit state. Then inspect the transition in motion, not only as isolated stills.

Common mistakes include multiple competing primary actions; decorative motion louder than the explanation; off-screen or caption-covered evidence; formulas paraphrased into false notation; data without provenance; unexplained character or object teleportation; cuts that reverse causality; overly long caption lines; and vertical layouts produced by uniform bitmap shrink.
