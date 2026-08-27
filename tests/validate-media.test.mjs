import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  renameSync,
  statSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  decodeMedia,
  probeMedia,
  processOutputOrThrow,
  validateMediaFile,
  validateMediaMetadata
} from '../scripts/validate-media.mjs';
import * as mediaValidator from '../scripts/validate-media.mjs';

const testsRoot = dirname(fileURLToPath(import.meta.url));
const skillRoot = dirname(testsRoot);
const projectRoot = resolve(skillRoot, '..', '..');
const scriptPath = join(skillRoot, 'scripts', 'validate-media.mjs');
const contractPath = join(testsRoot, 'fixtures', 'cognitive-full-media-contract.json');
const approvedContract = {
  codec: 'h264',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 4540,
  audioStreams: 0,
  durationToleranceFrames: 1
};
const approvedMetadata = {
  streams: [{
    codec_type: 'video',
    codec_name: 'h264',
    width: 1920,
    height: 1080,
    r_frame_rate: '30/1',
    avg_frame_rate: '30/1',
    nb_frames: '4540'
  }],
  format: { duration: String(4540 / 30) }
};
const cliTimeoutMs = 30_000;
const approvedMediaPath = join(
  projectRoot,
  'outputs',
  '听懂不等于会做完整成片_20260824',
  '听懂不等于会做_完整成片.mp4'
);
const diagnosticAudioSamplePath = join(
  projectRoot,
  'outputs',
  '听懂不等于会做信息动画样片_20260821',
  '听懂不等于会做_29秒样片.mp4'
);
const remotionFfprobePath = join(
  projectRoot,
  'ranking-video',
  'node_modules',
  '@remotion',
  'compositor-win32-x64-msvc',
  'ffprobe.exe'
);
const remotionFfmpegPath = join(
  projectRoot,
  'ranking-video',
  'node_modules',
  '@remotion',
  'compositor-win32-x64-msvc',
  'ffmpeg.exe'
);

const isRegularFile = (filePath) => {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
};

const clone = (value) => structuredClone(value);
const hashFile = (filePath) => createHash('sha256').update(readFileSync(filePath)).digest('hex');

const runCli = (argumentsList, env = {}) => {
  const result = spawnSync(process.execPath, [scriptPath, ...argumentsList], {
    encoding: 'utf8',
    timeout: cliTimeoutMs,
    env: { ...process.env, ...env }
  });
  assert.equal(result.error, undefined, result.error?.message);
  return result;
};

const jsString = (value) => JSON.stringify(value);

const createHarness = (t, options = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'media validator with spaces '));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const mediaPath = join(root, 'approved media with spaces.mp4');
  const localContractPath = join(root, 'media contract with spaces.json');
  const probePath = join(root, 'fake ffprobe with spaces.mjs');
  const decodePath = join(root, 'fake ffmpeg with spaces.mjs');
  const probeLogPath = join(root, 'probe args.json');
  const decodeLogPath = join(root, 'decode args.json');
  writeFileSync(mediaPath, 'test media bytes');
  writeFileSync(localContractPath, JSON.stringify(options.contract ?? approvedContract));

  const probeMetadata = options.metadata ?? approvedMetadata;
  const probeBody = options.probeBody ?? [
    `if (process.env.MEDIA_PROBE_LOG) writeFileSync(process.env.MEDIA_PROBE_LOG, JSON.stringify(process.argv.slice(2)));`,
    `process.stderr.write('captured probe diagnostic');`,
    `process.stdout.write(${jsString(JSON.stringify(probeMetadata))});`
  ].join('\n');
  const decodeBody = options.decodeBody ?? [
    `if (process.env.MEDIA_DECODE_LOG) writeFileSync(process.env.MEDIA_DECODE_LOG, JSON.stringify(process.argv.slice(2)));`,
    `process.stdout.write('captured decoder stdout');`,
    `process.stderr.write('captured decoder diagnostic');`
  ].join('\n');

  writeFileSync(probePath, `import { writeFileSync } from 'node:fs';\n${probeBody}\n`);
  writeFileSync(decodePath, `import { writeFileSync } from 'node:fs';\n${decodeBody}\n`);

  return {
    root,
    mediaPath,
    contractPath: localContractPath,
    probePath,
    decodePath,
    probeLogPath,
    decodeLogPath,
    env: {
      MEDIA_PROBE_LOG: probeLogPath,
      MEDIA_DECODE_LOG: decodeLogPath
    }
  };
};

