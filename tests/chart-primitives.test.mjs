import test from 'node:test';
import assert from 'node:assert/strict';
import {barGeometry, historicalLabel, linePoints, tracePolyline, annularSector, donutArcs} from '../assets/chart-primitives/geometry.mjs';

const box = Object.freeze({x: 10, y: 20, width: 100, height: 80});
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('vertical bars grow proportionally from a fixed zero baseline', () => {
  assert.deepEqual(barGeometry(25, 100, box), {x: 10, y: 80, width: 100, height: 20});
  assert.deepEqual(barGeometry(25, 100, box, .5), {x: 10, y: 90, width: 100, height: 10});
  assert.deepEqual(barGeometry(0, 100, box), {x: 10, y: 100, width: 100, height: 0});
});

test('horizontal bars use the left baseline and clamp finite progress', () => {
  assert.deepEqual(barGeometry(25, 100, box, 2, 'horizontal'), {x: 10, y: 20, width: 25, height: 80});
  assert.equal(barGeometry(25, 100, box, -1, 'horizontal').width, 0);
  near(barGeometry(25, 100, box, 1 / 3, 'horizontal').width, 25 / 3);
});

test('bars reject invalid magnitudes, bounds, orientation and progress', () => {
  for (const value of [-1, 101, NaN, Infinity]) assert.throws(() => barGeometry(value, 100, box));
  for (const maximum of [0, -1, NaN, Infinity]) assert.throws(() => barGeometry(1, maximum, box));
  for (const progress of [NaN, Infinity]) assert.throws(() => barGeometry(1, 100, box, progress));
  assert.throws(() => barGeometry(1, 100, {...box, height: -1}));
  assert.throws(() => barGeometry(1, 100, {...box, x: NaN}));
  assert.throws(() => barGeometry(1, 100, box, 1, 'diagonal'));
});

test('historical labels preserve exact source strings and qualifiers', () => {
  assert.equal(historicalLabel('30.20', {approximate: true, unit: '%'}), '约30.20%');
  assert.equal(historicalLabel(25, {unit: '人以上'}), '25人以上');
  assert.equal(historicalLabel('0'), '0');
});

test('historical labels reject animation inputs and nonfinite values', () => {
  for (const value of [NaN, Infinity, -1, '', 'NaN']) assert.throws(() => historicalLabel(value));
  assert.throws(() => historicalLabel(25, {progress: .5}));
  assert.throws(() => historicalLabel(25, {approximate: 'yes'}));
});

test('line points use explicit domains and evenly spaced x positions', () => {
  const values = Object.freeze([20, 60, 100]);
  assert.deepEqual(linePoints(values, box, {min: 0, max: 100}), [{x: 10, y: 84}, {x: 60, y: 52}, {x: 110, y: 20}]);
  assert.deepEqual(linePoints([60], box, {min: 0, max: 100}), [{x: 10, y: 52}]);
  assert.deepEqual(linePoints([], box, {min: 0, max: 100}), []);
  assert.deepEqual(values, [20, 60, 100]);
});

test('line domains are required and reject invalid or out-of-domain values', () => {
  assert.throws(() => linePoints([20], box));
  for (const domain of [{min: 1, max: 1}, {min: 2, max: 1}, {min: 0, max: Infinity}]) assert.throws(() => linePoints([20], box, domain));
  for (const values of [[NaN], [Infinity], [-1], [101]]) assert.throws(() => linePoints(values, box, {min: 0, max: 100}));
});

test('polyline trace progresses by actual path distance', () => {
  const result = tracePolyline([{x: 0, y: 0}, {x: 3, y: 0}, {x: 3, y: 4}], .5);
  assert.deepEqual(result.head, {x: 3, y: .5});
  assert.equal(result.segmentIndex, 1);
  assert.equal(result.d, 'M 0 0 L 3 0 L 3 0.5');
});

test('polyline traces never expose future segments and clamp progress', () => {
  const points = [{x: 0, y: 0}, {x: 3, y: 0}, {x: 3, y: 4}];
  assert.equal(tracePolyline(points, -1).d, 'M 0 0');
  assert.equal(tracePolyline(points, .25).d, 'M 0 0 L 1.75 0');
  assert.equal(tracePolyline(points, 2).d, 'M 0 0 L 3 0 L 3 4');
});

test('empty, single and repeated polyline points are safe', () => {
  assert.deepEqual(tracePolyline([], .5), {d: '', head: null, segmentIndex: -1});
  assert.deepEqual(tracePolyline([{x: 2, y: 3}], .5), {d: 'M 2 3', head: {x: 2, y: 3}, segmentIndex: 0});
  assert.equal(tracePolyline([{x: 2, y: 3}, {x: 2, y: 3}], .5).d, 'M 2 3');
  assert.deepEqual(tracePolyline([{x: 0, y: 0}, {x: 0, y: 0}, {x: 4, y: 0}], .5).head, {x: 2, y: 0});
});

test('polyline tracing validates coordinates and progress', () => {
  assert.throws(() => tracePolyline([{x: NaN, y: 0}], .5));
  assert.throws(() => tracePolyline([{x: 0, y: Infinity}], .5));
  assert.throws(() => tracePolyline([], NaN));
});

