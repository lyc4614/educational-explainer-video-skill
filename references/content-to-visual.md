# Content to visual

## Extract before designing

For each smallest passage that still carries one complete meaning, record:

- its `id`, exact `sourceText`, and `sourceCueIds`;
- its `startMs` and `endMs` timing envelope;
- one `communicativeFunction`;
- `entities`, `actions`, `concepts`, `relations`, and `facts` explicitly present;
- one `viewerTakeaway` that the scene must make easier to understand.

Do not choose a visual motif until this semantic unit exists. Preserve the production-brief field names exactly. The canonical top-level contract is `project`, `aspect`, `fps`, `captions`, `semanticUnits`, `visualElements`, `scenes`, `sampleDecision`, and `verificationItems`.

## Admit only explanatory elements

Every primary or supporting `visualElements` entry must have a `sourcePhrase` and an `explanatoryRole`. It must also declare the canonical `id`, `kind`, `visualForm`, `stateChanges`, `sceneIds`, `evidenceStatus`, `originalityNote`, and `layer`. A decorative background may establish restrained tone or separation, but it cannot substitute for a sourced explanation, compete with the primary action, or obscure captions and evidence.

Prefer mappings in this order:

1. Show an action as a visible state change.
2. Put items being compared in a shared coordinate system.
3. Show sequence or causality in its stated order.
4. Turn an abstract concept into an observable state, spatial relation, or consequence.
5. Render a real formula literally and verified data literally; do not replace either with a suggestive icon.

Never strengthen or soften degree, reverse direction, or invent causality. A formula or data element may use `evidenceStatus: pending` only while every scene using it remains `draft`; record the unresolved check in a `verificationItems` entry whose status is `pending` and whose `targetElementIds` includes that element's `id`. Before any using scene becomes `approved` or `rendered`, its evidence must be `verified`. `not-applicable` is invalid for a used formula or data element. References may inform only abstract rhythm, hierarchy, and transition logic; never copy identifiable assets, characters, compositions, layouts, or shot sequences.

## Phone-interruption example

For “孩子刚开始写作业，手机通知一响，注意力就被拉走”:

- the child is the task performer;
- the phone pulse is the stated interrupt;
- the unfinished task shows the work being paused;
- the clock supports “刚开始” by locating the interruption near task onset;
- the attention path makes the stated shift from task to phone visible.

Do not add a classroom, teacher, blackboard, dopamine label, brain diagram, or neuroscience claim: none is authorized by the source.

## Rejection questions

- Exact phrase: which exact source phrase authorizes this element or change?
- Clearer relation: does it make the stated action, comparison, order, or cause clearer?
- Removal test: if removed, does explanatory understanding become worse? If not, demote or delete it.
- Overclaim test: does it change degree, causality, certainty, formula, or data beyond the source? If yes, reject it.

Scene planning must use the canonical `scenes` fields: `id`, `startFrame`, `endFrame`, `cueIds`, `semanticUnitIds`, `visualThesis`, `primaryElements`, `supportingElements`, `enterState`, `exitState`, `transitionIn`, `transitionOut`, `continuityAnchor`, `aspectOverrides`, `reviewFrames`, and `status`.
