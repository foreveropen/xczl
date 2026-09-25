/**
 * app.js — 主应用逻辑
 * 页面跳转、事件绑定、问题校验、摇卦流程、历史记录、备份导入导出
 */

'use strict';

/* ========== 全局状态 ========== */
var ST = {
  question: '',
  yao: [],
  shaking: false,
  timer: null,
  mind: 10,
  resultReady: false,
  fromHistory: false,
  pendingQuestion: '',
  hisPage: 1
};

var HIS_PAGE_SIZE = 10;
var POS_S = ['初', '二', '三', '四', '五', '上'];

/* ========== 工具函数 ========== */
function $(id) { return document.getElementById(id); }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
  $(id).classList.add('active');
}

/* ========== 八卦漂移水印（纯像素爻块拼） ========== */
(function () {
  var box = document.getElementById('wm');
  var trigs = [
    { b: [1, 1, 1], n: '乾' }, { b: [1, 0, 0], n: '震' },
    { b: [0, 1, 0], n: '坎' }, { b: [1, 1, 0], n: '兑' },
    { b: [0, 0, 1], n: '艮' }, { b: [1, 0, 1], n: '离' },
    { b: [0, 1, 1], n: '巽' }, { b: [0, 0, 0], n: '坤' }
  ];
  var pos = [
    { top: '6%', left: '3%', dur: '26s' }, { top: '9%', right: '5%', dur: '30s' },
    { top: '40%', left: '1%', dur: '24s' }, { top: '22%', left: '44%', dur: '32s' },
    { bottom: '6%', right: '4%', dur: '27s' }, { bottom: '18%', left: '4%', dur: '29s' },
    { bottom: '34%', right: '8%', dur: '25s' }, { top: '55%', right: '2%', dur: '31s' }
  ];
  trigs.forEach(function (t, i) {
    var el = document.createElement('div');
    el.className = 'wm';
    var h = '';
    [2, 1, 0].forEach(function (k) { h += '<div class="wb ' + (t.b[k] ? '' : 'y') + '"></div>'; });
    h += '<div class="lbl">' + t.n + '</div>';
    el.innerHTML = h;
    if (pos[i].top) el.style.top = pos[i].top;
    if (pos[i].bottom) el.style.bottom = pos[i].bottom;
    if (pos[i].left) el.style.left = pos[i].left;
    if (pos[i].right) el.style.right = pos[i].right;
    el.style.animation = 'drift ' + pos[i].dur + ' ease-in-out infinite';
    box.appendChild(el);
  });
})();

/* ========== 问题校验 ========== */

/**
 * 校验问题文本
 * @returns {{ok?:boolean, text?:string, err?:string}}
 */
function checkText(t) {
  t = t.trim();
  if (t.length < 3) return { err: '所问之事描述过短，请诚心写下真实所问' };
  /* 白名单过滤：只保留简体/繁体汉字和中文标点 */
  t = t.replace(/[^\u4e00-\u9fff\u3400-\u4dbf，。！？、；：""''（）《》…—]/g, '');
  if (t.length < 3) return { err: '请用中文诚心描述所问之事' };
  /* 违法/犯罪/不道德词黑名单 */
  var bad = /赌博|害人|报复|杀人|诅咒|骗钱|放火|纵火|投毒|强奸|诈骗|毒品|走私|贪污|卖国|反动|色情|卖淫|嫖娼|绑架|抢劫|抢夺|盗窃|受贿|行贿|造假|假药|偷渡|洗钱|贩毒|吸毒|制毒|藏毒|运毒|枪支|弹药|爆炸|爆炸物|炸药|恐怖|恐怖袭击|极端主义|分裂|台独|港独|藏独|疆独|法轮功|邪教|传销|非法集资|高利贷|套路贷|淫秽|裸体|裸聊|偷拍|偷窥|性骚扰|性侵|猥亵|乱伦|近亲|一夜情|出轨|小三|情人|包养|私生子|代孕|卖卵|约炮|打胎|堕胎|家暴|虐待|遗弃|不孝|恩将仇报|自杀|自残|轻生|厌世|抑郁|抑郁症|焦虑症|绝症|癌症|肿瘤|白血病|艾滋病|死期|寿命|生死|遗产|算命|改运|符咒|做法|斗法|巫术|下降头|蛊毒|巫蛊|风水|择日|改名|起名|算姻缘|催财|招财|转运|辟邪|镇宅|化煞|求子|求姻缘|桃花运|斩桃花|拆散感情|破坏感情|小三上位|挽回前任|复合几率|算命大师|看风水|选日子|搬家吉日|结婚吉日|敲诈|勒索|拐卖|赌场|赌球|赌马|六合彩|偷税|漏税|逃税|骗税|虚开发票|制假|售假|伪劣|电信诈骗|网络诈骗|刷单|套现|网贷|挪用公款|管制刀具|凶器/;
  if (bad.test(t)) return { err: '不义或违法之事不可占，请另求正道' };
  if (/随便|玩玩|测试|瞎测|娱乐|试试|随便问问|好奇|随便测|玩一玩|闹着玩|试试看|问问看/.test(t)) return { err: '嬉戏试探，心不诚则卦不灵' };
  return { ok: true, text: t };
}

