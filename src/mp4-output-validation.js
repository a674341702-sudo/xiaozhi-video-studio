/** Validate the top-level ISO-BMFF boxes before presenting bytes as a playable MP4. */
export function validateMp4Output(data) {
  if (!data || !ArrayBuffer.isView(data) || data.byteLength < 16) {
    throw new Error('导出文件不完整：MP4 数据长度不足，请重新导出。');
  }

  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const found = new Set();
  let offset = 0;
  let boxIndex = 0;

  while (offset < bytes.byteLength) {
    const remaining = bytes.byteLength - offset;
    if (remaining < 8) {
      throw new Error('导出文件校验失败：MP4 容器结构不完整，请重新导出。');
    }

    let boxSize = view.getUint32(offset, false);
    const boxType = String.fromCharCode(
      bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]
    );
    let headerSize = 8;

    if (boxSize === 1) {
      if (remaining < 16) {
        throw new Error('导出文件校验失败：MP4 扩展容器头不完整，请重新导出。');
      }
      const largeSize = view.getBigUint64(offset + 8, false);
      if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error('导出文件校验失败：MP4 容器尺寸超出安全范围。');
      }
      boxSize = Number(largeSize);
      headerSize = 16;
    } else if (boxSize === 0) {
      boxSize = remaining;
    }

    if (boxSize < headerSize || boxSize > remaining) {
      throw new Error('导出文件校验失败：MP4 容器长度异常，请重新导出。');
    }

    if (boxIndex === 0 && boxType !== 'ftyp') {
      throw new Error('导出文件校验失败：没有检测到 MP4 文件标识，请重新导出。');
    }

    if (boxType === 'ftyp') {
      if (boxIndex !== 0 || boxSize < headerSize + 8) {
        throw new Error('导出文件校验失败：MP4 文件标识无效，请重新导出。');
      }
      const brand = String.fromCharCode(
        bytes[offset + headerSize], bytes[offset + headerSize + 1],
        bytes[offset + headerSize + 2], bytes[offset + headerSize + 3]
      );
      if (!/^[a-zA-Z0-9 ]{4}$/.test(brand)) {
        throw new Error('导出文件校验失败：MP4 编码标识无效，请重新导出。');
      }
      found.add('ftyp');
    } else if (boxType === 'moov' || boxType === 'mdat') {
      if (boxSize <= headerSize) {
        throw new Error(`导出文件校验失败：MP4 ${boxType} 数据为空，请重新导出。`);
      }
      found.add(boxType);
    }

    offset += boxSize;
    boxIndex++;
  }

  if (offset !== bytes.byteLength || !found.has('ftyp') ||
      !found.has('moov') || !found.has('mdat')) {
    throw new Error('导出文件校验失败：MP4 缺少必要的视频索引或媒体数据，请重新导出。');
  }
  return true;
}
