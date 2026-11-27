import assert from 'node:assert/strict';
import { sanitizeProjectDocument, MAX_PROJECT_DOCUMENT_BYTES } from '../src/project-validation.js';
import { escapeHtml } from '../src/utils.js';

const project = {
  name: '安全导入测试',
  version: 2,
  width: 720,
  height: 1280,
  tracks: [
    { id: 'v1', type: 'video', name: '视频轨道', locked: false, muted: false, visible: true },
    { id: 'txt1', type: 'text', name: '字幕轨道', locked: false, muted: false, visible: true }
  ],
  clips: [
    {
      id: 'clip-video',
      trackId: 'v1',
      type: 'video',
      name: '视频素材',
      startTime: 0,
      duration: 3,
      src: 'https://tracking.example/pixel.mp4',
      proxySrc: 'https://tracking.example/proxy.mp4',
      customFontUrl: 'https://tracking.example/font.woff2'
    },
    {
      id: 'clip-text',
      trackId: 'txt1',
      type: 'text',
      name: '字幕',
      text: '正常文字',
      startTime: 0,
      duration: 3,
      color: '"><img src=x onerror=alert(1)>'
    }
  ],
  selectedClipId: 'clip-text'
};

const sanitized = sanitizeProjectDocument(project);
assert.equal(sanitized.clips[0].src, null, 'external source URLs must not be loaded from an imported JSON document');
assert.equal(sanitized.clips[0].proxySrc, null);
assert.equal(sanitized.clips[0].customFontUrl, null);
assert.equal(sanitized.clips[1].color, project.clips[1].color, 'metadata is preserved for safe attribute escaping');
assert.equal(sanitized.selectedClipId, 'clip-text');
assert.notEqual(sanitized.clips, project.clips, 'sanitization returns a new clips array');
assert.match(escapeHtml(project.clips[1].color), /&quot;&gt;&lt;img/);
assert.equal(MAX_PROJECT_DOCUMENT_BYTES, 5 * 1024 * 1024);

const invalid = [
  [{ ...project, width: '<img>' }, /画布尺寸无效/],
  [{ ...project, clips: new Array(5001).fill(project.clips[0]) }, /最多支持5000个片段/],
  [{ ...project, clips: [project.clips[0], project.clips[0]] }, /无效的片段编号/],
  [{ ...project, clips: [{ ...project.clips[0], type: 'script' }] }, /无效的片段编号/],
  [{ ...project, clips: [{ ...project.clips[0], startTime: Infinity }] }, /无效的片段编号/],
  [{ ...project, clips: [{ ...project.clips[0], trackId: 'unknown' }] }, /无效的片段编号/],
  [{ ...project, clips: [{ ...project.clips[0], opacity: 4 }] }, /透明度参数无效/],
  [{ ...project, tracks: [{ ...project.tracks[0], id: 'v1' }, { ...project.tracks[1], id: 'v1' }] }, /无效或重复的轨道信息/]
];
for (const [value, pattern] of invalid) {
  assert.throws(() => sanitizeProjectDocument(value), pattern);
}

console.log('Imported project validation, remote media stripping and HTML attribute escaping tests passed.');
