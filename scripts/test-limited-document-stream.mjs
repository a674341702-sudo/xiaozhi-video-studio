import assert from 'node:assert/strict';
import { readStreamWithLimit } from '../src/merchant-document.js';

function streamFromChunks(chunks, onCancel = () => {}) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk));
      controller.close();
    },
    cancel(reason) {
      onCancel(reason);
    }
  });
}

const restored = await readStreamWithLimit(
  streamFromChunks([[1, 2], [3], [4, 5]]),
  5
);
assert.deepEqual(Array.from(restored), [1, 2, 3, 4, 5]);

let cancelled = false;
await assert.rejects(
  () => readStreamWithLimit(
    streamFromChunks([[1, 2, 3], [4, 5]], () => { cancelled = true; }),
    4,
    'Word 正文超过测试上限'
  ),
  /Word 正文超过测试上限/
);
assert.equal(cancelled, true, 'stream should be cancelled immediately after the limit is exceeded');

console.log('DOCX streamed decompression size-limit tests passed.');
