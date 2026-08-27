import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const schemaPath = fileURLToPath(new URL('../assets/production-brief.schema.json', import.meta.url));
export const PRODUCTION_BRIEF_SCHEMA = JSON.parse(readFileSync(schemaPath, 'utf8'));

export const SUPPORTED_SCHEMA_KEYWORDS = Object.freeze([
  '$schema', '$id', 'title', '$ref', '$defs', 'type', 'enum', 'minimum', 'minLength',
  'minItems', 'minProperties', 'items', 'properties', 'required', 'uniqueItems',
  'pattern', 'additionalProperties'
]);

const SAMPLE_DELIVERABLES = {
  A: new Set(['20-30s-sample']),
  B: new Set(['8-12s-micro-sample', 'keyframes']),
  C: new Set(['direct-full'])
};
const A_RISK_CRITERIA = new Set(['new-topic', 'unapproved-visual-system']);
const B_RISK_CRITERIA = new Set(['many-new-elements', 'complex-metaphor']);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isIdentifier = (value) => isNonEmptyString(value) || Number.isInteger(value);
const asArray = (value) => (Array.isArray(value) ? value : []);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const comparisonPath = (path) => process.platform === 'win32' ? path.toLowerCase() : path;

function isPathInside(root, target) {
  const pathFromRoot = relative(comparisonPath(root), comparisonPath(target));
  return pathFromRoot === ''
    || (!isAbsolute(pathFromRoot)
      && pathFromRoot !== '..'
      && !pathFromRoot.startsWith(`..${sep}`));
}

function resolveLocalRef(rootSchema, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) {
    throw new Error(`unsupported schema reference ${String(ref)}`);
  }
  return ref.slice(2).split('/').reduce((node, token) => {
    const key = token.replaceAll('~1', '/').replaceAll('~0', '~');
    if (!isObject(node) || !hasOwn(node, key)) {
      throw new Error(`unresolved schema reference ${ref}`);
    }
    return node[key];
  }, rootSchema);
}

function sameJsonValue(left, right) {
  if (left === null || right === null) return left === right;
  if (typeof left !== typeof right) return false;
  if (typeof left === 'string' || typeof left === 'boolean') return left === right;
  if (typeof left === 'number') return Number.isFinite(left) && Number.isFinite(right) && left === right;
  if (typeof left !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((item, index) => sameJsonValue(item, right[index]));
  }
  if (!isObject(left) || !isObject(right)
    || Object.getPrototypeOf(left) !== Object.prototype
    || Object.getPrototypeOf(right) !== Object.prototype) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => hasOwn(right, key) && sameJsonValue(left[key], right[key]));
}

function matchesType(value, type) {
  switch (type) {
    case 'object': return isObject(value);
    case 'array': return Array.isArray(value);
    case 'string': return typeof value === 'string';
    case 'integer': return Number.isInteger(value);
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    default: throw new Error(`unsupported schema type ${String(type)}`);
  }
}

function typeArticle(type) {
  return type === 'array' || type === 'object' || type === 'integer' ? 'an' : 'a';
}

