/** Validate the ISO-BMFF file signature before presenting bytes as a playable MP4. */
export function validateMp4Output(data) {
  if (!data || !ArrayBuffer.isView(data) || data.byteLength < 16) {
    throw new Error('导出文件不完整：MP4 数据长度不足，请重新导出。');
  }
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const boxSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, false);
  const boxType = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  if (boxType !== 'ftyp' || boxSize < 16 || boxSize > bytes.byteLength) {
    throw new Error('导出文件校验失败：没有检测到有效的 MP4 文件头，请重新导出。');
  }
  const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (!/^[a-zA-Z0-9 ]{4}$/.test(brand)) {
    throw new Error('导出文件校验失败：MP4 编码标识无效，请重新导出。');
  }
  return true;
}
