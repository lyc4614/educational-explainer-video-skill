import { createHash } from 'node:crypto';
import { closeSync, openSync, readFileSync, readSync, realpathSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const USAGE = 'Usage: node scripts/validate-media.mjs <media> <contract.json> --ffprobe <path> --ffmpeg <path>';
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const NODE_SCRIPT_PATTERN = /\.(?:cjs|mjs)$/i;
const CONTRACT_KEYS = new Set([
  'codec',
  'width',
  'height',
  'fps',
  'frames',
  'audioStreams',
  'durationToleranceFrames',
  'audioCodec'
]);
const DEFAULT_PROBE_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BUFFER_BYTES = 8 * 1024 * 1024;
const MAX_DECODE_TIMEOUT_MS = 30 * 60_000;

const isPlainObject = (value) => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const ownValue = (value, key) => (
  isPlainObject(value) && Object.hasOwn(value, key) ? value[key] : undefined
);

const contractInteger = (contract, field, { allowZero = false } = {}) => {
  const value = ownValue(contract, field);
  if (
    !Number.isSafeInteger(value)
    || (allowZero ? value < 0 : value <= 0)
  ) {
    return `contract.${field} must be a ${allowZero ? 'nonnegative' : 'positive'} safe integer`;
  }
  return null;
};

export function validateMediaContract(contract) {
  if (!isPlainObject(contract)) {
    return ['contract must be a JSON object'];
  }

  const errors = [];
  for (const key of Reflect.ownKeys(contract)) {
    if (!CONTRACT_KEYS.has(key)) {
      errors.push(`contract.${String(key)} is not allowed`);
    }
  }
  const codec = ownValue(contract, 'codec');
  if (typeof codec !== 'string' || codec.trim() === '') {
    errors.push('contract.codec must be a nonempty string');
  }
  for (const field of ['width', 'height', 'fps', 'frames']) {
    const error = contractInteger(contract, field);
    if (error) errors.push(error);
  }
  for (const field of ['audioStreams', 'durationToleranceFrames']) {
    const error = contractInteger(contract, field, { allowZero: true });
    if (error) errors.push(error);
  }

  const audioStreams = ownValue(contract, 'audioStreams');
  const audioCodec = ownValue(contract, 'audioCodec');
  if (audioStreams > 0) {
    if (typeof audioCodec !== 'string' || audioCodec.trim() === '') {
      errors.push('contract.audioCodec must be a nonempty string when contract.audioStreams is positive');
    }
  } else if (Object.hasOwn(contract, 'audioCodec')) {
    errors.push('contract.audioCodec is forbidden when contract.audioStreams is zero');
  }

  return errors;
}

const parsePositiveIntegerString = (value) => {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const integer = BigInt(value);
  if (integer > MAX_SAFE_BIGINT) return null;
  return Number(integer);
};

const parsePositiveDurationFraction = (value) => {
  if (
    typeof value !== 'string'
    || value.length > 64
    || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)
  ) {
    return null;
  }
  const [integerPart, fractionalPart = ''] = value.split('.');
  const denominator = 10n ** BigInt(fractionalPart.length);
  const numerator = BigInt(`${integerPart}${fractionalPart}`);
  return numerator > 0n ? { numerator, denominator } : null;
};

const parseRationalRate = (value) => {
  if (typeof value !== 'string') return null;
  const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(value);
  if (!match) return null;
  const numerator = BigInt(match[1]);
  const denominator = BigInt(match[2]);
  if (numerator > MAX_SAFE_BIGINT || denominator > MAX_SAFE_BIGINT) return null;
  return { numerator, denominator };
};

const rateMatchesContract = (rate, fps) => (
  rate !== null && rate.numerator === BigInt(fps) * rate.denominator
);

