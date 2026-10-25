import {readFile, writeFile} from 'node:fs/promises';
import {parseSrt} from '@remotion/captions';

const input = await readFile(new URL('../input.srt', import.meta.url), 'utf8');
const {captions} = parseSrt({input});
if (captions.length !== 6 || captions.some(cue => cue.startMs < 0 || cue.endMs <= cue.startMs || cue.endMs > 24000)) {
  throw new Error('The synthetic 24-second example must have six valid caption cues. Update this contract when changing its script.');
}
await writeFile(new URL('../src/captions.json', import.meta.url), `${JSON.stringify(captions, null, 2)}\n`);
console.log(`Prepared ${captions.length} synthetic SRT cues.`);
