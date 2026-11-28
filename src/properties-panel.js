/**
 * Properties Panel Module
 * Displays and allows editing properties of the currently selected element.
 */
import { formatTime, escapeHtml, showToast } from './utils.js';
import { setKeyframe } from './keyframes.js';

const ASPECT_PRESETS = {
  '16:9': { ratio: 16 / 9, name: '16:9 横屏', default: { width: 1920, height: 1080 } },
  '9:16': { ratio: 9 / 16, name: '9:16 竖屏', default: { width: 1080, height: 1920 } },
  '1:1': { ratio: 1, name: '1:1 正方形', default: { width: 1080, height: 1080 } },
  '4:5': { ratio: 4 / 5, name: '4:5 竖版', default: { width: 1080, height: 1350 } },
  '4:3': { ratio: 4 / 3, name: '4:3 经典', default: { width: 1440, height: 1080 } },
  '21:9': { ratio: 21 / 9, name: '21:9 超宽屏', default: { width: 2560, height: 1080 } },
};

function getAspectRatioPreset(width, height) {
  const ratio = width / height;
  for (const [key, cfg] of Object.entries(ASPECT_PRESETS)) {
    if (Math.abs(ratio - cfg.ratio) < 0.02) return key;
  }
  return 'custom';
}

function getPresetDimensions(presetKey, currentWidth, currentHeight) {
  const cfg = ASPECT_PRESETS[presetKey];
  if (!cfg) return { width: currentWidth, height: currentHeight };

  const currentArea = currentWidth * currentHeight;
  const targetRatio = cfg.ratio;
  const height = Math.round(Math.sqrt(currentArea / targetRatio));
  const width = Math.round(height * targetRatio);
  return { width, height };
}


export class PropertiesPanel {
  constructor(container, composition, onChange, onMediaUrlRegistered, store) {
    this.container = container;
    this.comp = composition;
    this.onChange = onChange;
    this.onMediaUrlRegistered = onMediaUrlRegistered;
    this.store = store;

    this._lastSelectedClipId = null;
    this._lastPanelMode = null;

    this.render();
  }

  render() {
    const clip = this.comp.getSelectedClip();
    const mode = clip ? 'clip' : 'canvas';

    if (mode === 'clip' && this._lastPanelMode === 'clip' && this._lastSelectedClipId === clip.id) {
      this._updateClipValues(clip);
      return;
    }

    this._lastPanelMode = mode;
    this._lastSelectedClipId = clip ? clip.id : null;

    if (!clip) {
      this.renderCanvasSettings();
      return;
    }

    this._renderClipPanel(clip);
  }

  _updateClipValues(clip) {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (document.activeElement === el) return;
      if (el.value !== String(val)) el.value = val;
    };

    setVal('prop-start', clip.startTime);
    setVal('prop-duration', clip.duration);

    const isVisual = clip.type === 'video' || clip.type === 'image' || clip.type === 'text';
    if (isVisual) {
      setVal('prop-x', clip.x);
      setVal('prop-y', clip.y);
      setVal('prop-w', clip.width);
      setVal('prop-h', clip.height);
      setVal('prop-opacity', clip.opacity);
      const opacityVal = document.getElementById('prop-opacity-val');
      if (opacityVal) opacityVal.textContent = `${Math.round(clip.opacity * 100)}%`;
    }

