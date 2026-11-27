export const MAX_PROJECT_DOCUMENT_BYTES = 5 * 1024 * 1024;

const CLIP_TYPES = new Set(['video', 'image', 'text', 'audio']);
const TRACK_TYPES = new Set(['video', 'image', 'text', 'audio']);
const MAX_CLIPS = 5000;
const MAX_TRACKS = 30;
const MAX_PROJECT_SECONDS = 24 * 60 * 60;

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validate and sanitize a JSON project before it reaches DOM, media elements,
 * or the timeline renderer. JSON projects contain editing metadata only:
 * external/blob media URLs and custom font data are never trusted on import.
 */
export function sanitizeProjectDocument(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('项目文件格式不正确');
  }
  if (!isFiniteNumber(data.width) || !isFiniteNumber(data.height) ||
      data.width < 100 || data.width > 7680 ||
      data.height < 100 || data.height > 7680) {
    throw new Error('项目画布尺寸无效（应在100至7680像素之间）');
  }
  if (!Array.isArray(data.clips) || data.clips.length > MAX_CLIPS) {
    throw new Error('项目片段数量无效，最多支持5000个片段');
  }

  let tracks = null;
  const trackIds = new Set();
  if (data.tracks !== undefined && data.tracks !== null) {
    if (!Array.isArray(data.tracks) || data.tracks.length > MAX_TRACKS) {
      throw new Error('项目轨道数据无效或数量过多');
    }
    tracks = data.tracks.map(track => {
      if (!track || typeof track !== 'object' ||
          typeof track.id !== 'string' || !track.id || track.id.length > 128 ||
          trackIds.has(track.id) || !TRACK_TYPES.has(track.type) ||
          typeof track.name !== 'string' || track.name.length > 256) {
        throw new Error('项目包含无效或重复的轨道信息');
      }
      trackIds.add(track.id);
      return {
        id: track.id,
        type: track.type,
        name: track.name,
        locked: track.locked === true,
        muted: track.muted === true,
        visible: track.visible !== false
      };
    });
  }

  const clipIds = new Set();
  const clips = data.clips.map(clip => {
    if (!clip || typeof clip !== 'object' ||
        typeof clip.id !== 'string' || !clip.id || clip.id.length > 256 ||
        clipIds.has(clip.id) || !CLIP_TYPES.has(clip.type) ||
        typeof clip.trackId !== 'string' || !clip.trackId || clip.trackId.length > 128 ||
        (tracks && !trackIds.has(clip.trackId)) ||
        !isFiniteNumber(clip.startTime) || clip.startTime < 0 || clip.startTime > MAX_PROJECT_SECONDS ||
        !isFiniteNumber(clip.duration) || clip.duration <= 0 || clip.duration > MAX_PROJECT_SECONDS) {
      throw new Error('项目包含无效的片段编号、类型、轨道或时间信息');
    }
    if (clip.name !== undefined && (typeof clip.name !== 'string' || clip.name.length > 512)) {
      throw new Error('项目素材名称过长或格式不正确');
    }
    if (clip.text !== undefined && (typeof clip.text !== 'string' || clip.text.length > 10000)) {
      throw new Error('项目文字内容过长或格式不正确');
    }

    for (const property of ['x', 'y', 'width', 'height', 'opacity', 'volume', 'fontSize', 'trimStart', 'trimEnd']) {
      if (clip[property] !== undefined && clip[property] !== null &&
          (!isFiniteNumber(clip[property]) || Math.abs(clip[property]) > 1000000)) {
        throw new Error('项目包含无效的素材参数：' + property);
      }
    }
    if (clip.opacity !== undefined && (clip.opacity < 0 || clip.opacity > 1)) {
      throw new Error('项目素材透明度参数无效');
    }
    if (clip.volume !== undefined && (clip.volume < 0 || clip.volume > 4)) {
      throw new Error('项目素材音量参数无效');
    }

    clipIds.add(clip.id);
    const safeClip = { ...clip };
    // A standalone JSON project does not embed the original file. Never fetch
    // attacker-controlled URLs when opening a project document.
    safeClip.src = null;
    safeClip.proxySrc = null;
    safeClip.customFontUrl = null;
    delete safeClip.element;
    delete safeClip.file;
    return safeClip;
  });

  const selectedClipId = typeof data.selectedClipId === 'string' && clipIds.has(data.selectedClipId)
    ? data.selectedClipId
    : null;

  return {
    ...data,
    name: typeof data.name === 'string' ? data.name.slice(0, 256) : '小智视频项目',
    width: data.width,
    height: data.height,
    ...(tracks ? { tracks } : {}),
    clips,
    selectedClipId
  };
}
