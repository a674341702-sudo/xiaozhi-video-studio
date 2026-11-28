import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/auto-workflow.js', import.meta.url), 'utf8');
const keys = source.indexOf("const profileKeys = ['shop','industry','product','address','offer','copy','brief','style','length','cta'];");
const listeners = source.indexOf('profileKeys.forEach(key => {', keys);
assert.ok(keys >= 0 && listeners > keys, 'merchant profile fields must invalidate a previously approved production preview');
const profileBlock = source.slice(listeners, source.indexOf('const readProfile', listeners));
assert.match(profileBlock, /addEventListener\('input', invalidateProductionPreview\)/);
assert.match(profileBlock, /addEventListener\('change', invalidateProductionPreview\)/);
assert.match(profileBlock, /xzw-captions/);
assert.match(profileBlock, /xzw-narration/);
assert.match(profileBlock, /captionsManuallyEdited = true/);
assert.match(profileBlock, /xzw-requirements/);
assert.match(profileBlock, /xzw-media-map/);
assert.ok(source.includes("$('xzw-industry').addEventListener('change', () => {"));
assert.ok(source.includes('mediaRoleByFile.clear()'));
assert.ok(source.includes('renderMediaMapping()'));
assert.match(profileBlock, /xzw-ratio/);
assert.match(profileBlock, /xzw-branded-outro/);
for (const id of ['xzw-music', 'xzw-voice', 'xzw-original-audio', 'xzw-music-volume', 'xzw-voice-volume', 'xzw-video-volume', 'xzw-export-preset']) {
  assert.match(profileBlock, new RegExp(id), `${id} must invalidate the previous production preview`);
}
console.log('Merchant production preview invalidation tests passed.');

assert.match(source, /let productionGeneration = 0/);
assert.match(source, /productionGeneration \+= 1/);
assert.match(source, /const generationVersion = productionGeneration/);
assert.match(source, /const assertGenerationCurrent = \(\) =>/);
assert.match(source, /制作过程中商家资料或素材发生变化/);
assert.match(source, /await mediaManager\.importFile\(file, \{ startTime: cursor \}\);\s*assertGenerationCurrent\(\)/);
assert.match(source, /await createDefaultMusicFile\(\);\s*assertGenerationCurrent\(\)/);
assert.match(source, /await mediaManager\.importFile\(musicFile, \{ startTime: 0, trackIndex: 4 \}\);\s*assertGenerationCurrent\(\)/);
assert.match(source, /await mediaManager\.importFile\(voiceFile, \{ startTime: 0, trackIndex: 5 \}\);\s*assertGenerationCurrent\(\)/);

const closeWorkflowStart = source.indexOf('const closeWorkflow = () => {');
const closeWorkflowEnd = source.indexOf('launcher.addEventListener', closeWorkflowStart);
assert.ok(closeWorkflowStart >= 0 && closeWorkflowEnd > closeWorkflowStart);
assert.match(source.slice(closeWorkflowStart, closeWorkflowEnd), /invalidateProductionPreview\(\)/,
  'closing the merchant workflow must invalidate an in-flight async production attempt');
const briefImportStart = source.indexOf("$('xzw-brief-file').addEventListener('change', async () => {");
const briefImportEnd = source.indexOf('function getMerchantContentPoints', briefImportStart);
assert.ok(briefImportStart >= 0 && briefImportEnd > briefImportStart);
assert.match(source.slice(briefImportStart, briefImportEnd), /if \(!file\) return;\s*\/\/[\s\S]*?invalidateProductionPreview\(\)/,
  'selecting a brief document must invalidate an old run before asynchronous extraction');
const voiceReceiveStart = source.indexOf('pendingVoiceFile = file;');
const voiceReceiveEnd = source.indexOf("const profileKeys", voiceReceiveStart);
assert.ok(voiceReceiveStart >= 0 && voiceReceiveEnd > voiceReceiveStart);
const voiceReceiveBlock = source.slice(voiceReceiveStart, voiceReceiveEnd);
assert.match(voiceReceiveBlock, /invalidateProductionPreview\(\)/,
  'receiving generated voice must invalidate the previous production inputs');
assert.match(voiceReceiveBlock, /if \(\$\('xzw-generate'\)\.disabled\)/,
  'voice received during arrangement must be queued instead of importing into a partial timeline');
assert.match(voiceReceiveBlock, /当前编排已停止/);

const musicFallbackStart = source.indexOf("} catch (musicError) {");
const musicFallbackEnd = source.indexOf("\n        }", musicFallbackStart);
assert.ok(musicFallbackStart >= 0 && musicFallbackEnd > musicFallbackStart,
  'default music fallback must have a guarded error handler');
assert.match(source.slice(musicFallbackStart, musicFallbackEnd),
  /if \(generationVersion !== productionGeneration\) throw musicError/,
  'a stale generation error must not be swallowed as an optional background-music failure');

const ttsImportStart = source.indexOf("const voiceGeneration = productionGeneration;");
const ttsImportEnd = source.indexOf("const profileKeys", ttsImportStart);
assert.ok(ttsImportStart >= 0 && ttsImportEnd > ttsImportStart,
  'direct TTS voice import must capture a generation token');
const ttsImportBlock = source.slice(ttsImportStart, ttsImportEnd);
assert.ok(ttsImportBlock.includes("await mediaManager.importFile(file, { startTime: 0, trackIndex: 5 });"),
  'direct TTS voice import must use the expected audio track');
assert.ok(ttsImportBlock.includes("if (voiceGeneration !== productionGeneration)"),
  'a voice import completing after workflow invalidation must be rejected');
assert.ok(ttsImportBlock.includes("composition.removeClip(voice.id)"),
  'a stale imported voice clip must be removed from the timeline');
assert.ok(ttsImportBlock.includes("pendingVoiceFile = file;"),
  'a stale voice import must remain queued for the next valid arrangement');
