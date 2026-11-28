import assert from 'node:assert/strict';
import { validateFile } from '../src/utils.js';
import { splitMerchantRequirements, isRestrictionRequirement, mergeCaptionRequirements, validateMerchantMediaFiles, appendMerchantMediaFiles, isVideoMediaFile, getMerchantAudioMix, limitNarrationLines, prioritizeMerchantNarrationLines } from '../src/merchant-workflow-rules.js';
assert.deepEqual(splitMerchantRequirements('必须出现门店地址\n- 突出招牌产品；突出店内环境\n必须出现门店地址', 10), ['必须出现门店地址', '突出招牌产品', '突出店内环境']);
assert.deepEqual(splitMerchantRequirements('  \n；；', 16), []);
assert.deepEqual(splitMerchantRequirements('要求一；要求二；要求三', 2), ['要求一', '要求二']);
assert.equal(isRestrictionRequirement('不要出现其他品牌'), true);
assert.equal(isRestrictionRequirement('禁止使用未经授权的音乐'), true);
assert.equal(isRestrictionRequirement('重点突出招牌产品'), false);
console.log('商家需求拆解与禁止项规则测试通过');
assert.equal(mergeCaptionRequirements('招牌牛肉面，香气十足！', ['招牌牛肉面香气十足', '到店尝鲜']), '招牌牛肉面，香气十足！ · 到店尝鲜');
assert.equal(mergeCaptionRequirements('到店体验 · 环境舒适', ['环境舒适', '环境舒适', '']), '到店体验 · 环境舒适');
assert.equal(mergeCaptionRequirements('', ['门店地址']), '门店地址');
console.log('字幕要求去重测试通过');
const fakeFile = (name, type, size = 1024) => ({ name, type, size });
assert.equal(validateMerchantMediaFiles([fakeFile('店面.jpg', 'image/jpeg')]).valid, true);
assert.equal(validateMerchantMediaFiles([fakeFile('视频.mp4', 'video/mp4')]).valid, true);
assert.equal(validateMerchantMediaFiles([fakeFile('安卓照片.jpg', 'application/octet-stream')]).valid, true);
assert.equal(validateMerchantMediaFiles([fakeFile('安卓视频.mp4', '')]).valid, true);
assert.equal(validateMerchantMediaFiles([fakeFile('大视频.mp4', 'video/mp4', 41 * 1024 * 1024)]).valid, false);
assert.equal(validateMerchantMediaFiles([fakeFile('未知.heic', 'image/heic')]).valid, false);
assert.equal(validateMerchantMediaFiles(Array.from({ length: 9 }, (_, i) => fakeFile(i + '.jpg', 'image/jpeg'))).valid, false);
assert.equal(validateMerchantMediaFiles([
  fakeFile('一.mp4', 'video/mp4', 40 * 1024 * 1024),
  fakeFile('二.mp4', 'video/mp4', 40 * 1024 * 1024),
  fakeFile('三.mp4', 'video/mp4', 40 * 1024 * 1024),
  fakeFile('四.mp4', 'video/mp4', 40 * 1024 * 1024),
  fakeFile('五.mp4', 'video/mp4', 1)
]).valid, false);
console.log('手机素材上传限制测试通过');


const existingBatch = [
  { name: '门头.jpg', type: 'image/jpeg', size: 100, lastModified: 1 },
  { name: '环境.mp4', type: 'video/mp4', size: 200, lastModified: 2 }
];
const appended = appendMerchantMediaFiles(existingBatch, [
  { name: '环境.mp4', type: 'video/mp4', size: 200, lastModified: 2 },
  { name: '菜品.jpg', type: 'image/jpeg', size: 300, lastModified: 3 }
]);
assert.equal(appended.valid, true);
assert.equal(appended.files.length, 3);
assert.equal(appended.addedCount, 1);
assert.equal(appended.duplicateCount, 1);
const rejectedAppend = appendMerchantMediaFiles(existingBatch, Array.from({ length: 7 }, (_, i) => ({
  name: '追加' + i + '.jpg', type: 'image/jpeg', size: 100, lastModified: i + 10
})));
assert.equal(rejectedAppend.valid, false);
assert.equal(rejectedAppend.files.length, 2, '追加失败时必须保留原素材');
console.log('分批追加素材与重复文件保护测试通过');


