/**
 * Prevent autosave from silently replacing a recoverable project with one
 * whose media Blobs could not be captured from the editor or previous save.
 */
const MEDIA_TYPES = new Set(['video', 'image', 'audio']);

export function assertProjectMediaComplete(project, media) {
  if (!project || !Array.isArray(project.clips) || !Array.isArray(media)) {
    throw new Error('项目数据不完整，无法安全保存');
  }
  const clips = project.clips.filter(clip => MEDIA_TYPES.has(clip?.type));
  const mediaByClip = new Map();
  for (const item of media) {
    if (!item || typeof item.clipId !== 'string' || !item.clipId ||
        !(item.blob instanceof Blob) || item.blob.size <= 0 ||
        mediaByClip.has(item.clipId)) {
      throw new Error('项目素材记录无效，已取消保存以保护原项目');
    }
    mediaByClip.set(item.clipId, item);
  }
  for (const clip of clips) {
    if (!clip?.id || !mediaByClip.has(clip.id)) {
      throw new Error('素材“' + (clip?.name || clip?.id || '未命名') +
        '”暂时无法读取，已取消自动保存，避免覆盖原项目。请重新选择该素材后再保存');
    }
  }
  if (mediaByClip.size !== clips.length) {
    throw new Error('项目素材与时间线不匹配，已取消保存以保护原项目');
  }
  return true;
}