/**
 * 检查每日次数限制和3个月不复占
 * @returns {string} 空字符串=通过，否则=错误信息
 */
function checkLimit(q) {
  var s = load();
  var t = todayStr();
  if (s.date !== t) { s.date = t; s.n = 0; save(s); }
  if (s.n >= 3) return '今日三卦已满，请明日再来';
  var threeMonths = 90 * 24 * 3600 * 1000;
  var hit = s.his.filter(function (h) { return h.time > Date.now() - threeMonths && h.q === q; }).length;
  if (hit > 0) return '一事不二占，三个月内不可重复问同一件事';
  return '';
}

/* ========== 规则弹窗 ========== */
var RULE_KEY = 'gua_rule_state';
var RULE_COOLDOWN = 5 * 60 * 60 * 1000; // 5小时冷却

function getRuleState() {
  try { return JSON.parse(localStorage.getItem(RULE_KEY)) || {}; }
  catch (e) { return {}; }
}
function setRuleState(o) { localStorage.setItem(RULE_KEY, JSON.stringify(o)); }

function shouldShowRule() {
  var s = getRuleState();
  if (s.dontShow) return false;
  if (!s.lastShow) return true;
  return Date.now() - s.lastShow > RULE_COOLDOWN;
}

/* ========== 页面流程 ========== */

/** 首页点"进入静心" */
function enterMind() {
  var rawQ = $('q').value.trim();
  var result = checkText(rawQ);
  if (result.err) {
    $('err0').textContent = result.err;
    log('validate', '问题校验失败: ' + result.err + ' 输入:' + rawQ);
    return;
  }
  var cleanQ = result.text;
  var e2 = checkLimit(cleanQ);
  if (e2) {
    $('err0').textContent = e2;
    log('validate', '次数限制: ' + e2);
    return;
  }
  $('err0').textContent = '';
  log('action', '进入静心，问题: ' + cleanQ);
  ST.pendingQuestion = cleanQ;
  if (shouldShowRule()) {
    $('ruleMask').classList.add('show');
  } else {
    startMind(cleanQ);
  }
}

/** 开始静心倒计时 */
function startMind(q) {
  ST.question = q;
  ST.yao = [];
  ST.mind = 10;
  showScreen('s1');
  $('mindNum').textContent = 10;
  clearInterval(ST.timer);
  ST.timer = setInterval(function () {
    ST.mind--;
    $('mindNum').textContent = ST.mind;
    if (ST.mind <= 0) { clearInterval(ST.timer); startShake(); }
  }, 1000);
  /* 切后台自动暂停，回来继续 */
  document.onvisibilitychange = function () {
    if (document.hidden) {
      clearInterval(ST.timer);
    } else if (ST.mind > 0 && $('s1').classList.contains('active')) {
      clearInterval(ST.timer);
      ST.timer = setInterval(function () {
        ST.mind--;
        $('mindNum').textContent = ST.mind;
        if (ST.mind <= 0) { clearInterval(ST.timer); startShake(); }
      }, 1000);
    }
  };
}

/** 规则弹窗点"我已知晓" */
function confirmRule() {
  $('ruleMask').classList.remove('show');
  /* 手动查看模式：只关闭不触发占卜 */
  if ($('btnRuleOk').textContent === '关 闭') {
    $('btnRuleOk').textContent = '我已知晓 · 开始占卜';
    $('btnRuleCancel').style.display = '';
    $('ruleDontShow').parentElement.style.display = '';
    return;
  }
  var s = getRuleState();
  s.lastShow = Date.now();
  if ($('ruleDontShow').checked) s.dontShow = true;
  setRuleState(s);
  $('ruleDontShow').checked = false;
  startMind(ST.pendingQuestion || $('q').value.trim());
}

