/**
 * Media Manager Module
 * Handles loading & adding Video, Image, Text, and Audio elements into the multi-track composition.
 */
import { validateFile, showToast } from './utils.js';
import { generateProxy } from './proxy.js';
import { getPreciseMediaDuration } from './media-duration.js';

// Mobile browsers can occasionally leave media metadata loading unresolved.
// Bound the wait so the workflow can show a useful error instead of hanging forever.
function waitForMediaReady(element, readyCheck, readyEvent, timeoutMs = 15000) {
  if (readyCheck()) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    const finish = (ready) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      element.removeEventListener(readyEvent, onReady);
      element.removeEventListener('error', onError);
      resolve(ready);
    };
    const onReady = () => finish(true);
    const onError = () => finish(false);
    element.addEventListener(readyEvent, onReady, { once: true });
    element.addEventListener('error', onError, { once: true });
    timer = setTimeout(() => finish(false), timeoutMs);
    if (readyCheck()) finish(true);
  });
}

export class MediaManager {
  constructor(composition, onCompositionChanged, onMediaUrlRegistered, store) {
    this.comp = composition;
    this.onCompositionChanged = onCompositionChanged;
    this.onMediaUrlRegistered = onMediaUrlRegistered;
    this.store = store;

    this._bindFileInputs();
  }

  _bindFileInputs() {
    this.videoInput = this._createHiddenInput('video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov');
    this.imageInput = this._createHiddenInput('image/png,image/jpeg,image/webp,image/gif,image/avif,.png,.jpg,.jpeg,.webp,.gif,.avif');
    this.audioInput = this._createHiddenInput('audio/mp3,audio/wav,audio/aac,audio/ogg,audio/m4a,.mp3,.wav,.aac,.ogg,.m4a');

    this.videoInput.addEventListener('change', (e) => this._onVideoSelected(e));
    this.imageInput.addEventListener('change', (e) => this._onImageSelected(e));
    this.audioInput.addEventListener('change', (e) => this._onAudioSelected(e));
  }