export function validateMediaMetadata(metadata, contract) {
  const errors = validateMediaContract(contract);
  if (errors.length > 0) return errors;

  if (!isPlainObject(metadata)) {
    errors.push('metadata must be a plain object; metadata.streams must be an array');
    return errors;
  }
  const streamsValue = ownValue(metadata, 'streams');
  if (!Array.isArray(streamsValue)) {
    errors.push('metadata.streams must be an array');
    return errors;
  }
  const format = ownValue(metadata, 'format');
  if (!isPlainObject(format)) {
    errors.push('metadata.format must be a plain object');
  }

  const streams = streamsValue;
  streams.forEach((stream, index) => {
    if (!isPlainObject(stream)) {
      errors.push(`metadata.streams[${index}] must be a plain object`);
      return;
    }
    const codecType = ownValue(stream, 'codec_type');
    if (typeof codecType !== 'string' || codecType.trim() === '') {
      errors.push(`metadata.streams[${index}].codec_type must be a nonempty string`);
      return;
    }
    if (codecType !== 'video' && codecType !== 'audio') {
      errors.push(`unsupported codec_type ${codecType} at metadata.streams[${index}]`);
      return;
    }
    const codecName = ownValue(stream, 'codec_name');
    if (typeof codecName !== 'string' || codecName.trim() === '') {
      errors.push(`metadata.streams[${index}].codec_name must be a nonempty string`);
    }
  });
  const videos = streams.filter((stream) => ownValue(stream, 'codec_type') === 'video');
  const audios = streams.filter((stream) => ownValue(stream, 'codec_type') === 'audio');
  if (videos.length !== 1) {
    errors.push(`expected exactly one video stream; received ${videos.length}`);
  }
  const expectedAudioStreams = ownValue(contract, 'audioStreams');
  const expectedAudioCodec = ownValue(contract, 'audioCodec');
  if (audios.length !== expectedAudioStreams) {
    errors.push(`expected ${expectedAudioStreams} audio streams; received ${audios.length}`);
  }
  if (expectedAudioCodec && audios.some((audio) => ownValue(audio, 'codec_name') !== expectedAudioCodec)) {
    const observed = audios.map((audio) => String(ownValue(audio, 'codec_name'))).join(', ') || 'none';
    errors.push(`expected every audio stream codec ${expectedAudioCodec}; received ${observed}`);
  }

  if (videos.length === 1) {
    const video = videos[0];
    const videoCodec = ownValue(video, 'codec_name');
    const expectedCodec = ownValue(contract, 'codec');
    if (typeof videoCodec === 'string' && videoCodec !== expectedCodec) {
      errors.push(`expected codec ${expectedCodec}; received ${String(videoCodec)}`);
    }

    const videoWidth = ownValue(video, 'width');
    const videoHeight = ownValue(video, 'height');
    const widthIsInteger = Number.isSafeInteger(videoWidth) && videoWidth > 0;
    const heightIsInteger = Number.isSafeInteger(videoHeight) && videoHeight > 0;
    if (!widthIsInteger) errors.push('video.width must be a positive safe integer');
    if (!heightIsInteger) errors.push('video.height must be a positive safe integer');
    if (
      widthIsInteger
      && heightIsInteger
      && (videoWidth !== ownValue(contract, 'width') || videoHeight !== ownValue(contract, 'height'))
    ) {
      errors.push(`expected ${ownValue(contract, 'width')}x${ownValue(contract, 'height')}; received ${videoWidth}x${videoHeight}`);
    }

    // This contract is CFR-only: nominal and average rates must both be valid
    // rationals, equal one another, and exactly equal the declared integer fps.
    const nominalRateValue = ownValue(video, 'r_frame_rate');
    const averageRateValue = ownValue(video, 'avg_frame_rate');
    const expectedFps = ownValue(contract, 'fps');
    const nominalRate = parseRationalRate(nominalRateValue);
    const averageRate = parseRationalRate(averageRateValue);
    if (
      !rateMatchesContract(nominalRate, expectedFps)
      || !rateMatchesContract(averageRate, expectedFps)
      || nominalRate.numerator * averageRate.denominator !== averageRate.numerator * nominalRate.denominator
    ) {
      errors.push(
        `constant frame rate policy requires exact r_frame_rate and avg_frame_rate at ${expectedFps}fps; `
        + `received ${String(nominalRateValue)} and ${String(averageRateValue)}`
      );
    }

    const observedFrames = parsePositiveIntegerString(ownValue(video, 'nb_frames'));
    if (observedFrames === null) {
      errors.push('video.nb_frames must be a positive safe-integer decimal string; missing and N/A are not accepted');
    } else if (observedFrames !== ownValue(contract, 'frames')) {
      errors.push(`expected ${ownValue(contract, 'frames')} frames; received ${observedFrames}`);
    }
  }

  const durationValue = isPlainObject(format) ? ownValue(format, 'duration') : undefined;
  const duration = isPlainObject(format)
    ? parsePositiveDurationFraction(durationValue)
    : null;
  if (duration === null) {
    errors.push('format.duration must be a positive ordinary decimal string');
  } else {
    const expectedFps = ownValue(contract, 'fps');
    const expectedFrames = ownValue(contract, 'frames');
    const toleranceFrames = ownValue(contract, 'durationToleranceFrames');
    const observedScaledFrames = duration.numerator * BigInt(expectedFps);
    const expectedScaledFrames = BigInt(expectedFrames) * duration.denominator;
    const difference = observedScaledFrames >= expectedScaledFrames
      ? observedScaledFrames - expectedScaledFrames
      : expectedScaledFrames - observedScaledFrames;
    const tolerance = BigInt(toleranceFrames) * duration.denominator;
    if (difference > tolerance) {
      errors.push(
        `expected duration equivalent to ${expectedFrames} frames at ${expectedFps}fps `
        + `within ±${toleranceFrames} frame(s); received ${durationValue}`
      );
    }
  }

  return errors;
}