test('annular sectors handle empty, partial and complete circles', () => {
  assert.equal(annularSector(0, 0, 10, 5, -90, -90), '');
  const half = annularSector(0, 0, 10, 5, -90, 90);
  assert.equal((half.match(/ A /g) || []).length, 2);
  assert.match(half, /A 10 10 0 0 1/);
  const full = annularSector(0, 0, 10, 5, -90, 270);
  assert.equal((full.match(/ A /g) || []).length, 4);
  assert.match(full, /A 5 5 0 0 0/);
});

test('pie sectors allow inner radius zero and use two arcs for a full disk', () => {
  const pie = annularSector(0, 0, 10, 0, 0, 90);
  assert.match(pie, /L 0 0 Z$/);
  const full = annularSector(0, 0, 10, 0, 0, 360);
  assert.equal((full.match(/ A /g) || []).length, 2);
  assert.ok(!full.includes('A 0 0'));
});

test('sector geometry rejects invalid radii and unsupported angle spans', () => {
  for (const args of [[0, 0, -1, 0, 0, 90], [0, 0, 10, -1, 0, 90], [0, 0, 10, 11, 0, 90], [0, 0, 10, 5, 90, 0], [0, 0, 10, 5, 0, 361], [NaN, 0, 10, 5, 0, 90]]) assert.throws(() => annularSector(...args));
});

test('donut reveals retain final shares and angles instead of renormalizing visible data', () => {
  const values = Object.freeze([1, 3]);
  const early = donutArcs(values, 0, 0, 10, 5, -90, .125);
  assert.equal(early[0].share, .25);
  assert.equal(early[0].startAngle, -90);
  assert.equal(early[0].endAngle, 0);
  assert.equal(early[0].revealedEndAngle, -45);
  assert.equal(early[1].d, '');
  const middle = donutArcs(values, 0, 0, 10, 5, -90, .5);
  assert.equal(middle[1].startAngle, 0);
  assert.equal(middle[1].endAngle, 270);
  assert.equal(middle[1].revealedEndAngle, 90);
  assert.equal(middle[1].midAngle, 135);
  assert.deepEqual(values, [1, 3]);
});

test('donut zero values and empty totals remain safe', () => {
  assert.deepEqual(donutArcs([], 0, 0, 10, 5), []);
  assert.ok(donutArcs([0, 0], 0, 0, 10, 5).every(a => a.share === 0 && a.d === '' && a.endAngle === -90));
  const arcs = donutArcs([0, 1], 0, 0, 10, 0);
  assert.equal(arcs[0].d, '');
  assert.equal(arcs[1].share, 1);
  assert.equal((arcs[1].d.match(/ A /g) || []).length, 2);
  assert.equal(donutArcs([1], 0, 0, 10, 5, -90, 0)[0].d, '');
  assert.equal(donutArcs([...Array(7).fill(1), 0], 0, 0, 10, 5).at(-1).d, '');
});

test('donuts validate magnitudes, finite progress, radii and preserve fractional progress', () => {
  for (const values of [[-1], [NaN], [Infinity], [Number.MAX_VALUE, Number.MAX_VALUE]]) assert.throws(() => donutArcs(values, 0, 0, 10, 5));
  assert.throws(() => donutArcs([], 0, 0, 1, 2));
  assert.throws(() => donutArcs([1], 0, 0, 10, 5, -90, NaN));
  near(donutArcs([1], 0, 0, 10, 5, -90, 1 / 7)[0].revealedEndAngle, -90 + 360 / 7);
});
import {shareArcs} from '../assets/chart-primitives/geometry.mjs';

test('a single reported percentage occupies its stated share of an explicit whole',()=>{
  const [arc]=shareArcs([32.5],100,200,200,100,60,-90,1);
  assert.equal(arc.share,.325);
  assert.equal(arc.startAngle,-90);
  assert.equal(arc.endAngle,27);
  assert.equal(arc.revealedEndAngle,27);
  assert.ok(arc.d);
});

test('a partial-whole reveal reaches the stated endpoint without renormalizing to100 percent',()=>{
  const [arc]=shareArcs([32.5],100,200,200,100,60,-90,.5);
  assert.equal(arc.endAngle,27);
  assert.ok(Math.abs(arc.revealedEndAngle-(-90+58.5))<1e-8);
  assert.equal(shareArcs([0],100,200,200,100,60)[0].d,'');
});

test('part-whole data requires a finite explicit whole covering the parts',()=>{
  for(const whole of [undefined,0,-1,NaN,Infinity])assert.throws(()=>shareArcs([20],whole,0,0,10,5));
  assert.throws(()=>shareArcs([60,50],100,0,0,10,5));
  assert.equal(shareArcs([20,30],100,0,0,10,5).length,2);
});

test('part-whole coverage is scale-relative and permits only floating point roundoff',()=>{
  for(const whole of [1e-11,1,1e11])assert.throws(()=>shareArcs([2*whole],whole,0,0,10,5));
  assert.equal(shareArcs([0.1,0.2],0.3,0,0,10,5).length,2);
});
