/**
 * gua.js — 易经64卦核心逻辑
 * 包含：卦库、卦名计算、爻线图渲染、铜钱随机数
 */

/* ========== 64卦库 ==========
 * u=上卦(外卦) 三爻符号
 * l=下卦(内卦) 三爻符号
 */
var GUA = [
  { n: '乾为天', u: '☰', l: '☰' }, { n: '坤为地', u: '☷', l: '☷' },
  { n: '水雷屯', u: '☵', l: '☳' }, { n: '山水蒙', u: '☶', l: '☵' },
  { n: '水天需', u: '☵', l: '☰' }, { n: '天水讼', u: '☰', l: '☵' },
  { n: '地水师', u: '☷', l: '☵' }, { n: '水地比', u: '☵', l: '☷' },
  { n: '风天小畜', u: '☴', l: '☰' }, { n: '天泽履', u: '☰', l: '☱' },
  { n: '地天泰', u: '☷', l: '☰' }, { n: '天地否', u: '☰', l: '☷' },
  { n: '天火同人', u: '☰', l: '☲' }, { n: '火天大有', u: '☲', l: '☰' },
  { n: '地山谦', u: '☷', l: '☶' }, { n: '雷地豫', u: '☳', l: '☷' },
  { n: '泽雷随', u: '☱', l: '☳' }, { n: '山风蛊', u: '☶', l: '☴' },
  { n: '地泽临', u: '☷', l: '☱' }, { n: '风地观', u: '☴', l: '☷' },
  { n: '火雷噬嗑', u: '☲', l: '☳' }, { n: '山火贲', u: '☶', l: '☲' },
  { n: '山地剥', u: '☶', l: '☷' }, { n: '地雷复', u: '☷', l: '☳' },
  { n: '天雷无妄', u: '☰', l: '☳' }, { n: '山天大畜', u: '☶', l: '☰' },
  { n: '山雷颐', u: '☶', l: '☳' }, { n: '泽风大过', u: '☱', l: '☴' },
  { n: '坎为水', u: '☵', l: '☵' }, { n: '离为火', u: '☲', l: '☲' },
  { n: '泽山咸', u: '☱', l: '☶' }, { n: '雷风恒', u: '☳', l: '☴' },
  { n: '天山遁', u: '☰', l: '☶' }, { n: '雷天大壮', u: '☳', l: '☰' },
  { n: '火地晋', u: '☲', l: '☷' }, { n: '地火明夷', u: '☷', l: '☲' },
  { n: '风火家人', u: '☴', l: '☲' }, { n: '火泽睽', u: '☲', l: '☱' },
  { n: '水山蹇', u: '☵', l: '☶' }, { n: '雷水解', u: '☳', l: '☵' },
  { n: '山泽损', u: '☶', l: '☱' }, { n: '风雷益', u: '☴', l: '☳' },
  { n: '泽天夬', u: '☱', l: '☰' }, { n: '天风姤', u: '☰', l: '☴' },
  { n: '泽地萃', u: '☱', l: '☷' }, { n: '地风升', u: '☷', l: '☴' },
  { n: '泽水困', u: '☱', l: '☵' }, { n: '水风井', u: '☵', l: '☴' },
  { n: '泽火革', u: '☱', l: '☲' }, { n: '火风鼎', u: '☲', l: '☴' },
  { n: '震为雷', u: '☳', l: '☳' }, { n: '艮为山', u: '☶', l: '☶' },
  { n: '风山渐', u: '☴', l: '☶' }, { n: '雷泽归妹', u: '☳', l: '☱' },
  { n: '雷火丰', u: '☳', l: '☲' }, { n: '火山旅', u: '☲', l: '☶' },
  { n: '巽为风', u: '☴', l: '☴' }, { n: '兑为泽', u: '☱', l: '☱' },
  { n: '风水涣', u: '☴', l: '☵' }, { n: '水泽节', u: '☵', l: '☱' },
  { n: '风泽中孚', u: '☴', l: '☱' }, { n: '雷山小过', u: '☳', l: '☶' },
  { n: '水火既济', u: '☵', l: '☲' }, { n: '火水未济', u: '☲', l: '☵' }
];

