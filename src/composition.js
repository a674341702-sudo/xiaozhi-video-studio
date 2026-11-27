/**
 * Composition Data Model & State Management
 * Handles multi-track timeline data, clip lifecycle, tracks, and history stack.
 */
import { uid } from './utils.js';
import { History } from './history.js';

export class Composition {
  constructor(width = 1920, height = 1080) {
    this.width = width;
    this.height = height;

    this.tracks = [
      { id: 'v1', type: 'video', name: '视频轨道 1', locked: false, muted: false, visible: true },
      { id: 'v2', type: 'video', name: '视频轨道 2', locked: false, muted: false, visible: true },
      { id: 'img1', type: 'image', name: '图片叠加轨道', locked: false, muted: false, visible: true },
      { id: 'txt1', type: 'text', name: '文字字幕轨道', locked: false, muted: false, visible: true },
      { id: 'a1', type: 'audio', name: '音频轨道 1', locked: false, muted: false, visible: true },
      { id: 'a2', type: 'audio', name: '音频轨道 2', locked: false, muted: false, visible: true },
    ];

    this.clips = [];
    this.selectedClipId = null;
    this.history = new History(100);

    // Internal clip registry by id for O(1) lookups
    this._clipMap = new Map();

    // Keep a complete baseline snapshot so the first user edit can be undone.
    this._lastHistorySnapshot = null;
    this._batchSnapshot = null;
    this._batchName = null;
    this._pushSnapshot('new project');
  }

  get duration() {
    let maxEnd = 5;
    for (const clip of this.clips) {
      const clipEnd = clip.startTime + clip.duration;
      if (clipEnd > maxEnd) maxEnd = clipEnd;
    }
    return maxEnd;
  }

  addAudioTrack() {
    const audioTrackCount = this.tracks.filter(t => t.type === 'audio').length;
    if (audioTrackCount >= 10) {
      throw new Error('Maximum 10 audio tracks allowed');
    }
    const trackId = `a${audioTrackCount + 1}`;
    const track = {
      id: trackId,
      type: 'audio',
      name: `音频轨道 ${audioTrackCount + 1}`,
      locked: false,
      muted: false,
      visible: true
    };
    this.tracks.push(track);
    this._pushSnapshot('add audio track');
    return track;
  }

  getTrack(trackId) {
    return this.tracks.find(t => t.id === trackId);
  }

  addClip(clipData, { skipHistory = false } = {}) {
    const requestedStart = clipData.startTime || 0;
    const duration = clipData.duration || 5;

    // Find a non-overlapping start time on the requested track
    let startTime = requestedStart;
    const sameTrackClips = this.clips
      .filter(c => c.trackId === clipData.trackId)
      .sort((a, b) => a.startTime - b.startTime);

    for (const c of sameTrackClips) {
      const cEnd = c.startTime + c.duration;
      if (startTime < cEnd && startTime + duration > c.startTime) {
        startTime = Math.round((cEnd + 0.05) * 10) / 10;
      }
    }

    const clip = {
      id: clipData.id || uid(),
      trackId: clipData.trackId,
      type: clipData.type,
      name: clipData.name || '未命名素材',
      startTime,
      duration,
      trimStart: clipData.trimStart || 0,
      trimEnd: clipData.trimEnd || duration,
      x: clipData.x ?? Math.round(this.width * 0.1),
      y: clipData.y ?? Math.round(this.height * 0.1),
      width: clipData.width ?? Math.round(this.width * 0.8),
      height: clipData.height ?? Math.round(this.height * 0.8),
      opacity: clipData.opacity ?? 1,
      volume: clipData.volume ?? 1,
      loop: clipData.loop === true,
      file: clipData.file || null,
      src: clipData.src || null,
      element: clipData.element || null,
      text: clipData.text || '示例文字',
      fontSize: clipData.fontSize || 64,
      fontFamily: clipData.fontFamily || 'Inter',
      customFontUrl: clipData.customFontUrl || null,
      fontWeight: clipData.fontWeight || 'normal',
      color: clipData.color || '#ffffff',
      bgColor: clipData.bgColor || 'transparent',
      textAlign: clipData.textAlign || 'center',
      keyframes: clipData.keyframes || null,
      proxySrc: clipData.proxySrc || null,
      proxyState: clipData.proxyState || 'none'
    };

    this.clips.push(clip);
    this._clipMap.set(clip.id, clip);
    this.selectedClipId = clip.id;

    if (!skipHistory) this._pushSnapshot('add clip');
    return clip;
  }

