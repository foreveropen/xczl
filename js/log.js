/**
 * log.js — 系统操作日志
 * 所有用户操作和结果都记录到 localStorage，方便后期排查问题
 */

var LOG_KEY = 'gua_debug_log';
var MAX_LOG = 300; // 最多保留300条

/**
 * 写一条日志
 * @param {string} type - 日志类型: action/validate/shake/result/error/history/backup
 * @param {string} msg - 日志内容
 */
function log(type, msg) {
  try {
    var logs = JSON.parse(localStorage.getItem(LOG_KEY)) || [];
    logs.push({
      t: new Date().toISOString(),
      type: type,
      msg: String(msg)
    });
    if (logs.length > MAX_LOG) logs = logs.slice(-MAX_LOG);
    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
  } catch (e) {
    // 日志写入失败静默忽略，不影响主流程
  }
}
