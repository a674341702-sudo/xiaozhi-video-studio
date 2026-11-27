const DB_NAME = 'xiaozhi-video-local';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const LAST_PROJECT_ID = 'last-open-project';

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

export async function saveLocalProject(project, media) {
  const db = await openDatabase();
  try {
    const record = {
      id: LAST_PROJECT_ID,
      savedAt: Date.now(),
      project,
      media: media.map(item => ({
        clipId: item.clipId,
        name: item.name || '素材文件',
        type: item.type || item.blob?.type || 'application/octet-stream',
        blob: item.blob
      }))
    };
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('保存项目失败'));
      tx.onabort = () => reject(tx.error || new Error('保存项目被中断'));
    });
    return { savedAt: record.savedAt, mediaCount: record.media.length };
  } finally {
    db.close();
  }
}

export async function loadLocalProject() {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const record = await requestResult(tx.objectStore(STORE_NAME).get(LAST_PROJECT_ID));
    return record || null;
  } finally {
    db.close();
  }
}

export async function deleteLocalProject() {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(LAST_PROJECT_ID);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('删除本机项目失败'));
      tx.onabort = () => reject(tx.error || new Error('删除本机项目被中断'));
    });
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
