import {progress, travelPose} from './primitives/motion.mjs';

export const DURATION_SECONDS = 24;
export const ASSET = {
  id: 'student-focus-01',
  file: 'assets/student-focus-01.png',
  width: 1254,
  height: 1254,
  bounds: {x: 213, y: 11, width: 813, height: 1220},
};

// These numbers are deliberately invented examples. They are not school facts,
// outcomes or personal records, and the three charts are independent examples.
export const CHARTS = [
  {
    kind: 'bar',
    relation: 'comparable-categories',
    synthetic: true,
    title: '类别比较 · 同口径的三个虚构任务',
    values: [48, 64, 40],
    labels: ['任务A', '任务B', '任务C'],
    valueLabels: ['48分钟', '64分钟', '40分钟'],
    unit: '分钟',
    maximum: 80,
    sourceNote: '合成演示 · 同一周 / 同一计时规则 / 单位：分钟',
    startSeconds: 5,
    revealStartSeconds: 5.4,
    revealEndSeconds: 7.2,
    endSeconds: 10,
  },
  {
    kind: 'line',
    relation: 'equally-spaced-time-series',
    synthetic: true,
    title: '时间趋势 · 同一虚构任务的每周记录',
    values: [30, 45, 40, 60],
    labels: ['第1周', '第2周', '第3周', '第4周'],
    valueLabels: ['30分钟', '45分钟', '40分钟', '60分钟'],
    unit: '分钟',
    maximum: 80,
    sourceNote: '合成演示 · 等间隔周观测 / 同一任务 / 单位：分钟',
    startSeconds: 10.3,
    revealStartSeconds: 10.7,
    revealEndSeconds: 12.9,
    endSeconds: 15.7,
  },
  {
    kind: 'donut',
    relation: 'single-share-of-defined-whole',
    synthetic: true,
    title: '单项占比 · 一个虚构清单的完成比例',
    values: [65],
    labels: ['完成占比'],
    valueLabels: ['65%'],
    unit: '%',
    whole: 100,
    centerLabel: '65%',
    sourceNote: '合成演示 · 单一清单 / 整体为100% / 不推算人数',
    startSeconds: 16,
    revealStartSeconds: 16.4,
    revealEndSeconds: 18.8,
    endSeconds: 21.7,
  },
];

const established = {x: 960, y: 550, width: 430, rotation: 0};
const docked = {x: 350, y: 558, width: 375, rotation: 0};
const exited = {x: 300, y: 568, width: 360, rotation: 0};

/** Pure, random-access state. All motion uses seconds derived from caller fps. */
export function evaluateScene(frame, fps) {
  if (!Number.isFinite(frame) || !Number.isFinite(fps) || fps <= 0) throw new Error('finite frame and positive fps required');
  const time = frame / fps;
  const opacity = progress(time, 0, 0.8) * (1 - progress(time, 22.4, 23.6));
  const travel = travelPose(time, {start: 2.8, end: 4.4, from: established, to: docked, lift: 18});
  const exit = travelPose(time, {start: 22.4, end: 23.6, from: docked, to: exited, lift: 0});
  const subject = {...(time < 22.4 ? travel : exit), opacity};
  const chart = CHARTS.find(item => time >= item.startSeconds && time < item.endSeconds) ?? null;
  const chartOpacity = chart
    ? progress(time, chart.startSeconds, chart.startSeconds + 0.2) * (1 - progress(time, chart.endSeconds - 0.25, chart.endSeconds))
    : 0;
  const contentOpacity = progress(time, 0.1, 0.7) * (1 - progress(time, 22.4, 23.6));
  // The source shares the subject-label band: wait until the subject has docked
  // and the first data cue begins, while retaining the global content exit.
  const sourceOpacity = contentOpacity * progress(time, 5, 5.3);
  return {subject, chart, chartOpacity, contentOpacity, sourceOpacity};
}
