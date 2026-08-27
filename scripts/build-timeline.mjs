import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TIMING_PATTERN = /^(\d{2}):([0-5]\d):([0-5]\d),(\d{3}) --> (\d{2}):([0-5]\d):([0-5]\d),(\d{3})$/;
const FRAME_DIVISOR = 1000n;
const MAX_SAFE_FRAME = BigInt(Number.MAX_SAFE_INTEGER);

const toMilliseconds = (hours, minutes, seconds, milliseconds) => (
  (((Number(hours) * 60) + Number(minutes)) * 60 + Number(seconds)) * 1000
  + Number(milliseconds)
);

const cueError = (cueNumber, message) => new Error(`cue ${cueNumber}: ${message}`);

const normalizedPathForComparison = (path) => (
  process.platform === 'win32' ? path.toLowerCase() : path
);

export function isSameFile(inputPath, outputPath) {
  const resolvedInputPath = resolve(inputPath);
  const resolvedOutputPath = resolve(outputPath);
  if (normalizedPathForComparison(resolvedInputPath) === normalizedPathForComparison(resolvedOutputPath)) {
    return true;
  }
  if (!existsSync(resolvedInputPath) || !existsSync(resolvedOutputPath)) {
    return false;
  }

  const canonicalInputPath = realpathSync.native(resolvedInputPath);
  const canonicalOutputPath = realpathSync.native(resolvedOutputPath);
  if (normalizedPathForComparison(canonicalInputPath) === normalizedPathForComparison(canonicalOutputPath)) {
    return true;
  }

  const inputStat = statSync(resolvedInputPath);
  const outputStat = statSync(resolvedOutputPath);
  return inputStat.dev === outputStat.dev && inputStat.ino === outputStat.ino;
}

const toSafeFrame = (milliseconds, fps, roundUp, cueId) => {
  const numerator = BigInt(milliseconds) * BigInt(fps);
  const frame = roundUp
    ? (numerator + (FRAME_DIVISOR - 1n)) / FRAME_DIVISOR
    : numerator / FRAME_DIVISOR;

  if (frame > MAX_SAFE_FRAME) {
    throw cueError(cueId, `cannot be represented at ${fps}fps`);
  }
  return Number(frame);
};

export function parseSrt(source) {
  if (typeof source !== 'string') {
    throw new Error('SRT input must be a string');
  }

  const normalizedSource = source
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/^[\t ]+$/gm, '');
  if (normalizedSource.trim() === '') {
    throw new Error('SRT input is empty');
  }

  const blocks = normalizedSource.trim().split(/\n{2,}/);
  const captions = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const cueNumber = index + 1;
    const lines = blocks[index].split('\n');
    const idLine = lines[0].trim();
    const id = Number(idLine);

    if (!/^\d+$/.test(idLine) || !Number.isSafeInteger(id) || id !== cueNumber) {
      throw cueError(cueNumber, `id must be ${cueNumber}, received ${idLine || 'empty'}`);
    }

    const timing = lines[1]?.trim().match(TIMING_PATTERN);
    if (!timing) {
      throw cueError(cueNumber, 'timing must use HH:MM:SS,mmm --> HH:MM:SS,mmm');
    }

    const startMs = toMilliseconds(...timing.slice(1, 5));
    const endMs = toMilliseconds(...timing.slice(5, 9));
    if (endMs <= startMs) {
      throw cueError(cueNumber, 'end time must be after start time');
    }

    const text = lines.slice(2).map((line) => line.trim()).join('\n').trim();
    if (text === '') {
      throw cueError(cueNumber, 'text must not be empty');
    }

    const previousCaption = captions.at(-1);
    if (previousCaption && startMs < previousCaption.endMs) {
      throw cueError(cueNumber, `overlaps cue ${previousCaption.id}`);
    }

    captions.push({ id, text, startMs, endMs });
  }

  return captions;
}

export function buildTimeline(source, fps = 30) {
  if (!Number.isSafeInteger(fps) || fps <= 0) {
    throw new Error('fps must be a positive integer');
  }

  const captions = [];
  for (const caption of parseSrt(source)) {
    const rawFrom = toSafeFrame(caption.startMs, fps, false, caption.id);
    const to = toSafeFrame(caption.endMs, fps, true, caption.id);
    const from = Math.max(rawFrom, captions.at(-1)?.to ?? rawFrom);

    if (
      !Number.isSafeInteger(from)
      || !Number.isSafeInteger(to)
      || to <= from
    ) {
      throw cueError(caption.id, `cannot be represented at ${fps}fps`);
    }

    captions.push({ ...caption, from, to });
  }

  const durationInFrames = captions.at(-1)?.to ?? 0;
  if (!Number.isSafeInteger(durationInFrames)) {
    throw new Error(`timeline cannot be represented at ${fps}fps`);
  }

  return {
    fps,
    durationInFrames,
    captions
  };
}

const usage = () => 'Usage: node scripts/build-timeline.mjs <input.srt> <output.json> [--fps 30]';

const parseCliArguments = (argumentsList) => {
  if (argumentsList.length < 2) {
    throw new Error(usage());
  }

  const [inputPath, outputPath, ...options] = argumentsList;
  if (options.length === 0) {
    return { inputPath, outputPath, fps: 30 };
  }
  if (options[0] !== '--fps') {
    throw new Error(`unknown option: ${options[0]}`);
  }
  if (options.length === 1) {
    throw new Error('fps requires a value');
  }
  if (options.length > 2) {
    throw new Error(`unexpected argument: ${options[2]}`);
  }
  if (!/^[1-9]\d*$/.test(options[1])) {
    throw new Error('fps must be a positive integer');
  }

  const fps = Number(options[1]);
  if (!Number.isSafeInteger(fps)) {
    throw new Error('fps must be a positive integer');
  }
  return { inputPath, outputPath, fps };
};

const runCli = (argumentsList) => {
  const { inputPath, outputPath, fps } = parseCliArguments(argumentsList);
  const absoluteInputPath = resolve(inputPath);
  const absoluteOutputPath = resolve(outputPath);
  if (isSameFile(absoluteInputPath, absoluteOutputPath)) {
    throw new Error('input and output paths must differ');
  }
  const timeline = buildTimeline(readFileSync(absoluteInputPath, 'utf8'), fps);

  mkdirSync(dirname(absoluteOutputPath), { recursive: true });
  writeFileSync(absoluteOutputPath, `${JSON.stringify(timeline, null, 2)}\n`, 'utf8');
  console.log(`PASS timeline ${absoluteOutputPath}`);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    console.error(error.message === usage() ? error.message : `ERROR ${error.message}`);
    process.exitCode = 1;
  }
}
