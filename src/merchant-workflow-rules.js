/**
 * Pure helpers for merchant brief parsing and production constraints.
 * These rules are intentionally conservative and require human confirmation.
 */
export function splitMerchantRequirements(source, limit = 16) {
  const lines = String(source || '')
    .split(/\r?\n|[。；;]+/)
    .map(line => line.replace(/^\s*(?:[-*•]|\d+[.、）)])\s*/, '').trim())
    .filter(line => line.length >= 3);
  return [...new Set(lines)].slice(0, Math.max(1, Number(limit) || 16));
}

export function isRestrictionRequirement(text) {
  return /不要|禁止|不得|不能|严禁|避免|不可|勿用|不允许/.test(String(text || ''));
}

/**
 * Merge merchant requirements into a shot caption without repeating text that
 * is already present. Ignore whitespace and common punctuation for matching,
 * but preserve the original wording in the final caption.
 */
export function mergeCaptionRequirements(baseCaption, requirements = []) {
  const base = String(baseCaption || '').trim();
  const normalize = value => String(value || '')
    .replace(/[\s，。！？、；：,.!?;:（）()【】《》“”"'‘’·…—_-]+/g, '')
    .toLocaleLowerCase();
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
 * Validate uploaded merchant media against the first-version mobile limits.
 * Keep this independent from browser APIs so the rules can be unit-tested.
 */
export function validateMerchantMediaFiles(files, options = {}) {
  const maxFiles = Number(options.maxFiles) || 8;
  const maxVideoBytes = Number(options.maxVideoBytes) || 40 * 1024 * 1024;
  const list = Array.from(files || []);
  if (!list.length) return { valid: true, files: list };
  if (list.length > maxFiles) {
    return { valid: false, message: `一次最多选择 ${maxFiles} 个素材，你选择了 ${list.length} 个。请分批选择。` };
  }
  const allowedImage = /^(image\\/(jpeg|png|webp|gif|avif))$/i;
  const allowedVideo = /^(video\\/(mp4|webm|quicktime))$/i;
  const extension = name => String(name || '').split('.').pop().toLowerCase();
  for (const file of list) {
    const ext = extension(file.name);
    const imageByExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext);
    const videoByExt = ['mp4', 'webm', 'mov'].includes(ext);
    const isImage = allowedImage.test(file.type || '') || (!file.type && imageByExt);
    const isVideo = allowedVideo.test(file.type || '') || (!file.type && videoByExt);
    if (!isImage && !isVideo) {
      return { valid: false, message: `“${file.name || '未命名文件'}”格式暂不支持。请使用 JPG、PNG、WEBP 图片或 MP4、WEBM、MOV 视频。` };
    }
    if (isVideo && file.size > maxVideoBytes) {
      return { valid: false, message: `视频“${file.name}”超过40MB。请先压缩视频，或换一段较短的视频。` };
    }
  }
  return { valid: true, files: list };
}
