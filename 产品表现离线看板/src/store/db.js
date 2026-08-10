/* ============================================================
   IndexedDB 存储管理
   ============================================================ */

export const DB_NAME = "dashboard-db";
export const DB_VERSION = 1;
export const STORE_FILES = "sourceFiles";
export const STORE_DATA = "dashboardData";
export const STORE_SETTINGS = "settings";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) db.createObjectStore(STORE_FILES, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORE_DATA)) db.createObjectStore(STORE_DATA, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) db.createObjectStore(STORE_SETTINGS, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function dbPut(storeName, obj) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(obj);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  });
}

export function dbGet(storeName, id) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(id);
      req.onsuccess = () => { db.close(); resolve(req.result); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  });
}

export function dbGetAll(storeName) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => { db.close(); resolve(req.result); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  });
}

/** 保存看板构建结果 */
export function saveDashboardData(payload) {
  return dbPut(STORE_DATA, {
    id: "current",
    payload,
    builtAt: new Date().toISOString(),
  });
}

/** 加载看板构建结果 */
export function loadDashboardData() {
  return dbGet(STORE_DATA, "current");
}

/** 获取所有源文件列表 */
export function getAllFiles() {
  return dbGetAll(STORE_FILES);
}