export function processOutputOrThrow(result, label, { timeoutMs, maxBufferBytes } = {}) {
  if (result?.error) {
    if (result.error.code === 'ETIMEDOUT') {
      throw new Error(`${label} timed out after ${timeoutMs}ms`);
    }
    if (result.error.code === 'ENOBUFS') {
      throw new Error(`${label} exceeded the ${maxBufferBytes}-byte output buffer`);
    }
    throw new Error(`${label} spawn failed: ${result.error.message}`);
  }
  if (result?.signal) {
    throw new Error(`${label} terminated by signal ${result.signal}`);
  }
  if (result?.status !== 0) {
    const status = Number.isInteger(result?.status) ? result.status : 'unknown';
    const diagnostic = typeof result?.stderr === 'string' && result.stderr.trim() !== ''
      ? `: ${result.stderr.trim()}`
      : '';
    throw new Error(`${label} failed with exit ${status}${diagnostic}`);
  }
  return typeof result.stdout === 'string' ? result.stdout : '';
}

const runBinary = (
  binaryPath,
  argumentsList,
  label,
  { timeoutMs, maxBufferBytes = DEFAULT_MAX_BUFFER_BYTES } = {}
) => {
  const isNodeScript = NODE_SCRIPT_PATTERN.test(binaryPath);
  const command = isNodeScript ? process.execPath : binaryPath;
  const commandArguments = isNodeScript ? [binaryPath, ...argumentsList] : argumentsList;
  const result = spawnSync(command, commandArguments, {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    timeout: timeoutMs,
    maxBuffer: maxBufferBytes
  });
  return processOutputOrThrow(result, label, { timeoutMs, maxBufferBytes });
};