const validArguments = (harness) => [
  harness.mediaPath,
  harness.contractPath,
  '--ffprobe',
  harness.probePath,
  '--ffmpeg',
  harness.decodePath
];

test('stores the exact immutable approved full-video contract', () => {
  assert.deepEqual(JSON.parse(readFileSync(contractPath, 'utf8')), approvedContract);
});

test('accepts the approved constant-frame-rate full-video metadata', () => {
  assert.deepEqual(validateMediaMetadata(approvedMetadata, approvedContract), []);
});

test('rejects wrong dimensions, audio count, frames, rate, codec, and duration', async (t) => {
  const cases = [
    ['width', (value) => { value.streams[0].width = 1080; }, /1920x1080/],
    ['height', (value) => { value.streams[0].height = 1920; }, /1920x1080/],
    ['audio count', (value) => { value.streams.push({ codec_type: 'audio', codec_name: 'aac' }); }, /audio streams/],
    ['frames', (value) => { value.streams[0].nb_frames = '4539'; }, /4540 frames/],
    ['nominal rate', (value) => { value.streams[0].r_frame_rate = '30000/1001'; }, /constant frame rate.*30fps/i],
    ['average rate', (value) => { value.streams[0].avg_frame_rate = '30000/1001'; }, /constant frame rate.*30fps/i],
    ['codec', (value) => { value.streams[0].codec_name = 'vp9'; }, /codec h264/],
    ['duration', (value) => { value.format.duration = '150'; }, /duration.*4540 frames/i]
  ];

  for (const [name, mutate, diagnostic] of cases) {
    await t.test(name, () => {
      const value = clone(approvedMetadata);
      mutate(value);
      assert.match(validateMediaMetadata(value, approvedContract).join('\n'), diagnostic);
    });
  }
});

test('rejects missing, non-finite, negative, non-integer, and malformed contract fields', async (t) => {
  const invalidValues = [undefined, null, '', '30', Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5];
  const numericFields = ['width', 'height', 'fps', 'frames', 'audioStreams', 'durationToleranceFrames'];

  for (const field of numericFields) {
    for (const invalidValue of invalidValues) {
      await t.test(`${field} rejects ${String(invalidValue)}`, () => {
        const contract = clone(approvedContract);
        if (invalidValue === undefined) delete contract[field];
        else contract[field] = invalidValue;
        assert.match(validateMediaMetadata(approvedMetadata, contract).join('\n'), new RegExp(`contract\\.${field}`));
      });
    }
  }

  for (const invalidCodec of [undefined, null, '', '   ', 123]) {
    await t.test(`codec rejects ${String(invalidCodec)}`, () => {
      const contract = clone(approvedContract);
      if (invalidCodec === undefined) delete contract.codec;
      else contract.codec = invalidCodec;
      assert.match(validateMediaMetadata(approvedMetadata, contract).join('\n'), /contract\.codec/);
    });
  }
});

test('contract rejects unknown own keys, prototype-looking JSON keys, and invalid audioCodec presence', async (t) => {
  const cases = [
    ['ordinary extra key', { ...approvedContract, unexpected: true }, /contract\.unexpected.*not allowed/i],
    ['own __proto__ key', JSON.parse(`${JSON.stringify(approvedContract).slice(0, -1)},"__proto__":"pollution"}`), /contract\.__proto__.*not allowed/i],
    ['audioCodec with zero streams', { ...approvedContract, audioCodec: 'aac' }, /contract\.audioCodec.*forbidden.*zero/i]
  ];

  for (const [name, contract, diagnostic] of cases) {
    await t.test(name, () => {
      assert.match(validateMediaMetadata(approvedMetadata, contract).join('\n'), diagnostic);
    });
  }
});

