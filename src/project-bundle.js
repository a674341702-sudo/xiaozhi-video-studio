const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const MAX_BUNDLE_SIZE = 1024 * 1024 * 1024;
const MAX_ENTRIES = 501;
const MAX_MEDIA_ENTRIES = MAX_ENTRIES - 1;
const MAX_NAME_BYTES = 512;
const MAX_MANIFEST_SIZE = 5 * 1024 * 1024;
let crcTable;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let k = 0; k < 8; k++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    crcTable[n] = value >>> 0;
  }
  return crcTable;
}

async function crc32Blob(blob) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  if (blob.stream) {
    const reader = blob.stream().getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        for (let i = 0; i < value.length; i++) crc = table[(crc ^ value[i]) & 0xff] ^ (crc >>> 8);
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeHeader(length, fill) {
  const bytes = new Uint8Array(length);
  fill(new DataView(bytes.buffer));
  return bytes;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function isMediaClip(clip) {
  return clip && ['video', 'image', 'audio'].includes(clip.type);
}

function assertSafePath(path) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('\\') || path.includes('\0')) {
    throw new Error('项目包包含不安全的文件路径');
  }
  const segments = path.split('/');
  if (segments.some(part => !part || part === '.' || part === '..')) {
    throw new Error('项目包包含不安全的文件路径');
  }
  if (path !== 'xiaozhi-project.json' && !/^media\/[0-9]{4,}\.bin$/.test(path)) {
    throw new Error('项目包包含不支持的文件路径');
  }
}

export async function createProjectBundle(project, media) {
  if (!project || !Array.isArray(project.clips) || !Array.isArray(media)) {
    throw new Error('项目数据不完整，无法打包');
  }
  if (media.length > MAX_MEDIA_ENTRIES) throw new Error('项目素材数量超过 500 个，暂不支持打包');
  const clipById = new Map();
  for (const clip of project.clips) {
    if (!clip || typeof clip.id !== 'string' || !clip.id || clip.id.length > 256 || clipById.has(clip.id)) {
      throw new Error('项目中存在无效或重复的素材片段编号');
    }
    clipById.set(clip.id, clip);
  }

  const entries = [];
  const mediaManifest = [];
  const includedClipIds = new Set();
  let totalMediaSize = 0;
  for (let index = 0; index < media.length; index++) {
    const item = media[index];
    if (!item || typeof item.clipId !== 'string' || !item.clipId || item.clipId.length > 256) {
      throw new Error('项目素材缺少有效的片段编号');
    }
    if (includedClipIds.has(item.clipId)) throw new Error('项目中存在重复的素材记录');
    const clip = clipById.get(item.clipId);
    if (!isMediaClip(clip)) throw new Error('项目素材无法对应到有效的视频、图片或音频片段');
    if (!(item.blob instanceof Blob)) throw new Error('项目素材文件无法读取：' + (item.name || item.clipId));
    includedClipIds.add(item.clipId);
    totalMediaSize += item.blob.size;
    if (totalMediaSize > MAX_BUNDLE_SIZE) throw new Error('项目素材总量超过 1 GB，暂不支持打包');
    const path = 'media/' + String(index + 1).padStart(4, '0') + '.bin';
    entries.push({ path, blob: item.blob });
    mediaManifest.push({
      clipId: item.clipId,
      path,
      name: typeof item.name === 'string' ? item.name.slice(0, 256) : '素材文件',
      type: typeof item.type === 'string' ? item.type.slice(0, 256) : item.blob.type || 'application/octet-stream'
    });
  }
  for (const clip of project.clips) {
    if (isMediaClip(clip) && !includedClipIds.has(clip.id)) {
      throw new Error('缺少素材文件：' + (clip.name || clip.id) + '。请重新上传原素材后再导出完整项目包');
    }
  }

  const manifest = {
    format: 'xiaozhi-video-project',
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
    media: mediaManifest
  };
  const manifestText = JSON.stringify(manifest);
  if (encoder.encode(manifestText).length > MAX_MANIFEST_SIZE) throw new Error('项目时间线数据过大，无法打包');
  entries.unshift({
    path: 'xiaozhi-project.json',
    blob: new Blob([manifestText], { type: 'application/json' })
  });
  const parts = [];
  const central = [];
  let offset = 0;
  const stamp = dosDateTime();
  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const size = entry.blob.size;
    if (name.length > MAX_NAME_BYTES || size > 0xffffffff || offset > 0xffffffff) {
      throw new Error('单个素材或项目包过大，暂不支持 ZIP64 格式');
    }
    const crc = await crc32Blob(entry.blob);
    const local = makeHeader(30, view => {
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0x0800, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, stamp.time, true);
      view.setUint16(12, stamp.date, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, size, true);
      view.setUint32(22, size, true);
      view.setUint16(26, name.length, true);
      view.setUint16(28, 0, true);
    });
    parts.push(local, name, entry.blob);
    const directory = makeHeader(46, view => {
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, 0x0800, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, stamp.time, true);
      view.setUint16(14, stamp.date, true);
      view.setUint32(16, crc, true);
      view.setUint32(20, size, true);
      view.setUint32(24, size, true);
      view.setUint16(28, name.length, true);
      view.setUint16(30, 0, true);
      view.setUint16(32, 0, true);
      view.setUint16(34, 0, true);
      view.setUint16(36, 0, true);
      view.setUint32(38, 0, true);
      view.setUint32(42, offset, true);
    });
    central.push(directory, name);
    offset += local.length + name.length + size;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  if (offset + centralSize > 0xffffffff) throw new Error('项目包超过 ZIP 标准大小限制');
  const end = makeHeader(22, view => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, entries.length, true);
    view.setUint16(10, entries.length, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, offset, true);
    view.setUint16(20, 0, true);
  });
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

