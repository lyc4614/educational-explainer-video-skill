// Pure SVG geometry. Callers provide timing, source labels and visible scales.
const finite = (n, name) => {
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new TypeError(`${name} must be finite`);
  return n;
};
const nonnegative = (n, name) => {
  finite(n, name);
  if (n < 0) throw new RangeError(`${name} must be nonnegative`);
  return n;
};
const progressValue = p => Math.max(0, Math.min(1, finite(p, 'progress')));
const validateBox = b => {
  if (!b || typeof b !== 'object') throw new TypeError('box is required');
  for (const key of ['x', 'y', 'width', 'height']) finite(b[key], `box.${key}`);
  if (b.width <= 0 || b.height <= 0) throw new RangeError('box dimensions must be positive');
};
const validateArray = values => {
  if (!Array.isArray(values)) throw new TypeError('values must be an array');
  values.forEach(v => nonnegative(v, 'value'));
};
const fmt = n => String(Number(n.toFixed(10)));
const xy = p => `${fmt(p.x)} ${fmt(p.y)}`;
const pointAt = (cx, cy, radius, angle) => ({
  x: cx + radius * Math.cos(angle * Math.PI / 180),
  y: cy + radius * Math.sin(angle * Math.PI / 180),
});
const validateRadii = (cx, cy, outerR, innerR) => {
  finite(cx, 'cx'); finite(cy, 'cy');
  nonnegative(outerR, 'outerR'); nonnegative(innerR, 'innerR');
  if (outerR <= 0 || innerR >= outerR) throw new RangeError('require 0 <= innerR < outerR');
};

export function barGeometry(value, maximum, box, progress = 1, orientation = 'vertical') {
  nonnegative(value, 'value'); finite(maximum, 'maximum'); validateBox(box);
  if (maximum <= 0 || value > maximum) throw new RangeError('require 0 <= value <= maximum and maximum > 0');
  const ratio = value / maximum * progressValue(progress);
  const {x, y, width, height} = box;
  if (orientation === 'vertical') return {x, y: y + height * (1 - ratio), width, height: height * ratio};
  if (orientation === 'horizontal') return {x, y, width: width * ratio, height};
  throw new RangeError('orientation must be vertical or horizontal');
}

export function historicalLabel(value, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('options must be an object');
  if (Object.keys(options).some(k => !['approximate', 'unit'].includes(k))) throw new TypeError('only approximate and unit are supported');
  const {approximate = false, unit = ''} = options;
  if (typeof approximate !== 'boolean' || typeof unit !== 'string') throw new TypeError('invalid label options');
  if (typeof value !== 'number' && typeof value !== 'string') throw new TypeError('value must be numeric');
  if (typeof value === 'string' && !value.trim()) throw new TypeError('value must not be empty');
  nonnegative(Number(value), 'value');
  return `${approximate ? '约' : ''}${value}${unit}`;
}

export function linePoints(values, box, domain) {
  validateArray(values); validateBox(box);
  if (!domain) throw new TypeError('explicit domain is required');
  finite(domain.min, 'domain.min'); finite(domain.max, 'domain.max');
  const range = domain.max - domain.min;
  if (!(range > 0) || !Number.isFinite(range)) throw new RangeError('domain.max must exceed domain.min');
  return values.map((value, index) => {
    if (value < domain.min || value > domain.max) throw new RangeError('value is outside domain');
    return {x: box.x + (values.length > 1 ? index / (values.length - 1) * box.width : 0),
      y: box.y + (1 - (value - domain.min) / range) * box.height};
  });
}

