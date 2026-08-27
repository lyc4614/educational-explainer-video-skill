# QA and delivery

## Automated gate

Run timeline tests, production-brief/schema validation, scene behavior tests, TypeScript checks, and composition registration/contract checks. For each changed behavior, preserve a genuine failure-before-fix run, then run the focused test and full suite after implementation. Automated success does not replace semantic or visual review.

## Visual gate

Inspect every declared `reviewFrames` entry from every scene and both sides of every scene boundary. Generate interval and boundary contact sheets. Check explanatory hierarchy, legibility, caption safe area, literal formula and verified-data fidelity, character/object state, and causal continuity. For 9:16, explicitly inspect the top, center, and bottom zones, including the reserved caption band.

## Media gate

Run `scripts/validate-media.mjs` against the declared contract. Verify video/audio stream counts, codecs, dimensions, fps, frame count, duration tolerance, and full decode. A successful metadata probe is necessary but insufficient: truncated or corrupt frames can pass a probe.

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
