import assert from 'node:assert/strict';
import { getMerchantWorkflowErrorMessage } from '../src/merchant-workflow-error.js';

assert.match(getMerchantWorkflowErrorMessage(new Error('Out of memory')), /减少素材数量或文件大小/);
assert.match(getMerchantWorkflowErrorMessage(new Error('Video decode failed')), /单独测试出错的素材/);
assert.match(getMerchantWorkflowErrorMessage(new Error('照片读取失败或等待超时：IMG_001.jpg')), /单独上传这张照片/);
assert.match(getMerchantWorkflowErrorMessage(new Error('Unsupported codec')), /MP4（H.264）/);
assert.match(getMerchantWorkflowErrorMessage(new Error('Failed to fetch')), /稳定网络/);
const ordinary = getMerchantWorkflowErrorMessage(new Error('custom failure'));
assert.match(ordinary, /上传素材和文案仍保留/);
assert.match(ordinary, /custom failure/);
assert.ok(getMerchantWorkflowErrorMessage(new Error('x'.repeat(500))).length < 300, 'error details should be bounded for mobile status UI');
console.log('Merchant workflow failure recovery guidance tests passed.');

import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/auto-workflow.js', import.meta.url), 'utf8');
assert.match(source, /import \{ getMerchantWorkflowErrorMessage \} from '\.\/merchant-workflow-error\.js';/);
assert.match(source, /setStatus\(getMerchantWorkflowErrorMessage\(error\)\)/);
assert.match(source, /正在读取照片/);
assert.match(source, /素材读取失败或超时/);
console.log('Merchant workflow recovery guidance integration tests passed.');