test('required contract and metadata fields cannot be inherited from a polluted Object prototype', () => {
  const pollutedValues = {
    codec: 'h264',
    codec_type: 'video',
    codec_name: 'h264',
    width: 1920,
    height: 1080,
    r_frame_rate: '30/1',
    avg_frame_rate: '30/1',
    nb_frames: '4540',
    duration: String(4540 / 30)
  };
  const previousDescriptors = new Map(
    Object.keys(pollutedValues).map((key) => [key, Object.getOwnPropertyDescriptor(Object.prototype, key)])
  );

  try {
    for (const [key, value] of Object.entries(pollutedValues)) {
      Object.defineProperty(Object.prototype, key, { configurable: true, writable: true, value });
    }

    const missingOwnCodec = clone(approvedContract);
    delete missingOwnCodec.codec;
    assert.match(validateMediaMetadata(approvedMetadata, missingOwnCodec).join('\n'), /contract\.codec/);

    const inheritedStream = { streams: [{}], format: {} };
    const inheritedDiagnostics = validateMediaMetadata(inheritedStream, approvedContract).join('\n');
    assert.match(inheritedDiagnostics, /metadata\.streams\[0\]\.codec_type/);
    assert.match(inheritedDiagnostics, /format\.duration/);

    const inheritedWidth = clone(approvedMetadata);
    delete inheritedWidth.streams[0].width;
    assert.match(validateMediaMetadata(inheritedWidth, approvedContract).join('\n'), /video\.width/);
  } finally {
    for (const [key, descriptor] of previousDescriptors) {
      if (descriptor) Object.defineProperty(Object.prototype, key, descriptor);
      else delete Object.prototype[key];
    }
  }
});

test('validates the declared codec for every required audio stream', () => {
  const contract = { ...approvedContract, audioStreams: 1, audioCodec: 'aac' };
  const valid = clone(approvedMetadata);
  valid.streams.push({ codec_type: 'audio', codec_name: 'aac' });
  assert.deepEqual(validateMediaMetadata(valid, contract), []);

  const wrong = clone(valid);
  wrong.streams[1].codec_name = 'opus';
  assert.match(validateMediaMetadata(wrong, contract).join('\n'), /audio stream codec aac.*opus/i);

  const missingCodecContract = { ...approvedContract, audioStreams: 1 };
  assert.match(validateMediaMetadata(valid, missingCodecContract).join('\n'), /contract\.audioCodec/);
});

test('rejects non-object stream entries instead of ignoring malformed probe output', () => {
  const metadata = clone(approvedMetadata);
  metadata.streams.push(null);
  assert.match(validateMediaMetadata(metadata, approvedContract).join('\n'), /metadata\.streams\[1\]/);
});

