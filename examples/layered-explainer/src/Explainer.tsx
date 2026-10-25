import React from 'react';
import type {Caption} from '@remotion/captions';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {ChartLayer, type ChartLayerProps} from './primitives/ChartLayer';
import {VisibleAsset} from './primitives/VisibleAsset';
import {ASSET, CHARTS, evaluateScene} from './state.mjs';
import captions from './captions.json';

const color = {ink: '#F4F1E9', muted: '#B8C8D3', cyan: '#9ADBE2', gold: '#DABA81'};
const fontFamily = 'Noto Sans SC, Microsoft YaHei, PingFang SC, sans-serif';

const HeaderLayer: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {contentOpacity} = evaluateScene(frame, fps);
  return <div style={{position: 'absolute', left: 106, top: 75, right: 106, opacity: contentOpacity}}>
    <div style={{fontSize: 25, letterSpacing: 4, color: color.cyan, marginBottom: 15}}>分层讲解 / 可迁移示例</div>
    <div style={{fontSize: 58, lineHeight: 1.15, fontWeight: 700, color: color.ink}}>让主体让位，让关系清楚</div>
    <div style={{position: 'absolute', right: 0, top: 12, border: '1px solid #DABA8170', borderRadius: 10, padding: '13px 21px', color: color.gold, fontSize: 26}}>合成数据 · 无声演示</div>
  </div>;
};

const SubjectLayer: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const state = evaluateScene(frame, fps);
  return <VisibleAsset asset={ASSET} pose={state.subject} zIndex={10}/>;
};

const SubjectLabelLayer: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const state = evaluateScene(frame, fps);
  return <div style={{position: 'absolute', left: state.subject.x - 240, top: 879, width: 480, textAlign: 'center', opacity: state.subject.opacity, color: color.muted, fontSize: 24}}>
    student-focus-01 · 透明 PNG 主体
  </div>;
};

type DemoChart = (typeof CHARTS)[number];
const ChartWindow: React.FC<{chart: DemoChart}> = ({chart}) => {
  const localFrame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const frame = localFrame + chart.startSeconds * fps;
  const state = evaluateScene(frame, fps);
  return <div style={{position: 'absolute', inset: 0, opacity: state.chartOpacity, zIndex: 20}}>
    <ChartLayer
      kind={chart.kind as ChartLayerProps['kind']}
      values={chart.values} labels={chart.labels} valueLabels={chart.valueLabels}
      maximum={chart.maximum} whole={chart.whole} unit={chart.unit}
      centerLabel={chart.centerLabel}
      frame={frame} startFrame={chart.revealStartSeconds * fps} endFrame={chart.revealEndSeconds * fps}
      box={{x: 720, y: 243, width: 1090, height: 620}}
      title={chart.title} sourceNote={chart.sourceNote}
      accent={color.cyan} colors={[color.cyan, color.gold, '#7DA8C9']}
    />
  </div>;
};

/** Independent attribution layer; it is never baked into a PNG or caption. */
const SourceLayer: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {sourceOpacity} = evaluateScene(frame, fps);
  return <div style={{position: 'absolute', left: 720, top: 888, width: 1090, opacity: sourceOpacity, color: color.muted, fontSize: 23, lineHeight: 1.35, zIndex: 30}}>
    来源：本示例人工合成的教学数据；不对应真实学校、学生或成绩。
  </div>;
};

/** Independent SRT-derived caption layer with original cue timing. */
const CaptionLayer: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const timeMs = frame / fps * 1000;
  const caption = (captions as Caption[]).find(item => item.startMs <= timeMs && timeMs < item.endMs);
  if (!caption) return null;
  return <div style={{position: 'absolute', left: 150, top: 954, width: 1620, minHeight: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', borderTop: '1px solid #B8C8D333', paddingTop: 12, zIndex: 40}}>
    <div style={{fontSize: 43, lineHeight: 1.25, fontWeight: 600, color: color.ink, whiteSpace: 'pre-wrap', textAlign: 'center'}}>{caption.text}</div>
  </div>;
};

export const Explainer: React.FC = () => {
  const {fps} = useVideoConfig();
  return <AbsoluteFill style={{overflow: 'hidden', fontFamily, background: 'radial-gradient(ellipse at 36% 38%, #263747 0%, #17232E 45%, #0B0C10 100%)'}}>
    <Sequence name="独立标题层" premountFor={fps}><HeaderLayer/></Sequence>
    <Sequence name="透明主体与接触影" premountFor={fps}><SubjectLayer/></Sequence>
    <Sequence name="主体身份标签" premountFor={fps}><SubjectLabelLayer/></Sequence>
    <Sequence name="类别柱形：合成数据" from={5 * fps} durationInFrames={5 * fps} premountFor={fps}><ChartWindow chart={CHARTS[0]}/></Sequence>
    <Sequence name="等间隔趋势：合成数据" from={10.3 * fps} durationInFrames={5.4 * fps} premountFor={fps}><ChartWindow chart={CHARTS[1]}/></Sequence>
    <Sequence name="单项占比：合成数据" from={16 * fps} durationInFrames={5.7 * fps} premountFor={fps}><ChartWindow chart={CHARTS[2]}/></Sequence>
    <Sequence name="独立可见来源提示" premountFor={fps}><SourceLayer/></Sequence>
    <Sequence name="独立字幕层" premountFor={fps}><CaptionLayer/></Sequence>
  </AbsoluteFill>;
};
