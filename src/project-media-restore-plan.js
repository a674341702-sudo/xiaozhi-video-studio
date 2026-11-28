const MEDIA_TYPES = new Set(['video', 'image', 'audio']);

export function buildProjectMediaRestorePlan(clips, media) {
  if (!Array.isArray(clips) || !Array.isArray(media)) {
    throw new Error('项目素材恢复数据不完整');
  }
  const mediaByClip = new Map();
  for (const item of media) {
    if (!item || typeof item.clipId !== 'string' || !item.clipId) {
      throw new Error('项目素材记录缺少片段编号');
    }
    if (mediaByClip.has(item.clipId)) {
      throw new Error('项目素材记录重复：' + item.clipId);
    }
    mediaByClip.set(item.clipId, item);
  }

  const missingClipIds = [];
  for (const clip of clips) {
    if (!MEDIA_TYPES.has(clip?.type)) continue;
    const item = mediaByClip.get(clip.id);
    if (!item || !(item.blob instanceof Blob) || item.blob.size <= 0) {
      missingClipIds.push(clip.id);
    }
  }
  return { mediaByClip, missingClipIds };
}