test('requires strict plain metadata and AV-only stream shapes', async (t) => {
  const metadataWith = (stream) => ({
    streams: [clone(approvedMetadata.streams[0]), stream],
    format: clone(approvedMetadata.format)
  });
  const cases = [
    ['metadata array', [], /metadata must be a plain object/i],
    ['format array', { streams: clone(approvedMetadata.streams), format: [] }, /metadata\.format must be a plain object/i],
    ['missing codec type', metadataWith({ codec_name: 'aac' }), /metadata\.streams\[1\]\.codec_type/],
    ['numeric codec type', metadataWith({ codec_type: 1, codec_name: 'aac' }), /metadata\.streams\[1\]\.codec_type/],
    ['empty codec type', metadataWith({ codec_type: '', codec_name: 'aac' }), /metadata\.streams\[1\]\.codec_type/],
    ['boxed pseudo audio', metadataWith({ codec_type: new String('audio'), codec_name: 'aac' }), /metadata\.streams\[1\]\.codec_type/],
    ['subtitle stream', metadataWith({ codec_type: 'subtitle', codec_name: 'mov_text' }), /unsupported codec_type subtitle/i],
    ['data stream', metadataWith({ codec_type: 'data', codec_name: 'bin_data' }), /unsupported codec_type data/i],
    ['attachment stream', metadataWith({ codec_type: 'attachment', codec_name: 'ttf' }), /unsupported codec_type attachment/i],
    ['unknown stream', metadataWith({ codec_type: 'mystery', codec_name: 'unknown' }), /unsupported codec_type mystery/i],
    ['missing video codec', (() => { const value = clone(approvedMetadata); delete value.streams[0].codec_name; return value; })(), /metadata\.streams\[0\]\.codec_name/],
    ['numeric video codec', (() => { const value = clone(approvedMetadata); value.streams[0].codec_name = 264; return value; })(), /metadata\.streams\[0\]\.codec_name/],
    ['missing audio codec', metadataWith({ codec_type: 'audio' }), /metadata\.streams\[1\]\.codec_name/],
    ['numeric audio codec', metadataWith({ codec_type: 'audio', codec_name: 1 }), /metadata\.streams\[1\]\.codec_name/]
  ];

  for (const [name, metadata, diagnostic] of cases) {
    await t.test(name, () => {
      const contract = name.includes('audio codec')
        ? { ...approvedContract, audioStreams: 1, audioCodec: 'aac' }
        : approvedContract;
      assert.match(validateMediaMetadata(metadata, contract).join('\n'), diagnostic);
    });
  }
});

test('rejects malformed metadata instead of coercing or skipping it', async (t) => {
  const cases = [
    ['metadata null', null, /metadata\.streams/],
    ['streams absent', { format: approvedMetadata.format }, /metadata\.streams/],
    ['streams object', { streams: {}, format: approvedMetadata.format }, /metadata\.streams/],
    ['format absent', { streams: approvedMetadata.streams }, /format\.duration/],
    ['width string', (() => { const value = clone(approvedMetadata); value.streams[0].width = '1920'; return value; })(), /video\.width/],
    ['height fractional', (() => { const value = clone(approvedMetadata); value.streams[0].height = 1080.5; return value; })(), /video\.height/],
    ['frame count absent', (() => { const value = clone(approvedMetadata); delete value.streams[0].nb_frames; return value; })(), /video\.nb_frames/],
    ['frame count N/A', (() => { const value = clone(approvedMetadata); value.streams[0].nb_frames = 'N\/A'; return value; })(), /video\.nb_frames/],
    ['frame count negative', (() => { const value = clone(approvedMetadata); value.streams[0].nb_frames = '-1'; return value; })(), /video\.nb_frames/],
    ['frame count fractional', (() => { const value = clone(approvedMetadata); value.streams[0].nb_frames = '4540.0'; return value; })(), /video\.nb_frames/],
    ['duration empty', (() => { const value = clone(approvedMetadata); value.format.duration = ''; return value; })(), /format\.duration/],
    ['duration NaN', (() => { const value = clone(approvedMetadata); value.format.duration = 'NaN'; return value; })(), /format\.duration/],
    ['duration Infinity', (() => { const value = clone(approvedMetadata); value.format.duration = 'Infinity'; return value; })(), /format\.duration/],
    ['duration negative', (() => { const value = clone(approvedMetadata); value.format.duration = '-1'; return value; })(), /format\.duration/]
  ];

  for (const [name, metadata, diagnostic] of cases) {
    await t.test(name, () => {
      assert.match(validateMediaMetadata(metadata, approvedContract).join('\n'), diagnostic);
    });
  }
});

test('enforces exact constant-frame-rate rational metadata', async (t) => {
  const invalidRates = ['', '30', '30/0', '3e1/1', '30/1e0', '30.0/1', '+30/1', '-30/1', '0/1', '9007199254740992/1'];

  for (const field of ['r_frame_rate', 'avg_frame_rate']) {
    for (const rate of invalidRates) {
      await t.test(`${field} rejects ${rate || 'empty'}`, () => {
        const metadata = clone(approvedMetadata);
        metadata.streams[0][field] = rate;
        assert.match(validateMediaMetadata(metadata, approvedContract).join('\n'), /constant frame rate.*30fps/i);
      });
    }
  }
});

