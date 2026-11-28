/**
 * Pure helpers for merchant brief parsing and production constraints.
 */
export function splitMerchantRequirements(source, limit = 16) {
  const lines = String(source || '').split(/\r?\n|[。；;]+/)
    .map(line => line.replace(/^\s*(?:[-*•]|\d+[.、）)])\s*/, '').trim())
    .filter(line => line.length >= 3);
  return [...new Set(lines)].slice(0, Math.max(1, Number(limit) || 16));
}
export function isRestrictionRequirement(text) {
  return /不要|禁止|不得|不能|严禁|避免|不可|勿用|不允许/.test(String(text || ''));
}
export function mergeCaptionRequirements(baseCaption, requirements = []) {
  const base = String(baseCaption || '').trim();
  const normalize = value => String(value || '').replace(/[\s，。！？、；：,.!?;:（）()【】《》“”"'‘’·…—_-]+/g, '').toLocaleLowerCase();
  const normalizedBase = normalize(base);
  const additions = [];
  const seen = new Set();
  for (const item of requirements) {
    const text = String(item || '').trim();
    const key = normalize(text);
    if (!key || seen.has(key) || normalizedBase.includes(key)) continue;
    seen.add(key);
    additions.push(text);
  }
  return [base, ...additions].filter(Boolean).join(' · ');
}
/**
 * Validate mobile uploads before replacing the current selected media.
 * MIME types are preferred; known extensions are a fallback for Android
 * pickers that report an empty or generic application/octet-stream type.
 */
export function validateMerchantMediaFiles(files, options = {}) {
  const maxFiles = Number(options.maxFiles) || 8;
  const maxVideoBytes = Number(options.maxVideoBytes) || 40 * 1024 * 1024;
  const maxTotalBytes = Number(options.maxTotalBytes) || 160 * 1024 * 1024;
  const list = Array.from(files || []);
  if (!list.length) return { valid: true, files: list };
  if (list.length > maxFiles) {
    return { valid: false, message: '一次最多选择 ' + maxFiles + ' 个素材，你选择了 ' + list.length + ' 个。请分批选择。' };
  }
  const extension = name => String(name || '').split('.').pop().toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];
  const videoExts = ['mp4', 'webm', 'mov'];
  let totalBytes = 0;
  for (const file of list) {
    const ext = extension(file.name);
    const type = String(file.type || '').toLowerCase();
    const imageByType = /^image\/(jpeg|png|webp|gif|avif)$/.test(type);
    const videoByType = /^video\/(mp4|webm|quicktime)$/.test(type);
    const genericType = !type || type === 'application/octet-stream' || type === 'binary/octet-stream';
    const isImage = imageByType || (imageExts.includes(ext) && genericType);
    const isVideo = videoByType || (videoExts.includes(ext) && genericType);
    if (!isImage && !isVideo) {
      return { valid: false, message: '“' + (file.name || '未命名文件') + '”格式暂不支持。请使用 JPG、PNG、WEBP 图片或 MP4、WEBM、MOV 视频。' };
    }
    if (isVideo && file.size > maxVideoBytes) {
      return { valid: false, message: '视频“' + file.name + '”超过40MB。请先压缩视频，或换一段较短的视频。' };
    }
    totalBytes += Number(file.size) || 0;
  }
  if (totalBytes > maxTotalBytes) {
    return { valid: false, message: '本次素材总量超过160MB。请减少素材数量或压缩较大的文件，避免手机内存不足。' };
  }
  return { valid: true, files: list };
}


/**
 * Append newly selected mobile files without discarding existing media.
 * Re-selecting the same file is ignored using its stable picker metadata.
 */
export function appendMerchantMediaFiles(existingFiles = [], incomingFiles = [], options = {}) {
  const existing = Array.from(existingFiles || []);
  const incoming = Array.from(incomingFiles || []);
  const signature = file => [file.name || '', Number(file.size) || 0, Number(file.lastModified) || 0].join('::');
  const seen = new Set(existing.map(signature));
  const additions = [];
  for (const file of incoming) {
    const key = signature(file);
    if (seen.has(key)) continue;
    seen.add(key);
    additions.push(file);
  }
  const combined = [...existing, ...additions];
  const validation = validateMerchantMediaFiles(combined, options);
  if (!validation.valid) return { ...validation, files: existing, addedCount: 0, duplicateCount: incoming.length - additions.length };
  return {
    valid: true,
    files: combined,
    addedCount: additions.length,
    duplicateCount: incoming.length - additions.length
  };
}


/** Identify video files even when Android supplies an empty/generic MIME type. */
export function isVideoMediaFile(file) {
  const type = String(file?.type || '').toLowerCase();
  const extension = String(file?.name || '').split('.').pop().toLowerCase();
  return type.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(extension);
}


/**
 * Keep narration intelligible by ducking music and camera audio whenever
 * a voice track is present. Values are normalized 0..1 timeline gains.
 */
export function getMerchantAudioMix({ hasVoice = false, keepOriginalAudio = false } = {}) {
  return {
    video: keepOriginalAudio ? (hasVoice ? 0.12 : 0.7) : 0,
    music: hasVoice ? 0.12 : 0.22,
    voice: 1
  };
}


/**
 * Keep generated narration within the mobile TTS lab's 500-character limit.
 * Any omitted details remain in the merchant brief and shot checklist; they
 * are never silently represented as spoken narration.
 */
export function limitNarrationLines(lines = [], maxChars = 480) {
  const source = Array.from(lines || []).map(line => String(line || '').trim()).filter(Boolean);
  const limit = Math.max(1, Math.floor(Number(maxChars) || 480));
  const result = [];
  let used = 0;
  let truncated = false;
  let omittedLines = 0;

  for (let index = 0; index < source.length; index++) {
    const line = source[index];
    const separatorCost = result.length ? 1 : 0;
    const remaining = limit - used - separatorCost;
    if (line.length <= remaining) {
      result.push(line);
      used += separatorCost + line.length;
      continue;
    }
    if (remaining >= 2) {
      result.push(Array.from(line).slice(0, remaining - 1).join('') + '…');
      truncated = true;
    } else {
      omittedLines = source.length - index;
    }
    if (truncated) omittedLines += source.length - index - 1;
    break;
  }

  return { lines: result, text: result.join('\n'), truncated, omittedLines, totalLines: source.length };
}


/**
 * Order the most decision-critical merchant facts before optional supporting
 * copy so a mobile TTS length cap is less likely to remove the offer or address.
 */
export function prioritizeMerchantNarrationLines({
  intro = '',
  product = '',
  offer = '',
  address = '',
  contentPoints = [],
  disclaimer = ''
} = {}) {
  return [
    intro,
    product,
    offer,
    address,
    ...Array.from(contentPoints || []).map(point => {
      const text = String(point || '').trim();
      return text && !/[。！？!?]$/.test(text) ? text + '。' : text;
    }),
    disclaimer
  ].map(line => String(line || '').trim()).filter(Boolean);
}


/**
 * Suggest a shot only when the filename contains a recognizable hint.
 * Unknown filenames must remain unassigned for explicit human confirmation.
 */
export function suggestMerchantShotIndex(fileName, planRoles = []) {
  const name = String(fileName || '').toLowerCase();
  const rules = [
    [/菜品|招牌菜|餐饮|餐品|产品|商品|主打|特写/, /招牌展示|产品亮相|核心产品|核心细节|服务项目/],
    [/门头|招牌|外观|入口|店面|logo/, /开场|门店亮相|外观位置|空间展示|氛围开场/],
    [/环境|大厅|房间|装修|内景|店内/, /环境|空间|房间全景|公共空间/],
    [/制作|过程|操作|服务|体验/, /制作过程|服务过程|操作细节|现场过程/],
    [/价格|菜单|优惠|活动|套餐/, /活动信息|消费信息|规格展示/],
    [/地址|定位|地图|交通|电话/, /到店引导|预约引导|购买引导|预订引导/]
  ];
  const roles = Array.from(planRoles || []).map(role => typeof role === 'string' ? role : String(role?.role || ''));
  for (const [filePattern, rolePattern] of rules) {
    if (!filePattern.test(name)) continue;
    const index = roles.findIndex(role => rolePattern.test(role));
    if (index >= 0) return index;
  }
  return null;
}


/**
 * Order confirmed media assignments by the shot plan, preserving upload order
 * for multiple files assigned to the same shot.
 */
export function orderMerchantMediaAssignments(assignments = []) {
  return Array.from(assignments || [])
    .filter(item => item && Number.isInteger(item.fileIndex) && Number.isInteger(item.shotIndex) && item.shotIndex >= 0)
    .sort((a, b) => a.shotIndex - b.shotIndex || a.fileIndex - b.fileIndex);
}
