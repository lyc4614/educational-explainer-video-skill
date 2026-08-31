import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsRoot = dirname(fileURLToPath(import.meta.url));
const skillRoot = dirname(testsRoot);
const expectedReferences = [
  'references/content-to-visual.md',
  'references/production-workflow.md',
  'references/visual-system.md',
  'references/qa-and-delivery.md'
];
const readReference = (name) => readFileSync(join(skillRoot, 'references', name), 'utf8');
const section = (markdown, heading) => {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingMatch = new RegExp(`^## ${escapedHeading}\\r?$`, 'm').exec(markdown);
  assert.ok(headingMatch, `missing exact section heading: ${heading}`);
  const contentStart = headingMatch.index + headingMatch[0].length;
  const remainder = markdown.slice(contentStart);
  const nextHeading = /^## .+\r?$/m.exec(remainder);
  return remainder.slice(0, nextHeading?.index);
};
const orderedStep = (markdown, number) => {
  const match = markdown.match(new RegExp(`^${number}\\. (.+)$`, 'm'));
  assert.ok(match, `missing ordered workflow step ${number}`);
  return match[1];
};

test('SKILL.md routes exactly the four production references and every target exists', () => {
  const skill = readFileSync(join(skillRoot, 'SKILL.md'), 'utf8');
  const routedReferences = [...skill.matchAll(/references\/[a-z-]+\.md/g)].map(
    ([reference]) => reference
  );

  assert.deepEqual(routedReferences, expectedReferences);
  for (const reference of expectedReferences) {
    assert.ok(existsSync(join(skillRoot, reference)), `missing ${reference}`);
  }
});

test('content-to-visual defines canonical extraction, element admission, and draft evidence handling', () => {
  const content = readReference('content-to-visual.md');
  const extraction = section(content, 'Extract before designing');
  const requiredFields = [
    'id',
    'sourceText',
    'sourceCueIds',
    'startMs',
    'endMs',
    'communicativeFunction',
    'entities',
    'actions',
    'concepts',
    'relations',
    'facts',
    'viewerTakeaway'
  ];

  for (const field of requiredFields) {
    assert.ok(extraction.includes(`\`${field}\``), `missing semantic field: ${field}`);
  }
  const admission = section(content, 'Admit only explanatory elements');
  for (const invariant of [
    '`sourcePhrase`',
    '`explanatoryRole`',
    '`evidenceStatus: pending`',
    '`draft`',
    '`approved`',
    '`rendered`',
    '`verified`',
    '`not-applicable`',
    '`verificationItems`',
    '`targetElementIds`'
  ]) {
    assert.ok(admission.includes(invariant), `content-to-visual missing: ${invariant}`);
  }
});