function walkSchema(value, schema, rootSchema, path, errors) {
  if (!isObject(schema)) return;
  if (schema.$ref !== undefined) {
    walkSchema(value, resolveLocalRef(rootSchema, schema.$ref), rootSchema, path, errors);
    return;
  }

  if (schema.type !== undefined && !matchesType(value, schema.type)) {
    errors.push(`${path} must be ${typeArticle(schema.type)} ${schema.type}`);
    return;
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => sameJsonValue(candidate, value))) {
    errors.push(`${path} must be one of ${schema.enum.map(String).join(', ')}`);
  }

  if (typeof value === 'string') {
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) {
      errors.push(`${path} must have length at least ${schema.minLength}`);
    }
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path} must match pattern ${schema.pattern}`);
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)
    && typeof schema.minimum === 'number' && value < schema.minimum) {
    errors.push(`${path} must be at least ${schema.minimum}`);
  }

  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
      errors.push(`${path} must contain at least ${schema.minItems} item(s)`);
    }
    if (schema.uniqueItems === true) {
      const hasDuplicate = value.some((item, index) =>
        value.slice(0, index).some((earlier) => sameJsonValue(earlier, item))
      );
      if (hasDuplicate) errors.push(`${path} must contain unique items`);
    }
    if (isObject(schema.items)) {
      value.forEach((item, index) => {
        walkSchema(item, schema.items, rootSchema, `${path}[${index}]`, errors);
      });
    }
  }

  if (isObject(value)) {
    if (Number.isInteger(schema.minProperties)
      && Object.keys(value).length < schema.minProperties) {
      errors.push(`${path} must contain at least ${schema.minProperties} properties`);
    }
    for (const requiredKey of asArray(schema.required)) {
      if (!hasOwn(value, requiredKey)) errors.push(`${path}.${requiredKey} is required`);
    }
    const properties = isObject(schema.properties) ? schema.properties : {};
    for (const [key, childSchema] of Object.entries(properties)) {
      if (hasOwn(value, key)) walkSchema(value[key], childSchema, rootSchema, `${path}.${key}`, errors);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!hasOwn(properties, key)) errors.push(`${path}.${key} is not allowed`);
      }
    }
  }
}

export function validateAgainstSchema(value, schema, options = {}) {
  const errors = [];
  walkSchema(value, schema, options.rootSchema ?? schema, options.path ?? 'value', errors);
  return errors;
}

export function verifySourceFiles(brief, { sourceRoot } = {}) {
  const errors = [];
  const sourceFiles = asArray(brief?.project?.sourceFiles);

  sourceFiles.forEach((sourceFile, index) => {
    if (!isObject(sourceFile) || !isNonEmptyString(sourceFile.path)) return;
    const declaredPath = sourceFile.path;
    let lexicalPath;
    let canonicalRoot;

    if (isAbsolute(declaredPath)) {
      lexicalPath = resolve(declaredPath);
    } else {
      if (!isNonEmptyString(sourceRoot)) {
        errors.push(`project.sourceFiles[${index}].path ${declaredPath} is relative and requires sourceRoot`);
        return;
      }
      const lexicalRoot = resolve(sourceRoot);
      try {
        canonicalRoot = realpathSync.native(lexicalRoot);
      } catch (error) {
        if (error?.code === 'ENOENT') {
          errors.push(`project.sourceFiles[${index}] sourceRoot does not exist: ${lexicalRoot}`);
        } else {
          errors.push(`project.sourceFiles[${index}] sourceRoot is not readable: ${lexicalRoot}: ${error.message}`);
        }
        return;
      }
      if (!statSync(canonicalRoot).isDirectory()) {
        errors.push(`project.sourceFiles[${index}] sourceRoot is not a directory: ${canonicalRoot}`);
        return;
      }
      lexicalPath = resolve(lexicalRoot, declaredPath);
      if (!isPathInside(lexicalRoot, lexicalPath)) {
        errors.push(`project.sourceFiles[${index}].path ${declaredPath} resolves outside sourceRoot ${lexicalRoot}`);
        return;
      }
    }

    let canonicalPath;
    try {
      canonicalPath = realpathSync.native(lexicalPath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        errors.push(`project.sourceFiles[${index}] source does not exist: ${lexicalPath}`);
      } else {
        errors.push(`project.sourceFiles[${index}] source is not readable: ${lexicalPath}: ${error.message}`);
      }
      return;
    }
    if (canonicalRoot && !isPathInside(canonicalRoot, canonicalPath)) {
      errors.push(
        `project.sourceFiles[${index}].path ${declaredPath} resolves outside sourceRoot ${canonicalRoot}: canonical target ${canonicalPath}`
      );
      return;
    }

    let stats;
    try {
      stats = statSync(canonicalPath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        errors.push(`project.sourceFiles[${index}] source does not exist: ${canonicalPath}`);
      } else {
        errors.push(`project.sourceFiles[${index}] source is not readable: ${canonicalPath}: ${error.message}`);
      }
      return;
    }
    if (!stats.isFile()) {
      errors.push(`project.sourceFiles[${index}] source is not a regular file: ${canonicalPath}`);
      return;
    }

    let bytes;
    try {
      bytes = readFileSync(canonicalPath);
    } catch (error) {
      errors.push(`project.sourceFiles[${index}] source is not readable: ${canonicalPath}: ${error.message}`);
      return;
    }
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    const declaredHash = typeof sourceFile.sha256 === 'string'
      ? sourceFile.sha256.toLowerCase()
      : String(sourceFile.sha256);
    if (actualHash !== declaredHash) {
      errors.push(
        `project.sourceFiles[${index}] SHA-256 mismatch for ${canonicalPath}: declared ${declaredHash}; actual ${actualHash}`
      );
    }
  });

  return errors;
}

function idSet(items) {
  return new Set(items.filter(isObject).map((item) => item.id).filter(isIdentifier));
}

function checkDuplicateIds(errors, items, label) {
  const seen = new Set();
  for (const item of items) {
    if (!isObject(item) || !isIdentifier(item.id)) continue;
    if (seen.has(item.id)) errors.push(`duplicate ${label} id ${String(item.id)}`);
    else seen.add(item.id);
  }
}

function checkReferences(errors, refs, validIds, path, kind) {
  if (!Array.isArray(refs)) return;
  for (const ref of refs) {
    if (!validIds.has(ref)) errors.push(`${path} references missing ${kind} ${String(ref)}`);
  }
}

export function validateBrief(brief) {
  const errors = validateAgainstSchema(brief, PRODUCTION_BRIEF_SCHEMA, { path: 'brief' });
  if (!isObject(brief)) return errors;

  const captions = asArray(brief.captions);
  const semanticUnits = asArray(brief.semanticUnits);
  const visualElements = asArray(brief.visualElements);
  const scenes = asArray(brief.scenes);
  const verificationItems = asArray(brief.verificationItems);
  const cueIds = idSet(captions);
  const semanticUnitIds = idSet(semanticUnits);
  const sceneIds = idSet(scenes);
  const elementIds = idSet(visualElements);
  const cuesById = new Map(captions.filter(isObject).map((cue) => [cue.id, cue]));
  const semanticUnitsById = new Map(semanticUnits.filter(isObject).map((unit) => [unit.id, unit]));
  const elementsById = new Map(visualElements.filter(isObject).map((element) => [element.id, element]));
  const scenesById = new Map(scenes.filter(isObject).map((scene) => [scene.id, scene]));

  checkDuplicateIds(errors, captions, 'caption');
  checkDuplicateIds(errors, semanticUnits, 'semantic unit');
  checkDuplicateIds(errors, visualElements, 'visual element');
  checkDuplicateIds(errors, scenes, 'scene');

  verificationItems.forEach((item, index) => {
    if (!isObject(item)) return;
    checkReferences(
      errors,
      item.targetElementIds,
      elementIds,
      `verificationItems[${index}].targetElementIds`,
      'visual element'
    );
  });
  const pendingVerificationTargets = new Set(
    verificationItems
      .filter((item) => isObject(item) && item.status === 'pending')
      .flatMap((item) => asArray(item.targetElementIds))
  );

  captions.forEach((cue, index) => {
    if (!isObject(cue)) return;
    if (Number.isFinite(cue.startMs) && Number.isFinite(cue.endMs)
      && (cue.startMs < 0 || cue.endMs <= cue.startMs)) {
      errors.push(`captions[${index}] timing must have nonnegative startMs and endMs > startMs`);
    }
  });

  semanticUnits.forEach((unit, index) => {
    if (!isObject(unit)) return;
    const path = `semanticUnits[${index}]`;
    checkReferences(errors, unit.sourceCueIds, cueIds, `${path}.sourceCueIds`, 'caption cue');
    if (Number.isFinite(unit.startMs) && Number.isFinite(unit.endMs)
      && unit.endMs <= unit.startMs) {
      errors.push(`${path} timing must have positive duration`);
    }
    const sourceCues = asArray(unit.sourceCueIds).map((id) => cuesById.get(id)).filter(isObject);
    if (sourceCues.length > 0 && Number.isFinite(unit.startMs) && Number.isFinite(unit.endMs)) {
      const envelopeStart = Math.min(...sourceCues.map((cue) => cue.startMs));
      const envelopeEnd = Math.max(...sourceCues.map((cue) => cue.endMs));
      if (unit.startMs < envelopeStart || unit.endMs > envelopeEnd) {
        errors.push(`${path} timing must stay within its source cue envelope ${envelopeStart}-${envelopeEnd}ms`);
      }
    }
  });

  visualElements.forEach((element, index) => {
    if (!isObject(element)) return;
    const path = `visualElements[${index}]`;
    if (element.layer !== 'decorative') {
      if (!isNonEmptyString(element.sourcePhrase)) {
        errors.push(`${path}.sourcePhrase is required for non-decorative elements`);
      }
      if (!isNonEmptyString(element.explanatoryRole)) {
        errors.push(`${path}.explanatoryRole is required for non-decorative elements`);
      }
    }
    checkReferences(errors, element.sceneIds, sceneIds, `${path}.sceneIds`, 'scene');
  });

  const usedElementIds = new Set();
  const usedSceneIdsByElement = new Map();
  const coveredCueIds = new Set();
  scenes.forEach((scene, index) => {
    if (!isObject(scene)) return;
    const path = `scenes[${index}]`;
    if (Number.isInteger(scene.startFrame) && Number.isInteger(scene.endFrame)
      && scene.endFrame <= scene.startFrame) {
      errors.push(`${path} frame range must have positive duration`);
    }
    checkReferences(errors, scene.cueIds, cueIds, `${path}.cueIds`, 'caption cue');
    checkReferences(errors, scene.semanticUnitIds, semanticUnitIds, `${path}.semanticUnitIds`, 'semantic unit');

    for (const semanticUnitId of asArray(scene.semanticUnitIds)) {
      const semanticUnit = semanticUnitsById.get(semanticUnitId);
      if (!isObject(semanticUnit)) continue;
      for (const sourceCueId of asArray(semanticUnit.sourceCueIds)) {
        if (!asArray(scene.cueIds).includes(sourceCueId)) {
          errors.push(`${path}.cueIds must include semantic unit ${String(semanticUnitId)} source cue ${String(sourceCueId)}`);
        }
      }
    }

    const primaryElementIds = asArray(scene.primaryElements);
    const supportingElementIds = asArray(scene.supportingElements);
    if (primaryElementIds.some((elementId) => supportingElementIds.includes(elementId))) {
      errors.push(`${path}.primaryElements and supportingElements must be disjoint`);
    }

    const sceneElementFields = [
      ['primaryElements', primaryElementIds],
      ['supportingElements', supportingElementIds],
      ['continuityAnchor', isNonEmptyString(scene.continuityAnchor) ? [scene.continuityAnchor] : []]
    ];
    for (const [field, refs] of sceneElementFields) {
      checkReferences(errors, refs, elementIds, `${path}.${field}`, 'visual element');
      for (const ref of refs) {
        usedElementIds.add(ref);
        if (!usedSceneIdsByElement.has(ref)) usedSceneIdsByElement.set(ref, new Set());
        usedSceneIdsByElement.get(ref).add(scene.id);
        const element = elementsById.get(ref);
        if (isObject(element) && !asArray(element.sceneIds).includes(scene.id)) {
          errors.push(`visual element ${ref}.sceneIds must include ${scene.id}`);
        }
      }
    }

    for (const ref of asArray(scene.primaryElements)) {
      if (elementsById.get(ref)?.layer === 'decorative') {
        errors.push(`${path}.primaryElements contains decorative element ${ref}`);
      }
    }

    for (const cueId of asArray(scene.cueIds)) {
      coveredCueIds.add(cueId);
      const cue = cuesById.get(cueId);
      if (!isObject(cue) || !Number.isFinite(brief.fps)
        || !Number.isFinite(cue.startMs) || !Number.isFinite(cue.endMs)
        || !Number.isInteger(scene.startFrame) || !Number.isInteger(scene.endFrame)) continue;
      const cueStartFrame = Math.floor(cue.startMs * brief.fps / 1000);
      const cueEndFrame = Math.ceil(cue.endMs * brief.fps / 1000);
      if (cueStartFrame < scene.startFrame || cueEndFrame > scene.endFrame) {
        errors.push(`${path} cue ${cueId} frame interval ${cueStartFrame}-${cueEndFrame} must fit scene ${scene.startFrame}-${scene.endFrame}`);
      }
    }

    for (const reviewFrame of asArray(scene.reviewFrames)) {
      if (Number.isInteger(reviewFrame) && Number.isInteger(scene.startFrame)
        && Number.isInteger(scene.endFrame)
        && (reviewFrame < scene.startFrame || reviewFrame >= scene.endFrame)) {
        errors.push(`${path} reviewFrame ${reviewFrame} must satisfy startFrame <= frame < endFrame`);
      }
    }
  });

  for (let index = 1; index < scenes.length; index += 1) {
    const previous = scenes[index - 1];
    const current = scenes[index];
    if (!isObject(previous) || !isObject(current)
      || !Number.isInteger(previous.startFrame) || !Number.isInteger(previous.endFrame)
      || !Number.isInteger(current.startFrame) || !Number.isInteger(current.endFrame)) continue;
    if (current.startFrame < previous.startFrame) errors.push('scenes must be ordered by startFrame');
    if (current.startFrame < previous.endFrame) errors.push('scenes must not overlap');
  }

  for (const cueId of cueIds) {
    if (!coveredCueIds.has(cueId)) errors.push(`caption cue ${cueId} is not covered by any scene`);
  }

  visualElements.forEach((element) => {
    if (!isObject(element) || !isNonEmptyString(element.id)) return;
    for (const sceneId of asArray(element.sceneIds)) {
      if (sceneIds.has(sceneId) && !usedSceneIdsByElement.get(element.id)?.has(sceneId)) {
        errors.push(`visual element ${element.id}.sceneIds includes unused scene ${sceneId}`);
      }
    }
    if (element.layer !== 'decorative' && !usedElementIds.has(element.id)) {
      errors.push(`unused non-decorative element ${element.id}`);
    }
    if (!usedElementIds.has(element.id)) return;
    if (element.kind === 'formula' || element.kind === 'data') {
      if (element.evidenceStatus === 'pending') {
        const usingSceneIds = [...usedSceneIdsByElement.get(element.id) ?? []];
        let hasNonDraftScene = false;
        for (const sceneId of usingSceneIds) {
          const scene = scenesById.get(sceneId);
          if (isObject(scene) && scene.status !== 'draft') {
            hasNonDraftScene = true;
            errors.push(
              `visual element ${element.id} has pending evidence but is used by ${String(scene.status)} scene ${String(sceneId)}; required verified`
            );
          }
        }
        if (!hasNonDraftScene && !pendingVerificationTargets.has(element.id)) {
          errors.push(
            `visual element ${element.id} has pending draft evidence and requires pending verificationItems targetElementIds linkage`
          );
        }
      } else if (element.evidenceStatus !== 'verified') {
        errors.push(
          `visual element ${element.id} has nonverified evidence: evidenceStatus ${String(element.evidenceStatus)} is invalid for formula/data; required verified or pending in draft scenes`
        );
      }
    }
  });

  const sampleDecision = brief.sampleDecision;
  if (isObject(sampleDecision)) {
    const allowedDeliverables = SAMPLE_DELIVERABLES[sampleDecision.level];
    if (allowedDeliverables && !allowedDeliverables.has(sampleDecision.deliverable)) {
      errors.push(`sampleDecision.deliverable does not match level ${String(sampleDecision.level)}`);
    }
    const criteria = new Set(asArray(sampleDecision.criteria).filter(isNonEmptyString));
    if (sampleDecision.level === 'A'
      && ![...A_RISK_CRITERIA].some((criterion) => criteria.has(criterion))) {
      errors.push('sampleDecision.criteria for level A must include new-topic or unapproved-visual-system');
    }
    if (sampleDecision.level === 'B') {
      if (![...B_RISK_CRITERIA].some((criterion) => criteria.has(criterion))) {
        errors.push('sampleDecision.criteria for level B must include many-new-elements or complex-metaphor');
      }
      if ([...A_RISK_CRITERIA].some((criterion) => criteria.has(criterion))) {
        errors.push('sampleDecision.criteria for level B must exclude new-topic and unapproved-visual-system');
      }
    }
    if (sampleDecision.level === 'C') {
      if (!criteria.has('same-approved-series') || !criteria.has('low-risk-reuse')) {
        errors.push('sampleDecision.criteria for level C must include both same-approved-series and low-risk-reuse');
      }
      if ([...A_RISK_CRITERIA, ...B_RISK_CRITERIA].some((criterion) => criteria.has(criterion))) {
        errors.push('sampleDecision.criteria for level C must exclude all A/B risk criteria');
      }
    }
  }

  return errors;
}

function runCli(argv) {
  const usage = 'Usage: node scripts/validate-brief.mjs <production-brief.json> [--source-root <dir>]';
  if (argv.length === 0) {
    console.error(usage);
    return 1;
  }
  let sourceRoot;
  if (argv.length > 1) {
    if (argv[1] !== '--source-root') {
      console.error(`ERROR unknown option ${String(argv[1])}`);
      console.error(usage);
      return 1;
    }
    if (argv.length < 3 || !isNonEmptyString(argv[2])) {
      console.error('ERROR --source-root requires a directory');
      console.error(usage);
      return 1;
    }
    if (argv.length > 3) {
      console.error(`ERROR unexpected argument ${String(argv[3])}`);
      console.error(usage);
      return 1;
    }
    sourceRoot = argv[2];
  }

  const briefPath = resolve(argv[0]);
  let brief;
  try {
    brief = JSON.parse(readFileSync(briefPath, 'utf8'));
  } catch (error) {
    console.error(`ERROR unable to read production brief: ${error.message}`);
    return 1;
  }

  const errors = validateBrief(brief);
  if (errors.length === 0) errors.push(...verifySourceFiles(brief, { sourceRoot }));
  if (errors.length > 0) {
    for (const error of errors) console.error(`ERROR ${error}`);
    return 1;
  }

  console.log(`PASS production brief ${briefPath}`);
  return 0;
}

const isMain = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) process.exitCode = runCli(process.argv.slice(2));