/* 八卦符号 → (名, 自然象, 三爻二进制) */
var TRI = {
  '☰': { n: '乾', x: '天', b: [1, 1, 1] },
  '☷': { n: '坤', x: '地', b: [0, 0, 0] },
  '☵': { n: '坎', x: '水', b: [0, 1, 0] },
  '☲': { n: '离', x: '火', b: [1, 0, 1] },
  '☳': { n: '震', x: '雷', b: [1, 0, 0] },
  '☴': { n: '巽', x: '风', b: [0, 1, 1] },
  '☶': { n: '艮', x: '山', b: [0, 0, 1] },
  '☱': { n: '兑', x: '泽', b: [1, 1, 0] }
};

/**
 * 三爻数值(6/7/8/9) → 八卦符号
 * 数组索引0=初爻(最下)，索引2=上爻(最上)
 */
function getTri(three) {
  var a = three[0] % 2 ? 1 : 0;
  var b = three[1] % 2 ? 1 : 0;
  var c = three[2] % 2 ? 1 : 0;
  var code = a * 4 + b * 2 + c;
  return ['☷', '☶', '☵', '☴', '☳', '☲', '☱', '☰'][code];
}

/**
 * 六爻数值数组 → 卦名
 * @param {number[]} yao6 - 6个爻值(6/7/8/9)，索引0=初爻
 * @returns {string} 卦名
 */
function nameOf(yao6) {
  var l = getTri(yao6.slice(0, 3));
  var u = getTri(yao6.slice(3, 6));
  var g = GUA.find(function (x) { return x.l === l && x.u === u; });
  return g ? g.n : '未知卦';
}

/**
 * 生成六爻爻线图HTML
 * @param {Array} yao6 - 爻值数组 或 {v:number, dong:boolean} 对象数组
 * @returns {string} HTML字符串
 */
function guaYaoGraph(yao6) {
  var arr = yao6.map(function (y) {
    if (typeof y === 'object' && y !== null) return { v: y.v, dong: !!y.dong };
    return { v: y, dong: (y === 6 || y === 9) };
  });

  function line(y) {
    if (!y) return '<div class="gline empty" style="opacity:.18"></div>';
    var yang = (y.v === 7 || y.v === 9);
    var cls = 'gline' + (yang ? '' : ' yin') + (y.dong ? ' dong' : '');
    return '<div class="' + cls + '"></div>';
  }

  function cluster(idxs) {
    var h = '<div class="cluster">';
    [2, 1, 0].forEach(function (k) { h += line(arr[idxs[k]]); });
    h += '</div>';
    return h;
  }

  function labeledCluster(idxs, neiWai) {
    var vals = idxs.map(function (i) { return arr[i] ? arr[i].v : 7; });
    var sym = getTri(vals);
    var xiang = TRI[sym] ? TRI[sym].x : '';
    return '<div class="cluster-wrap"><span class="tri-xiang">' + xiang + '</span>' + cluster(idxs) + '<span class="tri-nw">' + neiWai + '</span></div>';
  }

  return '<div class="gua-yao">' + labeledCluster([3, 4, 5], '外') + labeledCluster([0, 1, 2], '内') + '</div>';
}

/* ========== 铜钱随机数 ========== */

/** 安全随机布尔值，优先用crypto.getRandomValues */
function randomBool() {
  if (window.crypto && crypto.getRandomValues) {
    var a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % 2 === 0;
  }
  return Math.random() < 0.5;
}

/**
 * 摇三枚铜钱，得一爻
 * 正面=字(2) 背面=花(3)
 * 6=老阴(动) 7=少阳 8=少阴 9=老阳(动)
 */
function throwYao() {
  var coins = [];
  var sum = 0;
  for (var i = 0; i < 3; i++) {
    var zi = randomBool();
    coins.push(zi ? '字' : '花');
    sum += zi ? 2 : 3;
  }
  var y;
  if (sum === 6) y = { v: 6, text: '老阴', dong: true };
  else if (sum === 7) y = { v: 7, text: '少阳', dong: false };
  else if (sum === 8) y = { v: 8, text: '少阴', dong: false };
  else y = { v: 9, text: '老阳', dong: true };
  y.coins = coins;
  return y;
}

/**
 * 根据动爻数量给出断卦方法说明
 * @param {number} n - 动爻数量(0-6)
 */
function dongRule(n) {
  if (n === 1) return '取本卦动爻爻辞为断';
  if (n === 2) return '以阴动爻为主为断';
  if (n === 3) return '参看本卦、变卦卦辞';
  if (n === 4 || n === 5) return '以变卦静爻为断';
  return '乾坤二卦特殊参看';
}