  _createHiddenInput(accept) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);
    return input;
  }

  addVideo() {
    this.videoInput.click();
  }

  addImage() {
    this.imageInput.click();
  }

  addAudio() {
    this.audioInput.click();
  }

  addText(textStr = '新建文字') {
    const textTrack = this.comp.tracks.find(t => t.type === 'text');
    if (!textTrack) {
      showToast('没有可用的文字轨道', 'error');
      return;
    }

    const clip = this.comp.addClip({
      trackId: textTrack.id,
      type: 'text',
      name: textStr.length > 15 ? textStr.substring(0, 15) + '...' : textStr,
      text: textStr,
      startTime: 0,
      duration: 5,
      x: Math.round(this.comp.width * 0.25),
      y: Math.round(this.comp.height * 0.4),
      width: Math.round(this.comp.width * 0.5),
      height: 120,
      fontSize: 64,
      fontFamily: 'Inter',
      fontWeight: 'normal',
      customFontUrl: null,
      color: '#ffffff',
      bgColor: 'transparent',
      textAlign: 'center'
    });

    showToast(`已添加文字： "${textStr}"`, 'success');
    if (this.onCompositionChanged) this.onCompositionChanged();
    return clip;
  }

  async importFile(file, { startTime = 0, trackIndex = null } = {}) {
    const type = this._detectType(file);
    if (!type) {
      showToast(`不支持的文件类型： ${file.name}`, 'error');
      return;
    }

    if (type === 'video') return this._importVideo(file, { startTime, trackIndex });
    if (type === 'image') return this._importImage(file, { startTime, trackIndex });
    if (type === 'audio') return this._importAudio(file, { startTime, trackIndex });
  }

  _detectType(file) {
    const valVideo = validateFile(file, 'video');
    if (valVideo.valid) return 'video';
    const valImage = validateFile(file, 'image');
    if (valImage.valid) return 'image';
    const valAudio = validateFile(file, 'audio');
    if (valAudio.valid) return 'audio';
    return null;
  }

  async _importVideo(file, { startTime, trackIndex }) {
    const val = validateFile(file, 'video');
    if (!val.valid) {
      showToast(val.error, 'error');
      return;
    }

    let videoTrack = this.comp.tracks.find(t => t.type === 'video');
    if (trackIndex !== null) {
      const requested = this.comp.tracks[trackIndex];
      if (requested && (requested.type === 'video' || requested.type === 'image')) {
        videoTrack = requested;
      }
    }
    if (!videoTrack) {
      showToast('没有可用的视频轨道', 'error');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    // Load an actual decodable frame, not metadata only. Canvas drawImage() is
    // blank/throws on many mobile browsers until readyState reaches HAVE_CURRENT_DATA.
    video.preload = 'auto';
    video.playsInline = true;
    video.muted = true;
    video.src = objectUrl;
    video.load();
    const videoReady = await waitForMediaReady(video, () => video.readyState >= 2, 'loadeddata', 30000);
    if (!videoReady) {
      URL.revokeObjectURL(objectUrl);
      showToast('手机读取视频失败或等待超时，请换成 MP4 文件或压缩后重试。', 'error');
      return null;
    }

    const dur = getPreciseMediaDuration(video.duration, 10);
    const vW = video.videoWidth || 1920;
    const vH = video.videoHeight || 1080;

    let targetW = this.comp.width;
    let targetH = Math.round(targetW * (vH / vW));
    if (targetH > this.comp.height) {
      targetH = this.comp.height;
      targetW = Math.round(targetH * (vW / vH));
    }
    const posX = Math.round((this.comp.width - targetW) / 2);
    const posY = Math.round((this.comp.height - targetH) / 2);

    const clip = this.comp.addClip({
      trackId: videoTrack.id,
      type: 'video',
      name: file.name,
      file: file,
      src: objectUrl,
      element: video,
      startTime,
      duration: dur,
      x: posX,
      y: posY,
      width: targetW,
      height: targetH,
      opacity: 1
    });

    if (this.onMediaUrlRegistered) this.onMediaUrlRegistered(clip.id, objectUrl);

    // Repaint the canvas when mobile decoders deliver or seek to a new frame.
    const repaint = () => {
      if (this.onCompositionChanged) this.onCompositionChanged();
    };
    video.addEventListener('loadeddata', repaint);
    video.addEventListener('seeked', repaint);
    video.addEventListener('error', () => {
      showToast('视频解码失败，请尝试转换为 H.264 编码的 MP4 后重新上传。', 'error');
    });

    // Generate proxy asynchronously for smooth editing
    const proxyEnabled = this.store ? this.store.get('proxyEnabled') !== false : true;
    if (proxyEnabled && file.size > 50 * 1024 * 1024) {
      generateProxy(file, objectUrl, 540, (pct) => {
        // Proxy progress could be shown in UI
        console.log(`Proxy generation: ${pct}%`);
      }).then((proxyUrl) => {
        clip.proxySrc = proxyUrl;
        clip.proxyState = 'ready';
        if (this.onCompositionChanged) this.onCompositionChanged();
      }).catch((e) => {
        console.warn('Proxy failed:', e);
        clip.proxyState = 'failed';
      });
    }

    showToast(`已添加视频： ${file.name}`, 'success');
    if (this.onCompositionChanged) this.onCompositionChanged();
    return clip;
  }

  async _importImage(file, { startTime, trackIndex }) {
    const val = validateFile(file, 'image');
    if (!val.valid) {
      showToast(val.error, 'error');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = objectUrl;
    const imageReady = await waitForMediaReady(img, () => img.complete && img.naturalWidth > 0, 'load');
    if (!imageReady) {
      URL.revokeObjectURL(objectUrl);
      showToast('手机读取图片失败或等待超时，请换成 JPG、PNG 图片后重试。', 'error');
      return null;
    }

    let imgTrack = this.comp.tracks.find(t => t.type === 'image');
    if (trackIndex !== null) {
      const requested = this.comp.tracks[trackIndex];
      if (requested && (requested.type === 'image' || requested.type === 'video')) {
        imgTrack = requested;
      }
    }
    if (!imgTrack) imgTrack = this.comp.tracks.find(t => t.type === 'video');

    const iW = img.naturalWidth || 800;
    const iH = img.naturalHeight || 600;

    let targetW = Math.min(iW, Math.round(this.comp.width * 0.6));
    let targetH = Math.round(targetW * (iH / iW));
    const posX = Math.round((this.comp.width - targetW) / 2);
    const posY = Math.round((this.comp.height - targetH) / 2);

    const clip = this.comp.addClip({
      trackId: imgTrack ? imgTrack.id : 'v1',
      type: 'image',
      name: file.name,
      file: file,
      src: objectUrl,
      element: img,
      startTime,
      duration: 5,
      x: posX,
      y: posY,
      width: targetW,
      height: targetH,
      opacity: 1
    });

    if (this.onMediaUrlRegistered) this.onMediaUrlRegistered(clip.id, objectUrl);
    showToast(`已添加图片： ${file.name}`, 'success');
    if (this.onCompositionChanged) this.onCompositionChanged();
    return clip;
  }

  async _importAudio(file, { startTime, trackIndex }) {
    const val = validateFile(file, 'audio');
    if (!val.valid) {
      showToast(val.error, 'error');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio(objectUrl);
    audio.preload = 'metadata';
    const audioReady = await waitForMediaReady(audio, () => audio.readyState >= 1, 'loadedmetadata');
    if (!audioReady) {
      URL.revokeObjectURL(objectUrl);
      showToast('手机读取音频失败或等待超时，请换成 MP3 或 WAV 文件后重试。', 'error');
      return null;
    }

    const dur = getPreciseMediaDuration(audio.duration, 10);

    let audioTrack = this.comp.tracks.find(t => t.type === 'audio');
    if (trackIndex !== null) {
      const requested = this.comp.tracks[trackIndex];
      if (requested && requested.type === 'audio') {
        audioTrack = requested;
      }
    }
    if (!audioTrack) {
      audioTrack = this.comp.addAudioTrack();
    }

    const clip = this.comp.addClip({
      trackId: audioTrack.id,
      type: 'audio',
      name: file.name,
      file: file,
      src: objectUrl,
      element: audio,
      startTime,
      duration: dur,
      volume: 1
    });

    if (this.onMediaUrlRegistered) this.onMediaUrlRegistered(clip.id, objectUrl);
    showToast(`已添加音频： ${file.name}`, 'success');
    if (this.onCompositionChanged) this.onCompositionChanged();
    return clip;
  }

  async _onVideoSelected(e) {
    // Snapshot the FileList before clearing the picker. Some mobile browsers
    // expose a live FileList whose contents change when input.value is reset.
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    for (const file of files) {
      await this._importVideo(file, { startTime: 0 });
    }
  }

  async _onImageSelected(e) {
    // Snapshot the FileList before clearing the picker. Some mobile browsers
    // expose a live FileList whose contents change when input.value is reset.
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    for (const file of files) {
      await this._importImage(file, { startTime: 0 });
    }
  }

  async _onAudioSelected(e) {
    // Snapshot the FileList before clearing the picker. Some mobile browsers
    // expose a live FileList whose contents change when input.value is reset.
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    for (const file of files) {
      await this._importAudio(file, { startTime: 0 });
    }
  }
}
