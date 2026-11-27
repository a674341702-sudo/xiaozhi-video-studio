/**
 * Canvas Preview Renderer & Interactive Element Selector
 * Renders all active clips (Videos, Images, Text overlays) onto the preview canvas
 * with selectable/draggable elements and 8-point resize handles.
 */
import { clamp } from './utils.js';
import { applyClipTransformsAtTime } from './keyframes.js';
import { wrapTextLines } from './text-layout.js';
import { getMediaDrawGeometry } from './media-fit.js';

export class CanvasPreview {
  constructor({ canvas, composition, onSelectClip, onChangeClipTransform, onContextMenu }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.comp = composition;
    this.onSelectClip = onSelectClip;
    this.onChangeClipTransform = onChangeClipTransform;
    this.onContextMenu = onContextMenu;

    this.currentTime = 0;

    this.isDragging = false;
    this.dragMode = null;
    this.dragStartPos = { x: 0, y: 0 };
    this.initialClipRect = { x: 0, y: 0, width: 0, height: 0 };

    this._setupCanvas();
    this._bindEvents();

    this._resizeObserver = new ResizeObserver(() => this._setupCanvas());
    this._resizeObserver.observe(this.canvas.parentElement);
  }

  _setupCanvas() {
    const parent = this.canvas.parentElement;
    const pRect = parent.getBoundingClientRect();

    const padding = 16;
    let availableW = Math.max(1, pRect.width - padding * 2);
    let availableH = Math.max(1, pRect.height - padding * 2);

    const compRatio = (this.comp.width || 1920) / (this.comp.height || 1080);
    let w = availableW;
    let h = w / compRatio;

    if (h > availableH) {
      h = availableH;
      w = h * compRatio;
    }

    w = Math.max(1, Math.floor(w));
    h = Math.max(1, Math.floor(h));

    this.displayWidth = w;
    this.displayHeight = h;
    this.scale = this.displayWidth / (this.comp.width || 1920);

    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.setAttribute('data-aspect-ratio', `${w}/${h}`);

    this.render();
  }

  resize() {
    this._setupCanvas();
  }

  setCurrentTime(t) {
    this.currentTime = t;
    this.render();
  }

  setIsPlaying(playing) {
    this.isPlaying = playing;
  }

  markNeedsRender() {
    if (this._renderPending) return;
    this._renderPending = true;
    requestAnimationFrame(() => {
      this._renderPending = false;
      this.render();
    });
  }

  /**
   * Offline clean render (for high quality export without selection outlines/handles)
   */
  renderOffline(ctx, time, width = 1920, height = 1080) {
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#06060c';
    ctx.fillRect(0, 0, width, height);

    const activeClips = this.comp.getClipsAtTime(time);

    activeClips.sort((a, b) => {
      const idxA = this.comp.tracks.findIndex(t => t.id === a.trackId);
      const idxB = this.comp.tracks.findIndex(t => t.id === b.trackId);
      return idxA - idxB;
    });

    for (const clip of activeClips) {
      ctx.save();
      this._applyClipTransform(ctx, clip, time, true);

      if (clip.type === 'video') {
        this._renderVideoClipAtTime(ctx, clip, time);
      } else if (clip.type === 'image') {
        this._renderImageClip(ctx, clip);
      } else if (clip.type === 'text') {
        this._renderTextClip(ctx, clip);
      }

      ctx.restore();
    }
  }

  _applyClipTransform(ctx, clip, time, applyOpacity = true) {
    const t = applyClipTransformsAtTime(clip, time);

    if (applyOpacity) ctx.globalAlpha = t.opacity;

    // Position keyframes are offsets from the clip's base coordinates.
    // Apply them before rotating/scaling so Ken Burns pans remain centered and smooth.
    const animatedX = Number.isFinite(t.x) ? t.x : clip.x;
    const animatedY = Number.isFinite(t.y) ? t.y : clip.y;
    const cx = clip.x + clip.width / 2;
    const cy = clip.y + clip.height / 2;

    ctx.translate(animatedX - clip.x, animatedY - clip.y);
    ctx.translate(cx, cy);
    if (t.rotation) ctx.rotate((t.rotation * Math.PI) / 180);
    if (t.scale !== 1) ctx.scale(t.scale, t.scale);
    ctx.translate(-cx, -cy);

    return t;
  }

