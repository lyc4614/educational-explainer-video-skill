# QA and delivery

## Automated gate

Run timeline tests, production-brief/schema validation, scene behavior tests, TypeScript checks, and composition registration/contract checks. For each changed behavior, preserve a genuine failure-before-fix run and run focused tests. The selected review profile determines regression frequency, but every source change must be covered before delivery. Automated success does not replace semantic or visual review.

## Visual gate

Both profiles inspect representative scene states, both sides of every scene boundary, and interval and boundary contact sheets. Strict Audit additionally inspects every declared `reviewFrames` entry at original resolution and denser interval evidence. Check explanatory hierarchy, legibility, caption safe area, literal formula and verified-data fidelity, character/object state, and causal continuity. For 9:16, explicitly inspect the top, center, and bottom zones, including the reserved caption band.

## Standard Efficient

Use `standard-efficient` for routine production on a mature system without a strict trigger.

- Run focused tests for each changed behavior and one final full regression after the last source change.
- Inspect representative scene frames, both sides of every scene boundary, and compact interval and boundary contact sheets.
- Use at most one independent final review when independent review is available and authorized; do not schedule per-task duplicate reviewers by default.
- Do not repeat an already successful check without a new failure signal, source/artifact change, or evidence that the affected scope is broader.
- Keep the production record concise while still recording the profile, core checks, final artifact, omissions, and approval boundary.

## Strict Audit

Use `strict-audit` after explicit selection or accepted escalation.

- Run staged full regressions at meaningful implementation checkpoints.
- Inspect every declared `reviewFrames` entry at original resolution, perform dense interval review, and retain expanded boundary/contact-sheet evidence.
- Perform an independent specification review and an independent quality review; add a final global review when the acceptance context requires it.
- Preserve detailed append-only evidence for each approval, check, omission, and artifact.
- Expand re-verification when failures implicate shared components, multiple scenes, or the audit trail itself.

## Shared final media gate

This gate is identical for `standard-efficient` and `strict-audit`. Against the current final artifact and current source, run the fail-closed starter-token scan; verify the versioned path and SHA-256; validate video/audio stream counts, codec, dimensions, fps, frame count, duration tolerance, and audio contract; and perform a full decode. A successful metadata probe is necessary but insufficient.

## Media gate

Run `scripts/validate-media.mjs` against the declared contract. Verify video/audio stream counts, codecs, dimensions, fps, frame count, duration tolerance, and full decode. A successful metadata probe is necessary but insufficient: truncated or corrupt frames can pass a probe.

## Failure recovery

Any final validation failure blocks delivery. Diagnose and repair the smallest affected scope, run focused checks for that scope, and expand only when shared code or multiple scenes are implicated. If the final artifact changed, rerender it and run the complete shared final media gate against the new bytes. For a media-only parameter failure, do not rerun unrelated semantic, visual, or code checks unless their source or evidence changed. Repeated failures with the same cause require root-cause diagnosis before another render.

## Delivery gate

Use a versioned filename and never overwrite an approved artifact or an existing output. Keep failed renders, partial media, diagnostics, and scratch contact sheets outside the delivery directory. Record:

Before any delivery render, run the fail-closed, case-sensitive source scan below against the delivery project's source root. The three tokens are the complete centralized starter-token list: the marker, visible title, and visible caption. A clean scan is the only allowed success. Any starter-token match, missing source path, unavailable `rg`, or other scanner error must stop delivery. Record the clean source-scan result with the other delivery evidence. The command scans only `$DeliverySource`; do not point it at this QA reference.

```powershell
param([Parameter(Mandatory = $true)][string]$DeliverySource)
$ErrorActionPreference = 'Stop'
try {
  $rgCommand = Get-Command rg -CommandType Application -ErrorAction Stop | Select-Object -First 1
  $resolvedDeliverySource = Resolve-Path -LiteralPath $DeliverySource -ErrorAction Stop
  $deliverySourceItem = Get-Item -LiteralPath $resolvedDeliverySource.Path -Force -ErrorAction Stop
  if (-not $deliverySourceItem.PSIsContainer) { throw 'DeliverySource must resolve to a directory' }
  & $rgCommand.Source -n -F --hidden --no-ignore --follow -e 'STARTER_PLACEHOLDER_DO_NOT_DELIVER' -e 'Replace with manuscript-derived visual system' -e 'Replace this preview with source-traceable explanatory content' -- $deliverySourceItem.FullName
  $rgExitCode = $LASTEXITCODE
  switch ($rgExitCode) {
    1 { exit 0 }
    0 { [Console]::Error.WriteLine('starter token found; stop delivery'); exit 10 }
    default { [Console]::Error.WriteLine("starter token source scan failed with rg exit code $rgExitCode"); exit 20 }
  }
} catch {
  [Console]::Error.WriteLine("starter token source scan could not run: $($_.Exception.Message)")
  exit 30
}
```

- the artifact's absolute path and SHA-256 hash;
- the media-contract path and expected versus observed stream, frame, duration, and dimension counts;
- the focused/full test commands and results;
- representative stills and contact-sheet paths;
- the written sample/style approval and final approval boundary;
- every omitted check, with reason and resulting risk.

Completion requires fresh evidence from the current artifact and current code. Prior runs, a probe without full decode, or an approval for an earlier version cannot establish completion.

## Production run record

The canonical run-record filename is `production-run.json`. Store it beside the production brief or in the project QA directory. `briefPath`, every `resolvedPath`, every output `path`, and every `evidencePath` must be absolute; `declaredPath` preserves the source declaration for audit. Use this exact JSON shape and keys:

```json
{
  "briefPath": "C:/project/production-brief.json",
  "resolvedSources": [
    {
      "declaredPath": "inputs/source.srt",
      "resolvedPath": "C:/project/inputs/source.srt",
      "sha256": "944dd17a0ce33b28d6fb7134f2e01da7b7b6f67681c8e5616b681f065e88ba75",
      "status": "verified"
    }
  ],
  "approvals": [
    {
      "kind": "sample",
      "scope": "Gate A visual system",
      "status": "approved",
      "evidencePath": "C:/project/qa/sample-approval.txt"
    }
  ],
  "checks": [
    {
      "kind": "full-suite",
      "command": "npm test",
      "status": "passed",
      "evidencePath": "C:/project/qa/test-output.txt"
    }
  ],
  "artifacts": [
    {
      "kind": "delivery-video",
      "path": "C:/project/delivery/video_v001.mp4",
      "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "status": "verified"
    }
  ],
  "omissions": [
    {
      "check": "audio-stream",
      "reason": "silent audio contract",
      "risk": "none"
    }
  ]
}
```

Treat entries as append-only. After an approval, freeze that record; any later run uses a new versioned project or QA directory containing its own `production-run.json`. Never overwrite or silently revise an approved record.
