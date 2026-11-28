import assert from 'node:assert/strict';
import { extractMerchantDocumentText } from '../src/merchant-document.js';

function namedBlob(content, name) {
  const file = new Blob([content], { type: 'text/plain' });
  Object.defineProperty(file, 'name', { value: name });
  return file;
}

const plain = await extractMerchantDocumentText(namedBlob(
  '店名：云林小馆\n招牌：米线\n地址：昆明市',
  'merchant.txt'
));
assert.equal(plain, '店名：云林小馆\n招牌：米线\n地址：昆明市');

const markdown = await extractMerchantDocumentText(namedBlob(
  '# 商家要求\n- 必须展示门头\n- 不要出现其他品牌',
  'brief.md'
));
assert.ok(markdown.includes('必须展示门头'));
assert.ok(markdown.includes('不要出现其他品牌'));

const csv = await extractMerchantDocumentText(namedBlob(
  '项目,内容\n招牌菜,过桥米线',
  'brief.csv'
));
assert.ok(csv.includes('过桥米线'));

const rtf = await extractMerchantDocumentText(namedBlob(
  String.raw`{\\rtf1\\ansi 商家要求\\par 展示门头和招牌菜}`,
  'brief.rtf'
));
assert.ok(rtf.includes('商家要求'));
assert.ok(rtf.includes('展示门头和招牌菜'));

const longText = await extractMerchantDocumentText(namedBlob('甲'.repeat(21000), 'long.txt'));
assert.equal(longText.length, 20000, '文档正文必须限制在20000字符以内');

await assert.rejects(
  () => extractMerchantDocumentText(namedBlob('   \n ', 'empty.txt')),
  /没有读取到文字内容/
);
await assert.rejects(
  () => extractMerchantDocumentText(namedBlob('%PDF-1.7', 'brief.pdf')),
  /PDF 暂不支持/
);
await assert.rejects(
  () => extractMerchantDocumentText(namedBlob('not a zip file', 'broken.docx')),
  /不是有效的 .docx/
);
await assert.rejects(
  () => extractMerchantDocumentText(namedBlob('x'.repeat(10 * 1024 * 1024 + 1), 'oversize.txt')),
  /不能超过 10MB/
);

console.log('商家文档读取测试通过：TXT、Markdown、CSV、RTF、空文档、PDF提示、损坏DOCX及大小限制。');