  _drawMediaClip(ctx, element, clip) {
    const sourceWidth = element.videoWidth || element.naturalWidth || element.width;
    const sourceHeight = element.videoHeight || element.naturalHeight || element.height;
    if (!sourceWidth || !sourceHeight) return;

    if (clip.fit === 'contain') {
      // Fill the empty bands with a softened version of the same frame, then
      // place the complete, undistorted source image/video in front.
      const cover = getMediaDrawGeometry(sourceWidth, sourceHeight, clip.x, clip.y, clip.width, clip.height, 'cover');
      const contain = getMediaDrawGeometry(sourceWidth, sourceHeight, clip.x, clip.y, clip.width, clip.height, 'contain');
      ctx.save();
      ctx.beginPath();
      ctx.rect(clip.x, clip.y, clip.width, clip.height);
      ctx.clip();
      ctx.fillStyle = '#101018';
      ctx.fillRect(clip.x, clip.y, clip.width, clip.height);
      const previousFilter = ctx.filter;
      const previousAlpha = ctx.globalAlpha;
      if ('filter' in ctx) ctx.filter = 'blur(28px)';
      ctx.globalAlpha = previousAlpha * 0.42;
      ctx.drawImage(element, cover.sx, cover.sy, cover.sw, cover.sh, cover.dx, cover.dy, cover.dw, cover.dh);
      if ('filter' in ctx) ctx.filter = previousFilter || 'none';
      ctx.globalAlpha = previousAlpha;
      ctx.drawImage(element, contain.sx, contain.sy, contain.sw, contain.sh, contain.dx, contain.dy, contain.dw, contain.dh);
      ctx.restore();
      return;
    }

    if (clip.fit !== 'cover') {
      ctx.drawImage(element, clip.x, clip.y, clip.width, clip.height);
      return;
    }

    const geometry = getMediaDrawGeometry(sourceWidth, sourceHeight, clip.x, clip.y, clip.width, clip.height, 'cover');
    ctx.drawImage(element, geometry.sx, geometry.sy, geometry.sw, geometry.sh, geometry.dx, geometry.dy, geometry.dw, geometry.dh);
  }

  _renderVideoClipAtTime(ctx, clip, time) {
    if (!clip.element) return;
    const video = clip.element;
    const clipOffset = time - clip.startTime + clip.trimStart;

    if (Math.abs(video.currentTime - clipOffset) > 0.04) {
      video.currentTime = clipOffset;
    }

    try {
      this._drawMediaClip(ctx, video, clip);
    } catch (e) {}
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#06060c';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.scale(this.scale, this.scale);

    const activeClips = this.comp.getClipsAtTime(this.currentTime);

    activeClips.sort((a, b) => {
      const idxA = this.comp.tracks.findIndex(t => t.id === a.trackId);
      const idxB = this.comp.tracks.findIndex(t => t.id === b.trackId);
      return idxA - idxB;
    });

    for (const clip of activeClips) {
      ctx.save();
      this._applyClipTransform(ctx, clip, this.currentTime, true);

      if (clip.type === 'video') {
        this._renderVideoClip(ctx, clip);
      } else if (clip.type === 'image') {
        this._renderImageClip(ctx, clip);
      } else if (clip.type === 'text') {
        this._renderTextClip(ctx, clip);
      }

      ctx.restore();
    }

    const selectedClip = this.comp.getSelectedClip();
    if (selectedClip && activeClips.some(c => c.id === selectedClip.id)) {
      const transform = applyClipTransformsAtTime(selectedClip, this.currentTime);
      const scale = Number.isFinite(transform.scale) ? transform.scale : 1;
      const animatedX = Number.isFinite(transform.x) ? transform.x : selectedClip.x;
      const animatedY = Number.isFinite(transform.y) ? transform.y : selectedClip.y;
      const overlayClip = {
        ...selectedClip,
        x: animatedX + selectedClip.width * (1 - scale) / 2,
        y: animatedY + selectedClip.height * (1 - scale) / 2,
        width: selectedClip.width * scale,
        height: selectedClip.height * scale
      };
      this._renderSelectionOverlay(ctx, overlayClip);
    }

    ctx.restore();
  }