/** 规则弹窗点"再想想" */
function cancelRule() {
  $('ruleMask').classList.remove('show');
  log('action', '规则弹窗取消');
}

/** 进入摇卦页，重置状态 */
function startShake() {
  ST.yao = [];
  ST.shaking = false;
  ST.resultReady = false;
  renderShakeGua();
  ['c1', 'c2', 'c3'].forEach(function (id) {
    var c = $(id);
    c.classList.remove('flip', 'tail');
    c.classList.add('head');
  });
  $('shakeProg').textContent = '第 1 爻 / 共 6 爻';
  $('shakeMsg').innerHTML = '轻触铜钱，开始摇卦';
  $('err2').textContent = '';
  var btn = $('btnShake');
  btn.textContent = '摇 铜 钱';
  showScreen('s2');
}

/** 静心页返回 */
function cancelMind() {
  clearInterval(ST.timer);
  log('action', '静心页返回');
  showScreen('s0');
}

/** 渲染摇卦页六行爻 */
function renderShakeGua() {
  var box = $('guaYao');
  var h = '';
  for (var i = 5; i >= 0; i--) {
    var y = ST.yao[i];
    var between = (i === 2) ? ' between' : '';
    h += '<div class="shake-row' + between + '">';
    h += '<span class="pos">' + POS_S[i] + '</span>';
    if (y) {
      var yang = (y.v === 7 || y.v === 9);
      var isDong = (y.v === 6 || y.v === 9);
      var cls = 'yao' + (yang ? '' : ' yin') + (isDong ? ' dong' : '');
      h += '<span class="' + cls + '"></span>';
      h += '<span class="num">' + y.v + '</span>';
    } else {
      h += '<span class="yao empty"></span>';
      h += '<span class="num"></span>';
    }
    h += '</div>';
  }
  box.innerHTML = h;
}

/** 点击摇铜钱 */
async function doShake() {
  if (ST.shaking) return;
  if (ST.resultReady) { showScreen('s3'); return; }
  if (ST.yao.length >= 6) return;
  ST.shaking = true;
  var btn = $('btnShake');
  btn.disabled = true;

  var y = throwYao();
  var coinIds = ['c1', 'c2', 'c3'];
  coinIds.forEach(function (id) {
    var c = $(id);
    c.classList.remove('flip');
    void c.offsetWidth;
    c.classList.add('flip');
  });
  await new Promise(function (r) { setTimeout(r, 520); });
  coinIds.forEach(function (id, i) {
    var c = $(id);
    c.classList.remove('flip', 'head', 'tail');
    c.classList.add(y.coins[i] === '字' ? 'head' : 'tail');
  });
  ST.yao.push(y);
  renderShakeGua();
  log('shake', '第' + ST.yao.length + '爻: v=' + y.v + ' ' + y.text + ' 铜钱=' + y.coins.join(','));

  var next = ST.yao.length;
  if (next < 6) {
    $('shakeProg').textContent = '第 ' + (next + 1) + ' 爻 / 共 6 爻';
    $('shakeMsg').textContent = '第 ' + next + ' 爻 · ' + y.text;
    btn.textContent = '摇 铜 钱';
  } else {
    $('shakeProg').textContent = '第 6 爻 / 共 6 爻';
    $('shakeMsg').innerHTML = '<span class="done">六爻已成！</span>';
    btn.textContent = '查 看 结 果';
  }
  ST.shaking = false;
  btn.disabled = false;
  if (ST.yao.length === 6) { await finishGua(); }
}

/** 六爻摇完，计算卦象并保存 */
async function finishGua() {
  try {
    var s = load();
    s.n += 1;
    s.his.push({
      q: ST.question,
      time: Date.now(),
      yao: ST.yao.map(function (y) { return { v: y.v }; })
    });
    save(s);
    refreshLeft();
  } catch (e) {
    log('error', '保存记录失败: ' + e.message);
  }

  var yao = ST.yao.map(function (y) { return y.v; });
  var dongIdx = yao.map(function (v, i) { return (v === 6 || v === 9) ? i : -1; }).filter(function (i) { return i >= 0; });
  var benName = nameOf(yao);
  var bian = yao.map(function (v, i) { return dongIdx.indexOf(i) >= 0 ? (v === 6 ? 7 : 8) : v; });
  var bianName = nameOf(bian);
  var hasBian = dongIdx.length > 0;
  var dongCount = dongIdx.length;
  var dongNote = dongCount === 0 ? '本卦无动爻，以本卦卦象为断'
    : dongCount + ' 个动爻 · ' + dongRule(dongCount);

  $('resTitle').textContent = '卦 成';
  $('resQuestion').textContent = '所问：' + ST.question;
  $('dongNote').textContent = dongNote;
  $('gbBenName').textContent = benName;
  $('gbBenTri').innerHTML = guaYaoGraph(yao);

  if (hasBian) {
    $('bianBlock').style.display = '';
    $('gbBianName').textContent = bianName;
    $('gbBianTri').innerHTML = guaYaoGraph(bian);
  } else {
    $('bianBlock').style.display = 'none';
  }
  ST.resultReady = true;
  ST.fromHistory = false;
  $('btnAgain').textContent = '再占一卦';
  log('result', '卦成: 本卦=' + benName + ' 变卦=' + (hasBian ? bianName : '无') + ' 动爻数=' + dongCount + ' 爻值=[' + yao.join(',') + ']');

  /* 30%概率弹出赞助 */
  if (Math.random() < 0.3) { setTimeout(openDonate, 1800); }
}

