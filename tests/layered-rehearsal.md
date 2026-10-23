# Layered-asset extension verification

## Baseline observations

A pre-change, independent planning rehearsal used the existing skill with a short synthetic education script, declared asset metadata, no source PNGs and no actual student grades. It already preserved uncertainty, rejected a full scene as a transparent subject, avoided an invented institution threshold and calculated visible-bound placement correctly. These were successful baseline behaviors, not failures to erase.

The old plan did not have a shared executable pixel-inspection/placement helper, and scheduled data animation before the layer composite. This extension supplies portable helpers and clarifies the simpler subject-motion intermediate before final data overlays. It retains the existing evidence and sample-gate contracts.

Before implementation, `node --test tests/layered-assets.test.mjs` failed because `scripts/inspect-asset.mjs` did not exist. After implementation, all five new tests pass: true alpha and bounds, opaque/empty rejection, visible-center placement and linked shadow, deterministic continuous motion, and non-overwriting CLI failure behavior.

## Verification scope

- Full suite: 319 tests; 313 pass, zero fail, six existing environment-dependent tests skip. Skips concern unavailable external integration fixtures or unsupported file symlinks; the new pure helper tests do not skip.
- Skill-creator frontmatter/scaffold validation passes.
- The inspection CLI was also run on an actual transparent PNG using a trusted installed sharp module. Its measured bounds matched the existing source metadata.
- The three copied TSX/motion resources are checked in an isolated Remotion project and rendered as a motion-only intermediate and a synthetic-data composite. Project images and machine-specific test harnesses are not included in the skill repository.

An independent post-change planning rehearsal was attempted but aborted by account usage limits before producing a result. It is **not** counted as a behavioral pass. Local executable/component checks provide evidence for the mechanical helpers, not a claim of independent model compliance. Future real usage should continue checking the plan-before-generation and intermediate/data distinction.
