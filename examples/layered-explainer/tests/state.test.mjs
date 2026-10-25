import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {ASSET, CHARTS, DURATION_SECONDS, evaluateScene} from '../src/state.mjs';
import {placeImage} from '../src/primitives/motion.mjs';
import {barGeometry, linePoints, shareArcs} from '../src/primitives/geometry.mjs';

const read = relative => readFileSync(new URL(relative, import.meta.url));

test('all data is explicitly synthetic and each relation has an explicit basis', () => {
  assert.equal(DURATION_SECONDS, 24);
  for (const chart of CHARTS) {
    assert.equal(chart.synthetic, true);
    assert.match(chart.sourceNote, /合成/);
    assert.equal(chart.values.length, chart.labels.length);
    assert.equal(chart.values.length, chart.valueLabels.length);
    for (let i = 0; i < chart.values.length; i++) {
      assert.equal(chart.valueLabels[i], `${chart.values[i]}${chart.unit}`);
    }
  }
  assert.equal(CHARTS[0].relation, 'comparable-categories');
  assert.equal(CHARTS[1].relation, 'equally-spaced-time-series');
  assert.deepEqual(CHARTS[1].labels, ['第1周', '第2周', '第3周', '第4周']);
  assert.equal(CHARTS[2].relation, 'single-share-of-defined-whole');
  assert.equal(CHARTS[2].whole, 100);
  assert.deepEqual(CHARTS[2].values, [65]);
});

test('proportions keep their actual geometry instead of normalizing one share to 100%', () => {
  const b = barGeometry(48, 80, {x: 0, y: 0, width: 20, height: 100});
  assert.equal(b.height, 60);
  const points = linePoints([30, 45, 40, 60], {x: 0, y: 0, width: 300, height: 100}, {min: 0, max: 80});
  assert.deepEqual(points.map(p => p.x), [0, 100, 200, 300]);
  assert.ok(points[2].y > points[1].y, 'the third observation visibly decreases');
  const arc = shareArcs([65], 100, 0, 0, 100, 60)[0];
  assert.equal(arc.endAngle - arc.startAngle, 234);
  assert.equal(arc.share, 0.65);
});

test('the supplied PNG matches the published catalog hash and measured visible bounds', () => {
  const record = JSON.parse(read('../public/asset-record.json'));
  assert.equal(record.id, ASSET.id);
  assert.equal(record.sourceCatalog, 'material-library/catalog.json#student-focus-01');
  assert.equal(record.sha256, createHash('sha256').update(read('../public/assets/student-focus-01.png')).digest('hex'));
  assert.deepEqual(record.bounds, ASSET.bounds);
  assert.equal(record.width, ASSET.width);
  assert.equal(record.height, ASSET.height);
});

