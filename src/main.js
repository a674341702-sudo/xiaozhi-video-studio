/**
 * Viz — First Local Video Editor
 * Main Application Orchestrator
 */
import './style.css';
import { Composition } from './composition.js';
import { CanvasPreview } from './canvas-preview.js';
import { MultiTimeline } from './multi-timeline.js';
import { MediaManager } from './media-manager.js';
import { PropertiesPanel } from './properties-panel.js';
import { ClipboardManager } from './clipboard.js';
import { ContextMenu } from './context-menu.js';
import { Toolbar } from './toolbar.js';
import { createDefaultStore } from './state.js';
import { loadFFmpeg, exportComposition, downloadBlob } from './ffmpeg-worker.js';
import { formatTime, showToast } from './utils.js';
import { getExportErrorMessage } from './export-error-message.js';
import { getClipPlaybackState, getMediaElementVolume, isTrackAudioEnabled } from './keyframes.js';
import { LiveAudioMixer } from './live-audio-mixer.js';
import { initAutoWorkflow } from './auto-workflow.js';
import { initSubtitleStudio } from './subtitle-studio.js';
import { saveLocalProject, loadLocalProject, loadLastActiveLocalProject, listLocalProjects, deleteLocalProject, createLocalProjectId, stripTemporaryMediaUrls } from './local-project-store.js';
import { createProjectBundle, readProjectBundle } from './project-bundle.js';
import { sanitizeProjectDocument, MAX_PROJECT_DOCUMENT_BYTES } from './project-validation.js';
import { createSerialTaskQueue } from './serial-task-queue.js';
import { shouldWarnBeforeProjectExit } from './local-save-guard.js';
import { getLocalStorageFailureMessage } from './local-storage-diagnostics.js';
import { revokeProxy } from './proxy.js';
import { assertProjectMediaComplete } from './project-media-integrity.js';
import { buildProjectMediaRestorePlan } from './project-media-restore-plan.js';

// --- Global State ---
let composition = null;
let canvasPreview = null;
let multiTimeline = null;
let mediaManager = null;
let propertiesPanel = null;
let clipboardManager = null;
let contextMenu = null;
let toolbar = null;
let store = null;

let liveAudioMixer = new LiveAudioMixer();
let isPlaying = false;
let playAnimFrameId = null;
let lastPlayTimestamp = 0;
let playbackRate = 1;

let inPoint = 0;
let outPoint = 0;

// --- DOM References ---
const previewCanvasEl = document.getElementById('preview-canvas');
const timelineContainerEl = document.getElementById('multitimeline-container');
const propertiesContainerEl = document.getElementById('properties-panel-container');

const ctrlPlayBtn = document.getElementById('ctrl-play');
const ctrlStopBtn = document.getElementById('ctrl-stop');
const ctrlTimeEl = document.getElementById('ctrl-time');
const previewTimeEl = document.getElementById('preview-time');
const previewBadgeEl = document.getElementById('preview-badge');
const previewRatioSelectEl = document.getElementById('preview-ratio-select');
const headerStatusEl = document.getElementById('header-status');
const headerFilenameEl = document.getElementById('header-filename');

const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomLevelEl = document.getElementById('zoom-level');

const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');

const btnCopy = document.getElementById('btn-copy');
const btnPaste = document.getElementById('btn-paste');
const btnDuplicate = document.getElementById('btn-duplicate');
const btnDelete = document.getElementById('btn-delete');
const btnExport = document.getElementById('btn-export');

const progressOverlay = document.getElementById('progress-overlay');
const progressBar = document.getElementById('progress-bar');
const progressPercent = document.getElementById('progress-percent');
const progressTitle = document.getElementById('progress-title');
const progressSubtitle = document.getElementById('progress-subtitle');
const progressCancelBtn = document.getElementById('progress-cancel-btn');

const exportWidthEl = document.getElementById('export-width');
const exportHeightEl = document.getElementById('export-height');
const exportFpsEl = document.getElementById('export-fps');
const exportQualityEl = document.getElementById('export-quality');

let exportAbortController = null;
let isExporting = false;
let localRestoreComplete = false;
let localAutosaveTimer = null;
let localAutosaveInProgress = false;
let localAutosavePendingCount = 0;
const enqueueLocalSave = createSerialTaskQueue();
let localAutosaveDirty = false;
let localAutosaveErrorShown = false;
let isRestoringLocalProject = false;
let activeProjectId = 'last-open-project';
let activeProjectName = '小智视频项目';
const localSaveStatusEl = document.getElementById('local-save-status');

const mediaUrlRegistry = new Map(); // clipId -> objectUrl for cleanup