test('rejects multiple video streams even when the first stream matches', () => {
  const metadata = clone(approvedMetadata);
  metadata.streams.push({ ...clone(approvedMetadata.streams[0]), codec_name: 'vp9' });
  assert.match(validateMediaMetadata(metadata, approvedContract).join('\n'), /exactly one video stream; received 2/);
});

test('compares decimal duration to frame tolerance with exact BigInt fractions', () => {
  const contract = { ...approvedContract, fps: 10, frames: 300, durationToleranceFrames: 1 };
  const metadata = clone(approvedMetadata);
  metadata.streams[0].r_frame_rate = '10/1';
  metadata.streams[0].avg_frame_rate = '10/1';
  metadata.streams[0].nb_frames = '300';

  metadata.format.duration = '30.1';
  assert.deepEqual(validateMediaMetadata(metadata, contract), []);

  metadata.format.duration = '30.100000000000001';
  assert.match(validateMediaMetadata(metadata, contract).join('\n'), /duration/);

  const largeContract = {
    ...approvedContract,
    fps: 10,
    frames: Number.MAX_SAFE_INTEGER,
    durationToleranceFrames: 0
  };
  const largeMetadata = clone(metadata);
  largeMetadata.streams[0].nb_frames = String(Number.MAX_SAFE_INTEGER);
  largeMetadata.format.duration = '900719925474099.13';
  assert.match(validateMediaMetadata(largeMetadata, largeContract).join('\n'), /duration/);
});

test('process result handling rejects spawn errors, signals, and nonzero exits', async (t) => {
  assert.equal(processOutputOrThrow({ status: 0, signal: null, stdout: 'ok', stderr: '' }, 'tool'), 'ok');
  await t.test('spawn error', () => assert.throws(
    () => processOutputOrThrow({ status: null, signal: null, stdout: '', stderr: '', error: new Error('ENOENT') }, 'tool'),
    /tool spawn failed.*ENOENT/i
  ));
  await t.test('signal', () => assert.throws(
    () => processOutputOrThrow({ status: null, signal: 'SIGTERM', stdout: '', stderr: '' }, 'tool'),
    /tool terminated by signal SIGTERM/i
  ));
  await t.test('nonzero', () => assert.throws(
    () => processOutputOrThrow({ status: 7, signal: null, stdout: 'unrelated', stderr: 'bad media' }, 'tool'),
    /tool failed.*exit 7.*bad media/i
  ));
});

test('subprocess execution has actionable timeout and output-buffer failures', async (t) => {
  await t.test('probe timeout', (subtest) => {
    const harness = createHarness(subtest, { probeBody: `setTimeout(() => {}, 1000);` });
    assert.throws(
      () => validateMediaFile(
        harness.mediaPath,
        approvedContract,
        harness.probePath,
        harness.decodePath,
        { probeTimeoutMs: 500, decodeTimeoutMs: 500, maxBufferBytes: 1024 }
      ),
      /ffprobe timed out after 500ms/i
    );
  });

  await t.test('decode timeout', (subtest) => {
    const harness = createHarness(subtest, { decodeBody: `setTimeout(() => {}, 1000);` });
    assert.throws(
      () => validateMediaFile(
        harness.mediaPath,
        approvedContract,
        harness.probePath,
        harness.decodePath,
        { probeTimeoutMs: 2000, decodeTimeoutMs: 500, maxBufferBytes: 1024 }
      ),
      /ffmpeg decode timed out after 500ms/i
    );
  });

  await t.test('probe maxBuffer', (subtest) => {
    const harness = createHarness(subtest, { probeBody: `process.stdout.write('x'.repeat(8192));` });
    assert.throws(
      () => probeMedia(harness.mediaPath, harness.probePath, { timeoutMs: 500, maxBufferBytes: 1024 }),
      /ffprobe exceeded.*1024.*output buffer/i
    );
  });

  assert.equal(typeof mediaValidator.computeDecodeTimeoutMs, 'function');
  const shortBudget = mediaValidator.computeDecodeTimeoutMs({ ...approvedContract, fps: 30, frames: 30 });
  const longBudget = mediaValidator.computeDecodeTimeoutMs({ ...approvedContract, fps: 1, frames: Number.MAX_SAFE_INTEGER });
  assert.ok(shortBudget >= 5_000 && shortBudget <= 60_000);
  assert.ok(longBudget >= shortBudget && longBudget <= 30 * 60_000);
});

