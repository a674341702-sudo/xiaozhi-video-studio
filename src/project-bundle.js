const encoder = new TextEncoder();
const decoder = new TextDecoder();
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

export async function createProjectBundle(project, media) {
  const entries = [];
  const mediaManifest = [];
  for (let index = 0; index < media.length; index++) {
    const item = media[index];
    if (!(item.blob instanceof Blob)) continue;
    const path = 'media/' + String(index + 1).padStart(4, '0') + '.bin';
    entries.push({ path, blob: item.blob });
    mediaManifest.push({
      clipId: item.clipId,
      path,
      name: item.name || '素材文件',
      type: item.type || item.blob.type || 'application/octet-stream'
    });
  }
  const manifest = {
    format: 'xiaozhi-video-project',
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
    media: mediaManifest
  };
  entries.unshift({
    path: 'xiaozhi-project.json',
    blob: new Blob([JSON.stringify(manifest)], { type: 'application/json' })
  });
  if (entries.length > 65535) throw new Error('项目包含的文件数量过多，无法打包');
  const parts = [];
  const central = [];
  let offset = 0;
  const stamp = dosDateTime();
  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const size = entry.blob.size;
    if (size > 0xffffffff || offset > 0xffffffff) throw new Error('单个素材或项目包过大，暂不支持 ZIP64 格式');
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
  if (file.size > 1024 * 1024 * 1024) throw new Error('项目包超过 1 GB，手机暂不建议导入');
  const tailLength = Math.min(file.size, 65557);
  const tail = new DataView(await file.slice(file.size - tailLength).arrayBuffer());
  let endOffset = -1;
  for (let offset = tail.byteLength - 22; offset >= Math.max(0, tail.byteLength - 65557); offset--) {
    if (tail.getUint32(offset, true) === 0x06054b50) { endOffset = offset; break; }
  }
  if (endOffset < 0) throw new Error('不是有效的 ZIP 项目包');
  const entryCount = tail.getUint16(endOffset + 10, true);
  const directorySize = tail.getUint32(endOffset + 12, true);
  const directoryOffset = tail.getUint32(endOffset + 16, true);
  if (!entryCount || entryCount > 501 || directoryOffset + directorySize > file.size) throw new Error('项目包目录信息不正确');
  const directory = new DataView(await file.slice(directoryOffset, directoryOffset + directorySize).arrayBuffer());
  const entries = new Map();
  let cursor = 0;
  for (let index = 0; index < entryCount; index++) {
    if (directory.getUint32(cursor, true) !== 0x02014b50) throw new Error('项目包目录已损坏');
    const method = directory.getUint16(cursor + 10, true);
    const crc = directory.getUint32(cursor + 16, true);
    const compressedSize = directory.getUint32(cursor + 20, true);
    const size = directory.getUint32(cursor + 24, true);
    const nameLength = directory.getUint16(cursor + 28, true);
    const extraLength = directory.getUint16(cursor + 30, true);
    const commentLength = directory.getUint16(cursor + 32, true);
    const localOffset = directory.getUint32(cursor + 42, true);
    const name = decoder.decode(new Uint8Array(directory.buffer, directory.byteOffset + cursor + 46, nameLength));
    if (method !== 0 || compressedSize !== size) throw new Error('项目包使用了暂不支持的压缩方式');
    if (name.startsWith('/') || name.includes('..')) throw new Error('项目包包含不安全的文件路径');
    const localHeader = new DataView(await file.slice(localOffset, localOffset + 30).arrayBuffer());
    if (localHeader.getUint32(0, true) !== 0x04034b50) throw new Error('项目包素材区已损坏');
    const localNameLength = localHeader.getUint16(26, true);
    const localExtraLength = localHeader.getUint16(28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    if (dataStart + size > directoryOffset) throw new Error('项目包素材数据超出范围');
    const blob = file.slice(dataStart, dataStart + size);
    if (await crc32Blob(blob) !== crc) throw new Error('项目包文件校验失败：' + name);
    entries.set(name, blob);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  const manifestBlob = entries.get('xiaozhi-project.json');
  if (!manifestBlob) throw new Error('项目包缺少项目清单');
  const manifest = JSON.parse(await manifestBlob.text());
  if (manifest.format !== 'xiaozhi-video-project' || manifest.version !== 1 || !manifest.project || !Array.isArray(manifest.project.clips)) {
    throw new Error('不支持的项目包格式');
  }
  const media = [];
  for (const item of manifest.media || []) {
    const blob = entries.get(item.path);
    if (!blob) throw new Error('项目包缺少素材：' + (item.name || item.path));
    media.push({ clipId: item.clipId, name: item.name, type: item.type, blob });
  }
  return { project: manifest.project, media, exportedAt: manifest.exportedAt };
}