/* ========== 历史记录 ========== */

/** 渲染历史记录列表（分页） */
function renderHis() {
  var s = load();
  var box = $('hisList');
  if (!s.his.length) {
    box.innerHTML = '<div class="empty-tip">尚无占卜记录</div>';
    return;
  }
  var reversed = s.his.slice().reverse();
  var showCount = ST.hisPage * HIS_PAGE_SIZE;
  var shown = reversed.slice(0, showCount);
  box.innerHTML = '';
  shown.forEach(function (h, idx) {
    var realIdx = s.his.length - 1 - idx;
    var d = new Date(h.time);
    var vals = h.yao.map(function (y) { return y.v; });
    var nm = nameOf(vals);
    var dongCount = vals.filter(function (v) { return v === 6 || v === 9; }).length;
    var item = document.createElement('div');
    item.className = 'his-item';
    var html = '<div class="q">' + h.q + '</div>' +
      '<div class="meta">' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + (dongCount ? ' · ' + dongCount + '动爻' : '') + '</div>' +
      '<div class="his-body">' + guaYaoGraph(vals) + '<div class="bname">' + nm + '</div></div>';
    item.innerHTML = html;
    item.addEventListener('click', function () { showHisDetail(realIdx); });
    box.appendChild(item);
  });
  /* 加载更多 */
  if (showCount < reversed.length) {
    var more = document.createElement('div');
    more.className = 'px-btn dark';
    more.style.cssText = 'margin-top:8px;font-size:12px;letter-spacing:2px';
    more.textContent = '加载更多（还有 ' + (reversed.length - showCount) + ' 条）';
    more.addEventListener('click', function () { ST.hisPage++; renderHis(); });
    box.appendChild(more);
  }
}

/** 清空全部记录 */
function clearHis() {
  if (confirm('确定清空全部占卜记录？')) {
    var s = load();
    log('history', '清空全部记录，共' + s.his.length + '条');
    s.his = [];
    save(s);
    renderHis();
  }
}

/** 查看历史记录详情（复用结果页） */
function showHisDetail(idx) {
  var s = load();
  var h = s.his[idx];
  if (!h) return;
  var yao = h.yao.map(function (y) { return y.v; });
  var dongIdx = yao.map(function (v, i) { return (v === 6 || v === 9) ? i : -1; }).filter(function (i) { return i >= 0; });
  var benName = nameOf(yao);
  var bian = yao.map(function (v, i) { return dongIdx.indexOf(i) >= 0 ? (v === 6 ? 7 : 8) : v; });
  var bianName = nameOf(bian);
  var hasBian = dongIdx.length > 0;
  var dongCount = dongIdx.length;
  var dongNote = dongCount === 0 ? '本卦无动爻，以本卦卦象为断'
    : dongCount + ' 个动爻 · ' + dongRule(dongCount);

  $('resTitle').textContent = '卦 象';
  $('resQuestion').textContent = '所问：' + h.q;
  $('dongNote').textContent = dongNote;
  $('gbBenName').textContent = benName;
  $('gbBenTri').innerHTML = guaYaoGraph(yao);
  if (hasBian) {
    $('bianBlock').style.display = '';
    $('gbBianName').textContent = bianName;
    $('gbBianTri').innerHTML = guaYaoGraph(bian);
  } else {
    $('bianBlock').style.display = 'none';
  }
  ST.fromHistory = true;
  $('btnAgain').textContent = '返回历史记录';
  showScreen('s3');
  log('history', '查看历史详情: ' + h.q + ' 卦=' + benName);
}