test('CLI validates paths with spaces, keeps tool output private, and records exact probe/decode arguments', (t) => {
  const harness = createHarness(t);
  const result = runCli(validArguments(harness), harness.env);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report, {
    status: 'pass',
    target: realpathSync.native(harness.mediaPath),
    contract: approvedContract,
    fullDecode: true,
    validatedSha256: hashFile(harness.mediaPath)
  });
  assert.equal(result.stdout.trim().split(/\r?\n/).length, 1);
  assert.doesNotMatch(result.stdout, /captured/);

  const probeArguments = JSON.parse(readFileSync(harness.probeLogPath, 'utf8'));
  assert.deepEqual(probeArguments, [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,nb_frames',
    '-of', 'json',
    harness.mediaPath
  ]);

  const decodeArguments = JSON.parse(readFileSync(harness.decodeLogPath, 'utf8'));
  assert.deepEqual(decodeArguments, [
    '-v', 'error',
    '-xerror',
    '-err_detect', 'explode',
    '-i', harness.mediaPath,
    '-map', '0:v:0',
    '-map', '0:a?',
    '-c:v', 'rawvideo',
    '-c:a', 'pcm_s16le',
    '-f', 'null',
    process.platform === 'win32' ? 'NUL' : '/dev/null'
  ]);
  assert.ok(!decodeArguments.includes('wrapped_avframe'));
  assert.equal(
    decodeArguments.some((argument, index) => argument === '-map' && decodeArguments[index + 1] === '0'),
    false,
    'full decode must not map subtitle, data, or attachment streams'
  );
});

test('CLI detects atomic media replacement after probe and never starts decode', (t) => {
  const replacementBody = [
    `const { renameSync } = await import('node:fs');`,
    `const target = process.argv.at(-1);`,
    `renameSync(target, target + '.before-probe');`,
    `writeFileSync(target, 'replacement after probe');`,
    `process.stdout.write(${jsString(JSON.stringify(approvedMetadata))});`
  ].join('\n');
  const harness = createHarness(t, { probeBody: replacementBody });
  const result = runCli(validArguments(harness), harness.env);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /media changed after ffprobe/i);
  assert.equal(existsSync(harness.decodeLogPath), false, 'decode must not start after probe-time replacement');
});

test('CLI detects atomic media replacement during decode and emits no success JSON', (t) => {
  const replacementBody = [
    `const { renameSync } = await import('node:fs');`,
    `const args = process.argv.slice(2);`,
    `const target = args[args.indexOf('-i') + 1];`,
    `renameSync(target, target + '.before-decode');`,
    `writeFileSync(target, 'replacement during decode');`
  ].join('\n');
  const harness = createHarness(t, { decodeBody: replacementBody });
  const result = runCli(validArguments(harness), harness.env);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /media changed after ffmpeg decode/i);
});

test('CLI canonicalizes directory-junction media aliases in tools and report', (t) => {
  const harness = createHarness(t);
  const realDirectory = join(harness.root, 'real media directory');
  const junctionDirectory = join(harness.root, 'junction media directory');
  mkdirSync(realDirectory);
  const realMediaPath = join(realDirectory, 'junction target.mp4');
  renameSync(harness.mediaPath, realMediaPath);
  symlinkSync(realDirectory, junctionDirectory, 'junction');
  harness.mediaPath = join(junctionDirectory, 'junction target.mp4');

  const result = runCli(validArguments(harness), harness.env);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.target, realpathSync.native(realMediaPath));
  assert.equal(report.validatedSha256, hashFile(realMediaPath));

  const probeArguments = JSON.parse(readFileSync(harness.probeLogPath, 'utf8'));
  const decodeArguments = JSON.parse(readFileSync(harness.decodeLogPath, 'utf8'));
  assert.equal(probeArguments.at(-1), realpathSync.native(realMediaPath));
  assert.equal(decodeArguments[decodeArguments.indexOf('-i') + 1], realpathSync.native(realMediaPath));
});