  removeClip(clipId, { skipHistory = false } = {}) {
    const idx = this.clips.findIndex(c => c.id === clipId);
    if (idx !== -1) {
      this.clips.splice(idx, 1);
      this._clipMap.delete(clipId);
      if (this.selectedClipId === clipId) {
        this.selectedClipId = null;
      }
      if (!skipHistory) this._pushSnapshot('delete clip');
      return true;
    }
    return false;
  }

  getClip(clipId) {
    return this._clipMap.get(clipId) || null;
  }

  getSelectedClip() {
    return this.getClip(this.selectedClipId);
  }

  updateClip(clipId, changes, { skipHistory = false } = {}) {
    const clip = this.getClip(clipId);
    if (!clip) return null;

    Object.assign(clip, changes);

    if (!skipHistory) this._pushSnapshot('update clip');
    return clip;
  }

  getClipsAtTime(time, endOverlap = 0) {
    const EPS = 1e-9;
    return this.clips.filter(c => {
      const track = this.getTrack(c.trackId);
      if (track && !track.visible) return false;
      const endTime = c.startTime + c.duration;
      return time + EPS >= c.startTime && time <= endTime + endOverlap + EPS;
    });
  }

  /**
   * Check whether placing a clip on a track at the given time range would overlap
   * any existing clip on that track. Pass the clip's own id to exclude itself.
   */
  clipOverlaps(clipId, trackId, startTime, duration) {
    const EPS = 1e-6;
    const endTime = startTime + duration;
    return this.clips.some(c => {
      if (c.id === clipId) return false;
      if (c.trackId !== trackId) return false;
      const cEnd = c.startTime + c.duration;
      return startTime + EPS < cEnd && endTime > c.startTime + EPS;
    });
  }

  setDimensions(width, height) {
    this.width = Math.max(100, Math.min(7680, Math.round(width)));
    this.height = Math.max(100, Math.min(7680, Math.round(height)));
    this._pushSnapshot('set dimensions');
  }

  // --- History ---
  _createSnapshot() {
    return {
      width: this.width,
      height: this.height,
      tracks: JSON.parse(JSON.stringify(this.tracks)),
      clips: this.clips.map(clip => ({
        ...clip,
        // Timeline/keyframe objects must not be shared between history entries.
        keyframes: clip.keyframes ? JSON.parse(JSON.stringify(clip.keyframes)) : null,
        // Keep the live media references so undo can restore deleted clips.
        element: clip.element || null,
        file: clip.file || null
      })),
      selectedClipId: this.selectedClipId
    };
  }

  _snapshotSignature(snapshot) {
    return JSON.stringify({
      width: snapshot.width,
      height: snapshot.height,
      tracks: snapshot.tracks,
      clips: snapshot.clips.map(({ element, file, ...clip }) => clip),
      selectedClipId: snapshot.selectedClipId
    });
  }

  _recordSnapshotChange(name, before, after) {
    if (this._snapshotSignature(before) === this._snapshotSignature(after)) {
      this._lastHistorySnapshot = after;
      return false;
    }

    this.history.push({
      name,
      do: () => {},
      undo: () => this._applySnapshot(before),
      redo: () => this._applySnapshot(after)
    });
    this._lastHistorySnapshot = after;
    return true;
  }

  _pushSnapshot(name) {
    const snapshot = this._createSnapshot();

    // The first snapshot is the history baseline. It gives the first actual
    // edit a valid previous state to return to.
    if (!this._lastHistorySnapshot) {
      this._lastHistorySnapshot = snapshot;
      this.history.push({
        name: 'initial state',
        do: () => {},
        undo: () => this._applySnapshot(snapshot),
        redo: () => this._applySnapshot(snapshot)
      });
      return;
    }

    // A grouped gesture records only one before/after pair at pointer-up.
    if (this._batchSnapshot) return;

    this._recordSnapshotChange(name, this._lastHistorySnapshot, snapshot);
  }

  canUndo() {
    return this.history.canUndo();
  }

