import React from 'react';
import * as geometry from './geometry.mjs';

type Box = {x: number; y: number; width: number; height: number};
type Point = {x: number; y: number};
type Arc = {
  value: number; share: number; startAngle: number; endAngle: number;
  revealedEndAngle: number; d: string; midAngle: number;
};
type Geometry = {
  barGeometry: (value: number, maximum: number, box: Box, progress?: number, orientation?: 'vertical' | 'horizontal') => Box;
  historicalLabel: (value: number, options?: {approximate?: boolean; unit?: string}) => string;
  linePoints: (values: number[], box: Box, domain: {min: number; max: number}) => Point[];
  tracePolyline: (points: Point[], progress: number) => {d: string; head: Point | null; segmentIndex: number};
  shareArcs: (values: number[], whole: number, cx: number, cy: number, outerR: number, innerR: number, startAngle?: number, progress?: number) => Arc[];
};
const {barGeometry, historicalLabel, linePoints, tracePolyline, shareArcs} = geometry as Geometry;

export type ChartLayerProps = {
  /** Line mode assumes equally spaced observations; map nonuniform x coordinates separately. */
  kind: 'line' | 'bar' | 'donut';
  values: number[];
  labels: string[];
  /** Required for line/bar. Use the same maximum across comparable charts. */
  maximum?: number;
  /** Required for donut: 100 for a percentage scale, or a sourced total in the same unit. */
  whole?: number;
  frame: number;
  startFrame: number;
  /** Reveal completion, not layer removal. The parent controls layer exit. */
  endFrame: number;
  box: Box;
  sourceNote: string;
  title: string;
  unit?: string;
  approximate?: boolean[];
  accent?: string;
  colors?: string[];
  centerLabel?: string;
  /** Original display strings, including unit/precision/qualifiers. Caller verifies agreement with values. */
  valueLabels?: string[];
};

const clamp = (n: number): number => Math.max(0, Math.min(1, n));
const smoothstep = (n: number): number => {
  const p = clamp(n);
  return p * p * (3 - 2 * p);
};
const finite = (n: number): boolean => Number.isFinite(n);

// Approximate glyph widths are only for label wrapping, never for data geometry.
const wrap = (text: string, width: number, fontSize: number): string[] => {
  const output: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    let used = 0;
    for (const character of Array.from(paragraph)) {
      const advance = fontSize * (/\s/.test(character) ? 0.32 : /[\u0000-\u00ff]/.test(character) ? 0.57 : 1);
      if (line && used + advance > width) {
        output.push(line);
        line = '';
        used = 0;
      }
      line += character;
      used += advance;
    }
    output.push(line);
  }
  return output;
};

function validate(props: ChartLayerProps): void {
  const {kind, values, labels, frame, startFrame, endFrame, box, sourceNote, title, maximum, whole, approximate, valueLabels, colors} = props;
  if (!['line', 'bar', 'donut'].includes(kind)) throw new Error('Unknown chart kind.');
  if (!values.length || values.some((v: number) => !finite(v) || v < 0)) throw new Error('values must contain finite nonnegative numbers.');
  if (labels.length !== values.length || labels.some((label: string) => typeof label !== 'string' || !label.trim())) throw new Error('Provide one nonempty label per value.');
  if (![frame, startFrame, endFrame].every(finite) || endFrame <= startFrame) throw new Error('Use finite frame times with endFrame > startFrame.');
  if (![box.x, box.y, box.width, box.height].every(finite) || box.width <= 0 || box.height <= 0) throw new Error('box must have finite coordinates and positive dimensions.');
  if (typeof title !== 'string' || !title.trim() || typeof sourceNote !== 'string' || !sourceNote.trim()) throw new Error('A title and visible sourceNote are required.');
  if (kind !== 'donut' && (maximum === undefined || !finite(maximum) || maximum <= 0 || values.some((v: number) => v > maximum))) throw new Error('line/bar require a positive maximum covering every value.');
  if (kind === 'donut') {
    const total=values.reduce((sum: number,v: number)=>sum+v,0);
    if(whole===undefined||!finite(whole)||whole<=0||!finite(total)||total-whole>Number.EPSILON*Math.max(whole,total)*8)throw new Error('A donut requires an explicit positive whole covering its parts.');
    if((props.unit?.trim()==='%'||props.unit?.trim()==='％')&&Math.abs(whole-100)>1e-9)throw new Error('A percentage uses an explicit whole of100.');
  }
  if (approximate && (approximate.length !== values.length || approximate.some((v: boolean) => typeof v !== 'boolean'))) throw new Error('approximate must contain one boolean per value.');
  if (valueLabels && (valueLabels.length !== values.length || valueLabels.some((label: string) => typeof label !== 'string' || !label.trim()))) throw new Error('valueLabels must contain one nonempty original display string per value.');
  if (colors && (!colors.length || colors.some((color: string) => typeof color !== 'string' || !color.trim()))) throw new Error('colors must be a nonempty palette.');
}