function bindHomeDashboard() {
  document.addEventListener('click', event => {
    const actionButton = event.target.closest('[data-home-action]');
    if (!actionButton) return;
    const action = actionButton.dataset.homeAction;
    if (action === 'editor') {
      document.body.classList.remove('home-mode');
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    if (action === 'projects') {
      document.getElementById('btn-project-library')?.click();
      return;
    }

    // Open the workflow modal directly. The floating launcher is deliberately
    // hidden on the home screen, so relying on its synthetic click is fragile
    // on mobile browsers and can leave the upload cards appearing unresponsive.
    const modal = document.getElementById('xiaozhi-workflow');
    if (!modal) {
      showToast('商家制作工作台正在加载，请稍后再试。', 'warning');
      return;
    }
    modal.classList.add('open');

    const targets = {
      viral: 'xzw-reference-studio',
      smart: 'xzw-files',
      materials: 'xzw-files',
      document: 'xzw-brief-file'
    };
    const target = document.getElementById(targets[action]);
    if (!target) {
      showToast('对应的上传区域还没有准备好，请稍后再试。', 'warning');
      return;
    }

    const section = target.closest('.xzw-section') || target;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (action === 'smart' || action === 'materials') {
      // Both primary entry points mean "start by selecting merchant media".
      // Open the native picker directly from the user's tap; focusing the input
      // alone is not enough on mobile browsers.
      target.click();
    } else if (action === 'document') {
      target.click();
    } else {
      target.focus({ preventScroll: true });
    }
  });
}

// --- Initialization ---
async function initApp() {
  document.body.classList.add('home-mode');
  bindHomeDashboard();
  store = createDefaultStore();
  composition = new Composition(1920, 1080);

  // 1. Media Manager
  mediaManager = new MediaManager(composition, () => onCompositionChanged(), onMediaUrlRegistered, store);

  // 2. Clipboard Manager
  clipboardManager = new ClipboardManager(
    composition,
    () => canvasPreview ? canvasPreview.currentTime : 0,
    () => onCompositionChanged(),
    onMediaUrlRegistered
  );

  // 3. Context Menu
  contextMenu = new ContextMenu({
    composition: composition,
    getPlayheadTime: () => canvasPreview ? canvasPreview.currentTime : 0,
    onCompositionChanged: () => onCompositionChanged(),
    clipboardManager: clipboardManager,
    onMediaUrlRegistered: onMediaUrlRegistered
  });

  // 4. Canvas Preview Renderer
  canvasPreview = new CanvasPreview({
    canvas: previewCanvasEl,
    composition: composition,
    onSelectClip: (clipId) => onCompositionChanged(),
    onChangeClipTransform: (clip) => {
      propertiesPanel.render();
    },
    onCommitClipTransform: () => onCompositionChanged(),
    onContextMenu: (x, y, clipId) => {
      contextMenu.show(x, y, clipId);
    }
  });

  // 5. Multi-Track Timeline
  multiTimeline = new MultiTimeline({
    container: timelineContainerEl,
    composition: composition,
    store: store,
    onSeek: (targetTime) => {
      seekTo(targetTime);
    },
    onSelectClip: (clipId) => onCompositionChanged(),
    onChangeClipTime: (clip) => {
      propertiesPanel.render();
      canvasPreview.render();
    },
    onCommitClipTime: () => onCompositionChanged(),
    onContextMenu: (x, y, clipId, clickTime) => {
      contextMenu.show(x, y, clipId, clickTime);
    }
  });

  // 6. Properties Panel
  propertiesPanel = new PropertiesPanel(
    propertiesContainerEl,
    composition,
    () => onCompositionChanged(),
    onMediaUrlRegistered,
    store
  );

  // 7. Toolbar
  toolbar = new Toolbar({
    onTogglePlay: togglePlay,
    onPause: pause,
    onStop: stop,
    onReversePlayback: () => setPlaybackRate(-1),
    onForwardPlayback: () => setPlaybackRate(1),
    onUndo: () => { if (composition.undo()) onCompositionChanged(); },
    onRedo: () => { if (composition.redo()) onCompositionChanged(); },
    onSplit: () => {
      const clip = composition.getSelectedClip();
      if (clip && contextMenu) contextMenu.splitClipAtTime(clip, canvasPreview.currentTime);
    },
    onDelete: () => clipboardManager.deleteSelected(),
    onExport: handleExport,
    onCopy: () => clipboardManager.copy(),
    onPaste: () => clipboardManager.paste(),
    onDuplicate: () => clipboardManager.duplicate(),
    onSetInPoint: setInPoint,
    onSetOutPoint: setOutPoint,
    onSeek: (t) => seekTo(t),
    onNudgeSeek: (delta) => seekTo((canvasPreview?.currentTime || 0) + delta),
    getDuration: () => composition.duration
  });

  bindControls();
  bindDropHandlers();
  window.addEventListener('beforeunload', event => {
    if (!shouldWarnBeforeProjectExit({
      dirty: localAutosaveDirty,
      timerActive: Boolean(localAutosaveTimer),
      inProgress: localAutosaveInProgress,
      pendingCount: localAutosavePendingCount
    })) return;
    // The browser may terminate async IndexedDB writes during navigation.
    // Ask the user to stay so the visible save status can finish first.
    event.preventDefault();
    event.returnValue = '';
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && localRestoreComplete) {
      if (localAutosaveTimer) clearTimeout(localAutosaveTimer);
      localAutosaveTimer = null;
      saveCurrentProjectLocally();
    }
  });
  // Load the large FFmpeg WASM engine only when the user exports, preserving phone memory during editing.
  onCompositionChanged();
  updateHeaderProjectName();
  initAutoWorkflow({ composition, mediaManager, canvasPreview, onCompositionChanged, releaseMediaUrls, onExport: handleExport });
  initSubtitleStudio({ composition, onCompositionChanged });

  await restoreLastLocalProject();
  applyDeviceExportDefaults();
  localRestoreComplete = true;
  onCompositionChanged();
}

function applyDeviceExportDefaults() {
  const isMobile = (typeof navigator !== 'undefined' && Number(navigator.maxTouchPoints || 0) > 1) ||
    (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 900px)').matches);
  if (!isMobile) return;

  const sourceWidth = Math.max(2, Number(composition.width) || 720);
  const sourceHeight = Math.max(2, Number(composition.height) || 1280);
  const scale = Math.min(1, 1280 / Math.max(sourceWidth, sourceHeight));
  const evenDimension = value => Math.max(2, Math.floor(value / 2) * 2);

  if (exportWidthEl) exportWidthEl.value = String(evenDimension(sourceWidth * scale));
  if (exportHeightEl) exportHeightEl.value = String(evenDimension(sourceHeight * scale));
  if (exportFpsEl) exportFpsEl.value = '24';
  if (exportQualityEl) exportQualityEl.value = 'medium';
}

function onMediaUrlRegistered(clipId, objectUrl) {
  if (objectUrl) mediaUrlRegistry.set(clipId, objectUrl);
  else mediaUrlRegistry.delete(clipId);
}

// Release all temporary media URLs before replacing or rolling back a composition.
function releaseMediaUrls() {
  // Prevent a slow file read from inserting old-project media after a project switch.
  mediaManager?.cancelPendingImports?.();
  for (const url of mediaUrlRegistry.values()) {
    try { revokeProxy(url); } catch (_) {}
    try { URL.revokeObjectURL(url); } catch (_) {}
  }
  mediaUrlRegistry.clear();
}

