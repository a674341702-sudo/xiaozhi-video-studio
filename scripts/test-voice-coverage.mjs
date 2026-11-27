import assert from 'node:assert/strict';
import { getVoiceCoverageNote, getVoiceClipDuration } from '../src/voice-coverage.js';

assert.equal(getVoiceCoverageNote(29.8, 30), '', 'small duration differences should not warn');
assert.equal(getVoiceCoverageNote(20, 30), '配音比视频短约 10.0 秒，结尾可能出现无配音画面；建议补录或缩短成片。');
assert.equal(getVoiceCoverageNote(35, 30), '配音比视频长约 5.0 秒，超出部分不会进入成片。');
assert.equal(getVoiceCoverageNote(0, 30), '');
assert.equal(getVoiceCoverageNote(NaN, 30), '');
assert.equal(getVoiceCoverageNote(30, 0), '');

console.log('voice coverage tests passed');

assert.equal(getVoiceClipDuration(35, 30), 30, 'long narration should stop at the end of the main story');
assert.equal(getVoiceClipDuration(20, 30), 20, 'short narration should keep its original duration');
assert.equal(getVoiceClipDuration(0, 30), 0);
assert.equal(getVoiceClipDuration(30, 0), 0);
