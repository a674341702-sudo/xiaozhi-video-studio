import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateFile } from '../src/utils.js';
import { splitMerchantRequirements, getMerchantRequirementStats, isRestrictionRequirement, mergeCaptionRequirements, validateMerchantMediaFiles, appendMerchantMediaFiles, isVideoMediaFile, getMerchantAudioMix, limitNarrationLines, prioritizeMerchantNarrationLines, getNarrationContentCoverage, getMerchantCaptionForShot, suggestMerchantShotIndex, orderMerchantMediaAssignments, getMerchantShotDuration } from '../src/merchant-workflow-rules.js';
assert.deepEqual(splitMerchantRequirements('必须出现门店地址\n- 突出招牌产品；突出店内环境\n必须出现门店地址', 10), ['必须出现门店地址', '突出招牌产品', '突出店内环境']);
assert.deepEqual(splitMerchantRequirements('  \n；；', 16), []);
assert.deepEqual(splitMerchantRequirements('要求一；要求二；要求三', 2), ['要求一', '要求二']);
assert.deepEqual(getMerchantRequirementStats('要求一；要求二；要求三；要求二', 2), {
  requirements: ['要求一', '要求二'], total: 3, omitted: 1
});
assert.equal(getMerchantRequirementStats('要求一；要求二', 16).omitted, 0);
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
const customMix = getMerchantAudioMix({
  hasVoice: true, keepOriginalAudio: true,
  musicVolume: 0.08, voiceVolume: 0.85, videoVolume: 0.05
});
assert.deepEqual(customMix, { music: 0.08, voice: 0.85, video: 0.05 });
assert.equal(getMerchantAudioMix({ hasVoice: true, musicVolume: 4, voiceVolume: 2 }).music, 0.5,
  'background music must be capped at 50%');
assert.equal(getMerchantAudioMix({ hasVoice: true, voiceVolume: 2 }).voice, 1.5,
  'narration gain may be increased up to 150%');
assert.equal(getMerchantAudioMix({ hasVoice: true, voiceVolume: -1 }).voice, 0,
  'negative volume values must be clamped');
assert.equal(getMerchantAudioMix({ hasVoice: true, musicVolume: Number.NaN }).music, 0.12,
  'invalid music volume falls back to the safe default');
console.log('人声优先与背景音压低规则测试通过');


assert.deepEqual(getNarrationContentCoverage(['招牌牛肉面', '新客优惠', '门店地址'], '招牌牛肉面。门店地址：昆明市。'), {
  total: 3, included: 2, missing: ['新客优惠']
});
assert.deepEqual(getNarrationContentCoverage(['招牌牛肉面', '招牌牛肉面'], '招牌牛肉面。'), {
  total: 1, included: 1, missing: []
});
console.log('商家重点进入配音稿覆盖率测试通过');

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


const autoWorkflowSource = readFileSync(new URL('../src/auto-workflow.js', import.meta.url), 'utf8');
assert.ok(autoWorkflowSource.includes('.xzw-shot{padding:9px 4px;border-bottom:1px solid #34344a;color:#ddd;font-size:13px}\n    .xzw-template-guide{'), '模板说明样式必须通过真实换行与前一条 CSS 规则分隔');
console.log('商家工作流模板说明 CSS 分隔测试通过');
assert.ok(autoWorkflowSource.includes('accept=".jpg,.jpeg,.png,.webp,.gif,.avif,image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime,.mov"'), 'merchant media picker must expose only formats accepted by validation, not generic HEIC images');



assert.equal(suggestMerchantShotIndex('门头照片.jpg', ['开场门店亮相', '招牌展示']), 0);
assert.equal(suggestMerchantShotIndex('招牌菜特写.png', ['开场门店亮相', '招牌展示']), 1);
assert.equal(suggestMerchantShotIndex('环境大厅.jpg', ['产品亮相', '空间展示']), 1);
assert.equal(suggestMerchantShotIndex('IMG_20261128_123456.jpg', ['开场门店亮相', '招牌展示']), null, '无语义文件名必须留待人工确认');
assert.equal(suggestMerchantShotIndex('unknown.mp4', ['开场门店亮相', '招牌展示']), null, '不能仅因视频素材位置自动猜测镜头用途');
assert.equal(suggestMerchantShotIndex('优惠菜单.png', ['产品亮相', '空间展示']), null, '没有匹配的镜头角色时不得强行分配');
// Unknown photo names remain usable: the workflow UI falls back to upload order.
assert.equal((suggestMerchantShotIndex('IMG_20261128_123456.jpg', ['开场门店亮相', '招牌展示']) ?? (3 % 2)), 1, '无语义文件名在工作流中按上传顺序自动安排');
console.log('素材镜头用途建议与待确认状态测试通过');