test('production-workflow defines intake, cue stops, risk criteria, approvals, and delivery record', () => {
  const workflow = readReference('production-workflow.md');
  const intake = section(workflow, 'Intake contract');
  for (const invariant of ['absolute', 'SHA-256', '--source-root', 'production-run.json']) {
    assert.ok(intake.includes(invariant), `workflow intake missing: ${invariant}`);
  }

  const orderedWorkflow = section(workflow, 'Ordered workflow');
  const steps = orderedWorkflow.match(/^(?:[1-9]|10)\. .+$/gm) ?? [];
  assert.equal(steps.length, 10, 'workflow must retain exactly 10 ordered steps');
  const step = orderedStep(orderedWorkflow, 1);

  for (const condition of [
    'empty cue',
    'nonpositive duration',
    'end <= start',
    'non-monotonic cue order',
    'overlap',
    'text/SRT mismatch'
  ]) {
    assert.ok(step.includes(condition), `workflow step 1 missing: ${condition}`);
  }

  const approvalStep = orderedStep(orderedWorkflow, 6);
  assert.match(
    approvalStep,
    /written approval.*every Gate A sample.*every Gate B micro-sample\/keyframe set.*before full expansion/,
    'Gate A and B deliverables require written approval before full expansion'
  );
  assert.match(
    approvalStep,
    /Gate C direct-full requires no sample approval.*brief and keyframes remain mandatory/,
    'Gate C must bypass sample approval without bypassing its brief or keyframes'
  );

  const gates = section(workflow, 'Sample risk gates');
  for (const criterion of [
    'new-topic',
    'unapproved-visual-system',
    'many-new-elements',
    'complex-metaphor',
    'same-approved-series',
    'low-risk-reuse',
    '20–30',
    '8–12'
  ]) {
    assert.ok(gates.includes(criterion), `workflow risk gate missing: ${criterion}`);
  }
  assert.ok(orderedWorkflow.includes('`targetElementIds`'));

  const stops = section(workflow, 'Stop conditions');
  const requirements = [
    ['text/SRT mismatch', 'list differences', 'request the authoritative version'],
    ['unclear formula, data, or causal evidence', 'mark it `pending`', 'stop final scene implementation'],
    ['meaning-changing metaphor', 'return to the brief', 'neutral mapping'],
    ['copyright-risky reference', 'abstract rhythm, hierarchy, and transition rules'],
    ['output already exists', 'new versioned filename', 'never overwrite'],
    ['render, audio, probe, or decode failure', 'outside the delivery']
  ];

  for (const phrases of requirements) {
    const remediationLine = stops
      .split(/\r?\n/)
      .find((line) => line.includes(phrases[0]));
    assert.ok(remediationLine, `missing stop condition: ${phrases[0]}`);
    for (const phrase of phrases.slice(1)) {
      assert.ok(remediationLine.includes(phrase), `${phrases[0]} missing remediation: ${phrase}`);
    }
  }

  const deliveryStep = orderedStep(orderedWorkflow, 10);
  assert.ok(deliveryStep.includes('production-run.json'));
});

test('visual-system defines both aspect contracts and boundary continuity', () => {
  const visual = readReference('visual-system.md');
  const grammar = section(visual, 'Explanatory grammar');
  const aspects = section(visual, 'Aspect contracts');
  const continuity = section(visual, 'Continuity review');

  for (const invariant of ['one primary explanatory action', 'frame-driven', 'continuityAnchor']) {
    assert.ok(grammar.includes(invariant), `visual grammar missing: ${invariant}`);
  }
  for (const invariant of ['16:9', '1920×1080', '9:16', '1080×1920']) {
    assert.ok(aspects.includes(invariant), `aspect contract missing: ${invariant}`);
  }
  assert.ok(continuity.includes('boundary as a pair'));
});