function onCompositionChanged() {
  if (
    canvasPreview.canvas.width === 0 ||
    canvasPreview.canvas.height === 0 ||
    canvasPreview.lastCompWidth !== composition.width ||
    canvasPreview.lastCompHeight !== composition.height
  ) {
    canvasPreview.resize();
    canvasPreview.lastCompWidth = composition.width;
    canvasPreview.lastCompHeight = composition.height;
  }

  canvasPreview.markNeedsRender();
  multiTimeline.render();
  propertiesPanel.render();
  updatePreviewResolutionBadge();
  updateTimeDisplay();
  updateUndoRedoButtons();
  toolbar?.setPlaying(isPlaying);
  scheduleLocalAutosave();
}

function updateHeaderProjectName(name = '新建视频项目') {
  activeProjectName = name;
  if (headerFilenameEl) headerFilenameEl.textContent = name;
}

function updatePreviewResolutionBadge() {
  if (previewBadgeEl) {
    previewBadgeEl.textContent = `${composition.width}×${composition.height}`;
  }
  if (previewRatioSelectEl) {
    const ratio = getAspectRatioPreset(composition.width, composition.height);
    previewRatioSelectEl.value = ratio;
  }
}

function getAspectRatioPreset(width, height) {
  const r = width / height;
  if (Math.abs(r - 16 / 9) < 0.02) return '16:9';
  if (Math.abs(r - 9 / 16) < 0.02) return '9:16';
  if (Math.abs(r - 1) < 0.02) return '1:1';
  if (Math.abs(r - 4 / 5) < 0.02) return '4:5';
  if (Math.abs(r - 4 / 3) < 0.02) return '4:3';
  if (Math.abs(r - 21 / 9) < 0.02) return '21:9';
  return 'custom';
}

function getPresetDimensions(presetKey, currentWidth, currentHeight) {
  const presets = {
    '16:9': 16 / 9,
    '9:16': 9 / 16,
    '1:1': 1,
    '4:5': 4 / 5,
    '4:3': 4 / 3,
    '21:9': 21 / 9,
  };
  const ratio = presets[presetKey];
  if (!ratio) return { width: currentWidth, height: currentHeight };
  const area = currentWidth * currentHeight;
  const height = Math.round(Math.sqrt(area / ratio));
  const width = Math.round(height * ratio);
  return { width, height };
}

function seekTo(targetTime, playing = false) {
  const t = clamp(targetTime, 0, composition.duration);
  canvasPreview.setCurrentTime(t);
  multiTimeline.setCurrentTime(t);
  updateTimeDisplay();
  syncActiveMedia(t, playing);
}

function resizePreviewOnce() {
  if (!canvasPreview) return;
  if (
    canvasPreview.lastCompWidth !== composition.width ||
    canvasPreview.lastCompHeight !== composition.height
  ) {
    canvasPreview.resize();
    canvasPreview.lastCompWidth = composition.width;
    canvasPreview.lastCompHeight = composition.height;
  }
}

function updateTimeDisplay() {
  const current = canvasPreview.currentTime;
  const total = composition.duration;

  if (ctrlTimeEl) ctrlTimeEl.textContent = formatTime(current);
  if (previewTimeEl) previewTimeEl.textContent = `${formatTime(current)} / ${formatTime(total)}`;
}

function updateUndoRedoButtons() {
  if (btnUndo) btnUndo.disabled = !composition.canUndo();
  if (btnRedo) btnRedo.disabled = !composition.canRedo();
  toolbar?.set撤销重做?.(composition.canUndo(), composition.canRedo());
}

function syncActiveMedia(time, playing) {
  for (const clip of composition.clips) {
    if (!clip.element || (clip.type !== 'video' && clip.type !== 'audio')) continue;

    const element = clip.element;
    const track = composition.getTrack(clip.trackId);
    const state = getClipPlaybackState(
      clip,
      time,
      Number.isFinite(element.duration) && element.duration > 0 ? element.duration : Infinity
    );

    // Use Web Audio for the editor's 0..150% gain range; fall back to native 0..100%.
    if (liveAudioMixer.connect(element)) {
      element.volume = 1;
      liveAudioMixer.setGain(element, state.volume);
    } else {
      element.volume = getMediaElementVolume(state.volume);
    }
    element.muted = !isTrackAudioEnabled(track);
    // Native looping is safe only when the selected source range is the
    // complete media file. Trimmed loops are wrapped against sourceTime above.
    const mediaDuration = Number.isFinite(element.duration) ? element.duration : 0;
    const trimStart = Math.max(0, Number(clip.trimStart) || 0);
    const trimEnd = Number.isFinite(Number(clip.trimEnd)) ? Number(clip.trimEnd) : mediaDuration;
    element.loop = state.loop && trimStart <= 0.001 && trimEnd >= mediaDuration - 0.05 && mediaDuration > 0;

    if (!state.active || state.sourceEnded) {
      if (!element.paused) element.pause();
      if (state.sourceEnded && !state.loop) {
        const safeEnd = Number.isFinite(element.duration) && element.duration > 0
          ? Math.min(element.duration, Math.max(0, Number(clip.trimEnd) || element.duration))
          : state.sourceTime;
        if (Math.abs(element.currentTime - safeEnd) > 0.05) element.currentTime = safeEnd;
      }
      continue;
    }

    const threshold = playing
      ? (clip.type === 'audio' ? 0.12 : 0.3)
      : 0.04;
    if (Number.isFinite(state.sourceTime) && Math.abs(element.currentTime - state.sourceTime) > threshold) {
      try { element.currentTime = state.sourceTime; } catch { /* metadata may still be loading */ }
    }

    if (playing) {
      element.playbackRate = Math.abs(playbackRate);
      if (element.paused) element.play().catch(() => {});
    } else if (!element.paused) {
      element.pause();
    }
  }
}

function togglePlay() {
  if (isPlaying) {
    pause();
  } else {
    play();
  }
}

function setPlaybackRate(rate) {
  playbackRate = rate;
  if (!isPlaying) {
    play();
  }
}