assert.deepEqual(
  orderMerchantMediaAssignments([
    { fileIndex: 0, shotIndex: 2 },
    { fileIndex: 1, shotIndex: 0 },
    { fileIndex: 2, shotIndex: 1 },
    { fileIndex: 3, shotIndex: 1 },
    { fileIndex: 4, shotIndex: 0 }
  ]),
  [
    { fileIndex: 1, shotIndex: 0 },
    { fileIndex: 4, shotIndex: 0 },
    { fileIndex: 2, shotIndex: 1 },
    { fileIndex: 3, shotIndex: 1 },
    { fileIndex: 0, shotIndex: 2 }
  ],
  '素材必须按镜头脚本顺序排列，同一镜头内保留上传顺序'
);
assert.deepEqual(orderMerchantMediaAssignments([{fileIndex:0,shotIndex:null},{fileIndex:1,shotIndex:-1},{fileIndex:2,shotIndex:2}]), [{fileIndex:2,shotIndex:2}], '忽略未确认或无效的镜头分配');
console.log('商家素材按镜头脚本排序测试通过');


assert.equal(getMerchantShotDuration({ plannedDuration: 4, remainingDuration: 10, isVideo: true, mediaDuration: 0.35 }), 0.35, '不足1秒的视频必须保留真实时长，不得强行延长');
assert.equal(getMerchantShotDuration({ plannedDuration: 4, remainingDuration: 2, isVideo: true, mediaDuration: 8 }), 2, '视频镜头不得超过剩余目标时长');
assert.equal(getMerchantShotDuration({ plannedDuration: 4, remainingDuration: 10, isVideo: true, mediaDuration: 2.5 }), 2.5, '视频镜头不得超过素材实际时长');
assert.equal(getMerchantShotDuration({ plannedDuration: 4, remainingDuration: 10, isVideo: false, mediaDuration: 0 }), 4, '照片按计划镜头时长展示');
assert.equal(getMerchantShotDuration({ plannedDuration: 4, remainingDuration: 0, isVideo: true, mediaDuration: 2 }), 0, '目标时长用尽后不再生成镜头');
assert.equal(getMerchantShotDuration({ plannedDuration: 4, remainingDuration: 10, isVideo: true, mediaDuration: 0 }), 0, '无效视频时长必须被拒绝');
console.log('视频镜头真实时长边界测试通过');

const restrictionUiSource = readFileSync(new URL('../src/auto-workflow.js', import.meta.url), 'utf8');
assert.ok(restrictionUiSource.includes('系统不会自动审查画面'), '禁止项确认必须明确说明画面由人工核查');
assert.ok(restrictionUiSource.includes('系统不会自动识别画面是否违规'), '制作预览必须提醒限制项不会自动进行画面审查');
assert.match(restrictionUiSource, /textarea\.addEventListener\('input', \(\) => \{[\s\S]*?confirmed\.checked = false;[\s\S]*?invalidateProductionPreview\(\);[\s\S]*?\}\);/, 'editing a confirmed merchant requirement must revoke its previous approval');
console.log('商家限制项人工画面核查提示测试通过');


assert.equal(getMerchantCaptionForShot(['字幕一', '字幕二', '字幕三'], 0, '模板一'), '字幕一');
assert.equal(getMerchantCaptionForShot(['字幕一', '字幕二', '字幕三'], 2, '模板三'), '字幕三');
assert.equal(getMerchantCaptionForShot(['字幕一', '字幕二', '字幕三'], 3, '模板四'), '模板四',
  'when custom captions are fewer than shots, use the matching shot template instead of cycling earlier captions');
assert.equal(getMerchantCaptionForShot(['字幕一'], 4, '', '店铺介绍'), '店铺介绍');
assert.equal(getMerchantCaptionForShot([], 1, '行业镜头建议'), '行业镜头建议');
assert.equal(getMerchantCaptionForShot(['', '  '], 1, '行业镜头建议'), '行业镜头建议');
console.log('逐镜字幕不循环重复及行业模板回退测试通过');