test('CLI canonicalizes file-symlink media aliases when supported', (t) => {
  const harness = createHarness(t);
  const aliasPath = join(harness.root, 'file media alias.mp4');
  try {
    symlinkSync(harness.mediaPath, aliasPath, 'file');
  } catch (error) {
    if (error?.code === 'EPERM') {
      t.skip('file symlink unavailable: EPERM');
      return;
    }
    throw error;
  }
  const canonicalPath = realpathSync.native(harness.mediaPath);
  harness.mediaPath = aliasPath;

  const result = runCli(validArguments(harness), harness.env);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).target, canonicalPath);
  const probeArguments = JSON.parse(readFileSync(harness.probeLogPath, 'utf8'));
  assert.equal(probeArguments.at(-1), canonicalPath);
});

const realIntegrationFiles = [approvedMediaPath, contractPath, remotionFfprobePath, remotionFfmpegPath];
const missingRealIntegrationFiles = realIntegrationFiles.filter((filePath) => !isRegularFile(filePath));

test('real Remotion ffmpeg fully decodes the approved MP4 with explicit supported encoders', {
  skip: missingRealIntegrationFiles.length > 0
    ? `portable Skill copy lacks integration fixture/tool(s): ${missingRealIntegrationFiles.join(', ')}`
    : false,
  timeout: 30_000
}, () => {
  const result = runCli([
    approvedMediaPath,
    contractPath,
    '--ffprobe',
    remotionFfprobePath,
    '--ffmpeg',
    remotionFfmpegPath
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), {
    status: 'pass',
    target: realpathSync.native(approvedMediaPath),
    contract: approvedContract,
    fullDecode: true,
    validatedSha256: hashFile(approvedMediaPath)
  });
});

test('real Remotion ffmpeg null output accepts mapped audio through pcm_s16le', {
  skip: !isRegularFile(diagnosticAudioSamplePath) || !isRegularFile(remotionFfmpegPath)
    ? 'portable Skill copy lacks the local audio diagnostic fixture or Remotion ffmpeg'
    : false,
  timeout: 30_000
}, () => {
  assert.doesNotThrow(() => decodeMedia(diagnosticAudioSamplePath, remotionFfmpegPath));
});

test('CLI rejects unknown, duplicate, missing-value, missing-required, and extra arguments', async (t) => {
  const harness = createHarness(t);
  const cases = [
    ['unknown option', [...validArguments(harness), '--wat'], /unknown option.*--wat/i],
    ['duplicate ffprobe', [...validArguments(harness), '--ffprobe', harness.probePath], /duplicate option.*--ffprobe/i],
    ['duplicate ffmpeg', [...validArguments(harness), '--ffmpeg', harness.decodePath], /duplicate option.*--ffmpeg/i],
    ['missing ffprobe value', [harness.mediaPath, harness.contractPath, '--ffprobe', '--ffmpeg', harness.decodePath], /missing value.*--ffprobe/i],
    ['missing ffmpeg value', [harness.mediaPath, harness.contractPath, '--ffprobe', harness.probePath, '--ffmpeg'], /missing value.*--ffmpeg/i],
    ['missing ffprobe option', [harness.mediaPath, harness.contractPath, '--ffmpeg', harness.decodePath], /required option.*--ffprobe/i],
    ['missing ffmpeg option', [harness.mediaPath, harness.contractPath, '--ffprobe', harness.probePath], /required option.*--ffmpeg/i],
    ['extra positional', [harness.mediaPath, harness.contractPath, 'extra.mp4', '--ffprobe', harness.probePath, '--ffmpeg', harness.decodePath], /unexpected argument.*extra\.mp4/i]
  ];

  for (const [name, argumentsList, diagnostic] of cases) {
    await t.test(name, () => {
      const result = runCli(argumentsList, harness.env);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, diagnostic);
    });
  }
});