test('qa-and-delivery defines profile-aware visual review and canonical production-run.json', () => {
  const qa = readReference('qa-and-delivery.md');
  const visual = section(qa, 'Visual gate');
  for (const invariant of [
    'every declared `reviewFrames` entry',
    'both sides of every scene boundary',
    'interval and boundary contact sheets'
  ]) {
    assert.ok(visual.includes(invariant), `visual QA missing: ${invariant}`);
  }
  assert.ok(section(qa, 'Media gate').includes('full decode'));
  assert.ok(section(qa, 'Delivery gate').includes('versioned'));

  const runRecord = section(qa, 'Production run record');
  for (const invariant of [
    '`production-run.json`',
    'beside the production brief',
    'project QA directory',
    'absolute',
    'append-only',
    'versioned'
  ]) {
    assert.ok(runRecord.includes(invariant), `production run record missing: ${invariant}`);
  }

  const jsonBlock = runRecord.match(/```json\r?\n([\s\S]*?)\r?\n```/);
  assert.ok(jsonBlock, 'production run record must contain a JSON example');
  const record = JSON.parse(jsonBlock[1]);
  assert.deepEqual(Object.keys(record), [
    'briefPath',
    'resolvedSources',
    'approvals',
    'checks',
    'artifacts',
    'omissions'
  ]);
  assert.deepEqual(Object.keys(record.resolvedSources[0]), [
    'declaredPath', 'resolvedPath', 'sha256', 'status'
  ]);
  assert.deepEqual(Object.keys(record.approvals[0]), ['kind', 'scope', 'status', 'evidencePath']);
  assert.deepEqual(Object.keys(record.checks[0]), ['kind', 'command', 'status', 'evidencePath']);
  assert.deepEqual(Object.keys(record.artifacts[0]), ['kind', 'path', 'sha256', 'status']);
  assert.deepEqual(Object.keys(record.omissions[0]), ['check', 'reason', 'risk']);

  const assertExactKeys = (entry, keys, label) => {
    assert.deepEqual(Object.keys(entry), keys, `${label} keys`);
  };
  const assertNonEmptyString = (value, label) => {
    assert.equal(typeof value, 'string', `${label} type`);
    assert.ok(value.trim().length > 0, `${label} must be nonempty`);
  };
  const assertAbsoluteOrNull = (value, label) => {
    if (value === null) return;
    assertNonEmptyString(value, label);
    assert.ok(isAbsolute(value), `${label} must be absolute when non-null`);
  };
  assertAbsoluteOrNull(record.briefPath, 'briefPath');
  assert.ok(Array.isArray(record.resolvedSources));
  for (const [index, source] of record.resolvedSources.entries()) {
    assertExactKeys(source, ['declaredPath', 'resolvedPath', 'sha256', 'status'], `resolvedSources[${index}]`);
    assertNonEmptyString(source.declaredPath, `resolvedSources[${index}].declaredPath`);
    assertAbsoluteOrNull(source.resolvedPath, `resolvedSources[${index}].resolvedPath`);
    assert.match(source.sha256, /^[0-9a-fA-F]{64}$/);
    assert.ok(['pending', 'verified', 'failed'].includes(source.status));
  }
  assert.ok(Array.isArray(record.approvals));
  for (const [index, approval] of record.approvals.entries()) {
    assertExactKeys(approval, ['kind', 'scope', 'status', 'evidencePath'], `approvals[${index}]`);
    assertNonEmptyString(approval.kind, `approvals[${index}].kind`);
    assertNonEmptyString(approval.scope, `approvals[${index}].scope`);
    assert.ok(['pending', 'approved', 'rejected'].includes(approval.status));
    assertAbsoluteOrNull(approval.evidencePath, `approvals[${index}].evidencePath`);
  }
  assert.ok(Array.isArray(record.checks));
  for (const [index, check] of record.checks.entries()) {
    assertExactKeys(check, ['kind', 'command', 'status', 'evidencePath'], `checks[${index}]`);
    assertNonEmptyString(check.kind, `checks[${index}].kind`);
    assertNonEmptyString(check.command, `checks[${index}].command`);
    assert.ok(['pending', 'passed', 'failed', 'omitted'].includes(check.status));
    assertAbsoluteOrNull(check.evidencePath, `checks[${index}].evidencePath`);
  }
  assert.ok(Array.isArray(record.artifacts));
  for (const [index, artifact] of record.artifacts.entries()) {
    assertExactKeys(artifact, ['kind', 'path', 'sha256', 'status'], `artifacts[${index}]`);
    assertNonEmptyString(artifact.kind, `artifacts[${index}].kind`);
    assertAbsoluteOrNull(artifact.path, `artifacts[${index}].path`);
    assert.match(artifact.sha256, /^[0-9a-fA-F]{64}$/);
    assert.ok(['pending', 'verified', 'failed'].includes(artifact.status));
  }
  assert.ok(Array.isArray(record.omissions));
  for (const [index, omission] of record.omissions.entries()) {
    assertExactKeys(omission, ['check', 'reason', 'risk'], `omissions[${index}]`);
    assertNonEmptyString(omission.check, `omissions[${index}].check`);
    assertNonEmptyString(omission.reason, `omissions[${index}].reason`);
    assertNonEmptyString(omission.risk, `omissions[${index}].risk`);
  }
});