function play() {
  if (isPlaying) return;
  // Resume inside the play gesture so mobile browsers can unlock audio output.
  liveAudioMixer.resume().catch(() => {});
  isPlaying = true;
  if (canvasPreview) canvasPreview.setIsPlaying(true);
  lastPlayTimestamp = performance.now();

  syncActiveMedia(canvasPreview.currentTime, true);

  const playIcon = document.getElementById('ctrl-play-icon');
  if (playIcon) {
    playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>';
  }
  toolbar?.setPlaying(true);

  const loop = (now) => {
    if (!isPlaying) return;
    const dt = ((now - lastPlayTimestamp) / 1000) * playbackRate;
    lastPlayTimestamp = now;

    let nextTime = canvasPreview.currentTime + dt;
    const totalDur = composition.duration;

    // Loop between in/out points if they are set
    if (outPoint > inPoint) {
      if (nextTime > outPoint) nextTime = inPoint;
      if (nextTime < inPoint && dt < 0) nextTime = outPoint;
    }

    if (nextTime >= totalDur) {
      nextTime = totalDur;
      pause();
    } else if (nextTime < 0) {
      nextTime = 0;
      pause();
    }

    canvasPreview.setCurrentTime(nextTime);
    multiTimeline.setCurrentTime(nextTime);
    updateTimeDisplay();
    syncActiveMedia(nextTime, true);

    playAnimFrameId = requestAnimationFrame(loop);
  };

  playAnimFrameId = requestAnimationFrame(loop);
}

function pause() {
  if (!isPlaying) return;
  isPlaying = false;
  playbackRate = 1;
  if (canvasPreview) canvasPreview.setIsPlaying(false);
  if (playAnimFrameId) cancelAnimationFrame(playAnimFrameId);

  syncActiveMedia(canvasPreview.currentTime, false);

  const playIcon = document.getElementById('ctrl-play-icon');
  if (playIcon) {
    playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
  }
  toolbar?.setPlaying(false);
}

function stop() {
  pause();
  seekTo(inPoint || 0);
}

function setInPoint() {
  inPoint = canvasPreview.currentTime;
  showToast(`已设置入点： ${formatTime(inPoint)}`, 'info');
}

function setOutPoint() {
  outPoint = canvasPreview.currentTime;
  showToast(`已设置出点： ${formatTime(outPoint)}`, 'info');
}

// --- Event Controls Binding ---
function bindControls() {
  if (ctrlPlayBtn) ctrlPlayBtn.addEventListener('click', togglePlay);
  if (ctrlStopBtn) ctrlStopBtn.addEventListener('click', stop);

  document.getElementById('add-video-btn')?.addEventListener('click', () => mediaManager.addVideo());
  document.getElementById('add-image-btn')?.addEventListener('click', () => mediaManager.addImage());
  document.getElementById('add-text-btn')?.addEventListener('click', () => {
    const textVal = prompt('Enter text for overlay:', 'Title Overlay');
    if (textVal) mediaManager.addText(textVal);
  });
  document.getElementById('add-audio-btn')?.addEventListener('click', () => mediaManager.addAudio());

  const btnNewProject = document.getElementById('btn-new-project');
  const btnSaveProject = document.getElementById('btn-save-project');
  const btnLoadProject = document.getElementById('btn-load-project');
  const projectLibrary = document.getElementById('project-library');
  document.getElementById('btn-project-library')?.addEventListener('click', () => {
    projectLibrary?.removeAttribute('hidden');
    renderProjectLibrary();
  });
  document.getElementById('project-library-close')?.addEventListener('click', () => projectLibrary?.setAttribute('hidden', ''));
  projectLibrary?.addEventListener('click', event => {
    if (event.target === projectLibrary) projectLibrary.setAttribute('hidden', '');
  });
  document.getElementById('project-save-copy')?.addEventListener('click', saveAsNewLocalProject);
  document.getElementById('project-export-bundle')?.addEventListener('click', exportCurrentProjectBundle);
  const projectBundleInput = document.getElementById('project-bundle-input');
  document.getElementById('project-import-bundle')?.addEventListener('click', () => projectBundleInput?.click());
  projectBundleInput?.addEventListener('change', () => {
    const file = projectBundleInput.files?.[0];
    if (file) importProjectBundleFile(file);
    projectBundleInput.value = '';
  });
  const loadProjectInput = document.getElementById('load-project-input');

  if (btnNewProject) btnNewProject.addEventListener('click', () => window.newProject?.());
  if (btnSaveProject) btnSaveProject.addEventListener('click', () => window.saveProject?.());
  if (btnLoadProject && loadProjectInput) {
    btnLoadProject.addEventListener('click', () => loadProjectInput.click());
    loadProjectInput.addEventListener('change', () => {
      if (loadProjectInput.files && loadProjectInput.files[0]) {
        window.loadProject?.(loadProjectInput.files[0]);
      }
      loadProjectInput.value = '';
    });
  }

  if (btnCopy) btnCopy.addEventListener('click', () => clipboardManager.copy());
  if (btnPaste) btnPaste.addEventListener('click', () => clipboardManager.paste());
  if (btnDuplicate) btnDuplicate.addEventListener('click', () => clipboardManager.duplicate());
  if (btnDelete) btnDelete.addEventListener('click', () => clipboardManager.deleteSelected());

  if (btnUndo) btnUndo.addEventListener('click', () => { if (composition.undo()) onCompositionChanged(); });
  if (btnRedo) btnRedo.addEventListener('click', () => { if (composition.redo()) onCompositionChanged(); });

  if (zoomInBtn) zoomInBtn.addEventListener('click', () => {
    multiTimeline.setZoom(multiTimeline.zoomLevel + 0.5);
    if (zoomLevelEl) zoomLevelEl.textContent = `${Math.round(multiTimeline.zoomLevel * 100)}%`;
  });
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => {
    multiTimeline.setZoom(multiTimeline.zoomLevel - 0.5);
    if (zoomLevelEl) zoomLevelEl.textContent = `${Math.round(multiTimeline.zoomLevel * 100)}%`;
  });


  if (previewRatioSelectEl) {
    previewRatioSelectEl.addEventListener('change', () => {
      const preset = previewRatioSelectEl.value;
      if (preset === 'custom') return;
      const dims = getPresetDimensions(preset, composition.width, composition.height);
      composition.setDimensions(dims.width, dims.height);
      // Keep the actual MP4 output in the selected canvas ratio. Otherwise a
      // portrait preview can silently export with the previous landscape size.
      if (exportWidthEl) exportWidthEl.value = String(dims.width);
      if (exportHeightEl) exportHeightEl.value = String(dims.height);
      onCompositionChanged();
    });
  }

  initSidebarResizer();
}

