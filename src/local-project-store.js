const DB_NAME = 'xiaozhi-video-local';
const DB_VERSION = 2;
const STORE_NAME = 'projects';
const META_STORE = 'meta';
const LAST_PROJECT_ID = 'last-open-project';
const LAST_ACTIVE_KEY = 'last-active-project';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('当前浏览器不支持本机项目存储'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('打开本机存储失败'));
    request.onblocked = () => reject(new Error('本机存储正在被其他页面占用，请关闭重复打开的工作台后重试'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('本机存储操作失败'));
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('本机存储操作失败'));
    tx.onabort = () => reject(tx.error || new Error('本机存储操作被中断'));
  });
}

export function createLocalProjectId() {
  return globalThis.crypto?.randomUUID?.() || 'project-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

export async function saveLocalProject(project, media, projectId = LAST_PROJECT_ID) {
  const db = await openDatabase();
  try {
    const record = {
      id: projectId,
      name: project.name || '未命名项目',
      savedAt: Date.now(),
      project,
      media: media.map(item => ({
        clipId: item.clipId,
        name: item.name || '素材文件',
        type: item.type || item.blob?.type || 'application/octet-stream',
        blob: item.blob
      }))
    };
    const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.objectStore(META_STORE).put({ key: LAST_ACTIVE_KEY, value: projectId });
    await transactionDone(tx);
    return { savedAt: record.savedAt, mediaCount: record.media.length, id: projectId };
  } finally {
    db.close();
  }
}

export async function loadLocalProject(projectId = LAST_PROJECT_ID) {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    return await requestResult(tx.objectStore(STORE_NAME).get(projectId)) || null;
  } finally {
    db.close();
  }
}

export async function loadLastActiveLocalProject() {
  const db = await openDatabase();
  try {
    const tx = db.transaction([STORE_NAME, META_STORE], 'readonly');
    const active = await requestResult(tx.objectStore(META_STORE).get(LAST_ACTIVE_KEY));
    const record = await requestResult(tx.objectStore(STORE_NAME).get(active?.value || LAST_PROJECT_ID));
    return record || null;
  } finally {
    db.close();
  }
}

export async function listLocalProjects() {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const records = await requestResult(tx.objectStore(STORE_NAME).getAll());
    return (records || [])
      .filter(record => record.id !== LAST_PROJECT_ID)
      .map(record => ({
        id: record.id,
        name: record.name || record.project?.name || '未命名项目',
        savedAt: record.savedAt || 0,
        clipCount: record.project?.clips?.length || 0,
        mediaCount: record.media?.length || 0
      }))
      .sort((a, b) => b.savedAt - a.savedAt);
  } finally {
    db.close();
  }
}

export async function deleteLocalProject(projectId) {
  if (!projectId || projectId === LAST_PROJECT_ID) throw new Error('不能删除当前自动恢复记录');
  const db = await openDatabase();
  try {
    const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
    tx.objectStore(STORE_NAME).delete(projectId);
    const active = await requestResult(tx.objectStore(META_STORE).get(LAST_ACTIVE_KEY));
    if (active?.value === projectId) {
      tx.objectStore(META_STORE).put({ key: LAST_ACTIVE_KEY, value: LAST_PROJECT_ID });
    }
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

export function stripTemporaryMediaUrls(project) {
  const copy = JSON.parse(JSON.stringify(project));
  for (const clip of copy.clips || []) {
    if (typeof clip.src === 'string' && clip.src.startsWith('blob:')) clip.src = null;
  }
  return copy;
}
