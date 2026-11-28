import assert from 'node:assert/strict';
import { getMediaFileSizeLimit, isMobileMediaDevice, validateMediaFileSize, MAX_FILE_SIZE, MAX_MOBILE_FILE_SIZE } from '../src/utils.js';

assert.equal(getMediaFileSizeLimit(false), MAX_FILE_SIZE);
assert.equal(getMediaFileSizeLimit(true), MAX_MOBILE_FILE_SIZE);
assert.equal(MAX_MOBILE_FILE_SIZE, 250 * 1024 * 1024);
assert.equal(isMobileMediaDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Mobile', maxTouchPoints: 1 }), true);
assert.equal(isMobileMediaDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32', maxTouchPoints: 0 }), false);
assert.equal(isMobileMediaDevice({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 }), true);
console.log('Mobile media file-size guard tests passed.');

const mobileLimit = validateMediaFileSize(MAX_MOBILE_FILE_SIZE, true);
assert.equal(mobileLimit.valid, true, 'mobile limit itself is accepted');
assert.equal(validateMediaFileSize(MAX_MOBILE_FILE_SIZE + 1, true).valid, false);
assert.equal(validateMediaFileSize(MAX_FILE_SIZE, false).valid, true, 'desktop retains the 2GB limit');
assert.equal(validateMediaFileSize(MAX_FILE_SIZE + 1, false).valid, false);
assert.equal(validateMediaFileSize(-1, true).valid, false);
assert.equal(validateMediaFileSize(Number.NaN, true).valid, false);