export function probeMedia(target, ffprobePath, options = {}) {
  const stdout = runBinary(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,nb_frames',
    '-of', 'json',
    target
  ], 'ffprobe', {
    timeoutMs: options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS,
    maxBufferBytes: options.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES
  });

  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`ffprobe returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function decodeMedia(target, ffmpegPath, options = {}) {
  runBinary(ffmpegPath, [
    '-v', 'error',
    '-xerror',
    '-err_detect', 'explode',
    '-i', target,
    '-map', '0:v:0',
    '-map', '0:a?',
    '-c:v', 'rawvideo',
    '-c:a', 'pcm_s16le',
    '-f', 'null',
    process.platform === 'win32' ? 'NUL' : '/dev/null'
  ], 'ffmpeg decode', {
    timeoutMs: options.timeoutMs ?? MAX_DECODE_TIMEOUT_MS,
    maxBufferBytes: options.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES
  });
}

export function computeDecodeTimeoutMs(contract) {
  const expectedDurationMs = (contract.frames / contract.fps) * 1000;
  return Math.ceil(Math.min(
    MAX_DECODE_TIMEOUT_MS,
    Math.max(5_000, expectedDurationMs * 4 + 5_000)
  ));
}

const sha256File = (target) => {
  const hash = createHash('sha256');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const descriptor = openSync(target, 'r');
  try {
    let bytesRead;
    do {
      bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    closeSync(descriptor);
  }
  return hash.digest('hex');
};

const mediaSnapshot = (target) => {
  const stats = statSync(target, { bigint: true });
  if (!stats.isFile()) throw new Error(`media must remain a regular file: ${target}`);
  return {
    dev: stats.dev,
    ino: stats.ino,
    size: stats.size,
    mtimeNs: stats.mtimeNs,
    ctimeNs: stats.ctimeNs,
    sha256: sha256File(target)
  };
};

const snapshotsEqual = (left, right) => (
  left.dev === right.dev
  && left.ino === right.ino
  && left.size === right.size
  && left.mtimeNs === right.mtimeNs
  && left.ctimeNs === right.ctimeNs
  && left.sha256 === right.sha256
);

const assertMediaUnchanged = (target, expected, phase) => {
  let current;
  try {
    current = mediaSnapshot(target);
  } catch {
    throw new Error(`media changed after ${phase}: ${target}`);
  }
  if (!snapshotsEqual(expected, current)) {
    throw new Error(`media changed after ${phase}: ${target}`);
  }
};

export function validateMediaFile(target, contract, ffprobePath, ffmpegPath, options = {}) {
  const contractErrors = validateMediaContract(contract);
  if (contractErrors.length > 0) throw new Error(contractErrors.join('\n'));

  let canonicalTarget;
  try {
    canonicalTarget = realpathSync.native(resolve(target));
  } catch {
    throw new Error(`media must resolve to an existing regular file: ${resolve(target)}`);
  }
  const before = mediaSnapshot(canonicalTarget);
  const metadata = probeMedia(canonicalTarget, ffprobePath, {
    timeoutMs: options.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS,
    maxBufferBytes: options.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES
  });
  assertMediaUnchanged(canonicalTarget, before, 'ffprobe');
  const metadataErrors = validateMediaMetadata(metadata, contract);
  if (metadataErrors.length > 0) throw new Error(metadataErrors.join('\n'));
  decodeMedia(canonicalTarget, ffmpegPath, {
    timeoutMs: options.decodeTimeoutMs ?? computeDecodeTimeoutMs(contract),
    maxBufferBytes: options.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES
  });
  assertMediaUnchanged(canonicalTarget, before, 'ffmpeg decode');
  return {
    status: 'pass',
    target: canonicalTarget,
    contract,
    fullDecode: true,
    validatedSha256: before.sha256
  };
}

const parseCliArguments = (argumentsList) => {
  if (argumentsList.length < 2) throw new Error(USAGE);
  const [mediaPath, contractPath, ...options] = argumentsList;
  const values = new Map();

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    if (option !== '--ffprobe' && option !== '--ffmpeg') {
      if (option.startsWith('--')) throw new Error(`unknown option: ${option}`);
      throw new Error(`unexpected argument: ${option}`);
    }
    if (values.has(option)) throw new Error(`duplicate option: ${option}`);
    const value = options[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`missing value for ${option}`);
    }
    values.set(option, value);
    index += 1;
  }

  for (const option of ['--ffprobe', '--ffmpeg']) {
    if (!values.has(option)) throw new Error(`required option missing: ${option}`);
  }

  return {
    mediaPath,
    contractPath,
    ffprobePath: values.get('--ffprobe'),
    ffmpegPath: values.get('--ffmpeg')
  };
};

const requireRegularFile = (inputPath, label) => {
  const absolutePath = resolve(inputPath);
  let canonicalPath;
  let stats;
  try {
    canonicalPath = realpathSync.native(absolutePath);
    stats = statSync(canonicalPath);
  } catch {
    throw new Error(`${label} must resolve to an existing regular file: ${absolutePath}`);
  }
  if (!stats.isFile()) {
    throw new Error(`${label} must resolve to an existing regular file: ${absolutePath}`);
  }
  return canonicalPath;
};

const readContract = (contractFilePath) => {
  const source = readFileSync(contractFilePath, 'utf8').replace(/^\uFEFF/, '');
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`contract JSON is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    const parsed = parseCliArguments(process.argv.slice(2));
    const mediaPath = requireRegularFile(parsed.mediaPath, 'media');
    const contractFilePath = requireRegularFile(parsed.contractPath, 'contract');
    const ffprobePath = requireRegularFile(parsed.ffprobePath, 'ffprobe');
    const ffmpegPath = requireRegularFile(parsed.ffmpegPath, 'ffmpeg');
    const contract = readContract(contractFilePath);
    const contractErrors = validateMediaContract(contract);
    if (contractErrors.length > 0) throw new Error(contractErrors.join('\n'));

    const report = validateMediaFile(mediaPath, contract, ffprobePath, ffmpegPath);
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