test('CLI fails closed for missing and directory-valued media, contract, and tool paths', async (t) => {
  const harness = createHarness(t);
  const directoryPath = join(harness.root, 'directory path');
  mkdirSync(directoryPath);
  const cases = [
    ['media missing', 0, join(harness.root, 'missing media.mp4'), /media.*regular file/i],
    ['media directory', 0, directoryPath, /media.*regular file/i],
    ['contract missing', 1, join(harness.root, 'missing contract.json'), /contract.*regular file/i],
    ['contract directory', 1, directoryPath, /contract.*regular file/i],
    ['ffprobe missing', 3, join(harness.root, 'missing probe.exe'), /ffprobe.*regular file/i],
    ['ffprobe directory', 3, directoryPath, /ffprobe.*regular file/i],
    ['ffmpeg missing', 5, join(harness.root, 'missing decode.exe'), /ffmpeg.*regular file/i],
    ['ffmpeg directory', 5, directoryPath, /ffmpeg.*regular file/i]
  ];

  for (const [name, index, replacement, diagnostic] of cases) {
    await t.test(name, () => {
      const argumentsList = validArguments(harness);
      argumentsList[index] = replacement;
      const result = runCli(argumentsList, harness.env);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, diagnostic);
    });
  }
});

test('CLI rejects invalid contract JSON and invalid contract semantics before probing', async (t) => {
  const harness = createHarness(t);

  writeFileSync(harness.contractPath, '{broken');
  const invalidJson = runCli(validArguments(harness), harness.env);
  assert.equal(invalidJson.status, 1);
  assert.equal(invalidJson.stdout, '');
  assert.match(invalidJson.stderr, /contract JSON/i);

  writeFileSync(harness.contractPath, JSON.stringify({ ...approvedContract, frames: -1 }));
  const invalidContract = runCli(validArguments(harness), harness.env);
  assert.equal(invalidContract.status, 1);
  assert.equal(invalidContract.stdout, '');
  assert.match(invalidContract.stderr, /contract\.frames/);
});

test('CLI reports ffprobe nonzero, invalid JSON, malformed structure, and spawn errors', async (t) => {
  const cases = [
    ['nonzero', `process.stderr.write('probe exploded'); process.exitCode = 9;`, /ffprobe failed.*exit 9.*probe exploded/i],
    ['invalid JSON', `process.stdout.write('not json');`, /ffprobe returned invalid JSON/i],
    ['malformed structure', `process.stdout.write(${jsString(JSON.stringify({ streams: {}, format: {} }))});`, /metadata\.streams/],
    ['spawn error', ``, /ffprobe spawn failed/i]
  ];

  for (const [name, probeBody, diagnostic] of cases) {
    await t.test(name, (subtest) => {
      const harness = createHarness(subtest, { probeBody });
      if (name === 'spawn error') {
        harness.probePath = join(harness.root, 'invalid executable.bin');
        writeFileSync(harness.probePath, 'not an executable');
      }
      const result = runCli(validArguments(harness), harness.env);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, diagnostic);
    });
  }
});

test('CLI reports ffmpeg decode nonzero and does not emit a success report', (t) => {
  const harness = createHarness(t, {
    decodeBody: `process.stderr.write('decode corruption'); process.exitCode = 13;`
  });
  const result = runCli(validArguments(harness), harness.env);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /ffmpeg decode failed.*exit 13.*decode corruption/i);
});

test('CLI reports an ffmpeg spawn error and does not emit a success report', (t) => {
  const harness = createHarness(t);
  harness.decodePath = join(harness.root, 'invalid decoder executable.bin');
  writeFileSync(harness.decodePath, 'not an executable');
  const result = runCli(validArguments(harness), harness.env);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /ffmpeg decode spawn failed/i);
});