test('the lockfile fixes direct versions and includes complete cross-platform renderer packages', () => {
  const manifest = JSON.parse(read('../package.json'));
  const lock = JSON.parse(read('../package-lock.json'));
  assert.equal(lock.lockfileVersion, 3);
  for (const [name, version] of Object.entries({...manifest.dependencies, ...manifest.devDependencies})) {
    assert.equal(lock.packages[`node_modules/${name}`].version, version);
  }
  for (const [name, entry] of Object.entries(lock.packages)) {
    if (!name) continue;
    assert.ok(entry.version, `missing locked version: ${name}`);
    assert.match(entry.resolved, /^https:\/\/registry\.npmjs\.org\//);
    assert.ok(entry.integrity, `missing content integrity: ${name}`);
  }
  for (const platform of ['darwin-arm64', 'darwin-x64', 'linux-arm64-gnu', 'linux-arm64-musl', 'linux-x64-gnu', 'linux-x64-musl', 'win32-x64-msvc']) {
    assert.equal(lock.packages[`node_modules/@remotion/compositor-${platform}`].version, '4.0.477');
  }
});

test('checked-in caption JSON preserves all source SRT cue text and times', () => {
  const srt = read('../input.srt').toString('utf8').trim().replaceAll('\r\n', '\n');
  const captions = JSON.parse(read('../src/captions.json'));
  const blocks = srt.split(/\n\s*\n/);
  const milliseconds = value => {
    const [hours, minutes, seconds, millis] = value.split(/[:,]/).map(Number);
    return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
  };
  assert.equal(captions.length, blocks.length);
  blocks.forEach((block, index) => {
    const [, timing, ...lines] = block.split('\n');
    const [start, end] = timing.split(' --> ');
    assert.equal(captions[index].text, lines.join('\n'));
    assert.equal(captions[index].startMs, milliseconds(start));
    assert.equal(captions[index].endMs, milliseconds(end));
  });
});

test('the subject stays below the title and above captions, with a separate data area after docking', () => {
  for (let frame = 0; frame < DURATION_SECONDS * 30; frame += 0.5) {
    const state = evaluateScene(frame, 30);
    const posed = placeImage(ASSET, state.subject);
    assert.ok(state.subject.y - posed.visible.height / 2 >= 198);
    assert.ok(state.subject.y + posed.visible.height / 2 <= 880);
    assert.ok(state.subject.x - posed.visible.width / 2 >= 100);
    assert.ok(state.subject.x + posed.visible.width / 2 <= 1820);
    if (state.chart) {
      assert.ok(state.subject.x + posed.visible.width / 2 + 70 < 720);
      assert.ok(frame / 30 >= state.chart.startSeconds);
      assert.ok(frame / 30 < state.chart.endSeconds);
    }
  }
});

test('source attribution waits for data, stays clear of the subject label and remains visible for chart reading', () => {
  // The authored label is centered on subject.x with width 480; the source
  // occupies x=720..1810. Their vertical bands overlap, so x must separate them.
  for (let frame = 0; frame < DURATION_SECONDS * 30; frame += 0.25) {
    const state = evaluateScene(frame, 30);
    const time = frame / 30;
    assert.ok(Number.isFinite(state.sourceOpacity));
    if (time <= 5) assert.equal(state.sourceOpacity, 0, `early attribution at ${time}s`);
    if (state.sourceOpacity > 0 && state.subject.opacity > 0) {
      const labelLeft = state.subject.x - 240;
      const labelRight = state.subject.x + 240;
      assert.ok(labelRight <= 720 || labelLeft >= 1810, `label/source collision at ${time}s`);
    }
    if (CHARTS.some(chart => time >= chart.revealStartSeconds && time < chart.endSeconds)) {
      assert.equal(state.sourceOpacity, 1, `missing source during chart reading at ${time}s`);
    }
    if (time >= 22.4) assert.equal(state.sourceOpacity, state.contentOpacity, 'source must preserve the global exit fade');
  }
});

test('chart windows are mutually exclusive, cue-aligned and clean on both sides of boundaries', () => {
  const cases = [[149, null], [150, 'bar'], [299, 'bar'], [300, null], [308, null],
    [309, 'line'], [470, 'line'], [471, null], [479, null], [480, 'donut'], [650, 'donut'], [651, null]];
  for (const [frame, kind] of cases) assert.equal(evaluateScene(frame, 30).chart?.kind ?? null, kind);
  for (const chart of CHARTS) {
    const revealFrame = chart.revealEndSeconds * 30;
    assert.ok(evaluateScene(revealFrame, 30).chartOpacity > 0.99);
    assert.ok(chart.endSeconds - chart.revealEndSeconds >= 2.5, 'readable hold after marks are complete');
  }
});

test('motion is deterministic, fps independent and continuous at the docking boundary', () => {
  const a = evaluateScene(132, 30);
  const b = evaluateScene(264, 60);
  assert.deepEqual(a, b);
  assert.deepEqual(a, evaluateScene(132, 30));
  for (const time of [0.8, 2.8, 4.4, 22.4, 23.6]) {
    const before = evaluateScene((time - 0.00001) * 30, 30).subject;
    const after = evaluateScene((time + 0.00001) * 30, 30).subject;
    for (const key of ['x', 'y', 'width', 'opacity']) assert.ok(Math.abs(before[key] - after[key]) < 0.002);
  }
});

test('the final frames contain only the background and zero/fractional timing is valid', () => {
  for (const frame of [708, 719, 719.5]) {
    const state = evaluateScene(frame, 30);
    assert.equal(state.subject.opacity, 0);
    assert.equal(state.contentOpacity, 0);
    assert.equal(state.sourceOpacity, 0);
    assert.equal(state.chart, null);
  }
  assert.throws(() => evaluateScene(NaN, 30));
  assert.throws(() => evaluateScene(0, 0));
});
