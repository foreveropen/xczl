/**
 * storage.js — 本地加密存储（跨平台自适应）
 *
 * 存储策略：
 * 1. 支持 File System Access API 的浏览器（Chrome/Edge 桌面+安卓）
 *    → 自动把数据写成文件存到用户授权的文件夹，文件管理器可见
 * 2. 不支持的浏览器（iOS Safari等）
 *    → 降级到 localStorage 加密存储
 *
 * 无论哪种模式，localStorage 始终作为同步缓存，保证代码读写一致
 */

var KEY = 'gua_bagua_v3';
var SECRET = 'xinchengzeling_gua_secret_2024';
var DEVICE_KEY = 'gua_device_id';
var FS_DB_NAME = 'gua_fs_db';
var FS_STORE = 'handles';

/* ========== 设备ID ========== */

function getDeviceId() {
  try {
    var id = localStorage.getItem(DEVICE_KEY);
    if (id) return id;
    var arr = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(arr);
    else { for (var i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256); }
    id = Array.from(arr).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch (e) { return 'fallback_device'; }
}

function getLocalKey() { return SECRET + '_' + getDeviceId(); }

/* ========== 加解密 ========== */

function utf8ToBytes(str) {
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if (code < 128) bytes.push(code);
    else if (code < 2048) bytes.push(192 | (code >> 6), 128 | (code & 63));
    else bytes.push(224 | (code >> 12), 128 | ((code >> 6) & 63), 128 | (code & 63));
  }
  return bytes;
}

function bytesToUtf8(bytes) {
  var str = ''; var i = 0;
  while (i < bytes.length) {
    var b1 = bytes[i];
    if (b1 < 128) { str += String.fromCharCode(b1); i++; }
    else if (b1 < 224) { str += String.fromCharCode(((b1 & 31) << 6) | (bytes[i + 1] & 63)); i += 2; }
    else { str += String.fromCharCode(((b1 & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63)); i += 3; }
  }
  return str;
}

function encrypt(str, key) {
  key = key || getLocalKey();
  var bytes = utf8ToBytes(str);
  for (var i = 0; i < bytes.length; i++) bytes[i] = bytes[i] ^ key.charCodeAt(i % key.length);
  var binary = '';
  for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decrypt(str, key) {
  key = key || getLocalKey();
  try {
    var binary = atob(str);
    var bytes = [];
    for (var i = 0; i < binary.length; i++) bytes.push(binary.charCodeAt(i));
    for (var i = 0; i < bytes.length; i++) bytes[i] = bytes[i] ^ key.charCodeAt(i % key.length);
    return bytesToUtf8(bytes);
  } catch (e) { return ''; }
}

/* ========== 同步 localStorage 层 ========== */

function load() {
  try {
    var raw = localStorage.getItem(KEY);
    if (!raw) return { date: '', n: 0, his: [] };
    var decrypted = decrypt(raw);
    return JSON.parse(decrypted) || { date: '', n: 0, his: [] };
  } catch (e) { return { date: '', n: 0, his: [] }; }
}

function save(o) {
  localStorage.setItem(KEY, encrypt(JSON.stringify(o)));
  /* 异步同步到文件系统（如果已授权） */
  if (FS.dirHandle) writeToFile(o);
}

/* ========== File System Access API 层 ========== */

var FS = {
  supported: !!(window.showDirectoryPicker),
  dirHandle: null,
  ready: false
};

/** 打开 IndexedDB */
function fsOpenDB() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open(FS_DB_NAME, 1);
    req.onupgradeneeded = function (e) {
      e.target.result.createObjectStore(FS_STORE);
    };
    req.onsuccess = function (e) { resolve(e.target.result); };
    req.onerror = function (e) { reject(e); };
  });
}

/** 从 IndexedDB 读取目录句柄 */
function idbGet(db, key) {
  return new Promise(function (resolve, reject) {
    var tx = db.transaction(FS_STORE, 'readonly');
    var req = tx.objectStore(FS_STORE).get(key);
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
}

/** 写入目录句柄到 IndexedDB */
function idbPut(db, value, key) {
  return new Promise(function (resolve, reject) {
    var tx = db.transaction(FS_STORE, 'readwrite');
    var req = tx.objectStore(FS_STORE).put(value, key);
    req.onsuccess = function () { resolve(); };
    req.onerror = function () { reject(req.error); };
  });
}

/** 从 IndexedDB 恢复目录句柄 */
async function fsRestoreHandle() {
  if (!FS.supported) return;
  try {
    var db = await fsOpenDB();
    var handle = await idbGet(db, 'dir');
    if (handle) {
      var opts = { mode: 'readwrite' };
      if ((await handle.queryPermission(opts)) === 'granted') {
        FS.dirHandle = handle;
        FS.ready = true;
        await fsLoadFromFile();
      }
    }
  } catch (e) { /* 静默失败，降级localStorage */ }
}

/** 让用户选择数据文件夹 */
async function chooseDataFolder() {
  if (!FS.supported) {
    alert('当前浏览器不支持文件夹访问，数据将保存在浏览器内部存储中。\n建议使用 Chrome / Edge 浏览器。');
    return;
  }
  try {
    var handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    FS.dirHandle = handle;
    FS.ready = true;
    var db = await fsOpenDB();
    await idbPut(db, handle, 'dir');
    save(load());
    alert('数据文件夹已设置！\n之后每次占卜都会自动保存到这个文件夹。\n\n文件夹名：' + handle.name);
    if (typeof log === 'function') log('storage', '已选择数据文件夹: ' + handle.name);
    if (typeof renderStorageStatus === 'function') renderStorageStatus();
  } catch (e) {
    if (e.name !== 'AbortError' && typeof log === 'function') log('error', '选择文件夹失败: ' + e.message);
  }
}

/** 把数据写入文件 */
async function writeToFile(o) {
  if (!FS.dirHandle) return;
  try {
    var fileHandle = await FS.dirHandle.getFileHandle('gua_data.json', { create: true });
    var writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(o, null, 2));
    await writable.close();
  } catch (e) { /* 写文件失败不影响主流程 */ }
}

/** 从文件读取数据 */
async function fsLoadFromFile() {
  if (!FS.dirHandle) return;
  try {
    var fileHandle = await FS.dirHandle.getFileHandle('gua_data.json');
    var file = await fileHandle.getFile();
    var text = await file.text();
    var data = JSON.parse(text);
    /* 文件数据覆盖到 localStorage */
    localStorage.setItem(KEY, encrypt(JSON.stringify(data)));
    if (typeof log === 'function') log('storage', '已从文件恢复数据，共' + data.his.length + '条');
  } catch (e) { /* 文件不存在或损坏，用localStorage */ }
}

/** 获取存储状态文字 */
function getStorageStatus() {
  if (!FS.supported) return '浏览器存储（不支持文件夹访问）';
  if (FS.ready && FS.dirHandle) return '文件存储：' + FS.dirHandle.name;
  return '浏览器存储（未设置文件夹）';
}

/* ========== 工具 ========== */

function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function refreshLeft() {
  var s = load();
  var t = todayStr();
  if (s.date !== t) { s.date = t; s.n = 0; save(s); }
  var el = document.getElementById('todayLeft');
  if (el) el.textContent = '今日剩余卦数：' + (3 - s.n) + '/3';
}
