import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { dirname, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import * as briefValidator from '../scripts/validate-brief.mjs';

const { validateBrief } = briefValidator;

const testsRoot = dirname(fileURLToPath(import.meta.url));
const skillRoot = dirname(testsRoot);
const fixturePath = join(testsRoot, 'fixtures', 'phone-distraction-brief.json');
const validatorPath = join(skillRoot, 'scripts', 'validate-brief.mjs');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const cloneFixture = () => structuredClone(fixture);
const addPrimaryElement = (brief, elementId) => {
  brief.scenes[0].primaryElements.push(elementId);
};
const addEvidenceElement = (brief, {
  id = 'formula-01',
  kind = 'formula',
  evidenceStatus = 'pending'
} = {}) => {
  brief.visualElements.push({
    id,
    kind,
    sourcePhrase: '注意切换',
    explanatoryRole: '表示通知与注意切换的关系',
    visualForm: 'relationship-card',
    stateChanges: ['hidden', 'visible'],
    sceneIds: ['scene-01'],
    evidenceStatus,
    originalityNote: '原创关系式排版',
    layer: 'primary'
  });
  addPrimaryElement(brief, id);
};

test('valid phone-distraction production brief returns no diagnostics', () => {
  assert.deepEqual(validateBrief(cloneFixture()), []);
});

test('primary elements require sourcePhrase and explanatoryRole', () => {
  const brief = cloneFixture();
  delete brief.visualElements[0].sourcePhrase;
  delete brief.visualElements[1].explanatoryRole;

  const errors = validateBrief(brief);

  assert.ok(errors.some((error) => error.includes('sourcePhrase')));
  assert.ok(errors.some((error) => error.includes('explanatoryRole')));
});

test('pending formula or data evidence is allowed only while every using scene is draft', async (t) => {
  const brief = cloneFixture();
  addEvidenceElement(brief);
  brief.verificationItems.push({
    id: 'verify-formula-01',
    description: '核验注意切换关系的证据',
    status: 'pending',
    targetElementIds: ['formula-01']
  });

  await t.test('draft scene accepts pending evidence', () => {
    assert.deepEqual(validateBrief(brief), []);
  });

  for (const status of ['approved', 'rendered']) {
    await t.test(`${status} scene requires verified evidence`, () => {
      const finalized = structuredClone(brief);
      finalized.scenes[0].status = status;
      assert.ok(validateBrief(finalized).some((error) =>
        error.includes(`pending evidence`) && error.includes(`${status} scene scene-01`)
      ));
    });
  }
});

test('pending draft evidence requires a traceable pending verification item', async (t) => {
  const makePendingBrief = () => {
    const brief = cloneFixture();
    addEvidenceElement(brief);
    return brief;
  };

  await t.test('missing verification item is rejected', () => {
    assert.ok(validateBrief(makePendingBrief()).some((error) =>
      error.includes('formula-01') && error.includes('pending verificationItems targetElementIds')
    ));
  });

  await t.test('unrelated pending verification item is rejected', () => {
    const brief = makePendingBrief();
    brief.verificationItems.push({
      id: 'verify-child',
      description: 'unrelated check',
      status: 'pending',
      targetElementIds: ['child']
    });
    assert.ok(validateBrief(brief).some((error) =>
      error.includes('formula-01') && error.includes('pending verificationItems targetElementIds')
    ));
  });

  await t.test('verified-only verification item is rejected', () => {
    const brief = makePendingBrief();
    brief.verificationItems.push({
      id: 'verify-formula',
      description: 'already closed check',
      status: 'verified',
      targetElementIds: ['formula-01']
    });
    assert.ok(validateBrief(brief).some((error) =>
      error.includes('formula-01') && error.includes('pending verificationItems targetElementIds')
    ));
  });

  await t.test('targetElementIds cannot reference a missing visual element', () => {
    const brief = cloneFixture();
    brief.verificationItems.push({
      id: 'verify-missing',
      description: 'bad target',
      status: 'pending',
      targetElementIds: ['missing-element']
    });
    assert.ok(validateBrief(brief).some((error) =>
      error.includes('targetElementIds') && error.includes('missing visual element missing-element')
    ));
  });
});

test('data kind triggers evidence validation even with a neutral visualForm', () => {
  const brief = cloneFixture();
  addEvidenceElement(brief, { id: 'data-01', kind: 'data' });
  brief.scenes[0].status = 'approved';

  assert.ok(validateBrief(brief).some((error) => error.includes('pending evidence')));
});

test('sample criteria enforce the executable A, B, and C risk gates', async (t) => {
  const validCases = [
    ['A new topic', 'A', ['new-topic'], '20-30s-sample'],
    ['A unapproved system', 'A', ['unapproved-visual-system'], '20-30s-sample'],
    ['B many new elements', 'B', ['many-new-elements'], '8-12s-micro-sample'],
    ['B complex metaphor', 'B', ['complex-metaphor'], 'keyframes'],
    ['C approved low risk', 'C', ['same-approved-series', 'low-risk-reuse'], 'direct-full']
  ];

  for (const [name, level, criteria, deliverable] of validCases) {
    await t.test(name, () => {
      const brief = cloneFixture();
      Object.assign(brief.sampleDecision, { level, criteria, deliverable, reason: name });
      assert.deepEqual(validateBrief(brief), []);
    });
  }

  const invalidCases = [
    ['A without A risk', 'A', ['many-new-elements'], '20-30s-sample', 'level A must include'],
    ['B with A risk', 'B', ['many-new-elements', 'new-topic'], 'keyframes', 'level B must exclude'],
    ['C missing low risk', 'C', ['same-approved-series'], 'direct-full', 'level C must include both'],
    ['C with B risk', 'C', ['same-approved-series', 'low-risk-reuse', 'complex-metaphor'], 'direct-full', 'level C must exclude']
  ];

  for (const [name, level, criteria, deliverable, diagnostic] of invalidCases) {
    await t.test(name, () => {
      const brief = cloneFixture();
      Object.assign(brief.sampleDecision, { level, criteria, deliverable, reason: name });
      assert.ok(validateBrief(brief).some((error) => error.includes(diagnostic)));
    });
  }

  await t.test('Gate C reason text cannot bypass criteria', () => {
    const brief = cloneFixture();
    Object.assign(brief.sampleDecision, {
      level: 'C',
      criteria: ['new-topic'],
      deliverable: 'direct-full',
      reason: 'same approved series and low-risk reuse'
    });
    const errors = validateBrief(brief);
    assert.ok(errors.some((error) => error.includes('level C must include both')));
    assert.ok(errors.some((error) => error.includes('level C must exclude')));
  });
});

test('verifySourceFiles validates resolved regular-file bytes independently of validateBrief', async (t) => {
  const verify = (...args) => typeof briefValidator.verifySourceFiles === 'function'
    ? briefValidator.verifySourceFiles(...args)
    : ['verifySourceFiles export is missing'];

  await t.test('valid relative fixture requires and accepts the Skill source root', () => {
    assert.deepEqual(verify(cloneFixture(), { sourceRoot: skillRoot }), []);
  });

  await t.test('absolute production source resolves directly without sourceRoot', () => {
    const brief = cloneFixture();
    brief.project.sourceFiles[0].path = join(testsRoot, 'fixtures', 'phone-distraction.srt');
    assert.deepEqual(verify(brief, {}), []);
  });

  await t.test('relative source without sourceRoot is rejected', () => {
    assert.ok(verify(cloneFixture(), {}).some((error) => error.includes('requires sourceRoot')));
  });

  await t.test('missing source is rejected', () => {
    const brief = cloneFixture();
    brief.project.sourceFiles[0].path = join(testsRoot, 'fixtures', 'missing-source.srt');
    assert.ok(verify(brief, {}).some((error) => error.includes('does not exist')));
  });

  await t.test('directory source is rejected as a nonfile', () => {
    const brief = cloneFixture();
    brief.project.sourceFiles[0].path = testsRoot;
    assert.ok(verify(brief, {}).some((error) => error.includes('not a regular file')));
  });

  await t.test('wrong well-formed hash reports declared and actual values', () => {
    const brief = cloneFixture();
    brief.project.sourceFiles[0].sha256 = '0'.repeat(64);
    const errors = verify(brief, { sourceRoot: skillRoot });
    assert.ok(errors.some((error) =>
      error.includes(`declared ${'0'.repeat(64)}`)
      && error.includes('actual 944dd17a0ce33b28d6fb7134f2e01da7b7b6f67681c8e5616b681f065e88ba75')
    ));
  });

  const sourceRoot = mkdtempSync(join(tmpdir(), 'brief-source-root-'));
  const outsideRoot = mkdtempSync(join(tmpdir(), 'brief-source-outside-'));
  t.after(() => {
    rmSync(sourceRoot, { recursive: true, force: true });
    rmSync(outsideRoot, { recursive: true, force: true });
  });
  const outsideFile = join(outsideRoot, 'outside.srt');
  const outsideBytes = Buffer.from('outside source bytes\n', 'utf8');
  const outsideHash = createHash('sha256').update(outsideBytes).digest('hex');
  writeFileSync(outsideFile, outsideBytes);
  const briefForPath = (path) => {
    const brief = cloneFixture();
    brief.project.sourceFiles = [{ path, sha256: outsideHash }];
    return brief;
  };

  await t.test('direct parent traversal is rejected before reading correct-hash bytes', () => {
    const traversal = relative(sourceRoot, outsideFile);
    assert.match(traversal, /^\.\.[\\/]/);
    assert.ok(verify(briefForPath(traversal), { sourceRoot }).some((error) =>
      error.includes('outside sourceRoot')
    ));
  });

  await t.test('Windows directory junction escaping sourceRoot is rejected', { skip: process.platform !== 'win32' }, () => {
    const junctionPath = join(sourceRoot, 'outside-junction');
    symlinkSync(outsideRoot, junctionPath, 'junction');
    assert.ok(verify(briefForPath(join('outside-junction', 'outside.srt')), { sourceRoot }).some((error) =>
      error.includes('outside sourceRoot')
    ));
  });

  await t.test('file symlink escaping sourceRoot is rejected when supported', (subtest) => {
    const symlinkPath = join(sourceRoot, 'outside-file-link.srt');
    try {
      symlinkSync(outsideFile, symlinkPath, 'file');
    } catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP', 'EINVAL'].includes(error?.code)) {
        subtest.skip(`file symlink unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    assert.ok(verify(briefForPath('outside-file-link.srt'), { sourceRoot }).some((error) =>
      error.includes('outside sourceRoot')
    ));
  });
});

test('rejects unsupported aspect and sample level plus missing scene element references', () => {
  const brief = cloneFixture();
  brief.aspect = '1:1';
  brief.sampleDecision.level = 'D';
  brief.scenes[0].primaryElements.push('missing-element');

  const errors = validateBrief(brief);

  assert.ok(errors.some((error) => error.includes('aspect')));
  assert.ok(errors.some((error) => error.includes('sampleDecision.level')));
  assert.ok(errors.some((error) => error.includes('missing-element')));
});

test('level C requires the direct-full deliverable', () => {
  const brief = cloneFixture();
  brief.sampleDecision.level = 'C';
  brief.sampleDecision.deliverable = '20-30s-sample';

  assert.ok(
    validateBrief(brief).some((error) => error.includes('sampleDecision.deliverable'))
  );
});

test('rejects invalid source hashes, unknown audio contracts, and uncovered cues', () => {
  const brief = cloneFixture();
  brief.project.sourceFiles[0].sha256 = 'bad-hash';
  brief.project.audioContract = 'unknown';
  brief.captions.push({ id: 2, text: '这条字幕没有对应场景。', startMs: 4000, endMs: 5000 });

  const errors = validateBrief(brief);

  assert.ok(errors.some((error) => error.includes('sha256')));
  assert.ok(errors.some((error) => error.includes('audioContract')));
  assert.ok(errors.some((error) => error.includes('not covered')));
});

test('fixture uses canonical field names and numeric cue IDs', () => {
  assert.equal(typeof fixture.captions[0].id, 'number');
  assert.deepEqual(fixture.semanticUnits[0].sourceCueIds, [1]);
  assert.equal(fixture.semanticUnits[0].communicativeFunction, 'explanation');
  assert.equal(fixture.semanticUnits[0].viewerTakeaway, '通知打断正在执行的作业任务');
  assert.ok(fixture.visualElements.every((element) => typeof element.kind === 'string'));
  assert.equal(typeof fixture.scenes[0].visualThesis, 'string');
  assert.deepEqual(fixture.scenes[0].primaryElements, ['child', 'phone', 'task-list', 'attention-path']);
  assert.deepEqual(fixture.scenes[0].supportingElements, ['clock']);
  assert.deepEqual(fixture.sampleDecision.criteria, ['new-topic', 'unapproved-visual-system']);
});

test('rejects duplicate IDs independently in every referenced collection', () => {
  const cases = [
    ['captions', 'duplicate caption id 1'],
    ['semanticUnits', 'duplicate semantic unit id unit-01'],
    ['visualElements', 'duplicate visual element id child'],
    ['scenes', 'duplicate scene id scene-01']
  ];

  for (const [collection, expectedDiagnostic] of cases) {
    const brief = cloneFixture();
    brief[collection].push(structuredClone(brief[collection][0]));
    assert.ok(
      validateBrief(brief).some((error) => error.includes(expectedDiagnostic)),
      `missing diagnostic: ${expectedDiagnostic}`
    );
  }
});

test('fixture uses canonical visual kinds and preserves the vertical reflow explanation', () => {
  assert.deepEqual(
    Object.fromEntries(fixture.visualElements.map((element) => [element.id, element.kind])),
    {
      child: 'character',
      phone: 'object',
      clock: 'object',
      'task-list': 'object',
      'attention-path': 'path'
    }
  );
  assert.deepEqual(fixture.scenes[0].aspectOverrides, {
    '9:16': 'vertical stack with task center and phone lower-right'
  });
});

test('accepts every canonical communicative function and rejects unknown values', () => {
  const canonicalFunctions = [
    'question',
    'explanation',
    'reversal',
    'example',
    'comparison',
    'conclusion',
    'action-advice'
  ];

  for (const communicativeFunction of canonicalFunctions) {
    const brief = cloneFixture();
    brief.semanticUnits[0].communicativeFunction = communicativeFunction;
    assert.deepEqual(
      validateBrief(brief),
      [],
      `unexpected diagnostic for ${communicativeFunction}`
    );
  }

  const brief = cloneFixture();
  brief.semanticUnits[0].communicativeFunction = 'unknown';
  assert.ok(
    validateBrief(brief).some((error) => error.includes('communicativeFunction'))
  );
});

test('rejects visual kinds outside the canonical enum', () => {
  const brief = cloneFixture();
  brief.visualElements[0].kind = 'device';

  assert.ok(validateBrief(brief).some((error) => error.includes('visualElements[0].kind')));
});

test('exports a local-ref-aware generic schema walker with numeric and uniqueness support', () => {
  assert.equal(typeof briefValidator.validateAgainstSchema, 'function');

  const schema = {
    $defs: {
      score: { type: 'number', minimum: 0 }
    },
    type: 'array',
    uniqueItems: true,
    items: { $ref: '#/$defs/score' }
  };
  assert.deepEqual(briefValidator.validateAgainstSchema([0.5, 1], schema), []);
  assert.ok(
    briefValidator.validateAgainstSchema([1, 1], schema).some((error) => error.includes('unique'))
  );
  assert.ok(
    briefValidator.validateAgainstSchema(['bad'], schema).some((error) => error.includes('number'))
  );
});

test('schema validation rejects required-field, enum, shape, item, and extra-property mutations', async (t) => {
  const validVerificationItem = { id: 'verify-01', description: 'check claim', status: 'pending' };
  const cases = [
    ['extra top-level property', (brief) => { brief.extra = true; }, 'brief.extra is not allowed'],
    ['extra nested property', (brief) => { brief.project.extra = true; }, 'brief.project.extra is not allowed'],
    ['missing root field', (brief) => { delete brief.verificationItems; }, 'brief.verificationItems is required'],
    ['missing project field', (brief) => { delete brief.project.title; }, 'brief.project.title is required'],
    ['missing source-file field', (brief) => { delete brief.project.sourceFiles[0].path; }, 'path is required'],
    ['missing caption field', (brief) => { delete brief.captions[0].text; }, 'text is required'],
    ['missing semantic field', (brief) => { delete brief.semanticUnits[0].facts; }, 'facts is required'],
    ['missing visual field', (brief) => { delete brief.visualElements[0].visualForm; }, 'visualForm is required'],
    ['missing scene field', (brief) => { delete brief.scenes[0].status; }, 'status is required'],
    ['missing sample field', (brief) => { delete brief.sampleDecision.reason; }, 'reason is required'],
    ['missing sample criteria', (brief) => { delete brief.sampleDecision.criteria; }, 'criteria is required'],
    ['missing verification item field', (brief) => {
      brief.verificationItems.push(validVerificationItem);
      delete brief.verificationItems[0].description;
    }, 'description is required'],
    ['invalid aspect enum', (brief) => { brief.aspect = '1:1'; }, 'brief.aspect must be one of'],
    ['invalid audio enum', (brief) => { brief.project.audioContract = 'unknown'; }, 'audioContract must be one of'],
    ['invalid communicative function enum', (brief) => {
      brief.semanticUnits[0].communicativeFunction = 'unknown';
    }, 'communicativeFunction must be one of'],
    ['invalid visual layer enum', (brief) => { brief.visualElements[0].layer = 'foreground'; }, 'layer must be one of'],
    ['invalid evidence status enum', (brief) => {
      brief.visualElements[0].evidenceStatus = 'assumed';
    }, 'evidenceStatus must be one of'],
    ['invalid scene status enum', (brief) => { brief.scenes[0].status = 'final'; }, 'status must be one of'],
    ['invalid sample criterion enum', (brief) => {
      brief.sampleDecision.criteria = ['unknown-risk'];
    }, 'criteria[0] must be one of'],
    ['duplicate sample criteria rejected', (brief) => {
      brief.sampleDecision.criteria = ['new-topic', 'new-topic'];
    }, 'criteria must contain unique items'],
    ['stateChanges wrong array type', (brief) => { brief.visualElements[0].stateChanges = 'idle'; }, 'stateChanges must be an array'],
    ['stateChanges wrong item type', (brief) => { brief.visualElements[0].stateChanges = [1]; }, 'stateChanges[0] must be a string'],
    ['entities malformed', (brief) => { brief.semanticUnits[0].entities = {}; }, 'entities must be an array'],
    ['reviewFrames wrong array type', (brief) => { brief.scenes[0].reviewFrames = '0'; }, 'reviewFrames must be an array'],
    ['reviewFrames wrong item type', (brief) => { brief.scenes[0].reviewFrames = ['0']; }, 'reviewFrames[0] must be an integer'],
    ['aspectOverrides malformed', (brief) => { brief.scenes[0].aspectOverrides = []; }, 'aspectOverrides must be an object'],
    ['aspectOverrides empty explanation', (brief) => { brief.scenes[0].aspectOverrides['9:16'] = ''; }, 'aspectOverrides.9:16 must have length'],
    ['aspectOverrides extra key', (brief) => { brief.scenes[0].aspectOverrides['1:1'] = 'square'; }, 'aspectOverrides.1:1 is not allowed'],
    ['verificationItems wrong array type', (brief) => { brief.verificationItems = {}; }, 'verificationItems must be an array'],
    ['verificationItems wrong item type', (brief) => { brief.verificationItems = ['bad']; }, 'verificationItems[0] must be an object'],
    ['verification item invalid enum', (brief) => {
      brief.verificationItems = [{ ...validVerificationItem, status: 'assumed' }];
    }, 'verificationItems[0].status must be one of'],
    ['verification target IDs require at least one item', (brief) => {
      brief.verificationItems = [{ ...validVerificationItem, targetElementIds: [] }];
    }, 'targetElementIds must contain at least 1 item'],
    ['verification target IDs require nonempty strings', (brief) => {
      brief.verificationItems = [{ ...validVerificationItem, targetElementIds: [''] }];
    }, 'targetElementIds[0] must have length at least 1'],
    ['verification target IDs reject duplicates', (brief) => {
      brief.verificationItems = [{
        ...validVerificationItem,
        targetElementIds: ['child', 'child']
      }];
    }, 'targetElementIds must contain unique items'],
    ['duplicate state change rejected by uniqueItems', (brief) => {
      brief.visualElements[0].stateChanges = ['writing', 'writing'];
    }, 'stateChanges must contain unique items']
  ];

  for (const [name, mutate, expected] of cases) {
    await t.test(name, () => {
      const brief = cloneFixture();
      mutate(brief);
      assert.ok(
        validateBrief(brief).some((error) => error.includes(expected)),
        `missing schema diagnostic containing: ${expected}`
      );
    });
  }
});

test('enforces scene-element membership and layer usage invariants', async (t) => {
  await t.test('scene-used element lists the claiming scene', () => {
    const brief = cloneFixture();
    brief.visualElements[0].sceneIds = [];
    assert.ok(validateBrief(brief).some((error) => error.includes('must include scene-01')));
  });

  await t.test('element sceneIds cannot dangle', () => {
    const brief = cloneFixture();
    brief.visualElements[0].sceneIds = ['missing-scene'];
    assert.ok(validateBrief(brief).some((error) => error.includes('missing scene missing-scene')));
  });

  await t.test('non-decorative elements cannot be unused', () => {
    const brief = cloneFixture();
    brief.visualElements.push({
      id: 'unused', kind: 'other', sourcePhrase: 'unused', explanatoryRole: 'unused',
      visualForm: 'dot', stateChanges: [], sceneIds: [], evidenceStatus: 'not-applicable',
      originalityNote: 'original', layer: 'supporting'
    });
    assert.ok(validateBrief(brief).some((error) => error.includes('unused non-decorative element unused')));
  });

  await t.test('decorative elements cannot be primary', () => {
    const brief = cloneFixture();
    brief.visualElements[0].layer = 'decorative';
    assert.ok(validateBrief(brief).some((error) => error.includes('decorative element child')));
  });
});

test('enforces scene ordering, cue timing, semantic timing, and review-frame bounds', async (t) => {
  const addEmptyScene = (brief, id, startFrame, endFrame) => {
    const scene = structuredClone(brief.scenes[0]);
    Object.assign(scene, {
      id, startFrame, endFrame, cueIds: [], semanticUnitIds: [], primaryElements: [],
      supportingElements: [], continuityAnchor: 'attention-path', reviewFrames: [startFrame]
    });
    brief.visualElements.find((element) => element.id === 'attention-path').sceneIds.push(id);
    return scene;
  };

  await t.test('scenes must be ordered', () => {
    const brief = cloneFixture();
    const later = addEmptyScene(brief, 'scene-02', 120, 180);
    brief.scenes.unshift(later);
    assert.ok(validateBrief(brief).some((error) => error.includes('scenes must be ordered')));
  });

  await t.test('scenes must not overlap', () => {
    const brief = cloneFixture();
    brief.scenes.push(addEmptyScene(brief, 'scene-02', 100, 180));
    assert.ok(validateBrief(brief).some((error) => error.includes('scenes must not overlap')));
  });

  await t.test('claimed cue frame interval must fit scene', () => {
    const brief = cloneFixture();
    brief.scenes[0].endFrame = 1;
    brief.scenes[0].reviewFrames = [0];
    assert.ok(validateBrief(brief).some((error) => error.includes('cue 1 frame interval')));
  });

  await t.test('semantic timing must fit source cue envelope', () => {
    const brief = cloneFixture();
    brief.semanticUnits[0].endMs = 4001;
    assert.ok(validateBrief(brief).some((error) => error.includes('source cue envelope')));
  });

  await t.test('semantic timing must have positive duration', () => {
    const brief = cloneFixture();
    brief.semanticUnits[0].endMs = brief.semanticUnits[0].startMs;
    assert.ok(validateBrief(brief).some((error) => error.includes('positive duration')));
  });

  await t.test('review frames must stay inside scene range', () => {
    const brief = cloneFixture();
    brief.scenes[0].reviewFrames = [120];
    assert.ok(validateBrief(brief).some((error) => error.includes('reviewFrame 120')));
  });
});

test('uses precise evidence and sample-decision diagnostics', async (t) => {
  await t.test('evidence diagnostic reports actual and required statuses', () => {
    const brief = cloneFixture();
    brief.visualElements.push({
      id: 'formula-status', kind: 'formula', sourcePhrase: 'relationship',
      explanatoryRole: 'show relationship', visualForm: 'card', stateChanges: [],
      sceneIds: ['scene-01'], evidenceStatus: 'not-applicable', originalityNote: 'original',
      layer: 'primary'
    });
    addPrimaryElement(brief, 'formula-status');
    const errors = validateBrief(brief);
    assert.ok(errors.some((error) => error.includes('not-applicable') && error.includes('verified')));
  });

  await t.test('invalid sample level does not cascade to deliverable mismatch', () => {
    const brief = cloneFixture();
    brief.sampleDecision.level = 'D';
    const errors = validateBrief(brief);
    assert.ok(errors.some((error) => error.includes('sampleDecision.level')));
    assert.ok(!errors.some((error) => error.includes('sampleDecision.deliverable does not match')));
  });
});

test('rejects an isolated caption cue with reversed timing', () => {
  const brief = cloneFixture();
  brief.captions.push({
    id: 2,
    text: '孤立的倒置字幕。',
    startMs: 5000,
    endMs: 4000
  });

  assert.ok(
    validateBrief(brief).some((error) =>
      error.includes('captions[1] timing must have nonnegative startMs and endMs > startMs')
    )
  );
});

test('requires visual-element sceneIds to match scene use in both directions', () => {
  const brief = cloneFixture();
  const secondScene = structuredClone(brief.scenes[0]);
  Object.assign(secondScene, {
    id: 'scene-02',
    startFrame: 120,
    endFrame: 180,
    cueIds: [],
    semanticUnitIds: [],
    primaryElements: [],
    supportingElements: [],
    continuityAnchor: 'attention-path',
    reviewFrames: [120]
  });
  brief.scenes.push(secondScene);
  brief.visualElements.find((element) => element.id === 'attention-path').sceneIds.push('scene-02');
  brief.visualElements.find((element) => element.id === 'child').sceneIds.push('scene-02');

  assert.ok(
    validateBrief(brief).some((error) =>
      error.includes('visual element child.sceneIds includes unused scene scene-02')
    )
  );
});

test('requires each semantic-unit source cue inside every claiming scene', () => {
  const brief = cloneFixture();
  brief.captions.push({
    id: 2,
    text: '第二条字幕。',
    startMs: 4000,
    endMs: 8000
  });
  brief.semanticUnits[0].sourceCueIds.push(2);
  brief.semanticUnits[0].endMs = 8000;
  const secondScene = structuredClone(brief.scenes[0]);
  Object.assign(secondScene, {
    id: 'scene-02',
    startFrame: 120,
    endFrame: 240,
    cueIds: [2],
    semanticUnitIds: [],
    primaryElements: [],
    supportingElements: [],
    continuityAnchor: 'attention-path',
    reviewFrames: [120]
  });
  brief.scenes.push(secondScene);
  brief.visualElements.find((element) => element.id === 'attention-path').sceneIds.push('scene-02');

  assert.ok(
    validateBrief(brief).some((error) =>
      error.includes('scenes[0].cueIds must include semantic unit unit-01 source cue 2')
    )
  );
});

test('rejects a primary element repeated as a supporting element in the same scene', () => {
  const brief = cloneFixture();
  brief.scenes[0].supportingElements.push('child');

  assert.ok(
    validateBrief(brief).some((error) =>
      error.includes('scenes[0].primaryElements and supportingElements must be disjoint')
    )
  );
});

test('returns enum diagnostics for direct non-JSON values without throwing', () => {
  for (const nonJsonValue of [1n, Symbol('unknown-aspect')]) {
    const brief = cloneFixture();
    brief.aspect = nonJsonValue;

    assert.doesNotThrow(() => validateBrief(brief));
    assert.ok(
      validateBrief(brief).some((error) => error.includes('brief.aspect must be one of'))
    );
  }
});

test('schema uses only keywords supported by the production schema walker', () => {
  const ignoredPropertyContainers = new Set(['properties', '$defs']);
  const discoveredKeywords = new Set();
  const visitSchema = (node, propertyName = null) => {
    if (Array.isArray(node)) {
      node.forEach((entry) => visitSchema(entry, propertyName));
      return;
    }
    if (node === null || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (propertyName === null || !ignoredPropertyContainers.has(propertyName)) {
        discoveredKeywords.add(key);
      }
      visitSchema(value, key);
    }
  };

  assert.ok(
    briefValidator.PRODUCTION_BRIEF_SCHEMA && typeof briefValidator.PRODUCTION_BRIEF_SCHEMA === 'object',
    'validator must expose its loaded production schema for compatibility auditing'
  );
  assert.ok(
    Array.isArray(briefValidator.SUPPORTED_SCHEMA_KEYWORDS),
    'validator must expose its supported schema keyword set for compatibility auditing'
  );
  visitSchema(briefValidator.PRODUCTION_BRIEF_SCHEMA);
  const unsupported = [...discoveredKeywords]
    .filter((keyword) => !briefValidator.SUPPORTED_SCHEMA_KEYWORDS.includes(keyword));

  assert.deepEqual(unsupported, [], `unsupported schema keyword(s): ${unsupported.join(', ')}`);
});

test('CLI covers valid, missing, malformed, unreadable, and invalid inputs', (t) => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'brief-cli-'));
  t.after(() => rmSync(tempRoot, { recursive: true, force: true }));
  const malformedPath = join(tempRoot, 'malformed.json');
  const invalidPath = join(tempRoot, 'invalid.json');
  const wrongHashPath = join(tempRoot, 'wrong-hash.json');
  const missingSourcePath = join(tempRoot, 'missing-source.json');
  const absoluteSourcePath = join(tempRoot, 'absolute-source.json');
  writeFileSync(malformedPath, '{bad json', 'utf8');
  writeFileSync(invalidPath, JSON.stringify({ aspect: '1:1' }), 'utf8');
  const wrongHashBrief = cloneFixture();
  wrongHashBrief.project.sourceFiles[0].sha256 = '0'.repeat(64);
  writeFileSync(wrongHashPath, JSON.stringify(wrongHashBrief), 'utf8');
  const missingSourceBrief = cloneFixture();
  missingSourceBrief.project.sourceFiles[0].path = join(tempRoot, 'absent.srt');
  writeFileSync(missingSourcePath, JSON.stringify(missingSourceBrief), 'utf8');
  const absoluteSourceBrief = cloneFixture();
  absoluteSourceBrief.project.sourceFiles[0].path = join(testsRoot, 'fixtures', 'phone-distraction.srt');
  writeFileSync(absoluteSourcePath, JSON.stringify(absoluteSourceBrief), 'utf8');

  const cases = [
    { name: 'valid portable fixture', args: [fixturePath, '--source-root', skillRoot], status: 0, stream: 'stdout', text: 'PASS production brief' },
    { name: 'valid absolute production source', args: [absoluteSourcePath], status: 0, stream: 'stdout', text: 'PASS production brief' },
    { name: 'missing', args: [], status: 1, stream: 'stderr', text: 'Usage:' },
    { name: 'relative source without root', args: [fixturePath], status: 1, stream: 'stderr', text: 'requires sourceRoot' },
    { name: 'missing source-root value', args: [fixturePath, '--source-root'], status: 1, stream: 'stderr', text: 'ERROR --source-root requires a directory' },
    { name: 'unknown flag', args: [fixturePath, '--bad-flag', skillRoot], status: 1, stream: 'stderr', text: 'ERROR unknown option --bad-flag' },
    { name: 'malformed', args: [malformedPath], status: 1, stream: 'stderr', text: 'ERROR unable to read production brief' },
    { name: 'unreadable', args: [join(tempRoot, 'missing.json')], status: 1, stream: 'stderr', text: 'ERROR unable to read production brief' },
    { name: 'invalid', args: [invalidPath], status: 1, stream: 'stderr', text: 'ERROR' },
    { name: 'wrong source hash', args: [wrongHashPath, '--source-root', skillRoot], status: 1, stream: 'stderr', text: 'SHA-256 mismatch' },
    { name: 'missing source path', args: [missingSourcePath], status: 1, stream: 'stderr', text: 'does not exist' }
  ];

  for (const cliCase of cases) {
    const result = spawnSync(process.execPath, [validatorPath, ...cliCase.args], { encoding: 'utf8' });
    assert.equal(result.status, cliCase.status, cliCase.name);
    assert.match(result[cliCase.stream], new RegExp(cliCase.text), cliCase.name);
  }
});