assert.equal(isVideoMediaFile({ name: '现场.mp4', type: '' }), true);
assert.equal(isVideoMediaFile({ name: '现场.mov', type: 'application/octet-stream' }), true);
assert.equal(isVideoMediaFile({ name: '现场.webm', type: 'video/webm' }), true);
assert.equal(isVideoMediaFile({ name: '门头.jpg', type: 'application/octet-stream' }), false);
assert.equal(isVideoMediaFile({ name: '门头.png', type: 'image/png' }), false);
console.log('安卓通用 MIME 视频识别测试通过');

assert.equal(validateFile(fakeFile('现代格式.avif', 'image/avif'), 'image').valid, true);
assert.equal(validateFile(fakeFile('安卓 AVIF.avif', 'application/octet-stream'), 'image').valid, true);
assert.equal(validateFile(fakeFile('不支持.heic', 'image/heic'), 'image').valid, false);
console.log('素材上传格式与编辑器导入格式一致性测试通过');

const voiceMix = getMerchantAudioMix({ hasVoice: true, keepOriginalAudio: true });
assert.equal(voiceMix.voice, 1);
assert.equal(voiceMix.music, 0.12);
assert.equal(voiceMix.video, 0.12);
const musicOnlyMix = getMerchantAudioMix({ hasVoice: false, keepOriginalAudio: false });
assert.equal(musicOnlyMix.music, 0.22);
assert.equal(musicOnlyMix.video, 0);
const cameraAudioMix = getMerchantAudioMix({ hasVoice: false, keepOriginalAudio: true });
assert.equal(cameraAudioMix.video, 0.7);
console.log('人声优先与背景音压低规则测试通过');


const shortNarration = limitNarrationLines(['今天带你了解这家门店。', '主打产品真实展示。'], 40);
assert.equal(shortNarration.text, '今天带你了解这家门店。\n主打产品真实展示。');
assert.equal(shortNarration.omittedLines, 0);
assert.equal(shortNarration.truncated, false);
const longNarration = limitNarrationLines(['开场介绍。', '甲'.repeat(40), '后续活动信息。'], 24);
assert.ok(longNarration.text.length <= 24, '移动端配音草稿必须受长度上限约束');
assert.equal(longNarration.truncated, true, '超长单条内容必须显式标记截断');
assert.equal(longNarration.omittedLines, 1, '未放入旁白的后续内容必须计数');
assert.ok(longNarration.text.endsWith('…'));
const overflowNarration = limitNarrationLines(['开场。', '第二条。', '第三条。'], 4);
assert.ok(overflowNarration.text.length <= 4);
assert.equal(overflowNarration.omittedLines, 2);
const emptyNarration = limitNarrationLines([], 480);
assert.deepEqual(emptyNarration, { lines: [], text: '', truncated: false, omittedLines: 0, totalLines: 0 });
console.log('手机配音文案长度与遗漏提示测试通过');


const prioritizedLines = prioritizeMerchantNarrationLines({
  intro: '开场介绍。',
  product: '招牌产品。',
  offer: '商家提供的活动信息：限时套餐。',
  address: '门店地址：昆明市五华区。',
  contentPoints: Array.from({ length: 12 }, (_, index) => '补充卖点' + index),
  disclaimer: '请以商家实际说明为准。'
});
assert.equal(prioritizedLines[2], '商家提供的活动信息：限时套餐。');
assert.equal(prioritizedLines[3], '门店地址：昆明市五华区。');
const prioritizedDraft = limitNarrationLines(prioritizedLines, 90);
assert.ok(prioritizedDraft.text.includes('限时套餐'), '字数受限时应优先保留商家活动');
assert.ok(prioritizedDraft.text.includes('昆明市五华区'), '字数受限时应优先保留门店地址');
assert.ok(!prioritizedDraft.text.includes('补充卖点11'), '超长时应先省略靠后的补充卖点');
console.log('商家活动与地址优先保留测试通过');
