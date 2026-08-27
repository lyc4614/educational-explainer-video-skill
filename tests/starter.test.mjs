import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath, pathToFileURL} from 'node:url';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const starterRoot = path.join(skillRoot, 'assets/remotion-starter');
const workspaceRoot = path.resolve(skillRoot, '../..');

const read = (relative) => fs.readFileSync(path.join(starterRoot, relative), 'utf8');

const importAspectConfig = () =>
  import(`${pathToFileURL(path.join(starterRoot, 'src/config/aspect.mjs')).href}?test=${Date.now()}`);

const dependencyCandidates = [
  {label: 'starter-local', root: path.join(starterRoot, 'node_modules')},
  {label: 'ranking-video 4.0.477 fallback', root: path.join(workspaceRoot, 'ranking-video/node_modules')},
];

const findRemotionDependencies = () => {
  for (const candidate of dependencyCandidates) {
    try {
      const remotion = JSON.parse(fs.readFileSync(path.join(candidate.root, 'remotion/package.json'), 'utf8'));
      const cli = JSON.parse(
        fs.readFileSync(path.join(candidate.root, '@remotion/cli/package.json'), 'utf8'),
      );
      if (remotion.version === '4.0.477' && cli.version === '4.0.477') return candidate;
    } catch {
      // Try the documented fallback candidate.
    }
  }
  return undefined;
};

// Chinese items are exact topic words; English alternatives use letter boundaries so
// subject defaults and their common plurals are blocked without flagging "microphone".
const CHINESE_BANNED_TOPIC_DEFAULTS = ['老师', '教师', '学生', '黑板', '试卷', '手机'];
const ENGLISH_BANNED_TOPIC_DEFAULTS = [
  'teachers?',
  'students?',
  'blackboards?',
  'exam\\s+papers?',
  'phones?',
  'smartphones?',
  'mobile\\s+phones?',
];

const hasBannedTopicDefault = (source) => {
  if (CHINESE_BANNED_TOPIC_DEFAULTS.some((word) => source.includes(word))) return true;
  return new RegExp(
    `(?<![A-Za-z])(?:${ENGLISH_BANNED_TOPIC_DEFAULTS.join('|')})(?![A-Za-z])`,
    'i',
  ).test(source);
};

const extractQaPowerShell = () => {
  const qa = fs.readFileSync(path.join(skillRoot, 'references/qa-and-delivery.md'), 'utf8');
  const match = qa.match(/```powershell\r?\n([\s\S]*?)\r?\n```/);
  assert.ok(match, 'QA must contain an executable PowerShell source-scan block');
  return match[1];
};

const runQaSourceScan = ({sourceRoot, pathValue = process.env.Path ?? process.env.PATH ?? ''}) => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'educational-starter-qa-'));
  const scriptPath = path.join(runRoot, 'scan.ps1');
  fs.writeFileSync(scriptPath, extractQaPowerShell(), 'utf8');
  const powershell = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const childEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => name.toLowerCase() !== 'path'),
  );
  childEnvironment.Path = pathValue;
  return spawnSync(
    powershell,
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-DeliverySource',
      sourceRoot,
    ],
    {
      encoding: 'utf8',
      env: childEnvironment,
      timeout: 15_000,
    },
  );
};

test('starter package is independently installable and exposes executable checks', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.deepEqual(pkg.scripts, {
    start: 'remotion studio src/index.ts',
    compositions: 'remotion compositions src/index.ts',
    typecheck: 'tsc --noEmit',
  });
  assert.deepEqual(pkg.dependencies, {
    '@remotion/cli': '4.0.477',
    react: '^18.3.1',
    'react-dom': '^18.3.1',
    remotion: '4.0.477',
    typescript: '^5.7.2',
  });
  assert.deepEqual(pkg.devDependencies, {
    '@types/react': '^18.3.18',
    '@types/react-dom': '^18.3.5',
  });
});

test('TypeScript configuration supports ESM, TSX, and explicit mjs imports', () => {
  const config = JSON.parse(read('tsconfig.json'));
  assert.deepEqual(config.include, ['src']);
  assert.equal(config.compilerOptions.target, 'ES2022');
  assert.equal(config.compilerOptions.module, 'ESNext');
  assert.equal(config.compilerOptions.moduleResolution, 'Bundler');
  assert.equal(config.compilerOptions.jsx, 'react-jsx');
  assert.equal(config.compilerOptions.strict, true);
  assert.equal(config.compilerOptions.allowJs, true);
  assert.equal(config.compilerOptions.checkJs, false);
  assert.equal(config.compilerOptions.noEmit, true);
});