export async function readProjectBundle(file) {
  if (!(file instanceof Blob) || file.size < 22) throw new Error('项目包文件无效或已损坏');
  if (file.size > MAX_BUNDLE_SIZE) throw new Error('项目包超过 1 GB，手机暂不建议导入');
  const tailLength = Math.min(file.size, 65557);
  const tailStart = file.size - tailLength;
  const tail = new DataView(await file.slice(tailStart).arrayBuffer());
  let endOffset = -1;
  for (let offset = tail.byteLength - 22; offset >= 0; offset--) {
    if (tail.getUint32(offset, true) === 0x06054b50) {
      const commentLength = tail.getUint16(offset + 20, true);
      if (offset + 22 + commentLength === tail.byteLength) { endOffset = offset; break; }
    }
  }
  if (endOffset < 0) throw new Error('不是有效的 ZIP 项目包');
  const endAbsoluteOffset = tailStart + endOffset;
  const diskNumber = tail.getUint16(endOffset + 4, true);
  const directoryDisk = tail.getUint16(endOffset + 6, true);
  const diskEntryCount = tail.getUint16(endOffset + 8, true);
  const entryCount = tail.getUint16(endOffset + 10, true);
  const directorySize = tail.getUint32(endOffset + 12, true);
  const directoryOffset = tail.getUint32(endOffset + 16, true);
  if (diskNumber !== 0 || directoryDisk !== 0 || diskEntryCount !== entryCount) {
    throw new Error('项目包不支持分卷或多磁盘 ZIP 格式');
  }
  if (!entryCount || entryCount > MAX_ENTRIES || directoryOffset + directorySize !== endAbsoluteOffset) {
    throw new Error('项目包目录信息不正确');
  }
  if (directorySize > MAX_ENTRIES * (46 + MAX_NAME_BYTES)) throw new Error('项目包目录数据过大');
  const directoryBytes = await file.slice(directoryOffset, directoryOffset + directorySize).arrayBuffer();
  const directory = new DataView(directoryBytes);
  const entries = new Map();
  const localRanges = [];
  let cursor = 0;
  let totalMediaSize = 0;

  for (let index = 0; index < entryCount; index++) {
    if (cursor + 46 > directory.byteLength || directory.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error('项目包目录已损坏');
    }
    const flags = directory.getUint16(cursor + 8, true);
    const method = directory.getUint16(cursor + 10, true);
    const crc = directory.getUint32(cursor + 16, true);
    const compressedSize = directory.getUint32(cursor + 20, true);
    const size = directory.getUint32(cursor + 24, true);
    const nameLength = directory.getUint16(cursor + 28, true);
    const extraLength = directory.getUint16(cursor + 30, true);
    const commentLength = directory.getUint16(cursor + 32, true);
    const localOffset = directory.getUint32(cursor + 42, true);
    const recordLength = 46 + nameLength + extraLength + commentLength;
    if (cursor + recordLength > directory.byteLength || !nameLength || nameLength > MAX_NAME_BYTES || extraLength !== 0 || commentLength !== 0) {
      throw new Error('项目包目录字段长度不正确');
    }
    if (flags !== 0x0800 || method !== 0 || compressedSize !== size) {
      throw new Error('项目包使用了暂不支持的压缩或加密方式');
    }
    let name;
    try {
      name = decoder.decode(new Uint8Array(directory.buffer, directory.byteOffset + cursor + 46, nameLength));
    } catch (_) {
      throw new Error('项目包文件名不是有效的 UTF-8 编码');
    }
    assertSafePath(name);
    if (entries.has(name)) throw new Error('项目包包含重复文件：' + name);
    if (localOffset + 30 > directoryOffset) throw new Error('项目包本地文件头超出范围');
    const localHeaderBytes = await file.slice(localOffset, localOffset + 30).arrayBuffer();
    if (localHeaderBytes.byteLength !== 30) throw new Error('项目包本地文件头不完整');
    const localHeader = new DataView(localHeaderBytes);
    if (localHeader.getUint32(0, true) !== 0x04034b50) throw new Error('项目包素材区已损坏');
    const localFlags = localHeader.getUint16(6, true);
    const localMethod = localHeader.getUint16(8, true);
    const localCrc = localHeader.getUint32(14, true);
    const localCompressedSize = localHeader.getUint32(18, true);
    const localSize = localHeader.getUint32(22, true);
    const localNameLength = localHeader.getUint16(26, true);
    const localExtraLength = localHeader.getUint16(28, true);
    if (localFlags !== flags || localMethod !== method || localCrc !== crc ||
        localCompressedSize !== compressedSize || localSize !== size ||
        localNameLength !== nameLength || localExtraLength !== 0) {
      throw new Error('项目包本地文件头与目录信息不一致');
    }
    const localNameBytes = new Uint8Array(await file.slice(localOffset + 30, localOffset + 30 + localNameLength).arrayBuffer());
    const centralNameBytes = new Uint8Array(directory.buffer, directory.byteOffset + cursor + 46, nameLength);
    if (localNameBytes.length !== nameLength || localNameBytes.some((byte, i) => byte !== centralNameBytes[i])) {
      throw new Error('项目包本地文件名与目录文件名不一致');
    }
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + size;
    if (dataStart < localOffset || dataEnd > directoryOffset || dataEnd < dataStart) {
      throw new Error('项目包素材数据超出范围');
    }
    localRanges.push({ start: localOffset, end: dataEnd });
    const blob = file.slice(dataStart, dataEnd);
    if (await crc32Blob(blob) !== crc) throw new Error('项目包文件校验失败：' + name);
    entries.set(name, blob);
    totalMediaSize += size;
    if (totalMediaSize > MAX_BUNDLE_SIZE) throw new Error('项目包素材总量超过限制');
    cursor += recordLength;
  }
  if (cursor !== directory.byteLength) throw new Error('项目包目录长度与文件记录不一致');
  localRanges.sort((a, b) => a.start - b.start);
  for (let index = 1; index < localRanges.length; index++) {
    if (localRanges[index].start < localRanges[index - 1].end) throw new Error('项目包文件数据区域重叠');
  }

  const manifestBlob = entries.get('xiaozhi-project.json');
  if (!manifestBlob) throw new Error('项目包缺少项目清单');
  if (manifestBlob.size > MAX_MANIFEST_SIZE) throw new Error('项目清单过大，无法安全读取');
  let manifest;
  try {
    manifest = JSON.parse(await manifestBlob.text());
  } catch (_) {
    throw new Error('项目清单不是有效的 JSON 文件');
  }
  if (!manifest || manifest.format !== 'xiaozhi-video-project' || manifest.version !== 1 ||
      !manifest.project || !Array.isArray(manifest.project.clips) ||
      !Array.isArray(manifest.media) || manifest.media.length > MAX_MEDIA_ENTRIES ||
      manifest.project.clips.length > 5000) {
    throw new Error('不支持的项目包格式或项目数据不完整');
  }

  const clipById = new Map();
  for (const clip of manifest.project.clips) {
    if (!clip || typeof clip.id !== 'string' || !clip.id || clip.id.length > 256 || clipById.has(clip.id)) {
      throw new Error('项目清单包含无效或重复的片段编号');
    }
    clipById.set(clip.id, clip);
  }
  const media = [];
  const referencedPaths = new Set(['xiaozhi-project.json']);
  const referencedClipIds = new Set();
  for (const item of manifest.media) {
    if (!item || typeof item.clipId !== 'string' || !item.clipId || item.clipId.length > 256 ||
        typeof item.path !== 'string' || typeof item.name !== 'string' || item.name.length > 256 ||
        typeof item.type !== 'string' || item.type.length > 256) {
      throw new Error('项目清单中的素材信息不完整');
    }
    assertSafePath(item.path);
    if (item.path === 'xiaozhi-project.json' || referencedPaths.has(item.path) || referencedClipIds.has(item.clipId)) {
      throw new Error('项目清单包含重复的素材路径或片段编号');
    }
    if (!isMediaClip(clipById.get(item.clipId))) throw new Error('项目素材无法对应到有效片段：' + item.clipId);
    const blob = entries.get(item.path);
    if (!blob) throw new Error('项目包缺少素材：' + (item.name || item.path));
    referencedPaths.add(item.path);
    referencedClipIds.add(item.clipId);
    media.push({ clipId: item.clipId, name: item.name, type: item.type, blob });
  }
  for (const clip of manifest.project.clips) {
    if (isMediaClip(clip) && !referencedClipIds.has(clip.id)) {
      throw new Error('项目包缺少素材：' + (clip.name || clip.id));
    }
  }
  if (referencedPaths.size !== entries.size) throw new Error('项目包包含未登记的额外文件');
  return { project: manifest.project, media, exportedAt: manifest.exportedAt };
}
