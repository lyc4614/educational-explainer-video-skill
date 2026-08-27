import assert from 'node:assert/strict';
import { linkSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildTimeline, parseSrt } from '../scripts/build-timeline.mjs';

const testsRoot = dirname(fileURLToPath(import.meta.url));
const skillRoot = dirname(testsRoot);
const scriptPath = join(skillRoot, 'scripts', 'build-timeline.mjs');
const fixturePath = join(testsRoot, 'fixtures', 'phone-distraction.srt');
const cliTimeoutMs = 5_000;

const runCli = (argumentsList) => {
  const result = spawnSync(process.execPath, [scriptPath, ...argumentsList], {
    encoding: 'utf8',
    timeout: cliTimeoutMs
  });

  assert.equal(result.error, undefined, result.error?.message);
  return result;
};

const twoCueSrt = [
  '1',
  '00:00:00,000 --> 00:00:01,500',
  '第一句中文。',
  '',
  '2',
  '00:00:01,500 --> 00:00:02,000',
  '第二句中文。'
].join('\n');

test('buildTimeline maps valid Chinese cues to stable 30fps frame ranges', () => {
  assert.deepEqual(buildTimeline(twoCueSrt), {
    fps: 30,
    durationInFrames: 60,
    captions: [
      { id: 1, text: '第一句中文。', startMs: 0, endMs: 1500, from: 0, to: 45 },
      { id: 2, text: '第二句中文。', startMs: 1500, endMs: 2000, from: 45, to: 60 }
    ]
  });
});

test('parseSrt rejects malformed cue content, timing, IDs, and overlap with cue diagnostics', async (t) => {
  const cases = [
    {
      name: 'empty text',
      source: ['1', '00:00:00,000 --> 00:00:01,000', '   '].join('\n'),
      diagnostic: /cue 1.*text/i
    },
    {
      name: 'end time is not after start time',
      source: ['1', '00:00:01,000 --> 00:00:01,000', '时间错误。'].join('\n'),
      diagnostic: /cue 1.*end.*start/i
    },
    {
      name: 'start minute is outside 00-59',
      source: ['1', '00:60:00,000 --> 01:00:01,000', '分钟错误。'].join('\n'),
      diagnostic: /cue 1.*timing/i
    },
    {
      name: 'start second is outside 00-59',
      source: ['1', '00:00:60,000 --> 00:01:01,000', '秒数错误。'].join('\n'),
      diagnostic: /cue 1.*timing/i
    },
    {
      name: 'end minute is outside 00-59',
      source: ['1', '00:00:00,000 --> 00:60:00,000', '结束分钟错误。'].join('\n'),
      diagnostic: /cue 1.*timing/i
    },
    {
      name: 'first identifier is not one',
      source: ['2', '00:00:00,000 --> 00:00:01,000', '编号错误。'].join('\n'),
      diagnostic: /cue 1.*id.*1/i
    },
    {
      name: 'identifiers are non-sequential',
      source: [
        '1', '00:00:00,000 --> 00:00:01,000', '第一句。', '',
        '3', '00:00:01,000 --> 00:00:02,000', '第二句。'
      ].join('\n'),
      diagnostic: /cue 2.*id.*2/i
    },
    {
      name: 'adjacent cues overlap',
      source: [
        '1', '00:00:00,000 --> 00:00:01,000', '第一句。', '',
        '2', '00:00:00,900 --> 00:00:02,000', '第二句。'
      ].join('\n'),
      diagnostic: /cue 2.*overlap/i
    }
  ];

  for (const { name, source, diagnostic } of cases) {
    await t.test(name, () => {
      assert.throws(() => parseSrt(source), diagnostic);
    });
  }
});

test('parseSrt treats a whitespace-only physical line as a cue separator', () => {
  const captions = parseSrt([
    '1', '00:00:00,000 --> 00:00:01,000', '第一句。', '   ',
    '2', '00:00:01,000 --> 00:00:02,000', '第二句。'
  ].join('\n'));

  assert.deepEqual(captions, [
    { id: 1, text: '第一句。', startMs: 0, endMs: 1000 },
    { id: 2, text: '第二句。', startMs: 1000, endMs: 2000 }
  ]);
});

test('buildTimeline clamps quantized starts to the preceding cue end', () => {
  const timeline = buildTimeline([
    '1', '00:00:00,000 --> 00:00:00,034', '第一句。', '',
    '2', '00:00:00,034 --> 00:00:00,068', '第二句。'
  ].join('\n'), 30);

  assert.deepEqual(timeline.captions.map(({ from, to }) => [from, to]), [[0, 2], [2, 3]]);
  assert.equal(timeline.durationInFrames, 3);
});

test('buildTimeline rejects unsafe frame bounds at an otherwise valid FPS', () => {
  const source = ['1', '00:00:00,000 --> 00:00:02,000', '超大帧率。'].join('\n');

  assert.throws(
    () => buildTimeline(source, Number.MAX_SAFE_INTEGER),
    /cue 1: cannot be represented at 9007199254740991fps/
  );
});