  _renderVideoClip(ctx, clip) {
    if (!clip.element) return;
    try {
      this._drawMediaClip(ctx, clip.element, clip);
    } catch (e) {}
  }

  _renderImageClip(ctx, clip) {
    if (!clip.element) return;
    try {
      this._drawMediaClip(ctx, clip.element, clip);
    } catch (e) {}
  }

  async _loadCustomFont(clip) {
    if (!clip.customFontUrl || !clip.fontFamily) return;
    if (document.fonts.check(`${clip.fontSize}px "${clip.fontFamily}"`)) return;
    try {
      const face = new FontFace(clip.fontFamily, `url(${clip.customFontUrl})`);
      await face.load();
      document.fonts.add(face);
    } catch (err) {
      console.warn('Failed to load custom font:', clip.fontFamily, err);
    }
  }

  _renderTextClip(ctx, clip) {
    if (!clip.text) return;

    this._loadCustomFont(clip);

    const align = clip.textAlign || 'center';
    const fontSize = Math.max(12, Number(clip.fontSize) || 36);
    const weight = clip.fontWeight === 'bold' ? 'bold ' : '';
    const fontFamily = clip.customFontUrl
      ? `"${clip.fontFamily || 'Inter'}"`
      : (clip.fontFamily || '"Noto Sans CJK SC", "Noto Sans SC", "Microsoft YaHei", "PingFang SC", Arial');
    ctx.font = `${weight}${fontSize}px ${fontFamily}, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    const horizontalPadding = Math.max(8, Math.round(fontSize * 0.24));
    const maxTextWidth = Math.max(1, clip.width - horizontalPadding * 2);
    const lineHeight = fontSize * 1.2;
    const verticalPadding = Math.max(4, Math.round(fontSize * 0.18));
    const maxLines = Math.max(1, Math.floor((clip.height - verticalPadding * 2) / lineHeight));
    const lines = wrapTextLines(ctx, clip.text, maxTextWidth, maxLines);
    const totalHeight = lines.length * lineHeight;
    const startY = clip.y + clip.height / 2 - totalHeight / 2 + lineHeight / 2;

    let maxWidth = 0;
    for (const line of lines) {
      const measured = ctx.measureText(line).width;
      if (measured > maxWidth) maxWidth = measured;
    }

    if (clip.bgColor && clip.bgColor !== 'transparent') {
      const padding = horizontalPadding;
      const bgWidth = Math.min(clip.width, maxWidth + padding * 2);
      const bgX = align === 'left' ? clip.x :
                  align === 'right' ? clip.x + clip.width - bgWidth : clip.x + clip.width / 2 - bgWidth / 2;
      const bgY = Math.max(clip.y, clip.y + clip.height / 2 - totalHeight / 2 - verticalPadding);
      const bgHeight = Math.min(clip.height, totalHeight + verticalPadding * 2);
      ctx.save();
      ctx.fillStyle = clip.bgColor;
      ctx.shadowColor = 'rgba(0,0,0,0.28)';
      ctx.shadowBlur = Math.max(4, Math.round(fontSize * 0.16));
      ctx.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.05));
      const radius = Math.min(Math.round(fontSize * 0.34), bgHeight / 2, bgWidth / 2);
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgWidth, bgHeight, radius);
        ctx.fill();
      } else {
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
      }
      ctx.restore();
    }

    const textX = align === 'left' ? clip.x + horizontalPadding :
                  align === 'right' ? clip.x + clip.width - horizontalPadding :
                  clip.x + clip.width / 2;
    ctx.save();
    ctx.fillStyle = clip.color || '#ffffff';
    ctx.strokeStyle = clip.strokeColor || 'rgba(0,0,0,0.92)';
    ctx.lineWidth = Math.max(2.5, fontSize * 0.085);
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = Math.max(2, Math.round(fontSize * 0.08));
    for (let i = 0; i < lines.length; i++) {
      const y = startY + i * lineHeight;
      if (typeof ctx.strokeText === 'function') ctx.strokeText(lines[i], textX, y, maxTextWidth);
      ctx.fillText(lines[i], textX, y, maxTextWidth);
    }
    ctx.restore();
  }

  _renderSelectionOverlay(ctx, clip) {
    const x = clip.x;
    const y = clip.y;
    const w = clip.width;
    const h = clip.height;
    const handleSize = 10;
    const halfH = handleSize / 2;

    ctx.save();

    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    ctx.fillStyle = '#22d3ee';
    const handles = this._getHandlePositions(clip);
    for (const key in handles) {
      const p = handles[key];
      ctx.fillRect(p.x - halfH, p.y - halfH, handleSize, handleSize);
      ctx.strokeStyle = '#0b0b16';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - halfH, p.y - halfH, handleSize, handleSize);
    }

    ctx.restore();
  }

  _getHandlePositions(clip) {
    const x = clip.x;
    const y = clip.y;
    const w = clip.width;
    const h = clip.height;
    const mx = x + w / 2;
    const my = y + h / 2;

    return {
      nw: { x: x, y: y },
      n:  { x: mx, y: y },
      ne: { x: x + w, y: y },
      e:  { x: x + w, y: my },
      se: { x: x + w, y: y + h },
      s:  { x: mx, y: y + h },
      sw: { x: x, y: y + h },
      w:  { x: x, y: my }
    };
  }

  _bindEvents() {
    // Pointer Events support mouse, pen and touch on phones/tablets.
    // Keep the gesture on the window as a fallback: some Android WebViews/PWA
    // builds stop delivering moves to the canvas after a touch starts.
    this.canvas.style.touchAction = 'none';
    this.canvas.style.userSelect = 'none';
    this.canvas.style.webkitUserSelect = 'none';
    this.activePointerId = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') e.preventDefault();
      if (e.button !== undefined && e.button !== 0) return;
      this.activePointerId = e.pointerId;
      try { this.canvas.setPointerCapture?.(e.pointerId); } catch (_) {}
      this._onMouseDown(e);
    });
    this._handlePointerMove = (e) => {
      if (this.activePointerId !== e.pointerId) return;
      if (e.pointerType === 'touch' && e.cancelable) e.preventDefault();
      this._onMouseMove(e);
    };
    this._handlePointerEnd = (e) => {
      if (this.activePointerId !== e.pointerId) return;
      this.activePointerId = null;
      this._onMouseUp();
    };
    window.addEventListener('pointermove', this._handlePointerMove, { passive: false });
    window.addEventListener('pointerup', this._handlePointerEnd);
    window.addEventListener('pointercancel', this._handlePointerEnd);
    this.canvas.addEventListener('lostpointercapture', (e) => this._handlePointerEnd(e));

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const selectedClip = this.comp.getSelectedClip();
      if (this.onContextMenu) {
        this.onContextMenu(e.clientX, e.clientY, selectedClip ? selectedClip.id : null);
      }
    });

    // Drag-and-drop media onto preview canvas
    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.canvas.classList.add('drag-over');
    });

    this.canvas.addEventListener('dragleave', () => {
      this.canvas.classList.remove('drag-over');
    });

    this.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      this.canvas.classList.remove('drag-over');
      if (this._onDropFiles) this._onDropFiles(e.dataTransfer.files, e);
    });
  }

  onDropFiles(callback) {
    this._onDropFiles = callback;
  }

  _getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    return {
      x: (clientX / rect.width) * this.comp.width,
      y: (clientY / rect.height) * this.comp.height
    };
  }

  _onMouseDown(e) {
    const pos = this._getCanvasPos(e);
    const selectedClip = this.comp.getSelectedClip();
    const activeClips = this.comp.getClipsAtTime(this.currentTime);

    if (selectedClip && activeClips.some(c => c.id === selectedClip.id)) {
      const handles = this._getHandlePositions(selectedClip);
      const hitDistance = 14 / this.scale;

      for (const key in handles) {
        const hp = handles[key];
        if (Math.hypot(pos.x - hp.x, pos.y - hp.y) <= hitDistance) {
          this.isDragging = true;
          this.dragMode = key;
          this.dragStartPos = pos;
          this.initialClipRect = {
            x: selectedClip.x,
            y: selectedClip.y,
            width: selectedClip.width,
            height: selectedClip.height
          };
          this.comp.startBatch('transform clip');
          return;
        }
      }
    }

    const sortedClips = [...activeClips].sort((a, b) => {
      const idxA = this.comp.tracks.findIndex(t => t.id === a.trackId);
      const idxB = this.comp.tracks.findIndex(t => t.id === b.trackId);
      return idxB - idxA;
    });

    const hitClip = sortedClips.find(clip => {
      return (
        pos.x >= clip.x &&
        pos.x <= clip.x + clip.width &&
        pos.y >= clip.y &&
        pos.y <= clip.y + clip.height
      );
    });

    if (hitClip) {
      const wasAlreadySelected = this.comp.selectedClipId === hitClip.id;
      this.comp.selectedClipId = hitClip.id;
      if (this.onSelectClip) this.onSelectClip(hitClip.id);

      // Touch and mouse use the same direct-manipulation gesture:
      // press on the visible clip and drag immediately.
      this.isDragging = true;
      this.dragMode = 'move';
      this.dragStartPos = pos;
      this.initialClipRect = {
        x: hitClip.x,
        y: hitClip.y,
        width: hitClip.width,
        height: hitClip.height
      };
      this.comp.startBatch('transform clip');
      this.render();
    } else {
      this.comp.selectedClipId = null;
      if (this.onSelectClip) this.onSelectClip(null);
      this.render();
    }
  }

  _onMouseMove(e) {
    if (!this.isDragging) return;

    const pos = this._getCanvasPos(e);
    const clip = this.comp.getSelectedClip();
    if (!clip) return;

    const dx = pos.x - this.dragStartPos.x;
    const dy = pos.y - this.dragStartPos.y;
    const init = this.initialClipRect;

    let newX = init.x;
    let newY = init.y;
    let newW = init.width;
    let newH = init.height;

    if (this.dragMode === 'move') {
      newX = Math.round(init.x + dx);
      newY = Math.round(init.y + dy);
    } else {
      if (this.dragMode.includes('e')) newW = Math.max(20, init.width + dx);
      if (this.dragMode.includes('s')) newH = Math.max(20, init.height + dy);
      if (this.dragMode.includes('w')) {
        const wCandidate = init.width - dx;
        if (wCandidate >= 20) {
          newW = wCandidate;
          newX = init.x + dx;
        }
      }
      if (this.dragMode.includes('n')) {
        const hCandidate = init.height - dy;
        if (hCandidate >= 20) {
          newH = hCandidate;
          newY = init.y + dy;
        }
      }
    }

    clip.x = Math.round(newX);
    clip.y = Math.round(newY);
    clip.width = Math.round(newW);
    clip.height = Math.round(newH);

    this.markNeedsRender();

    if (this.onChangeClipTransform) {
      this.onChangeClipTransform(clip);
    }
  }

  _onMouseUp() {
    if (this.isDragging) {
      this.isDragging = false;
      this.dragMode = null;
      this.comp.commitBatch();
    }
  }
}
