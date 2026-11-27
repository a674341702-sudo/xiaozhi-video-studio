const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENT_CHARS = 20000;

function decodeXmlText(xml) {
  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  if (parsed.querySelector('parsererror')) throw new Error('Word 文档内容无法解析');
  return Array.from(parsed.getElementsByTagName('w:p')).map(paragraph =>
    Array.from(paragraph.getElementsByTagName('w:t')).map(node => node.textContent || '').join('')
  ).filter(Boolean).join('\n');
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前浏览器不支持读取压缩 Word 文档，请另存为 TXT 后上传');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readDocx(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const searchStart = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= searchStart; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('这不是有效的 .docx Word 文档');
  const count = view.getUint16(eocd + 10, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (!count || count > 2000 || directoryOffset >= eocd) throw new Error('Word 文档目录信息异常');
  let cursor = directoryOffset;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error('Word 文档目录已损坏');
    }
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;
    if (name !== 'word/document.xml') continue;
    if (uncompressedSize > MAX_DOCUMENT_BYTES || compressedSize > MAX_DOCUMENT_BYTES ||
        localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error('Word 正文文件大小或位置异常');
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const end = start + compressedSize;
    if (end > directoryOffset || end < start) throw new Error('Word 正文数据超出文件范围');
    const compressed = bytes.slice(start, end);
    let xml;
    if (method === 0) xml = compressed;
    else if (method === 8) xml = await inflateRaw(compressed);
    else throw new Error('暂不支持这种 Word 文档压缩格式');
    if (xml.length > MAX_DOCUMENT_BYTES) throw new Error('Word 文档正文过大');
    return decodeXmlText(new TextDecoder('utf-8', { fatal: true }).decode(xml));
  }
  throw new Error('Word 文档中没有找到正文内容');
}

export async function extractMerchantDocumentText(file) {
  if (!(file instanceof Blob) || !file.name) throw new Error('请先选择文字文档');
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error('文字文档不能超过 10MB');
  const name = file.name.toLowerCase();
  let text;
  if (name.endsWith('.docx')) text = await readDocx(file);
  else if (/\.(txt|md|csv)$/.test(name)) text = await file.text();
  else if (name.endsWith('.rtf')) {
    const raw = await file.text();
    text = raw.replace(/\\'[0-9a-f]{2}/gi, ' ').replace(/\\par[d]?/g, '\n')
      .replace(/\\'[0-9a-f]{2}|\\[a-z]+-?\\d* ?|[{}]/gi, ' ').replace(/\\\\/g, '\\');
  } else {
    throw new Error('支持 TXT、Markdown、CSV、RTF 和 Word（.docx）文档；PDF 暂不支持，请复制文字或另存为 TXT');
  }
  text = String(text || '').replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').trim();
  if (!text) throw new Error('文档里没有读取到文字内容');
  if (text.length > MAX_DOCUMENT_CHARS) text = text.slice(0, MAX_DOCUMENT_CHARS);
  return text;
}