test('starter exposes exact immutable horizontal and vertical contracts', async () => {
  const {ASPECTS} = await importAspectConfig();
  assert.deepEqual(ASPECTS.horizontal, {
    width: 1920,
    height: 1080,
    fps: 30,
    safe: {x: 120, top: 96, bottom: 84},
    caption: {height: 180, maxLines: 2},
  });
  assert.deepEqual(ASPECTS.vertical, {
    width: 1080,
    height: 1920,
    fps: 30,
    safe: {x: 72, top: 160, bottom: 280},
    caption: {height: 240, maxLines: 2},
  });
  assert.ok(Object.isFrozen(ASPECTS));
  assert.ok(Object.isFrozen(ASPECTS.horizontal.safe));
  assert.ok(Object.isFrozen(ASPECTS.vertical.caption));
});

test('executable composition specs register exact aspect-derived previews', async () => {
  const {ASPECTS, COMPOSITION_SPECS} = await importAspectConfig();
  assert.deepEqual(COMPOSITION_SPECS, [
    {
      id: 'StarterHorizontalPreview',
      aspect: 'horizontal',
      durationInFrames: 150,
      fps: ASPECTS.horizontal.fps,
      width: ASPECTS.horizontal.width,
      height: ASPECTS.horizontal.height,
    },
    {
      id: 'StarterVerticalPreview',
      aspect: 'vertical',
      durationInFrames: 150,
      fps: ASPECTS.vertical.fps,
      width: ASPECTS.vertical.width,
      height: ASPECTS.vertical.height,
    },
  ]);
  assert.ok(Object.isFrozen(COMPOSITION_SPECS));
  assert.ok(COMPOSITION_SPECS.every(Object.isFrozen));

  const rootSource = read('src/Root.tsx');
  assert.match(rootSource, /COMPOSITION_SPECS\.map\s*\(/);
  assert.match(rootSource, /component=\{StarterPreview\}/);
  for (const prop of ['id', 'durationInFrames', 'fps', 'width', 'height']) {
    assert.match(rootSource, new RegExp(`${prop}=\\{spec\\.${prop}\\}`));
  }
  assert.match(rootSource, /defaultProps=\{\{aspect:\s*spec\.aspect\}\}/);
});

test('copied starter typechecks and Remotion enumerates exactly both contracts', {timeout: 60_000}, (t) => {
  const dependencies = findRemotionDependencies();
  if (!dependencies) {
    t.skip(
      'Remotion 4.0.477 dependencies unavailable: checked starter node_modules, then ranking-video fallback',
    );
    return;
  }

  const copyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'educational-remotion-smoke-'));
  fs.copyFileSync(path.join(starterRoot, 'package.json'), path.join(copyRoot, 'package.json'));
  fs.copyFileSync(path.join(starterRoot, 'tsconfig.json'), path.join(copyRoot, 'tsconfig.json'));
  fs.cpSync(path.join(starterRoot, 'src'), path.join(copyRoot, 'src'), {recursive: true});
  fs.symlinkSync(
    dependencies.root,
    path.join(copyRoot, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );

  const typecheck = spawnSync(
    process.execPath,
    [path.join(copyRoot, 'node_modules/typescript/bin/tsc'), '--project', 'tsconfig.json', '--noEmit'],
    {
    cwd: copyRoot,
    encoding: 'utf8',
    timeout: 30_000,
    },
  );
  assert.equal(
    typecheck.status,
    0,
    `TypeScript failed using ${dependencies.label}:\n${typecheck.stdout}\n${typecheck.stderr}`,
  );

  const compositions = spawnSync(
    process.execPath,
    [path.join(copyRoot, 'node_modules/@remotion/cli/remotion-cli.js'), 'compositions', 'src/index.ts'],
    {
      cwd: copyRoot,
      encoding: 'utf8',
      timeout: 45_000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  assert.equal(
    compositions.status,
    0,
    `Remotion compositions failed using ${dependencies.label}:\n${compositions.stdout}\n${compositions.stderr}`,
  );
  const contracts = `${compositions.stdout}\n${compositions.stderr}`
    .split(/\r?\n/)
    .map((line) => line.match(/^(Starter\S+)\s+(\d+)\s+(\d+x\d+)\s+(\d+)\s+\(/))
    .filter(Boolean)
    .map((match) => ({
      id: match[1],
      fps: Number(match[2]),
      dimensions: match[3],
      durationInFrames: Number(match[4]),
    }));
  assert.deepEqual(contracts, [
    {
      id: 'StarterHorizontalPreview',
      fps: 30,
      dimensions: '1920x1080',
      durationInFrames: 150,
    },
    {
      id: 'StarterVerticalPreview',
      fps: 30,
      dimensions: '1080x1920',
      durationInFrames: 150,
    },
  ]);
});

test('entrypoint registers the declared Remotion root with portable imports', () => {
  const indexSource = read('src/index.ts');
  assert.match(indexSource, /import\s+\{registerRoot\}\s+from\s+['"]remotion['"]/);
  assert.match(indexSource, /import\s+\{RemotionRoot\}\s+from\s+['"]\.\/Root['"]/);
  assert.match(indexSource, /registerRoot\(RemotionRoot\)/);
});

test('preview motion is frame-driven and has no runtime animation escape hatches', () => {
  const previewSource = read('src/scenes/StarterPreview.tsx');
  assert.match(previewSource, /useCurrentFrame\(\)/);
  assert.match(previewSource, /interpolate\(\s*frame\s*,/);
  assert.doesNotMatch(previewSource, /\bset(?:Timeout|Interval)\b|requestAnimationFrame|Math\.random|Date\.now/);
  assert.doesNotMatch(previewSource, /\banimation(?:Name)?\s*:|\btransition\s*:/);
});

test('safe-area and caption layout consume the centralized aspect contract', () => {
  const rootSource = read('src/Root.tsx');
  const previewSource = read('src/scenes/StarterPreview.tsx');
  const captionSource = read('src/components/CaptionBand.tsx');

  assert.match(rootSource, /from\s+['"]\.\/config\/aspect\.mjs['"]/);
  assert.match(previewSource, /from\s+['"]\.\.\/config\/aspect\.mjs['"]/);
  assert.match(captionSource, /from\s+['"]\.\.\/config\/aspect\.mjs['"]/);
  for (const token of ['config.safe.x', 'config.safe.top', 'config.safe.bottom']) {
    assert.ok(previewSource.includes(token), `preview must consume ${token}`);
  }
  for (const token of [
    'config.safe.x',
    'config.safe.bottom',
    'config.caption.height',
    'config.caption.maxLines',
  ]) {
    assert.ok(captionSource.includes(token), `caption must consume ${token}`);
  }

  const consumers = `${rootSource}\n${previewSource}\n${captionSource}`;
  assert.doesNotMatch(consumers, /\b(?:1920|1080|120|96|84|72|160|280|180|240)\b/);
});

test('title and geometry have independent zones and both aspect space budgets fit', async () => {
  const {ASPECTS, PREVIEW_LAYOUTS} = await importAspectConfig();
  const previewSource = read('src/scenes/StarterPreview.tsx');
  assert.match(previewSource, /data-layout-zone="starter-title"/);
  assert.match(previewSource, /data-layout-zone="starter-geometry"/);
  assert.doesNotMatch(previewSource, /position:\s*'absolute',\s*top:\s*26/);
  assert.match(previewSource, /gap:\s*layout\.geometryGap/);

  for (const aspect of ['horizontal', 'vertical']) {
    const config = ASPECTS[aspect];
    const layout = PREVIEW_LAYOUTS[aspect];
    const contentHeight =
      config.height -
      config.safe.top -
      (config.safe.bottom + config.caption.height + 28) -
      layout.paddingY * 2;
    const geometryHeight = contentHeight - layout.titleMinHeight - layout.sectionGap;
    const geometryWidth = config.width - config.safe.x * 2 - layout.paddingX * 2;
    const requiredMain =
      layout.primarySize * 2 + layout.connectorLength + layout.geometryGap * 2;
    if (aspect === 'vertical') {
      assert.ok(requiredMain <= geometryHeight, `${aspect} geometry must fit its height budget`);
      assert.ok(layout.primarySize <= geometryWidth, `${aspect} geometry must fit its width budget`);
    } else {
      assert.ok(requiredMain <= geometryWidth, `${aspect} geometry must fit its width budget`);
      assert.ok(layout.primarySize <= geometryHeight, `${aspect} geometry must fit its height budget`);
    }
  }
});

test('starter remains topic-neutral and renders only generic geometry', () => {
  const sourceFiles = fs
    .readdirSync(path.join(starterRoot, 'src'), {recursive: true})
    .filter((name) => /\.(?:tsx?|mjs)$/.test(name))
    .map((name) => read(path.join('src', name)))
    .join('\n');
  assert.equal(hasBannedTopicDefault(sourceFiles), false);
  assert.equal(hasBannedTopicDefault('microphone waveform scaffold'), false);
  assert.equal(hasBannedTopicDefault('generic smartphone illustration'), true);
  assert.equal(hasBannedTopicDefault('student-centered layout'), true);
  assert.equal(hasBannedTopicDefault('教师人物默认'), true);
});

test('starter preview centralizes every visible token and documents a fail-closed scan', async () => {
  const previewSource = read('src/scenes/StarterPreview.tsx');
  const qa = fs.readFileSync(path.join(skillRoot, 'references/qa-and-delivery.md'), 'utf8');
  const {STARTER_PLACEHOLDER_TOKENS} = await importAspectConfig();
  assert.deepEqual(STARTER_PLACEHOLDER_TOKENS, [
    'STARTER_PLACEHOLDER_DO_NOT_DELIVER',
    'Replace with manuscript-derived visual system',
    'Replace this preview with source-traceable explanatory content',
  ]);
  assert.ok(Object.isFrozen(STARTER_PLACEHOLDER_TOKENS));
  assert.match(previewSource, /STARTER_PLACEHOLDER_TOKENS/);
  assert.match(qa, /source scan/i);
  for (const token of STARTER_PLACEHOLDER_TOKENS) assert.ok(qa.includes(token), `QA missing ${token}`);
  assert.match(qa, /stop delivery|must stop|reject/i);
  assert.match(qa, /Get-Command rg -CommandType Application -ErrorAction Stop/);
  assert.match(qa, /Resolve-Path -LiteralPath \$DeliverySource -ErrorAction Stop/);
  assert.match(
    qa,
    /Get-Item -LiteralPath \$resolvedDeliverySource\.Path -Force -ErrorAction Stop/,
  );
  assert.match(qa, /PSIsContainer/);
  assert.match(
    qa,
    /&\s+\$rgCommand\.Source\s+-n\s+-F\s+--hidden\s+--no-ignore\s+--follow/,
  );
  assert.match(qa, /\$rgExitCode\s*=\s*\$LASTEXITCODE/);
  assert.match(qa, /switch\s*\(\$rgExitCode\)/);
  assert.match(qa, /\b1\s*\{\s*exit 0\s*\}/);
  assert.match(qa, /\b0\s*\{[^}]*exit\s+[1-9]\d*/s);
  assert.match(qa, /default\s*\{[^}]*exit\s+[1-9]\d*/s);
  assert.doesNotMatch(qa, /rg[^\r\n]*qa-and-delivery\.md/i);
});

test('documented delivery scan allows only clean sources and fails closed', {timeout: 30_000}, async (t) => {
  if (process.platform !== 'win32') {
    t.skip('PowerShell delivery-scan behavior is verified on Windows');
    return;
  }
  const {STARTER_PLACEHOLDER_TOKENS} = await importAspectConfig();
  const cleanRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'educational-starter-clean-'));
  fs.writeFileSync(path.join(cleanRoot, 'Scene.tsx'), 'export const Scene = () => "clean geometry";\n');
  const clean = runQaSourceScan({sourceRoot: cleanRoot});
  assert.equal(clean.status, 0, `clean source rejected:\n${clean.stdout}\n${clean.stderr}`);

  const singleFile = runQaSourceScan({sourceRoot: path.join(cleanRoot, 'Scene.tsx')});
  assert.notEqual(singleFile.status, 0, 'a single-file DeliverySource must fail closed');

  const ignoredRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'educational-starter-ignored-'));
  fs.writeFileSync(path.join(ignoredRoot, '.gitignore'), 'ignored.ts\n', 'utf8');
  fs.writeFileSync(path.join(ignoredRoot, 'ignored.ts'), STARTER_PLACEHOLDER_TOKENS[0], 'utf8');
  const ignored = runQaSourceScan({sourceRoot: ignoredRoot});
  assert.notEqual(ignored.status, 0, 'a starter token in gitignored source must be blocked');

  const hiddenFileRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'educational-starter-hidden-file-'));
  fs.writeFileSync(path.join(hiddenFileRoot, '.hidden.ts'), STARTER_PLACEHOLDER_TOKENS[1], 'utf8');
  const hiddenFile = runQaSourceScan({sourceRoot: hiddenFileRoot});
  assert.notEqual(hiddenFile.status, 0, 'a starter token in a hidden file must be blocked');

  const hiddenDirectoryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'educational-starter-hidden-directory-'),
  );
  fs.mkdirSync(path.join(hiddenDirectoryRoot, '.hidden-source'));
  fs.writeFileSync(
    path.join(hiddenDirectoryRoot, '.hidden-source/Scene.tsx'),
    STARTER_PLACEHOLDER_TOKENS[2],
    'utf8',
  );
  const hiddenDirectory = runQaSourceScan({sourceRoot: hiddenDirectoryRoot});
  assert.notEqual(hiddenDirectory.status, 0, 'a starter token in a hidden directory must be blocked');

  const cleanSpecialRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'educational-starter-clean-special-'),
  );
  fs.writeFileSync(path.join(cleanSpecialRoot, '.gitignore'), 'ignored.ts\n', 'utf8');
  fs.writeFileSync(path.join(cleanSpecialRoot, 'ignored.ts'), 'clean ignored source', 'utf8');
  fs.writeFileSync(path.join(cleanSpecialRoot, '.hidden.ts'), 'clean hidden source', 'utf8');
  fs.mkdirSync(path.join(cleanSpecialRoot, '.hidden-source'));
  fs.writeFileSync(
    path.join(cleanSpecialRoot, '.hidden-source/Clean.tsx'),
    'clean hidden directory source',
    'utf8',
  );
  const cleanSpecial = runQaSourceScan({sourceRoot: cleanSpecialRoot});
  assert.equal(
    cleanSpecial.status,
    0,
    `clean ignored/hidden source rejected:\n${cleanSpecial.stdout}\n${cleanSpecial.stderr}`,
  );

  const linkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'educational-starter-link-root-'));
  const linkTarget = fs.mkdtempSync(path.join(os.tmpdir(), 'educational-starter-link-target-'));
  fs.writeFileSync(path.join(linkTarget, 'Linked.tsx'), STARTER_PLACEHOLDER_TOKENS[0], 'utf8');
  fs.symlinkSync(
    linkTarget,
    path.join(linkRoot, 'linked-source'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const linked = runQaSourceScan({sourceRoot: linkRoot});
  assert.notEqual(linked.status, 0, 'a starter token reached through a directory link must be blocked');

  const fileLinkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'educational-starter-file-link-'));
  const fileLinkTargetRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'educational-starter-file-link-target-'),
  );
  const fileLinkTarget = path.join(fileLinkTargetRoot, 'target.tsx');
  fs.writeFileSync(fileLinkTarget, STARTER_PLACEHOLDER_TOKENS[1], 'utf8');
  try {
    fs.symlinkSync(fileLinkTarget, path.join(fileLinkRoot, 'linked.tsx'), 'file');
    const fileLinked = runQaSourceScan({sourceRoot: fileLinkRoot});
    assert.notEqual(fileLinked.status, 0, 'a starter token reached through a file symlink must be blocked');
  } catch (error) {
    if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error?.code)) throw error;
    await t.test('file symlink starter token is blocked when supported', (subtest) => {
      subtest.skip(`file symlink unavailable: ${error.code}`);
    });
  }

  const loopRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'educational-starter-link-loop-'));
  fs.writeFileSync(path.join(loopRoot, 'Clean.tsx'), 'clean source before link loop', 'utf8');
  fs.symlinkSync(
    loopRoot,
    path.join(loopRoot, 'loop'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const linkLoop = runQaSourceScan({sourceRoot: loopRoot});
  assert.equal(
    linkLoop.status,
    20,
    `a followed link loop must reach the non-1 rg error branch:\n${linkLoop.stdout}\n${linkLoop.stderr}`,
  );
  assert.match(linkLoop.stderr, /rg exit code (?!1\b)\d+/i);

  for (const [index, token] of STARTER_PLACEHOLDER_TOKENS.entries()) {
    const blockedRoot = fs.mkdtempSync(path.join(os.tmpdir(), `educational-starter-blocked-${index}-`));
    fs.writeFileSync(path.join(blockedRoot, 'Scene.tsx'), token, 'utf8');
    const blocked = runQaSourceScan({sourceRoot: blockedRoot});
    assert.notEqual(blocked.status, 0, `starter token was allowed: ${token}`);
  }

  const missing = runQaSourceScan({sourceRoot: path.join(cleanRoot, 'missing')});
  assert.notEqual(missing.status, 0, 'missing delivery source must fail closed');

  const emptyPath = fs.mkdtempSync(path.join(os.tmpdir(), 'educational-starter-no-rg-'));
  const unavailable = runQaSourceScan({sourceRoot: cleanRoot, pathValue: emptyPath});
  assert.notEqual(unavailable.status, 0, 'missing rg must fail closed');

  const brokenBin = fs.mkdtempSync(path.join(os.tmpdir(), 'educational-starter-broken-rg-'));
  fs.writeFileSync(path.join(brokenBin, 'rg.cmd'), '@echo off\r\nexit /b 7\r\n', 'utf8');
  const toolError = runQaSourceScan({sourceRoot: cleanRoot, pathValue: brokenBin});
  assert.notEqual(toolError.status, 0, 'nonzero rg tool errors must fail closed');
});
