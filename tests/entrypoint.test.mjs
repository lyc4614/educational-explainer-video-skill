import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsRoot = dirname(fileURLToPath(import.meta.url));
const skillRoot = dirname(testsRoot);
const requiredFiles = ['SKILL.md', join('agents', 'openai.yaml')];

test('resolves the Skill root and requires its entrypoint files', () => {
  for (const required of requiredFiles) {
    assert.ok(existsSync(join(skillRoot, required)), `missing ${required}`);
  }
});

test('validates Skill frontmatter and implicit invocation metadata', (t) => {
  if (!requiredFiles.every((required) => existsSync(join(skillRoot, required)))) {
    t.skip('entrypoint files are absent; existence test reports the RED baseline');
    return;
  }

  const skill = readFileSync(join(skillRoot, 'SKILL.md'), 'utf8');
  const openai = readFileSync(join(skillRoot, 'agents', 'openai.yaml'), 'utf8');
  const frontmatter = skill.match(/^(---\r?\n[\s\S]*?\r?\n---)/)?.[1] ?? '';
  const description = frontmatter.match(/^description:\s*(.*?)\s*$/m)?.[1] ?? '';

  assert.match(frontmatter, /^---\r?\nname:\s*educational-explainer-video\s*$/m);
  assert.match(description, /^Use when /);
  assert.doesNotMatch(description, /\b(first|then|workflow|parse|render)\b/i);
  assert.match(openai, /^[ \t]+allow_implicit_invocation: true$/m);
  assert.match(openai, /^[ \t]*default_prompt:\s*[^\r\n]*\$educational-explainer-video[^\r\n]*$/m);
});