    if (clip.type === 'text') {
      const textEl = document.getElementById('prop-text-content');
      if (textEl && document.activeElement !== textEl) {
        const safeText = clip.text || '';
        if (textEl.value !== safeText) textEl.value = safeText;
      }
      setVal('prop-text-size', clip.fontSize);
      const fontEl = document.getElementById('prop-text-font');
      if (fontEl && fontEl.value !== clip.fontFamily) fontEl.value = clip.fontFamily;
      setVal('prop-text-color', clip.color);
      const bgColor = clip.bgColor === 'transparent' ? '#000000' : clip.bgColor;
      setVal('prop-text-bg', bgColor);
      const bgTrans = document.getElementById('prop-text-bg-transparent');
      if (bgTrans) bgTrans.checked = clip.bgColor === 'transparent';
      const alignBtns = this.container.querySelectorAll('#prop-text-align .seg-btn');
      alignBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.align === (clip.textAlign || 'center'));
      });
      const boldEl = document.getElementById('prop-text-bold');
      if (boldEl) boldEl.checked = clip.fontWeight === 'bold';
    }

    const hasAudio = clip.type === 'video' || clip.type === 'audio';
    if (hasAudio) {
      setVal('prop-volume', clip.volume ?? 1);
      const volVal = document.getElementById('prop-volume-val');
      if (volVal) volVal.textContent = `${Math.round((clip.volume ?? 1) * 100)}%`;
    }
  }

  _renderClipPanel(clip) {
    const isVisual = clip.type === 'video' || clip.type === 'image' || clip.type === 'text';
    const isText = clip.type === 'text';
    const hasAudio = clip.type === 'video' || clip.type === 'audio';
    const hasKeyframes = clip.keyframes && Object.keys(clip.keyframes).length > 0;

    const typeNames = { video: '视频', image: '图片', text: '文字', audio: '音频' };
    const safeType = escapeHtml(typeNames[clip.type] || clip.type);
    const safeText = escapeHtml(clip.text || '');
    const safeAttr = value => escapeHtml(value === null || value === undefined ? '' : String(value));

    this.container.innerHTML = `
      <div class="panel-header compact">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M14 9h7"/><path d="M14 15h7"/></svg>
        <span>素材属性：${safeType}</span>
      </div>
      <div class="properties-body">

        <!-- Time & Duration -->
        <div class="prop-section">
          <span class="prop-section-title">时间与时长</span>
          <div class="prop-row">
            <label>开始时间（秒）</label>
            <input type="number" step="0.1" min="0" id="prop-start" value="${safeAttr(clip.startTime)}">
          </div>
          <div class="prop-row">
            <label>持续时间（秒）</label>
            <input type="number" step="0.1" min="0.5" id="prop-duration" value="${safeAttr(clip.duration)}">
          </div>
        </div>

        ${isVisual ? `
        <!-- Transform -->
        <div class="prop-section">
          <span class="prop-section-title">画面变换与位置</span>
          <div class="prop-grid-2">
            <div class="prop-field">
              <label>横向位置（像素）</label>
              <input type="number" id="prop-x" value="${safeAttr(clip.x)}">
            </div>
            <div class="prop-field">
              <label>纵向位置（像素）</label>
              <input type="number" id="prop-y" value="${safeAttr(clip.y)}">
            </div>
            <div class="prop-field">
              <label>宽度（像素）</label>
              <input type="number" min="10" id="prop-w" value="${safeAttr(clip.width)}">
            </div>
            <div class="prop-field">
              <label>高度（像素）</label>
              <input type="number" min="10" id="prop-h" value="${safeAttr(clip.height)}">
            </div>
          </div>
          <div class="prop-row" style="margin-top: 6px;">
            <label>不透明度</label>
            <input type="range" min="0" max="1" step="0.05" id="prop-opacity" value="${safeAttr(clip.opacity)}">
            <span class="prop-val-display" id="prop-opacity-val">${Math.round(clip.opacity * 100)}%</span>
          </div>
        </div>
        ` : ''}

        ${isText ? `
        <!-- Text Properties -->
        <div class="prop-section">
          <span class="prop-section-title">文字样式</span>
          <div class="prop-row-col">
            <label>字幕内容</label>
            <textarea id="prop-text-content" rows="4">${safeText}</textarea>
          </div>
          <div class="prop-row">
            <label>字体大小</label>
            <input type="number" min="12" max="300" id="prop-text-size" value="${safeAttr(clip.fontSize)}">
          </div>
          <div class="prop-row">
            <label>字体</label>
            <select id="prop-text-font">
              <option value="Inter" ${clip.fontFamily === 'Inter' ? 'selected' : ''}>Inter</option>
              <option value="JetBrains Mono" ${clip.fontFamily === 'JetBrains Mono' ? 'selected' : ''}>JetBrains Mono</option>
              <option value="Arial" ${clip.fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
              <option value="Impact" ${clip.fontFamily === 'Impact' ? 'selected' : ''}>Impact</option>
              <option value="Georgia" ${clip.fontFamily === 'Georgia' ? 'selected' : ''}>Georgia</option>
            </select>
          </div>
          <div class="prop-row">
            <label>自定义字体</label>
            <input type="file" id="prop-text-font-file" accept=".ttf,.otf,.woff,.woff2">
          </div>
          <div class="prop-row">
            <label>对齐方式</label>
            <div class="prop-segmented" id="prop-text-align">
              <button type="button" class="seg-btn ${clip.textAlign === 'left' ? 'active' : ''}" data-align="left" title="左对齐" aria-label="左对齐">L</button>
              <button type="button" class="seg-btn ${clip.textAlign === 'center' ? 'active' : ''}" data-align="center" title="居中对齐" aria-label="居中对齐">C</button>
              <button type="button" class="seg-btn ${clip.textAlign === 'right' ? 'active' : ''}" data-align="right" title="右对齐" aria-label="右对齐">R</button>
            </div>
          </div>
          <div class="prop-row">
            <label>加粗</label>
            <input type="checkbox" id="prop-text-bold" ${clip.fontWeight === 'bold' ? 'checked' : ''}>
          </div>
          <div class="prop-row">
            <label>文字颜色</label>
            <input type="color" id="prop-text-color" value="${safeAttr(clip.color)}">
          </div>
          <div class="prop-row">
            <label>背景颜色</label>
            <input type="color" id="prop-text-bg" value="${safeAttr(clip.bgColor === 'transparent' ? '#000000' : clip.bgColor)}">
          </div>
          <div class="prop-row">
            <label>背景透明</label>
            <input type="checkbox" id="prop-text-bg-transparent" ${clip.bgColor === 'transparent' ? 'checked' : ''}>
          </div>
        ` : ''}

        ${hasAudio ? `
        <!-- Audio 音量 -->
        <div class="prop-section">
          <span class="prop-section-title">音频</span>
          <div class="prop-row">
            <label>音量</label>
            <input type="range" min="0" max="2" step="0.05" id="prop-volume" value="${safeAttr(clip.volume ?? 1)}">
            <span class="prop-val-display" id="prop-volume-val">${Math.round((clip.volume ?? 1) * 100)}%</span>
          </div>
          <div class="prop-row">
            <label>淡入（秒）</label>
            <input type="number" min="0" step="0.1" id="prop-fade-in" value="${safeAttr(clip.fadeIn || 0)}">
          </div>
          <div class="prop-row">
            <label>淡出（秒）</label>
            <input type="number" min="0" step="0.1" id="prop-fade-out" value="${safeAttr(clip.fadeOut || 0)}">
          </div>
        </div>
        ` : ''}

        <!-- Keyframes -->
        <div class="prop-section">
          <span class="prop-section-title">关键帧动画</span>
          <div class="prop-row">
            <button class="tool-btn" id="prop-kf-position" type="button">+ 位置</button>
            <button class="tool-btn" id="prop-kf-scale" type="button">+ 缩放</button>
          </div>
          <div class="prop-row" style="margin-top: 4px;">
            <button class="tool-btn" id="prop-kf-rotation" type="button">+ 旋转</button>
            <button class="tool-btn" id="prop-kf-opacity" type="button">+ 不透明度</button>
          </div>
          ${hasKeyframes ? `
          <div class="prop-row" style="margin-top: 6px;">
            <span class="prop-val-display">${Object.keys(clip.keyframes).length} 个动画属性</span>
          </div>
          ` : ''}
        </div>

        <div class="prop-actions">
          <button class="tool-btn danger wide" id="prop-delete-btn" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            删除素材
          </button>
        </div>

      </div>
    `;

    this._bindInputs(clip);
  }

  renderCanvasSettings() {
    const duration = this.comp.duration;
    const trackCount = this.comp.tracks.length;
    const clipCount = this.comp.clips.length;
    const ratio = getAspectRatioPreset(this.comp.width, this.comp.height);
    const safeAttr = value => escapeHtml(value === null || value === undefined ? '' : String(value));

    this.container.innerHTML = `
      <div class="panel-header compact">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
        <span>画布与项目设置</span>
      </div>
      <div class="properties-body">

        <div class="prop-section">
          <span class="prop-section-title">画面比例</span>
          <div class="prop-row">
            <select id="canvas-ratio-select" style="width: 100%;">
              <option value="16:9" ${ratio === '16:9' ? 'selected' : ''}>16:9 横屏</option>
              <option value="9:16" ${ratio === '9:16' ? 'selected' : ''}>9:16 竖屏</option>
              <option value="1:1" ${ratio === '1:1' ? 'selected' : ''}>1:1 正方形</option>
              <option value="4:5" ${ratio === '4:5' ? 'selected' : ''}>4:5 竖版</option>
              <option value="4:3" ${ratio === '4:3' ? 'selected' : ''}>4:3 经典</option>
              <option value="21:9" ${ratio === '21:9' ? 'selected' : ''}>21:9 超宽屏</option>
              <option value="custom" ${ratio === 'custom' ? 'selected' : ''}>自定义</option>
            </select>
          </div>
        </div>

        <div class="prop-section">
          <span class="prop-section-title">分辨率（像素）</span>
          <div class="canvas-prop-grid">
            <div class="prop-field">
              <label>宽度</label>
              <input type="number" min="100" max="7680" id="canvas-width" value="${safeAttr(this.comp.width)}">
            </div>
            <div class="prop-field">
              <label>高度</label>
              <input type="number" min="100" max="7680" id="canvas-height" value="${safeAttr(this.comp.height)}">
            </div>
          </div>
          <div class="canvas-scale-row" style="margin-top: 6px;">
            <button class="canvas-scale-btn" data-w="3840" data-h="2160">4K</button>
            <button class="canvas-scale-btn" data-w="1920" data-h="1080">1080p</button>
            <button class="canvas-scale-btn" data-w="1280" data-h="720">720p</button>
            <button class="canvas-scale-btn" data-w="960" data-h="540">540p</button>
          </div>
          <button class="tool-btn wide" id="canvas-apply-btn" type="button" style="margin-top: 10px;">应用设置</button>
        </div>

        <div class="prop-section">
          <span class="prop-section-title">项目概览</span>
          <div class="canvas-summary">
            <div><strong>时长：</strong> ${formatTime(duration)}</div>
            <div><strong>轨道数：</strong> ${trackCount}</div>
            <div><strong>素材数：</strong> ${clipCount}</div>
            <div><strong>分辨率：</strong> ${safeAttr(this.comp.width)}×${safeAttr(this.comp.height)}</div>
          </div>
        </div>

      </div>
    `;

    this._bindCanvasInputs();
  }

  _bindCanvasInputs() {
    const widthEl = document.getElementById('canvas-width');
    const heightEl = document.getElementById('canvas-height');
    const ratioSelect = document.getElementById('canvas-ratio-select');
    const applyBtn = document.getElementById('canvas-apply-btn');

    const applyDimensions = (w, h) => {
      this.comp.setDimensions(w, h);
      if (this.onChange) this.onChange();
      this.render();
    };

    const updateFromPreset = (preset) => {
      if (preset === 'custom') return;
      const dims = getPresetDimensions(preset, this.comp.width, this.comp.height);
      if (widthEl) widthEl.value = dims.width;
      if (heightEl) heightEl.value = dims.height;
    };

    if (ratioSelect) {
      ratioSelect.addEventListener('change', () => {
        updateFromPreset(ratioSelect.value);
      });
    }

    const scaleBtns = this.container.querySelectorAll('.canvas-scale-btn');
    for (const btn of scaleBtns) {
      btn.addEventListener('click', () => {
        const w = parseInt(btn.dataset.w, 10);
        const h = parseInt(btn.dataset.h, 10);
        if (widthEl) widthEl.value = w;
        if (heightEl) heightEl.value = h;
        if (ratioSelect) {
          ratioSelect.value = getAspectRatioPreset(w, h);
        }
      });
    }

    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        const w = parseInt(widthEl?.value, 10);
        const h = parseInt(heightEl?.value, 10);
        if (!isNaN(w) && !isNaN(h)) {
          applyDimensions(w, h);
        }
      });
    }
  }

  _bindInputs(clip) {
    const bindNum = (id, prop, isFloat = false) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        const val = isFloat ? parseFloat(el.value) : parseInt(el.value, 10);
        if (!isNaN(val)) {
          clip[prop] = val;
          this.comp.saveSnapshot();
          if (this.onChange) this.onChange();
        }
      });
    };

    bindNum('prop-start', 'startTime', true);
    bindNum('prop-duration', 'duration', true);
    bindNum('prop-x', 'x');
    bindNum('prop-y', 'y');
    bindNum('prop-w', 'width');
    bindNum('prop-h', 'height');

    const opacityEl = document.getElementById('prop-opacity');
    if (opacityEl) {
      opacityEl.addEventListener('input', () => {
        clip.opacity = parseFloat(opacityEl.value);
        document.getElementById('prop-opacity-val').textContent = `${Math.round(clip.opacity * 100)}%`;
        if (this.onChange) this.onChange();
      });
      opacityEl.addEventListener('change', () => this.comp.saveSnapshot());
    }

    const textContentEl = document.getElementById('prop-text-content');
    if (textContentEl) {
      textContentEl.addEventListener('input', () => {
        clip.text = textContentEl.value;
        clip.name = clip.text.length > 15 ? clip.text.substring(0, 15) + '...' : clip.text;
        if (this.onChange) this.onChange();
      });
      textContentEl.addEventListener('change', () => this.comp.saveSnapshot());
    }

    bindNum('prop-text-size', 'fontSize');

    const fontSelect = document.getElementById('prop-text-font');
    if (fontSelect) {
      fontSelect.addEventListener('change', () => {
        clip.fontFamily = fontSelect.value;
        this.comp.saveSnapshot();
        if (this.onChange) this.onChange();
      });
    }

    const fontFileEl = document.getElementById('prop-text-font-file');
    if (fontFileEl) {
      fontFileEl.addEventListener('change', () => {
        const file = fontFileEl.files[0];
        if (!file) return;
        const customName = 'custom-font-' + Date.now();
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          const face = new FontFace(customName, `url(${dataUrl})`);
          face.load().then(() => {
            document.fonts.add(face);
            clip.fontFamily = customName;
            clip.customFontUrl = dataUrl;
            this.comp.saveSnapshot();
            if (this.onChange) this.onChange();
            showToast(`自定义字体已加载： ${file.name}`, 'success');
          }).catch((err) => {
            showToast('自定义字体加载失败： ' + file.name, 'error');
            console.error(err);
          }).finally(() => {
            fontFileEl.value = '';
          });
        };
        reader.onerror = () => {
          showToast('自定义字体读取失败： ' + file.name, 'error');
          fontFileEl.value = '';
        };
        reader.readAsDataURL(file);
      });
    }

    const alignBtns = this.container.querySelectorAll('#prop-text-align .seg-btn');
    alignBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        clip.textAlign = btn.dataset.align;
        alignBtns.forEach(b => b.classList.toggle('active', b === btn));
        this.comp.saveSnapshot();
        if (this.onChange) this.onChange();
      });
    });

    const boldEl = document.getElementById('prop-text-bold');
    if (boldEl) {
      boldEl.addEventListener('change', () => {
        clip.fontWeight = boldEl.checked ? 'bold' : 'normal';
        this.comp.saveSnapshot();
        if (this.onChange) this.onChange();
      });
    }

    const textColorEl = document.getElementById('prop-text-color');
    const textBgEl = document.getElementById('prop-text-bg');
    const textBgTransparentEl = document.getElementById('prop-text-bg-transparent');
    if (textColorEl) {
      textColorEl.addEventListener('input', () => {
        clip.color = textColorEl.value;
        if (this.onChange) this.onChange();
      });
      textColorEl.addEventListener('change', () => this.comp.saveSnapshot());
    }
    if (textBgEl && textBgTransparentEl) {
      const applyBg = () => {
        clip.bgColor = textBgTransparentEl.checked ? 'transparent' : textBgEl.value;
        if (this.onChange) this.onChange();
      };
      textBgEl.addEventListener('input', applyBg);
      textBgEl.addEventListener('change', () => { applyBg(); this.comp.saveSnapshot(); });
      textBgTransparentEl.addEventListener('change', () => { applyBg(); this.comp.saveSnapshot(); });
    }

    const volEl = document.getElementById('prop-volume');
    if (volEl) {
      volEl.addEventListener('input', () => {
        clip.volume = parseFloat(volEl.value);
        document.getElementById('prop-volume-val').textContent = `${Math.round(clip.volume * 100)}%`;
        if (this.onChange) this.onChange();
      });
      volEl.addEventListener('change', () => this.comp.saveSnapshot());
    }

    const fadeInEl = document.getElementById('prop-fade-in');
    const fadeOutEl = document.getElementById('prop-fade-out');
    if (fadeInEl) {
      fadeInEl.addEventListener('change', () => {
        clip.fadeIn = parseFloat(fadeInEl.value) || 0;
        this.comp.saveSnapshot();
        if (this.onChange) this.onChange();
      });
    }
    if (fadeOutEl) {
      fadeOutEl.addEventListener('change', () => {
        clip.fadeOut = parseFloat(fadeOutEl.value) || 0;
        this.comp.saveSnapshot();
        if (this.onChange) this.onChange();
      });
    }

    // Keyframe buttons
    const bindKeyframe = (id, property, valueFn) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', () => {
        const currentTime = this.store ? this.store.get('currentTime') || 0 : 0;
        const value = valueFn();
        clip.keyframes = setKeyframe(clip.keyframes, property, currentTime, value, 'linear');
        this.comp.saveSnapshot();
        if (this.onChange) this.onChange();
        showToast(`已添加关键帧： ${property}`, 'success');
      });
    };

    bindKeyframe('prop-kf-position', 'x', () => clip.x);
    bindKeyframe('prop-kf-scale', 'scale', () => 1);
    bindKeyframe('prop-kf-rotation', 'rotation', () => 0);
    bindKeyframe('prop-kf-opacity', 'opacity', () => clip.opacity ?? 1);

    const delBtn = document.getElementById('prop-delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        // Keep the temporary media URL registered while deletion remains undoable.
        this.comp.removeClip(clip.id);
        if (this.onChange) this.onChange();
      });
    }
  }
}