export function tracePolyline(points, progress) {
  const p = progressValue(progress);
  if (!Array.isArray(points)) throw new TypeError('points must be an array');
  points.forEach(point => { finite(point?.x, 'point.x'); finite(point?.y, 'point.y'); });
  if (!points.length) return {d: '', head: null, segmentIndex: -1};
  let head = {...points[0]}, d = `M ${xy(head)}`, segmentIndex = 0;
  const lengths = points.slice(1).map((point, i) => Math.hypot(point.x - points[i].x, point.y - points[i].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  finite(total, 'path length');
  let remaining = total * p;
  for (let i = 0; i < lengths.length && remaining > 0; i++) {
    const length = lengths[i];
    if (!length) continue;
    const ratio = Math.min(1, remaining / length);
    head = {x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
      y: points[i].y + (points[i + 1].y - points[i].y) * ratio};
    d += ` L ${xy(head)}`;
    segmentIndex = i;
    remaining -= length;
  }
  return {d, head, segmentIndex};
}

export function annularSector(cx, cy, outerR, innerR, startAngle, endAngle) {
  validateRadii(cx, cy, outerR, innerR);
  finite(startAngle, 'startAngle'); finite(endAngle, 'endAngle');
  const span = endAngle - startAngle;
  if (span < 0 || span > 360) throw new RangeError('clockwise span must be between 0 and 360 degrees');
  if (span === 0) return '';
  const outerStart = pointAt(cx, cy, outerR, startAngle);
  const outerEnd = pointAt(cx, cy, outerR, endAngle);
  const arc = (radius, large, sweep, point) => ` A ${fmt(radius)} ${fmt(radius)} 0 ${large} ${sweep} ${xy(point)}`;
  let d = `M ${xy(outerStart)}`;
  if (span === 360) {
    d += arc(outerR, 0, 1, pointAt(cx, cy, outerR, startAngle + 180)) + arc(outerR, 0, 1, outerStart);
    if (innerR > 0) {
      const innerStart = pointAt(cx, cy, innerR, startAngle);
      d += ` L ${xy(innerStart)}` + arc(innerR, 0, 0, pointAt(cx, cy, innerR, startAngle + 180)) + arc(innerR, 0, 0, innerStart);
    }
  } else {
    d += arc(outerR, span > 180 ? 1 : 0, 1, outerEnd);
    if (innerR > 0) d += ` L ${xy(pointAt(cx, cy, innerR, endAngle))}` + arc(innerR, span > 180 ? 1 : 0, 0, pointAt(cx, cy, innerR, startAngle));
    else d += ` L ${fmt(cx)} ${fmt(cy)}`;
  }
  return `${d} Z`;
}

export function donutArcs(values, cx, cy, outerR, innerR, startAngle = -90, progress = 1) {
  validateArray(values); validateRadii(cx, cy, outerR, innerR); finite(startAngle, 'startAngle');
  const p = progressValue(progress), total = values.reduce((sum, value) => sum + value, 0);
  finite(total, 'total');
  let angle = startAngle, cumulative = 0;
  return values.map(value => {
    const share = total > 0 ? value / total : 0;
    cumulative += value;
    const endAngle = total > 0 ? startAngle + cumulative / total * 360 : angle;
    const revealedEndAngle = Math.max(angle, Math.min(endAngle, startAngle + 360 * p));
    const result = {value, share, startAngle: angle, endAngle, revealedEndAngle,
      d: annularSector(cx, cy, outerR, innerR, angle, revealedEndAngle), midAngle: (angle + endAngle) / 2};
    angle = endAngle;
    return result;
  });
}

/** Explicit whole; unreported remainder stays neutral and receives no label/count. */
export function shareArcs(values, whole, cx, cy, outerR, innerR, startAngle = -90, progress = 1) {
  validateArray(values); finite(whole, 'whole');
  const total=values.reduce((sum,value)=>sum+value,0);
  finite(total, 'total');
  if(whole<=0||total-whole>Number.EPSILON*Math.max(whole,total)*8)throw new RangeError('whole must be positive and cover the reported parts');
  const p=progressValue(progress), remainder=Math.max(0,whole-total);
  return donutArcs([...values,remainder],cx,cy,outerR,innerR,startAngle,p*Math.min(1,total/whole)).slice(0,values.length);
}