/**
 * Frame-driven data-area overlay. There is no background, caption band, example
 * dataset, clock, or entrance/exit transition. Set box in the caller's canvas.
 * sourceNote remains visible throughout the reveal. Values are never counted up.
 */
export const ChartLayer: React.FC<ChartLayerProps> = (props) => {
  validate(props);
  const {kind, values, labels, frame, startFrame, endFrame, box, title, sourceNote, maximum, whole, unit = '', approximate, centerLabel, valueLabels} = props;
  const accent = props.accent ?? '#9ADBE2';
  const palette = props.colors ?? [accent, '#DABA81', '#7DA8C9', '#AAB6CD', '#B4CAC8'];
  const colorAt = (i: number): string => palette[i % palette.length];
  const displayAt = (i: number): string => valueLabels?.[i] ?? historicalLabel(values[i], {approximate: approximate?.[i] ?? false, unit});
  const progress = smoothstep((frame - startFrame) / (endFrame - startFrame));
  const w = box.width;
  const h = box.height;
  const u = Math.min(w / 800, h / 540);
  const pad = 24 * u;
  const titleSize = 32 * u;
  const labelSize = 26 * u;
  const tickSize = 22 * u;
  const sourceSize = 22 * u;
  const leading = (fontSize: number): number => fontSize * 1.35;
  const titleLines = wrap(title, w - 2 * pad, titleSize);
  const sourceLines = wrap(sourceNote, w - 2 * pad, sourceSize);
  const sourceY = h - pad - (sourceLines.length - 1) * leading(sourceSize);
  const top = pad + titleLines.length * leading(titleSize) + 48 * u;
  const bottom = sourceY - sourceSize - 26 * u;
  const labelWidth = Math.max(1, (w - 2 * pad - 48 * u) / values.length - 8 * u);
  const axisLabels = labels.map((label: string) => wrap(label, labelWidth, labelSize));
  const axisHeight = Math.max(...axisLabels.map((lines: string[]) => lines.length)) * leading(labelSize) + 16 * u;
  const plot: Box = {x: pad + (kind === 'donut' ? 0 : 48 * u), y: top, width: w - 2 * pad - (kind === 'donut' ? 0 : 48 * u), height: bottom - top - (kind === 'donut' ? 0 : axisHeight)};
  if (plot.height <= 24 * u || plot.width <= 0) throw new Error('The title, sourceNote and labels do not fit this box. Enlarge the box or recompose the layout.');
  if (frame < startFrame) return null;

  const multiline = (lines: string[], x: number, y: number, size: number, fill: string, anchor: 'start' | 'middle' | 'end' = 'start', weight = 500): React.ReactNode => (
    <text x={x} y={y} fontSize={size} fill={fill} textAnchor={anchor} fontWeight={weight}>
      {lines.map((line: string, i: number) => <tspan key={i} x={x} dy={i === 0 ? 0 : leading(size)}>{line}</tspan>)}
    </text>
  );
  const grid = (): React.ReactNode => [0, (maximum as number) / 2, maximum as number].map((value: number) => {
    const y = plot.y + plot.height * (1 - value / (maximum as number));
    return <g key={value}>
      <line x1={plot.x} x2={plot.x + plot.width} y1={y} y2={y} stroke="#B8D4DE" strokeOpacity={value === 0 ? 0.35 : 0.13} strokeWidth={u} />
      <text x={plot.x - 12 * u} y={y + tickSize * 0.35} textAnchor="end" fontSize={tickSize} fill="#AEBCC5">{String(value)}</text>
    </g>;
  });

  let content: React.ReactNode;
  if (kind === 'bar') {
    const slot = plot.width / values.length;
    const barWidth = slot * 0.54;
    content = <>
      {grid()}
      {values.map((value: number, i: number) => {
        const lag = values.length > 1 ? 0.35 * i / (values.length - 1) : 0;
        const local = smoothstep((progress - lag) / (1 - lag));
        const rect = barGeometry(value, maximum as number, {x: plot.x + slot * i + (slot - barWidth) / 2, y: plot.y, width: barWidth, height: plot.height}, local);
        const x = rect.x + rect.width / 2;
        return <g key={i}>
          <rect {...rect} rx={Math.min(6 * u, rect.height / 2)} fill={colorAt(i)} fillOpacity={0.88} />
          {local > 0.9 && <text x={x} y={Math.max(plot.y - 8 * u, rect.y - 12 * u)} textAnchor="middle" fill="#F4F1E9" fontSize={labelSize} fontWeight={700}>{displayAt(i)}</text>}
          {multiline(axisLabels[i], x, plot.y + plot.height + 27 * u, labelSize, '#D4DCE1', 'middle')}
        </g>;
      })}
    </>;
  } else if (kind === 'line') {
    const points = linePoints(values, plot, {min: 0, max: maximum as number});
    const traced = tracePolyline(points, progress);
    const distances: number[] = [0];
    for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    const total = distances[distances.length - 1];
    content = <>
      {grid()}
      {traced.d && <path d={traced.d} fill="none" stroke={accent} strokeWidth={4 * u} strokeLinecap="round" strokeLinejoin="round" />}
      {points.map((point: Point, i: number) => {
        const visible = progress > 0 && (total === 0 || distances[i] / total <= progress + 1e-9);
        const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
        return <g key={i}>
          {visible && <>
            <circle cx={point.x} cy={point.y} r={5 * u} fill="#F4F1E9" stroke={accent} strokeWidth={2 * u} />
            <text x={point.x} y={Math.max(plot.y - 8 * u, point.y - 15 * u)} textAnchor={anchor} fill="#F4F1E9" fontSize={labelSize} fontWeight={700}>{displayAt(i)}</text>
          </>}
          {multiline(axisLabels[i], point.x, plot.y + plot.height + 27 * u, labelSize, '#D4DCE1', anchor)}
        </g>;
      })}
      {progress > 0 && progress < 1 && traced.head && <circle cx={traced.head.x} cy={traced.head.y} r={7 * u} fill={accent} fillOpacity={0.7} />}
    </>;
  } else {
    const radius = Math.min(plot.height / 2 - 8 * u, plot.width * 0.255);
    const cx = plot.x + radius + 8 * u;
    const cy = plot.y + plot.height / 2;
    const inner = radius * 0.64;
    const arcs = shareArcs(values, whole as number, cx, cy, radius, inner, -90, progress);
    const legendX = cx + radius + 32 * u;
    const legendWidth = plot.x + plot.width - legendX;
    const legendFont = Math.min(labelSize, plot.height / Math.max(1, values.length * 2.8));
    const legendLines = labels.map((label: string) => wrap(label, legendWidth - 24 * u, legendFont));
    const rowHeights = legendLines.map((lines: string[]) => (lines.length + 1) * leading(legendFont) + 12 * u);
    const legendHeight = rowHeights.reduce((sum: number, height: number) => sum + height, 0);
    if (legendWidth <= 24 * u || legendHeight > plot.height) throw new Error('Donut legend does not fit. Enlarge the box or use a project-specific legend layout.');
    const centerLines = centerLabel ? wrap(centerLabel, inner * 1.6, labelSize) : [];
    let legendY = cy - legendHeight / 2 + legendFont;
    content = <>
      <circle cx={cx} cy={cy} r={(radius + inner) / 2} fill="none" stroke="#B8D4DE" strokeOpacity={0.09} strokeWidth={radius - inner} />
      {arcs.map((arc: Arc, i: number) => arc.d && <path key={i} d={arc.d} fill={colorAt(i)} fillOpacity={0.91} />)}
      {centerLabel && multiline(centerLines, cx, cy - (centerLines.length - 1) * leading(labelSize) / 2 + labelSize * 0.35, labelSize, '#F4F1E9', 'middle', 600)}
      {values.map((_value: number, i: number) => {
        const y = legendY;
        legendY += rowHeights[i];
        return <g key={i}>
          <rect x={legendX} y={y - legendFont * 0.7} width={10 * u} height={10 * u} rx={2 * u} fill={colorAt(i)} />
          {multiline(legendLines[i], legendX + 22 * u, y, legendFont, '#D4DCE1')}
          <text x={legendX + 22 * u} y={y + legendLines[i].length * leading(legendFont)} fill="#F4F1E9" fontSize={legendFont} fontWeight={700}>{displayAt(i)}</text>
        </g>;
      })}
    </>;
  }

  return <div style={{position: 'absolute', left: box.x, top: box.y, width: w, height: h, pointerEvents: 'none', overflow: 'hidden'}}>
    <svg xmlns="http://www.w3.org/2000/svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${title}。${sourceNote}`} style={{display: 'block', fontFamily: 'Noto Sans SC, Microsoft YaHei, PingFang SC, sans-serif'}}>
      {multiline(titleLines, pad, pad + titleSize, titleSize, '#F4F1E9', 'start', 750)}
      {content}
      {multiline(sourceLines, pad, sourceY, sourceSize, '#AEBCC5')}
    </svg>
  </div>;
};