  canRedo() {
    return this.history.canRedo();
  }

  undo() {
    return this.history.undo();
  }

  redo() {
    return this.history.redo();
  }

  _applySnapshot(snapshot) {
    this.width = snapshot.width;
    this.height = snapshot.height;
    this.tracks = JSON.parse(JSON.stringify(snapshot.tracks));

    const existingElements = new Map(
      this.clips.filter(clip => clip.element).map(clip => [clip.id, clip.element])
    );
    this.clips = snapshot.clips.map(source => {
      const clip = {
        ...source,
        keyframes: source.keyframes ? JSON.parse(JSON.stringify(source.keyframes)) : null,
        element: source.element || existingElements.get(source.id) || null,
        file: source.file || null
      };
      return clip;
    });
    this._clipMap = new Map(this.clips.map(clip => [clip.id, clip]));
    this.selectedClipId = snapshot.selectedClipId;
    this._lastHistorySnapshot = this._createSnapshot();
  }

  // --- Project serialization ---
  clear() {
    this.clips = [];
    this._clipMap.clear();
    this.selectedClipId = null;
    this.history.clear();
    this._lastHistorySnapshot = null;
    this._batchSnapshot = null;
    this._batchName = null;
    this.tracks = [
      { id: 'v1', type: 'video', name: '视频轨道 1', locked: false, muted: false, visible: true },
      { id: 'v2', type: 'video', name: '视频轨道 2', locked: false, muted: false, visible: true },
      { id: 'img1', type: 'image', name: '图片叠加轨道', locked: false, muted: false, visible: true },
      { id: 'txt1', type: 'text', name: '文字字幕轨道', locked: false, muted: false, visible: true },
      { id: 'a1', type: 'audio', name: '音频轨道 1', locked: false, muted: false, visible: true },
      { id: 'a2', type: 'audio', name: '音频轨道 2', locked: false, muted: false, visible: true },
    ];
    this._pushSnapshot('new project');
  }

  toJSON() {
    return {
      name: '小智视频项目',
      version: 2,
      width: this.width,
      height: this.height,
      tracks: JSON.parse(JSON.stringify(this.tracks)),
      clips: this.clips.map(c => {
        const copy = { ...c };
        delete copy.element;
        delete copy.file;
        return copy;
      }),
      selectedClipId: this.selectedClipId
    };
  }

  async fromJSON(data, resolveSrcUrl) {
    this.width = data.width || 1920;
    this.height = data.height || 1080;
    this.tracks = data.tracks ? JSON.parse(JSON.stringify(data.tracks)) : this.tracks;
    this.selectedClipId = data.selectedClipId || null;
    this.clips = [];
    this._clipMap.clear();

    for (const c of data.clips || []) {
      const clip = { ...c };
      delete clip.element;
      delete clip.file;

      if (clip.src && resolveSrcUrl) {
        clip.src = await resolveSrcUrl(clip.src, clip.type);
      }

      if (clip.src) {
        if (clip.type === 'video') {
          const video = document.createElement('video');
          video.src = clip.src;
          video.preload = 'auto';
          clip.element = video;
        } else if (clip.type === 'image') {
          const img = new Image();
          img.src = clip.src;
          clip.element = img;
        } else if (clip.type === 'audio') {
          const audio = new Audio(clip.src);
          clip.element = audio;
        }
      }

      this.clips.push(clip);
      this._clipMap.set(clip.id, clip);
    }

    this.history.clear();
    this._lastHistorySnapshot = null;
    this._batchSnapshot = null;
    this._batchName = null;
    this._pushSnapshot('load project');
  }

  startBatch(name) {
    if (this._batchSnapshot) return;
    this._batchSnapshot = this._createSnapshot();
    this._batchName = name || 'edit';
  }

  commitBatch() {
    if (!this._batchSnapshot) return false;
    const before = this._batchSnapshot;
    const name = this._batchName || 'edit';
    this._batchSnapshot = null;
    this._batchName = null;
    return this._recordSnapshotChange(name, before, this._createSnapshot());
  }

  cancelBatch() {
    if (!this._batchSnapshot) return false;
    const before = this._batchSnapshot;
    this._batchSnapshot = null;
    this._batchName = null;
    this._applySnapshot(before);
    return true;
  }
}
