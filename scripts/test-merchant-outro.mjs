import assert from 'node:assert/strict';
import { buildMerchantOutroText } from '../src/merchant-outro.js';
assert.equal(buildMerchantOutroText({}), null);
assert.equal(buildMerchantOutroText({ shop: '  ' }), null);
assert.equal(buildMerchantOutroText({ shop: '云林咖啡' }), '云林咖啡\n欢迎咨询了解');
assert.equal(buildMerchantOutroText({ shop: '云林咖啡', product: '手冲咖啡', address: '昆明市五华区' }), '云林咖啡\n主打：手冲咖啡\n地址：昆明市五华区\n欢迎咨询了解');
assert.equal(buildMerchantOutroText({ shop: '云林\n咖啡', product: ' 手冲\n咖啡 ' }), '云林 咖啡\n主打：手冲 咖啡\n欢迎咨询了解');
console.log('商家品牌片尾文案测试通过');
