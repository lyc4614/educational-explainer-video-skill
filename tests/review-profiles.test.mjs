import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const testsRoot = dirname(fileURLToPath(import.meta.url));
const skillRoot = dirname(testsRoot);
const read = (path) => readFileSync(join(skillRoot, path), 'utf8');

const section = (markdown, heading) => {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^## ${escaped}\\r?$`, 'm').exec(markdown);
  assert.ok(match, `missing section: ${heading}`);
  const remainder = markdown.slice(match.index + match[0].length);
  const next = /^## .+\r?$/m.exec(remainder);
  return remainder.slice(0, next?.index);
};

test('entrypoint selects a review profile before the production workflow', () => {
  const skill = read('SKILL.md');
  const selection = section(skill, 'Choose review profile first');

  assert.ok(skill.indexOf('## Choose review profile first') < skill.indexOf('## Start here'));
  assert.match(selection, /honor.*explicit.*choice/i);
  assert.match(selection, /standard-efficient/);
  assert.match(selection, /continue without blocking/i);
  assert.match(selection, /strict-audit/);
  assert.match(selection, /recommend.*user.*choice/i);
});

test('workflow keeps sample gates separate and defines strict escalation triggers', () => {
  const workflow = read('references/production-workflow.md');
  const selection = section(workflow, 'Review profile selection');

  for (const invariant of [
    'standard-efficient',
    'strict-audit',
    'formal client acceptance',
    'regulated or high-stakes claims',
    'new reusable visual system or shared component',
    'archival traceability',
    'failures spanning multiple scenes or shared components'
  ]) {
    assert.ok(selection.includes(invariant), `profile selection missing: ${invariant}`);
  }

  assert.match(selection, /sample risk gates A, B, and C.*independent/i);
  assert.match(selection, /new topic alone.*does not.*strict-audit/i);
  assert.match(selection, /record.*review-profile.*checks/i);
});

test('standard-efficient removes duplicate work while retaining visual coverage', () => {
  const qa = read('references/qa-and-delivery.md');
  const standard = section(qa, 'Standard Efficient');

  for (const invariant of [
    'one final full regression',
    'representative scene frames',
    'both sides of every scene boundary',
    'interval and boundary contact sheets',
    'at most one independent final review'
  ]) {
    assert.ok(standard.includes(invariant), `standard-efficient missing: ${invariant}`);
  }

  assert.match(standard, /do not repeat.*successful.*without.*failure|do not duplicate.*without.*failure/i);
});

test('strict-audit adds review density and independent staged review', () => {
  const qa = read('references/qa-and-delivery.md');
  const strict = section(qa, 'Strict Audit');

  for (const invariant of [
    'staged full regressions',
    'every declared `reviewFrames` entry',
    'dense interval review',
    'specification review',
    'quality review',
    'append-only evidence'
  ]) {
    assert.ok(strict.includes(invariant), `strict-audit missing: ${invariant}`);
  }
});

test('both profiles share the same final technical media gate', () => {
  const qa = read('references/qa-and-delivery.md');
  const shared = section(qa, 'Shared final media gate');

  for (const invariant of [
    'starter-token',
    'codec',
    'dimensions',
    'fps',
    'frame count',
    'duration',
    'audio',
    'full decode',
    'SHA-256'
  ]) {
    assert.ok(shared.includes(invariant), `shared final gate missing: ${invariant}`);
  }

  assert.match(shared, /identical.*standard-efficient.*strict-audit/i);
});

test('failure recovery is targeted but always revalidates a changed final artifact', () => {
  const qa = read('references/qa-and-delivery.md');
  const recovery = section(qa, 'Failure recovery');

  assert.match(recovery, /blocks delivery/i);
  assert.match(recovery, /smallest affected scope/i);
  assert.match(recovery, /expand.*shared code|expand.*multiple scenes/i);
  assert.match(recovery, /final artifact changed.*complete shared final media gate/i);
  assert.match(recovery, /media-only.*do not rerun unrelated/i);
});