/* ========== 备份导入导出 ========== */

/** 导出加密备份文件 */
function exportHis() {
  var s = load();
  if (!s.his.length) { alert('暂无记录可导出'); log('warn', '导出备份失败：无记录'); return; }
  try {
    var data = encrypt(JSON.stringify({
      exportTime: new Date().toISOString(),
      count: s.his.length,
      records: s.his
    }), SECRET);
    var blob = new Blob([data], { type: 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'gua_backup_' + todayStr() + '.dat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    log('backup', '导出备份，共 ' + s.his.length + ' 条');
  } catch (e) {
    log('error', '导出失败: ' + e.message);
    alert('导出失败: ' + e.message);
  }
}

/** 导入备份文件 */
function importHis(file) {
  log('backup', '开始导入文件: ' + file.name);
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var decrypted = decrypt(e.target.result, SECRET);
      var data = JSON.parse(decrypted);
      if (!data.records || !Array.isArray(data.records)) {
        alert('备份文件格式错误');
        log('error', '导入失败：格式错误');
        return;
      }
      var s = load();
      var existingTimes = s.his.map(function (h) { return h.time; });
      var added = 0, skipped = 0;
      data.records.forEach(function (r) {
        if (existingTimes.indexOf(r.time) < 0) { s.his.push(r); added++; }
        else { skipped++; }
      });
      save(s);
      log('backup', '导入完成：新增' + added + '条，跳过' + skipped + '条重复');
      alert('导入完成！新增 ' + added + ' 条记录，跳过 ' + skipped + ' 条重复');
      renderHis();
    } catch (err) {
      log('error', '导入解密失败: ' + err.message);
      alert('备份文件解密失败或已损坏');
    }
  };
  reader.onerror = function () { log('error', '文件读取失败'); alert('文件读取失败'); };
  reader.readAsText(file);
}

/* ========== 赞助弹窗 ========== */
function openDonate() { document.getElementById('donateMask').classList.add('show'); }
function closeDonate() { document.getElementById('donateMask').classList.remove('show'); }

/* ========== 事件绑定 ========== */
$('btn0').addEventListener('click', enterMind);
$('btnCancelMind').addEventListener('click', cancelMind);
$('btnShake').addEventListener('click', doShake);

$('btnAgain').addEventListener('click', function () {
  if (ST.fromHistory) {
    ST.fromHistory = false;
    $('btnAgain').textContent = '再占一卦';
    renderHis();
    showScreen('s4');
  } else {
    showScreen('s0');
    $('err0').textContent = '';
  }
});

$('btnHis').addEventListener('click', function () {
  ST.hisPage = 1;
  renderHis();
  renderStorageStatus();
  showScreen('s4');
});
$('btnHisBack').addEventListener('click', function () { showScreen('s0'); });
$('btnHisClear').addEventListener('click', clearHis);
$('btnHisExport').addEventListener('click', exportHis);
$('btnChooseFolder').addEventListener('click', chooseDataFolder);
$('btnHisImport').addEventListener('click', function () {
  log('backup', '点击导入备份');
  $('importFile').click();
});
$('importFile').addEventListener('change', function () {
  if (this.files[0]) importHis(this.files[0]);
  this.value = '';
});

/* 赞助弹窗 */
$('btnDonate').addEventListener('click', openDonate);
$('btnDonateClose').addEventListener('click', closeDonate);
document.getElementById('donateMask').addEventListener('click', function (e) {
  if (e.target === this) closeDonate();
});

/* 规则弹窗 */
$('btnRuleOk').addEventListener('click', confirmRule);
$('btnRuleCancel').addEventListener('click', cancelRule);
$('btnRuleView').addEventListener('click', function () {
  $('btnRuleOk').textContent = '关 闭';
  $('btnRuleCancel').style.display = 'none';
  $('ruleDontShow').parentElement.style.display = 'none';
  $('ruleMask').classList.add('show');
});

/* ========== 初始化 ========== */
refreshLeft();
showScreen('s0');
log('app', '页面加载完成');

/* 恢复文件系统句柄并更新存储状态 */
fsRestoreHandle().then(function () {
  refreshLeft();
  renderStorageStatus();
  if (FS.ready) renderHis(); /* 从文件恢复了数据，刷新历史列表 */
});

/** 更新存储状态显示 */
function renderStorageStatus() {
  var el = document.getElementById('storageStatus');
  if (el) el.textContent = '存储：' + getStorageStatus();
}
