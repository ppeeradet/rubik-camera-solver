/* vision.js — อ่านสีสติกเกอร์จากภาพ จัดกลุ่มสี และตรวจความถูกต้องของลูกบาศก์
 * ไม่มีไลบรารีภายนอก ทำงานในเบราว์เซอร์ (และใน Node สำหรับทดสอบ)
 */
(function (root) {
  'use strict';

  // ลำดับหน้าตามมาตรฐาน Kociemba / cubejs
  var FACES = ['U', 'R', 'F', 'D', 'L', 'B'];

  /* ---------- สี ---------- */
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function rgb2lab(rgb) {
    var R = lin(rgb[0]), G = lin(rgb[1]), B = lin(rgb[2]);
    var X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
    var Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
    var Z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;
    function f(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
    var fx = f(X), fy = f(Y), fz = f(Z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  // ให้น้ำหนักความสว่างน้อยลง เพราะแสงในห้องเปลี่ยนความสว่างได้มากกว่าเฉดสี
  function dE(a, b) {
    var dl = (a[0] - b[0]) * 0.55, da = a[1] - b[1], db = a[2] - b[2];
    return Math.sqrt(dl * dl + da * da + db * db);
  }

  // สีต้นแบบสำหรับ "ตั้งชื่อ" สีของจุดศูนย์กลาง (รวมสีสติกเกอร์แบบ stickerless ของ QiYi)
  var PROTOS = {
    W: [[240, 240, 235], [255, 255, 255], [205, 210, 208]],
    Y: [[255, 213, 0], [222, 228, 24], [250, 235, 70]],
    R: [[194, 29, 44], [200, 16, 46], [170, 25, 40]],
    O: [[232, 87, 12], [255, 88, 0], [240, 120, 20]],
    G: [[70, 212, 30], [0, 155, 72], [40, 170, 60]],
    B: [[10, 160, 185], [0, 70, 173], [0, 100, 200], [30, 120, 190]]
  };
  var NAMES = ['W', 'Y', 'R', 'O', 'G', 'B'];
  var PROTO_LAB = {};
  NAMES.forEach(function (n) { PROTO_LAB[n] = PROTOS[n].map(rgb2lab); });

  /* ---------- Hungarian (จับคู่ต้นทุนต่ำสุด) ---------- */
  function hungarian(a) {
    var n = a.length, m = a[0].length, INF = 1e18;
    var u = new Array(n + 1).fill(0), v = new Array(m + 1).fill(0);
    var p = new Array(m + 1).fill(0), way = new Array(m + 1).fill(0);
    for (var i = 1; i <= n; i++) {
      p[0] = i;
      var j0 = 0;
      var minv = new Array(m + 1).fill(INF);
      var used = new Array(m + 1).fill(false);
      do {
        used[j0] = true;
        var i0 = p[j0], delta = INF, j1 = 0;
        for (var j = 1; j <= m; j++) {
          if (!used[j]) {
            var cur = a[i0 - 1][j - 1] - u[i0] - v[j];
            if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
            if (minv[j] < delta) { delta = minv[j]; j1 = j; }
          }
        }
        for (var k = 0; k <= m; k++) {
          if (used[k]) { u[p[k]] += delta; v[k] -= delta; } else { minv[k] -= delta; }
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do { var jj = way[j0]; p[j0] = p[jj]; j0 = jj; } while (j0);
    }
    var ans = new Array(n).fill(-1);
    for (var c = 1; c <= m; c++) if (p[c]) ans[p[c] - 1] = c - 1;
    return ans;
  }

  /* ---------- อ่านสีจากภาพ ---------- */
  function median(arr) {
    arr.sort(function (x, y) { return x - y; });
    return arr[arr.length >> 1];
  }
  // imgData: {width,height,data} (RGBA) ; grid: {x,y,s} เป็นสัดส่วน 0..1 ของด้านภาพ (ภาพจัตุรัส)
  function sampleGrid(imgData, grid) {
    var W = imgData.width, H = imgData.height, d = imgData.data;
    var cell = grid.s * W / 3;
    var half = Math.max(2, Math.round(cell * 0.17));
    var out = [];
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 3; c++) {
        var cx = Math.round(grid.x * W + (c + 0.5) * cell);
        var cy = Math.round(grid.y * H + (r + 0.5) * cell);
        var R = [], G = [], B = [];
        for (var yy = cy - half; yy <= cy + half; yy++) {
          for (var xx = cx - half; xx <= cx + half; xx++) {
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            var o = (yy * W + xx) * 4;
            R.push(d[o]); G.push(d[o + 1]); B.push(d[o + 2]);
          }
        }
        out.push(R.length ? [median(R), median(G), median(B)] : [128, 128, 128]);
      }
    }
    return out;
  }

  /* ---------- ตั้งชื่อสีของศูนย์กลาง 6 หน้า ---------- */
  // centers: {U:[r,g,b],...} -> {U:'Y', ...} ชื่อสีไม่ซ้ำกัน
  function nameCenters(centers) {
    var cost = FACES.map(function (f) {
      var lab = rgb2lab(centers[f]);
      return NAMES.map(function (n) {
        var best = 1e9;
        PROTO_LAB[n].forEach(function (p) { best = Math.min(best, dE(lab, p)); });
        return best * best;
      });
    });
    var asg = hungarian(cost), res = {};
    FACES.forEach(function (f, i) { res[f] = NAMES[asg[i]]; });
    return res;
  }

  /* ---------- จัดกลุ่มสีสติกเกอร์ทั้ง 54 ช่อง ---------- */
  // samples: {U:[9 rgb], R:..., ...} -> array 54 ตัวอักษรหน้า (U,R,F,D,L,B) ลำดับ URFDLB
  // วิธี: เทียบกับสีศูนย์กลางจริงของภาพ และบังคับให้แต่ละสีมี 9 ช่องพอดี (Hungarian)
  function classify(samples) {
    var centerLab = FACES.map(function (f) { return rgb2lab(samples[f][4]); });
    var items = [];
    FACES.forEach(function (f, fi) {
      for (var i = 0; i < 9; i++) if (i !== 4) items.push({ fi: fi, i: i, lab: rgb2lab(samples[f][i]) });
    });
    var cost = items.map(function (it) {
      var row = [];
      for (var c = 0; c < 6; c++) {
        var d = dE(it.lab, centerLab[c]);
        for (var k = 0; k < 8; k++) row.push(d * d);
      }
      return row;
    });
    var asg = hungarian(cost);
    var out = new Array(54);
    FACES.forEach(function (f, fi) { out[fi * 9 + 4] = fi; });
    items.forEach(function (it, idx) { out[it.fi * 9 + it.i] = Math.floor(asg[idx] / 8); });
    return out; // ค่า 0..5 = ดัชนีหน้าใน FACES (สีเดียวกับศูนย์กลางหน้านั้น)
  }

  /* ---------- ตรวจความถูกต้องของลูกบาศก์ ---------- */
  function inversionsParity(arr) {
    var inv = 0;
    for (var i = 0; i < arr.length; i++) for (var j = i + 1; j < arr.length; j++) if (arr[i] > arr[j]) inv++;
    return inv & 1;
  }
  // facelets: สตริง 54 ตัวอักษร ลำดับ URFDLB ; Cube = คลาส cubejs
  // คืน null ถ้าถูกต้อง หรือข้อความภาษาไทยบอกปัญหา
  function validate(facelets, Cube) {
    if (typeof facelets !== 'string' || facelets.length !== 54 || /[^URFDLB]/.test(facelets)) {
      return 'ยังกรอกสีไม่ครบทุกช่อง';
    }
    var cnt = {};
    for (var i = 0; i < 54; i++) cnt[facelets[i]] = (cnt[facelets[i]] || 0) + 1;
    for (var k = 0; k < FACES.length; k++) {
      if (cnt[FACES[k]] !== 9) return 'แต่ละสีต้องมี 9 ช่องพอดี (ตอนนี้บางสีมากหรือน้อยเกินไป)';
    }
    var cube;
    try { cube = Cube.fromString(facelets); } catch (e) { return 'อ่านสถานะลูกบาศก์ไม่ได้'; }
    if (cube.asString() !== facelets) {
      return 'มีชิ้นส่วนที่ไม่มีอยู่จริงบนรูบิค (สีของมุมหรือขอบซ้ำหรือผิดคู่) ลองตรวจสีที่อ่านผิด';
    }
    var j = cube.toJSON();
    var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
    if (sum(j.co) % 3 !== 0) return 'มีมุมบิดอยู่ 1 มุม ตรวจสีของมุมอีกครั้ง';
    if (sum(j.eo) % 2 !== 0) return 'มีขอบกลับด้านอยู่ 1 ชิ้น ตรวจสีของขอบอีกครั้ง';
    if (inversionsParity(j.cp) !== inversionsParity(j.ep)) return 'มีชิ้นสลับตำแหน่งแบบที่เป็นไปไม่ได้ ตรวจสีที่อ่านผิด';
    return null;
  }

  var api = {
    FACES: FACES, NAMES: NAMES, rgb2lab: rgb2lab, dE: dE, hungarian: hungarian,
    sampleGrid: sampleGrid, nameCenters: nameCenters, classify: classify, validate: validate
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RCSVision = api;
})(typeof self !== 'undefined' ? self : this);