test('buildTimeline uses exact frame arithmetic at high safe FPS values', () => {
  const timeline = buildTimeline(
    ['1', '00:00:00,000 --> 00:00:04,000', '精确帧。'].join('\n'),
    2251799813685232
  );

  assert.equal(timeline.captions[0].to, 9007199254740928);
  assert.equal(timeline.durationInFrames, 9007199254740928);
});

test('parseSrt allows gaps and preserves the second start time', () => {
  const captions = parseSrt([
    '1', '00:00:00,000 --> 00:00:01,000', '第一句。', '',
    '2', '00:00:02,000 --> 00:00:03,000', '第二句。'
  ].join('\n'));

  assert.equal(captions[1].startMs, 2000);
});

test('parseSrt strips BOM, normalizes CRLF, and joins multiline cue text', () => {
  const captions = parseSrt('\uFEFF1\r\n00:00:00,000 --> 00:00:01,000\r\n第一行  \r\n第二行\r\n');

  assert.deepEqual(captions, [
    { id: 1, text: '第一行\n第二行', startMs: 0, endMs: 1000 }
  ]);
});

test('CLI writes deterministic, two-space-indented JSON and reports each absolute output path', () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'educational-explainer-timeline-'));

  try {
    const inputPath = join(temporaryDirectory, 'input.srt');
    const firstOutputPath = join(temporaryDirectory, 'first', 'timeline.json');
    const secondOutputPath = join(temporaryDirectory, 'second', 'timeline.json');
    writeFileSync(inputPath, twoCueSrt, 'utf8');

    const firstResult = runCli([inputPath, firstOutputPath, '--fps', '30']);
    const secondResult = runCli([inputPath, secondOutputPath, '--fps', '30']);
    const firstOutput = readFileSync(firstOutputPath);
    const secondOutput = readFileSync(secondOutputPath);

    assert.equal(firstResult.status, 0, firstResult.stderr);
    assert.equal(secondResult.status, 0, secondResult.stderr);
    assert.equal(firstResult.stderr, '');
    assert.equal(secondResult.stderr, '');
    assert.equal(firstResult.stdout.trim(), `PASS timeline ${firstOutputPath}`);
    assert.equal(secondResult.stdout.trim(), `PASS timeline ${secondOutputPath}`);
    assert.deepEqual(JSON.parse(firstOutput.toString('utf8')), buildTimeline(twoCueSrt, 30));
    assert.match(firstOutput.toString('utf8'), /^\{\n  "fps": 30,\n/);
    assert.match(firstOutput.toString('utf8'), /\n  "captions": \[/);
    assert.match(firstOutput.toString('utf8'), /\n$/);
    assert.deepEqual(firstOutput, secondOutput);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('CLI rejects missing arguments and invalid fps with concise errors', () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'educational-explainer-timeline-'));

  try {
    const missing = runCli([]);
    const invalidFps = runCli([fixturePath, join(temporaryDirectory, 'output.json'), '--fps', '0']);

    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /^Usage: node scripts\/build-timeline\.mjs /);
    assert.equal(invalidFps.status, 1);
    assert.match(invalidFps.stderr, /^ERROR fps must be a positive integer$/m);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('CLI rejects malformed SRT with its cue diagnostic', () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'educational-explainer-timeline-'));

  try {
    const inputPath = join(temporaryDirectory, 'malformed.srt');
    const outputPath = join(temporaryDirectory, 'timeline.json');
    writeFileSync(inputPath, ['1', '00:00:01,000 --> 00:00:01,000', '时间错误。'].join('\n'), 'utf8');

    const result = runCli([inputPath, outputPath]);

    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^ERROR cue 1: end time must be after start time$/m);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('CLI rejects identical resolved input and output paths before writing', () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'educational-explainer-timeline-'));

  try {
    const path = join(temporaryDirectory, 'same.srt');
    writeFileSync(path, twoCueSrt, 'utf8');

    const result = runCli([path, path]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /^ERROR input and output paths must differ$/m);
    assert.equal(readFileSync(path, 'utf8'), twoCueSrt);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('CLI rejects case-insensitive same files on Windows before writing', (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows-only case-folding behavior');
    return;
  }

  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'educational-explainer-timeline-'));

  try {
    const inputPath = join(temporaryDirectory, 'Same.srt');
    const outputPath = join(temporaryDirectory, 'same.srt');
    const sourceBytes = Buffer.from(twoCueSrt, 'utf8');
    writeFileSync(inputPath, sourceBytes);

    const result = runCli([inputPath, outputPath]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /^ERROR input and output paths must differ$/m);
    assert.deepEqual(readFileSync(inputPath), sourceBytes);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('CLI rejects hardlink aliases before writing when supported', (t) => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'educational-explainer-timeline-'));

  try {
    const inputPath = join(temporaryDirectory, 'input.srt');
    const outputPath = join(temporaryDirectory, 'alias.srt');
    const sourceBytes = Buffer.from(twoCueSrt, 'utf8');
    writeFileSync(inputPath, sourceBytes);

    try {
      linkSync(inputPath, outputPath);
    } catch (error) {
      t.skip(`hardlinks unavailable: ${error.code ?? error.message}`);
      return;
    }

    const result = runCli([inputPath, outputPath]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /^ERROR input and output paths must differ$/m);
    assert.deepEqual(readFileSync(inputPath), sourceBytes);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