function initSidebarResizer() {
  const resizer = document.getElementById('sidebar-resizer');
  const sidebar = document.querySelector('.editor-sidebar');
  if (!resizer || !sidebar) return;

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener('pointerdown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebar.getBoundingClientRect().width;
    resizer.setPointerCapture(e.pointerId);
    resizer.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  resizer.addEventListener('pointermove', (e) => {
    if (!isResizing) return;
    const delta = e.clientX - startX;
    const newWidth = Math.max(220, Math.min(window.innerWidth * 0.4, startWidth - delta));
    sidebar.style.width = `${newWidth}px`;
    document.documentElement.style.setProperty('--sidebar-w', `${newWidth}px`);
  });

  const endResize = (e) => {
    if (!isResizing) return;
    isResizing = false;
    try { resizer.releasePointerCapture(e?.pointerId); } catch (_) {}
    resizer.classList.remove('resizing');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  resizer.addEventListener('pointerup', endResize);
  resizer.addEventListener('pointercancel', endResize);
}

function bindDropHandlers() {
  const handleFiles = async (files, e) => {
    if (!files || files.length === 0) return;

    const rect = timelineContainerEl.getBoundingClientRect();
    const dropX = e.clientX - rect.left + timelineContainerEl.scrollLeft;
    const pps = multiTimeline.pxPerSec * multiTimeline.zoomLevel;
    const dropTime = Math.max(0, dropX / pps);
    const dropY = e.clientY - rect.top + timelineContainerEl.scrollTop;
    const trackIndex = Math.floor(dropY / 34);

    for (const file of files) {
      await mediaManager.importFile(file, { startTime: dropTime, trackIndex });
    }

    onCompositionChanged();
  };

  multiTimeline.onDropFiles(handleFiles);
  canvasPreview.onDropFiles(handleFiles);
}

// --- Export Handling ---
async function handleExport() {
  if (composition.clips.length === 0) {
    showToast('请至少添加一个素材后再导出', 'warning');
    return;
  }

  if (isExporting) {
    showToast('视频正在导出，请稍候', 'info');
    return;
  }

  isExporting = true;
  if (btnExport) btnExport.disabled = true;

  exportAbortController = new AbortController();
  const signal = exportAbortController.signal;

  pause();
  showProgress('正在导出商家视频', '正在逐帧渲染画面并混合配音和背景音乐，请保持页面打开。', 0);

  if (progressCancelBtn) {
    progressCancelBtn.textContent = '取消导出';
    progressCancelBtn.disabled = false;
    progressCancelBtn.onclick = () => {
      if (!exportAbortController || exportAbortController.signal.aborted) return;
      // Keep the progress dialog visible until the exporter has actually
      // stopped and released its resources; do not report cancellation early.
      progressCancelBtn.disabled = true;
      progressCancelBtn.textContent = '正在停止…';
      if (progressSubtitle) progressSubtitle.textContent = '正在停止渲染并释放手机内存，请稍候。';
      exportAbortController.abort();
    };
  }

  try {
    const width = parseInt(exportWidthEl?.value, 10) || composition.width;
    const height = parseInt(exportHeightEl?.value, 10) || composition.height;
    const fps = parseInt(exportFpsEl?.value, 10) || 30;
    const quality = exportQualityEl?.value || 'high';

    const { blob, ext } = await exportComposition(composition, canvasPreview, (progressPct, stage) => {
      if (signal.aborted) return;
      if (stage) progressSubtitle.textContent = stage;
      updateProgress(progressPct);
    }, signal, { width, height, fps, quality });

    if (signal.aborted) {
      hideProgress();
      return;
    }

    hideProgress();

    if (!blob || blob.size === 0) {
      showToast('导出失败：生成的视频文件为空', 'error', 6000);
      return;
    }

    const safeProjectName = String(activeProjectName || '商家视频').trim().replace(/[\/:*?"<>|\\]/g, '_').replace(/[\u0000-\u001f]/g, '_').replace(/\s+/g, '_').slice(0, 48) || '商家视频';
    const timestamp = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/[/: ]/g, '-');
    const filename = `${safeProjectName}_宣传视频_${timestamp}.${ext || 'mp4'}`;
    downloadBlob(blob, filename);
    showToast(`导出完成！正在下载 ${filename}`, 'success', 5000);
  } catch (err) {
    hideProgress();
    console.error('Export error:', err);
    if (err?.name === 'AbortError' || signal?.aborted) {
      showToast('已取消导出', 'info');
      return;
    }
    const msg = getExportErrorMessage(err);
    showToast(`导出失败：${msg}`, 'error', 9000);
  } finally {
    exportAbortController = null;
    isExporting = false;
    hideProgress();
    if (btnExport) btnExport.disabled = false;
    if (progressCancelBtn) {
      progressCancelBtn.disabled = true;
      progressCancelBtn.textContent = '取消导出';
    }
  }
}

function showProgress(title, subtitle, initialPct = 0) {
  if (progressTitle) progressTitle.textContent = title;
  if (progressSubtitle) progressSubtitle.textContent = subtitle;
  updateProgress(initialPct);
  if (progressOverlay) progressOverlay.classList.add('visible');
}

function updateProgress(pct) {
  if (progressBar) progressBar.style.width = `${pct}%`;
  if (progressPercent) progressPercent.textContent = `${pct}%`;
}

function hideProgress() {
  if (progressOverlay) progressOverlay.classList.remove('visible');
}

async function loadFFmpegInBackground() {
  if (headerStatusEl) headerStatusEl.textContent = '正在加载导出引擎…';
  try {
    await loadFFmpeg();
    if (headerStatusEl) headerStatusEl.textContent = '导出引擎已就绪';
  } catch (e) {
    console.warn('FFmpeg load failed:', e);
    if (headerStatusEl) headerStatusEl.textContent = '当前使用画布引擎';
    showToast('MP4 编码器暂时不可用。正式导出时会再次尝试加载；如果仍失败，请检查网络后重试。', 'warning', 6000);
  }
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// --- New Project / Cleanup ---

async function buildLocalProjectSnapshot(sourceComposition = composition, projectId = activeProjectId, projectName = activeProjectName) {
  // Capture the timeline and its clip references before awaiting IndexedDB.
  // This prevents a later edit or project switch from changing this save.
  const project = stripTemporaryMediaUrls(sourceComposition.toJSON());
  project.name = projectName;
  const sourceClips = sourceComposition.clips.map(clip => ({ ...clip }));
  const previousRecord = await loadLocalProject(projectId).catch(() => null);
  const previousMedia = new Map((previousRecord?.media || []).map(item => [item.clipId, item]));
  const media = [];
  for (const clip of sourceClips) {
    if (!['video', 'image', 'audio'].includes(clip.type)) continue;
    let blob = clip.file instanceof Blob ? clip.file : null;
    let previous = null;
    if (!blob && typeof clip.src === 'string' && clip.src.startsWith('blob:')) {
      try {
        const response = await fetch(clip.src);
        if (response.ok) blob = await response.blob();
      } catch (_) {}
    }
    if (!blob) {
      previous = previousMedia.get(clip.id);
      if (previous?.blob instanceof Blob) blob = previous.blob;
    }
    if (blob) media.push({
      clipId: clip.id,
      name: clip.file?.name || previous?.name || clip.name || '素材文件',
      type: blob.type || clip.file?.type || previous?.type || 'application/octet-stream',
      blob
    });
  }
  assertProjectMediaComplete(project, media);
  return { project, media };
}

function setLocalSaveStatus(message, state = 'normal') {
  if (!localSaveStatusEl) return;
  localSaveStatusEl.textContent = message;
  localSaveStatusEl.dataset.state = state;
}

function saveCurrentProjectLocally() {
  // Cancel the debounce immediately, not when the queued write eventually runs.
  if (localAutosaveTimer) clearTimeout(localAutosaveTimer);
  localAutosaveTimer = null;
  const targetComposition = composition;
  const targetProjectId = activeProjectId;
  const targetProjectName = activeProjectName;

  localAutosavePendingCount += 1;
  return enqueueLocalSave(async () => {
    if (localAutosaveTimer) clearTimeout(localAutosaveTimer);
    localAutosaveTimer = null;
    localAutosaveDirty = false;
    localAutosaveInProgress = true;
    if (targetProjectId === activeProjectId) setLocalSaveStatus('正在保存到本机…');

    try {
      const snapshot = await buildLocalProjectSnapshot(
        targetComposition,
        targetProjectId,
        targetProjectName
      );
      const result = await saveLocalProject(snapshot.project, snapshot.media, targetProjectId);
      if (targetProjectId === activeProjectId) {
        const time = new Date(result.savedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        setLocalSaveStatus('本机已保存 ' + time, 'saved');
        localAutosaveErrorShown = false;
      }
      return true;
    } catch (error) {
      console.warn('[小智本机自动保存]', error);
      if (targetProjectId === activeProjectId) {
        setLocalSaveStatus('本机保存失败', 'error');
        if (!localAutosaveErrorShown) {
          const diagnostic = await getLocalStorageFailureMessage(error);
          showToast('本机自动保存失败：' + diagnostic + '。请及时下载项目配置，并保留原素材。', 'warning', 11000);
          localAutosaveErrorShown = true;
        }
      }
      return false;
    } finally {
      localAutosaveInProgress = false;
      localAutosavePendingCount = Math.max(0, localAutosavePendingCount - 1);
      if (localAutosaveDirty && localRestoreComplete) scheduleLocalAutosave();
    }
  });
}

async function flushCurrentProjectLocally() {
  let saved = await saveCurrentProjectLocally();
  // Edits made while an IndexedDB write is in progress mark the save dirty.
  // Drain those edits before replacing the active composition/project ID.
  while (saved && (localAutosaveDirty || localAutosaveTimer || localAutosaveInProgress)) {
    if (localAutosaveTimer) clearTimeout(localAutosaveTimer);
    localAutosaveTimer = null;
    saved = await saveCurrentProjectLocally();
  }
  return saved;
}

function scheduleLocalAutosave() {
  if (!localRestoreComplete || isRestoringLocalProject) return;
  localAutosaveDirty = true;
  if (localAutosaveTimer) clearTimeout(localAutosaveTimer);
  setLocalSaveStatus('有未保存的更改…');
  localAutosaveTimer = setTimeout(() => {
    localAutosaveTimer = null;
    saveCurrentProjectLocally();
  }, 1400);
}

function waitForRestoredMedia(element, readyCheck, readyEvent) {
  if (readyCheck()) return Promise.resolve(true);
  return new Promise(resolve => {
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      element.removeEventListener(readyEvent, onReady);
      element.removeEventListener('error', onError);
      resolve(value);
    };
    const onReady = () => finish(true);
    const onError = () => finish(false);
    const timer = setTimeout(() => finish(false), 15000);
    element.addEventListener(readyEvent, onReady, { once: true });
    element.addEventListener('error', onError, { once: true });
    if (readyCheck()) finish(true);
  });
}

async function applyLocalProjectRecord(record, notify = true) {
  if (!record?.project || !Array.isArray(record.project.clips)) throw new Error('项目记录不完整，无法恢复');
  const safeProject = sanitizeProjectDocument(record.project);
  isRestoringLocalProject = true;
  releaseMediaUrls();
  try {
    // Project records restore original media from their IndexedDB Blob entries;
    // never load a persisted external URL as a fallback.
    await composition.fromJSON(safeProject, async () => null);
    let restored = 0;
    let missing = 0;
    const restorePlan = buildProjectMediaRestorePlan(composition.clips, record.media || []);
    const mediaByClip = restorePlan.mediaByClip;
    for (const clip of composition.clips) {
      if (!['video', 'image', 'audio'].includes(clip.type)) continue;
      const item = mediaByClip.get(clip.id);
      if (restorePlan.missingClipIds.includes(clip.id)) {
        missing++;
        continue;
      }
      const objectUrl = URL.createObjectURL(item.blob);
      try {
        let element;
        if (clip.type === 'video') {
          element = document.createElement('video');
          element.preload = 'metadata';
          element.src = objectUrl;
          if (!await waitForRestoredMedia(element, () => element.readyState >= 1, 'loadedmetadata')) throw new Error('视频元数据读取超时');
        } else if (clip.type === 'image') {
          element = new Image();
          element.src = objectUrl;
          if (!await waitForRestoredMedia(element, () => element.complete && element.naturalWidth > 0, 'load')) throw new Error('图片读取超时');
        } else {
          element = new Audio();
          element.preload = 'metadata';
          element.src = objectUrl;
          if (!await waitForRestoredMedia(element, () => element.readyState >= 1, 'loadedmetadata')) throw new Error('音频元数据读取超时');
        }
        clip.src = objectUrl;
        clip.file = typeof File !== 'undefined'
          ? new File([item.blob], item.name || clip.name || '素材文件', { type: item.type || item.blob.type })
          : item.blob;
        clip.element = element;
        onMediaUrlRegistered(clip.id, objectUrl);
        restored++;
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        clip.src = null;
        clip.file = null;
        clip.element = null;
        missing++;
        console.warn('[小智恢复素材]', clip.name, error);
      }
    }
    activeProjectId = record.id || 'last-open-project';
    updateHeaderProjectName(record.name || record.project.name || '已恢复项目');
    onCompositionChanged();
    setLocalSaveStatus('已恢复：' + activeProjectName, 'saved');
    if (notify) {
      const savedAt = new Date(record.savedAt || Date.now()).toLocaleString('zh-CN');
      showToast('项目已打开（' + savedAt + '）。素材恢复 ' + restored + ' 个' + (missing ? '，另有 ' + missing + ' 个素材未能读取' : '') + '。', missing ? 'warning' : 'success', 8000);
    }
    return { restored, missing };
  } finally {
    isRestoringLocalProject = false;
  }
}

async function restoreLastLocalProject() {
  setLocalSaveStatus('正在检查本机项目…');
  try {
    const record = await loadLastActiveLocalProject();
    if (!record?.project) {
      setLocalSaveStatus('本机自动保存已开启');
      return;
    }
    await applyLocalProjectRecord(record, true);
  } catch (error) {
    console.warn('[小智读取本机项目]', error);
    setLocalSaveStatus('本机项目读取失败', 'error');
    showToast('无法读取上次本机项目：' + (error?.message || '浏览器存储不可用') + '。你仍可手动打开项目文件。', 'warning', 8000);
  }
}

async function renderProjectLibrary() {
  const listEl = document.getElementById('project-library-list');
  if (!listEl) return;
  listEl.replaceChildren();
  try {
    const projects = await listLocalProjects();
    if (!projects.length) {
      const empty = document.createElement('p');
      empty.className = 'project-library-empty';
      empty.textContent = '还没有另存的商家项目。点击上方“保存为新项目”即可建立第一个项目。';
      listEl.append(empty);
      return;
    }
    for (const item of projects) {
      const row = document.createElement('div');
      row.className = 'project-library-row';
      const info = document.createElement('div');
      info.className = 'project-library-info';
      const name = document.createElement('strong');
      name.textContent = item.name;
      const meta = document.createElement('span');
      meta.textContent = new Date(item.savedAt).toLocaleString('zh-CN') + ' · ' + item.clipCount + ' 个片段 · ' + item.mediaCount + ' 个素材';
      info.append(name, meta);
      const actions = document.createElement('div');
      actions.className = 'project-library-actions';
      const open = document.createElement('button');
      open.type = 'button'; open.textContent = '打开';
      open.addEventListener('click', async () => {
        try {
          const currentSaved = await flushCurrentProjectLocally();
          if (!currentSaved && composition.clips.length > 0) {
            throw new Error('当前项目没有成功保存，为避免丢失素材，已取消切换');
          }
          const record = await loadLocalProject(item.id);
          await applyLocalProjectRecord(record, true);
          document.getElementById('project-library')?.setAttribute('hidden', '');
          renderProjectLibrary();
        } catch (error) {
          showToast('打开项目失败：' + (error?.message || '未知错误'), 'error', 7000);
        }
      });
      const remove = document.createElement('button');
      remove.type = 'button'; remove.textContent = '删除'; remove.className = 'danger';
      remove.addEventListener('click', async () => {
        if (!window.confirm('确定删除“' + item.name + '”及其本机素材备份吗？此操作不可撤销。')) return;
        try {
          await deleteLocalProject(item.id);
          if (activeProjectId === item.id) {
            activeProjectId = 'last-open-project';
            await saveCurrentProjectLocally();
          }
          renderProjectLibrary();
          showToast('项目已从本机项目库删除', 'success');
        } catch (error) {
          showToast('删除失败：' + (error?.message || '未知错误'), 'error');
        }
      });
      actions.append(open, remove);
      row.append(info, actions);
      listEl.append(row);
    }
  } catch (error) {
    const failed = document.createElement('p');
    failed.className = 'project-library-empty';
    failed.textContent = '无法读取本机项目库：' + (error?.message || '浏览器存储不可用');
    listEl.append(failed);
  }
}

async function exportCurrentProjectBundle() {
  try {
    const snapshot = await buildLocalProjectSnapshot();
    snapshot.project.name = activeProjectName;
    const bundle = await createProjectBundle(snapshot.project, snapshot.media);
    const unsafeNameChars = ['/', ':', '*', '?', '"', '<', '>', '|', String.fromCharCode(92)];
    const safeName = Array.from(activeProjectName).map(char => unsafeNameChars.includes(char) ? '_' : char).join('').slice(0, 48) || '小智视频项目';
    downloadBlob(bundle, safeName + '.xzproj');
    showToast('完整项目包已导出，包含时间线和 ' + snapshot.media.length + ' 个原始素材', 'success', 8000);
  } catch (error) {
    showToast('项目包导出失败：' + (error?.message || '未知错误'), 'error', 9000);
  }
}

async function importProjectBundleFile(file) {
  try {
    const result = await readProjectBundle(file);
    result.project = sanitizeProjectDocument(result.project);
    const projectName = result.project.name || file.name.replace(/\.(xzproj|zip)$/i, '') || '导入的商家项目';
    result.project.name = projectName;
    const currentSaved = await flushCurrentProjectLocally();
    if (!currentSaved && composition.clips.length > 0) {
      throw new Error('当前项目没有成功保存，为避免丢失素材，已取消导入');
    }
    const id = createLocalProjectId();
    const savedAt = Date.now();
    await saveLocalProject(result.project, result.media, id);
    await applyLocalProjectRecord({ id, name: projectName, savedAt, project: result.project, media: result.media }, false);
    document.getElementById('project-library')?.setAttribute('hidden', '');
    showToast('项目包导入成功：' + projectName + '，恢复素材 ' + result.media.length + ' 个', 'success', 9000);
  } catch (error) {
    showToast('项目包导入失败：' + (error?.message || '文件格式不正确'), 'error', 9000);
  }
}

async function saveAsNewLocalProject() {
  const suggested = activeProjectName && activeProjectName !== '新建视频项目' ? activeProjectName + ' - 副本' : '新商家项目';
  const name = window.prompt('给这个商家项目起个名字：', suggested);
  if (!name || !name.trim()) return;
  const savedCurrent = await flushCurrentProjectLocally();
  if (!savedCurrent && composition.clips.length > 0) {
    showToast('当前项目没有成功保存，暂时不能另存为副本，以免丢失素材。', 'warning', 8000);
    return;
  }
  const previousId = activeProjectId;
  const previousName = activeProjectName;
  activeProjectId = createLocalProjectId();
  updateHeaderProjectName(name.trim());
  const saved = await saveCurrentProjectLocally();
  if (saved) {
    showToast('已另存为“' + activeProjectName + '”，项目和素材已保存到本机', 'success', 7000);
    renderProjectLibrary();
  } else {
    activeProjectId = previousId;
    updateHeaderProjectName(previousName);
    showToast('副本保存失败，已保留原项目。', 'warning', 8000);
  }
}

window.newProject = async function newProject() {
  const currentSaved = await flushCurrentProjectLocally();
  if (!currentSaved && composition.clips.length > 0) {
    showToast('当前项目没有成功保存，已取消新建，避免丢失素材。请先导出完整项目包或检查浏览器存储空间。', 'warning', 9000);
    return false;
  }
  if (localAutosaveTimer) clearTimeout(localAutosaveTimer);
  localAutosaveTimer = null;
  activeProjectId = createLocalProjectId();
  releaseMediaUrls();
  composition.clear();
  inPoint = 0;
  outPoint = 0;
  updateHeaderProjectName('新建视频项目');
  onCompositionChanged();
  showToast('已新建项目；新项目会自动保存在本机', 'info');
  return true;
};

window.saveProject = async function saveProject() {
  const data = stripTemporaryMediaUrls(composition.toJSON());
  data.name = activeProjectName;
  const localSaved = await saveCurrentProjectLocally();
  const mediaCount = composition.clips.filter(clip => clip.file || clip.src?.startsWith('blob:')).length;
  data.mediaIncluded = false;
  data.mediaNotice = '此 JSON 文件只保存时间线和编辑参数，不包含原始媒体。当前浏览器会另行自动保存素材；如需换设备，请保留原始照片、视频和音频。';
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `小智视频项目_${Date.now()}.json`);
  showToast(localSaved
    ? '已保存到本机浏览器，并下载项目配置 JSON。JSON 不含原始素材；本机自动备份包含已导入素材。'
    : mediaCount > 0
      ? '项目配置 JSON 已下载，但本机素材备份失败。请保留原始照片、视频和音频。'
      : '项目配置 JSON 已下载。', localSaved ? 'success' : 'warning', 9000);
};

window.loadProject = async function loadProject(file) {
  try {
    if (!file || !Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_PROJECT_DOCUMENT_BYTES) {
      throw new Error('项目配置文件无效或超过5MB，请使用完整项目包导入素材');
    }
    const text = await file.text();
    const parsed = JSON.parse(text);
    const data = sanitizeProjectDocument(parsed);
    if (!window.confirm('打开项目会替换当前时间线。确定继续吗？')) return;
    const currentSaved = await flushCurrentProjectLocally();
    if (!currentSaved && composition.clips.length > 0) {
      showToast('当前项目没有成功保存，已取消打开新项目，避免丢失素材。', 'warning', 9000);
      return;
    }
    activeProjectId = createLocalProjectId();
    releaseMediaUrls();
    // JSON projects contain timeline metadata only. Source media is not
    // embedded, so external URLs are deliberately not fetched on import.
    const missingMediaCount = data.clips.filter(clip =>
      ['video', 'image', 'audio'].includes(clip.type)
    ).length;
    await composition.fromJSON(data, async () => null);
    onCompositionChanged();
    updateHeaderProjectName(data.name || file.name.replace(/\.json$/i, ''));
    showToast(missingMediaCount > 0
      ? '项目时间线已恢复，但 JSON 不包含 ' + missingMediaCount + ' 个原始素材，请重新上传。'
      : '项目已打开；本机自动保存会记录本次项目。', missingMediaCount > 0 ? 'warning' : 'success', 9000);
  } catch (err) {
    showToast('项目打开失败：' + err.message, 'error', 6000);
    console.error(err);
  }
};

// Start app
document.addEventListener('DOMContentLoaded', () => { initApp().catch(error => { console.error(error); showToast('工作台初始化失败：' + (error?.message || '未知错误'), 'error', 9000); }); });
