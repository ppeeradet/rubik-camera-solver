/* app.js — แก้รูบิคด้วยกล้อง: สแกน 6 ด้าน / ตั้งสีเองบนโมเดล 3 มิติ / บอกวิธีแก้ทีละตา */
(function () {
  'use strict';
  var V = window.RCSVision, Cube = window.CubeLib;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var FACES = V.FACES; // U R F D L B

  var COLORS = {
    W: { th: 'ขาว', hex: '#f2f5f3' }, Y: { th: 'เหลือง', hex: '#dfe51a' }, R: { th: 'แดง', hex: '#c21d2c' },
    O: { th: 'ส้ม', hex: '#e8570c' }, G: { th: 'เขียว', hex: '#46d41e' }, B: { th: 'ฟ้า', hex: '#0aa2bb' }
  };
  var FACE_TH = { U: 'บน', R: 'ขวา', F: 'หน้า', D: 'ล่าง', L: 'ซ้าย', B: 'หลัง' };
  // ศูนย์กลางตามรูบิคของแบมแบม: เหลืองบน ฟ้าหน้า แดงขวา ส้มซ้าย เขียวหลัง ขาวล่าง
  var DEFAULT_SCHEME = { U: 'Y', F: 'B', R: 'R', D: 'W', L: 'O', B: 'G' };
  var NETPOS = { U: [3, 0], L: [0, 3], F: [3, 3], R: [6, 3], B: [9, 3], D: [3, 6] };
  var DEMO_SCRAMBLE = "R U R' U' F2 D L' B2 U' R2 F D2 L U2 B'";

  var SCAN = [
    { f: 'F', t: 'ด้านที่ 1 · ด้านหน้า (F)', d: 'ถือรูบิคเป็นท่าเริ่มต้น แนะนำให้ศูนย์กลางเหลืองอยู่ข้างบน ฟ้าหันหาตัว แล้วถ่ายด้านที่หันหาตัว' },
    { f: 'R', t: 'ด้านที่ 2 · ด้านขวา (R)', d: 'หมุนทั้งลูกไปทางซ้าย 90° ให้ด้านขวาเข้ามาอยู่ข้างหน้า ขอบบนยังอยู่ข้างบน' },
    { f: 'B', t: 'ด้านที่ 3 · ด้านหลัง (B)', d: 'หมุนทั้งลูกไปทางซ้ายอีก 90° ขอบบนยังอยู่ข้างบน' },
    { f: 'L', t: 'ด้านที่ 4 · ด้านซ้าย (L)', d: 'หมุนทั้งลูกไปทางซ้ายอีก 90° ขอบบนยังอยู่ข้างบน' },
    { f: 'U', t: 'ด้านที่ 5 · ด้านบน (U)', d: 'หมุนไปทางซ้ายอีก 90° ให้กลับท่าเริ่มต้น แล้วเงยด้านบนเข้าหากล้อง ด้านหน้าเดิมจะอยู่ล่างภาพ' },
    { f: 'D', t: 'ด้านที่ 6 · ด้านล่าง (D)', d: 'กลับท่าเริ่มต้น แล้วคว่ำด้านล่างเข้าหากล้อง ด้านหน้าเดิมจะอยู่บนภาพ' }
  ];

  var S = {
    scheme: Object.assign({}, DEFAULT_SCHEME),
    cells: new Array(54).fill(null),   // ดัชนีหน้า 0..5 หรือ null
    samples: {}, step: 0, cur: null, grid: { x: 0.19, y: 0.19, s: 0.62 },
    brush: 0, from: 'manual', moves: [], idx: 0, facelets: '', timer: null, stream: null, mode: 'idle'
  };

  /* ---------- ตัวช่วย ---------- */
  function hexOf(fi) { return COLORS[S.scheme[FACES[fi]]].hex; }
  function nameOf(fi) { return COLORS[S.scheme[FACES[fi]]].th; }
  function rgbCss(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
  function textOn(hex) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var L = 0.2126 * Math.pow(r / 255, 2.2) + 0.7152 * Math.pow(g / 255, 2.2) + 0.0722 * Math.pow(b / 255, 2.2);
    return L < 0.22 ? '#ffffff' : '#1c2230';
  }
  function show(id) {
    ['home', 'scan', 'edit', 'solve'].forEach(function (n) { $('#screen-' + n).hidden = (n !== id); });
    if (id !== 'scan') stopCamera();
    if (id !== 'solve') stopPlay();
    window.scrollTo(0, 0);
  }
  function faceletString() { return S.cells.map(function (c) { return c === null ? '?' : FACES[c]; }).join(''); }
  function resetCenters() { for (var fi = 0; fi < 6; fi++) S.cells[fi * 9 + 4] = fi; }

  /* ---------- ตัวแก้ (Web Worker) ---------- */
  var solver = (function () {
    var worker = null, seq = 0, pend = {}, ready = false, mainInit = false;
    function setState(ok) {
      var el = $('#solverState'); ready = ok;
      el.textContent = ok ? 'ตัวแก้พร้อมแล้ว' : 'กำลังเตรียมตัวแก้…';
      el.classList.toggle('ok', ok);
    }
    function call(msg) {
      return new Promise(function (resolve, reject) {
        var id = ++seq; msg.id = id;
        var t = setTimeout(function () { delete pend[id]; reject(new Error('หมดเวลาคำนวณ')); }, 30000);
        pend[id] = { resolve: resolve, reject: reject, t: t };
        worker.postMessage(msg);
      });
    }
    function source() {
      var el = $('#cubejs-src');
      if (el.getAttribute('src')) return fetch(el.getAttribute('src')).then(function (r) { return r.text(); });
      return Promise.resolve(el.textContent);
    }
    function start() {
      return source().then(function (text) {
        var code = text + ';self.Cube=self.CubeLib;self.onmessage=function(e){var d=e.data;try{' +
          'if(d.cmd==="init"){Cube.initSolver();postMessage({id:d.id,ok:true});}' +
          'else{var c=Cube.fromString(d.facelets);postMessage({id:d.id,ok:true,solution:c.solve()});}' +
          '}catch(err){postMessage({id:d.id,ok:false,error:String(err)});}};';
        worker = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
        worker.onmessage = function (e) {
          var p = pend[e.data.id]; if (!p) return;
          clearTimeout(p.t); delete pend[e.data.id];
          if (e.data.ok) p.resolve(e.data); else p.reject(new Error(e.data.error));
        };
        worker.onerror = function () { worker = null; };
        return call({ cmd: 'init' });
      }).then(function () { setState(true); }).catch(function () { worker = null; });
    }
    function initMain() {
      return new Promise(function (res) {
        setTimeout(function () { if (!mainInit) { Cube.initSolver(); mainInit = true; } setState(true); res(); }, 30);
      });
    }
    return {
      init: function () { setState(false); return start().then(function () { if (!worker) return initMain(); }); },
      solve: function (facelets) {
        if (worker) return call({ cmd: 'solve', facelets: facelets }).then(function (r) { return r.solution; });
        return initMain().then(function () { return Cube.fromString(facelets).solve(); });
      }
    };
  })();

  /* ---------- แผ่นคลี่ ---------- */
  function createNet(el, onTap) {
    var cells = [];
    el.classList.toggle('tap', !!onTap);
    FACES.forEach(function (f, fi) {
      var p = NETPOS[f];
      for (var j = 0; j < 9; j++) {
        var c = document.createElement('i');
        c.style.gridColumn = String(p[0] + (j % 3) + 1);
        c.style.gridRow = String(p[1] + Math.floor(j / 3) + 1);
        c.dataset.i = String(fi * 9 + j);
        if (j === 4) c.classList.add('ctr');
        el.appendChild(c); cells[fi * 9 + j] = c;
      }
    });
    if (onTap) el.addEventListener('click', function (e) {
      var c = e.target.closest('i'); if (c) onTap(+c.dataset.i);
    });
    return {
      set: function (colors, opt) {
        opt = opt || {};
        var hi = opt.hl ? FACES.indexOf(opt.hl) : -1;
        for (var i = 0; i < 54; i++) {
          var c = cells[i], col = colors[i];
          c.style.background = col || '#cfd5db';
          var on = hi >= 0 && Math.floor(i / 9) === hi;
          c.classList.toggle('hl', on);
          c.classList.toggle('fade', hi >= 0 && !on);
          c.textContent = (on && i % 9 === 4) ? (opt.ctrText || '') : '';
        }
      }
    };
  }

  /* ---------- โมเดล 3 มิติ (ใช้ทั้งหน้าตั้งสีและหน้าวิธีแก้) ---------- */
  var VIEWS = { F: [0, 0], R: [0, -90], B: [0, -180], L: [0, 90], U: [-90, 0], D: [90, 0] };
  var ARROWS = {
    cw: '<path d="M50 14 A36 36 0 1 1 14 50" fill="none" stroke="#fff" stroke-width="17" stroke-linecap="round"/>' +
      '<path d="M50 14 A36 36 0 1 1 14 50" fill="none" stroke="#1c2230" stroke-width="9" stroke-linecap="round"/>' +
      '<polygon points="0,52 28,52 14,28" fill="#1c2230" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>',
    half: '<path d="M14 62 A36 36 0 0 1 86 62" fill="none" stroke="#fff" stroke-width="17" stroke-linecap="round"/>' +
      '<path d="M14 62 A36 36 0 0 1 86 62" fill="none" stroke="#1c2230" stroke-width="9" stroke-linecap="round"/>' +
      '<polygon points="72,60 100,60 86,84" fill="#1c2230" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>' +
      '<polygon points="0,60 28,60 14,84" fill="#1c2230" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>' +
      '<text x="50" y="72" text-anchor="middle" font-family="Prompt,sans-serif" font-weight="800" font-size="30" fill="#1c2230" stroke="#fff" stroke-width="5" paint-order="stroke">180°</text>'
  };
  function makeCube3d(root, scene, onTap) {
    var o = { rx: -28, ry: -35, els: [], faces: {} };
    root.innerHTML = '';
    FACES.forEach(function (f, fi) {
      var face = document.createElement('div'); face.className = 'cf ' + f; o.faces[f] = face;
      for (var j = 0; j < 9; j++) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'st' + (j === 4 ? ' ctr' : '');
        b.dataset.i = String(fi * 9 + j); b.tabIndex = onTap ? 0 : -1;
        b.setAttribute('aria-label', 'ด้าน' + FACE_TH[f] + ' แถว ' + (Math.floor(j / 3) + 1) + ' ช่อง ' + (j % 3 + 1));
        face.appendChild(b); o.els[fi * 9 + j] = b;
      }
      root.appendChild(face);
    });
    o.apply = function () { root.style.transform = 'rotateX(' + o.rx + 'deg) rotateY(' + o.ry + 'deg)'; };
    o.set = function (rx, ry) {
      o.rx = rx; o.ry = ry + 360 * Math.round((o.ry - ry) / 360); o.apply();
    };
    o.view = function (f, tilt) {
      var t = VIEWS[f], side = 'RFLB'.indexOf(f) >= 0;
      var rx = t[0], ry = t[1];
      if (tilt) { if (side) { rx = -22; ry -= 28; } else rx += (f === 'U' ? 25 : -25); }
      o.set(rx, ry);
    };
    o.arrow = function (f, kind) {
      FACES.forEach(function (x) {
        var face = o.faces[x], old = face.querySelector('svg'); if (old) old.remove();
        face.classList.toggle('act', x === f);
      });
      root.classList.toggle('hasAct', !!f);
      if (!f || !kind) return;
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('class', 'arrow');
      svg.innerHTML = kind === 'half' ? ARROWS.half : (kind === 'ccw' ? '<g transform="translate(100,0) scale(-1,1)">' + ARROWS.cw + '</g>' : ARROWS.cw);
      o.faces[f].appendChild(svg);
    };
    o.colors = function (colors) {
      for (var i = 0; i < 54; i++) {
        var el = o.els[i];
        el.style.background = colors[i] || '#cfd5db';
        el.style.color = colors[i] ? textOn(colors[i]) : '#1c2230';
      }
    };
    o.apply();
    var st = null;
    scene.addEventListener('pointerdown', function (e) {
      st = { x: e.clientX, y: e.clientY, rx: o.rx, ry: o.ry, moved: false, id: e.pointerId, tgt: e.target.closest('.st') };
    });
    scene.addEventListener('pointermove', function (e) {
      if (!st) return;
      var dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.moved && Math.hypot(dx, dy) > 7) {
        st.moved = true; root.classList.add('drag');
        try { scene.setPointerCapture(st.id); } catch (_) { /* ignore */ }
        if (o.onDrag) o.onDrag();
      }
      if (st.moved) {
        o.ry = st.ry + dx * 0.6;
        o.rx = Math.max(-90, Math.min(90, st.rx - dy * 0.6));
        o.apply();
      }
    });
    scene.addEventListener('pointerup', function () {
      if (!st) return;
      root.classList.remove('drag');
      if (!st.moved && st.tgt && onTap) onTap(+st.tgt.dataset.i);
      st = null;
    });
    scene.addEventListener('pointercancel', function () { root.classList.remove('drag'); st = null; });
    return o;
  }
  var cube3, cubeS;
  function build3d() {
    cube3 = makeCube3d($('#cube3d'), $('#scene'), paint);
    cube3.onDrag = function () { document.querySelectorAll('.view.on').forEach(function (v) { v.classList.remove('on'); }); };
    var vb = $('#views'); vb.innerHTML = '';
    ['F', 'R', 'B', 'L', 'U', 'D'].forEach(function (f) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'view'; b.dataset.f = f;
      b.textContent = FACE_TH[f]; b.setAttribute('aria-label', 'ดูด้าน' + FACE_TH[f]);
      b.addEventListener('click', function () { snapView(f); });
      vb.appendChild(b);
    });
    cubeS = makeCube3d($('#cube3dS'), $('#sceneS'), null);
    cubeS.onDrag = function () { $('#btnLook').hidden = false; };
    $('#btnLook').onclick = function () { $('#btnLook').hidden = true; lookAtMove(); };
  }
  function snapView(f) {
    cube3.view(f, false);
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('on', v.dataset.f === f); });
  }
  function lookAtMove() {
    var m = S.idx < S.moves.length ? S.moves[S.idx] : null;
    if (!m) { cubeS.set(-28, -35); return; }
    cubeS.view(m[0], true);
  }

  /* ---------- หน้าตั้งค่า/ตรวจสี ---------- */
  var editNet, scanNet, solveNet;
  function buildPalette() {
    var p = $('#palette'); p.innerHTML = '';
    for (var fi = 0; fi < 6; fi++) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'sw'; b.dataset.b = String(fi);
      b.setAttribute('role', 'radio'); b.setAttribute('aria-label', 'สี' + nameOf(fi));
      b.style.background = hexOf(fi); b.style.color = textOn(hexOf(fi)); b.textContent = nameOf(fi);
      p.appendChild(b);
    }
    var e = document.createElement('button'); e.type = 'button'; e.className = 'sw erase'; e.dataset.b = 'x';
    e.setAttribute('role', 'radio'); e.setAttribute('aria-label', 'ลบสี'); e.textContent = 'ลบ';
    p.appendChild(e);
    p.onclick = function (ev) {
      var b = ev.target.closest('.sw'); if (!b) return;
      S.brush = b.dataset.b === 'x' ? null : +b.dataset.b; markBrush();
    };
    markBrush();
  }
  function markBrush() {
    document.querySelectorAll('#palette .sw').forEach(function (b) {
      var on = (b.dataset.b === 'x') ? S.brush === null : (+b.dataset.b === S.brush);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }
  function paint(i) {
    if (i % 9 === 4) { setCenter(Math.floor(i / 9)); return; }
    S.cells[i] = S.brush;
    refreshEdit();
  }
  // เปลี่ยนสีศูนย์กลางของด้าน fi เป็นสีที่เลือกอยู่ (สลับกับด้านที่ถือสีนั้นอยู่ เพื่อให้ 6 ศูนย์กลางสีไม่ซ้ำ)
  function setCenter(fi) {
    var b = S.brush; if (b === null || b === fi) return;
    var a = FACES[fi], c = FACES[b], t = S.scheme[a];
    S.scheme[a] = S.scheme[c]; S.scheme[c] = t;
    S.brush = fi; buildPalette(); refreshEdit();
  }
  function schemeFix() { S.fix = null; $('#fixBox').hidden = true; }
  function refreshEdit() {
    var colors = S.cells.map(function (c) { return c === null ? null : hexOf(c); });
    editNet.set(colors);
    cube3.colors(colors);
    var cnt = $('#counts'); cnt.innerHTML = '';
    var total = 0;
    for (var fi = 0; fi < 6; fi++) {
      var n = S.cells.filter(function (c) { return c === fi; }).length; total += n;
      var d = document.createElement('span'); d.className = 'cnt ' + (n === 9 ? 'ok' : (n > 9 ? 'bad' : ''));
      d.innerHTML = '<i style="background:' + hexOf(fi) + '"></i>' + nameOf(fi) + ' ' + n + '/9';
      cnt.appendChild(d);
    }
    $('#editErr').textContent = ''; schemeFix();
    var cb = $('#centerBox'), ok = V.oppositeOk(S.scheme);
    cb.hidden = false;
    cb.innerHTML = '<b>1) ตรวจศูนย์กลาง</b> ' + FACES.map(function (f, fi) {
      return '<span class="cnt"><i style="background:' + hexOf(fi) + '"></i>' + FACE_TH[f] + ' ' + nameOf(fi) + '</span>';
    }).join(' ') + '<p class="note">' + (ok ? 'ศูนย์กลางตรงข้ามกันเป็นคู่มาตรฐาน (ขาว-เหลือง, ฟ้า-เขียว, แดง-ส้ม) ถ้าสีศูนย์กลางบนรูบิคของคุณต่างจากนี้ แตะช่องตรงกลางบนโมเดลเพื่อแก้'
      : 'คู่ตรงข้ามของศูนย์กลางไม่ใช่ขาว-เหลือง / ฟ้า-เขียว / แดง-ส้ม ตรวจสีศูนย์กลางอีกครั้ง (แตะช่องตรงกลางเพื่อแก้)') + '</p>';
  }
  function openEdit(kind) {
    S.from = kind;
    var t = $('#editTitle'), l = $('#editLead');
    if (kind === 'scan') {
      t.textContent = 'ตรวจสีที่อ่านได้';
      l.textContent = 'ถ้ามีช่องที่สีผิด ให้เลือกสีที่ถูกจากแถบสี แล้วแตะช่องนั้น ลากโมเดลเพื่อหมุนดูทุกด้าน';
    } else {
      t.textContent = 'ตั้งสีของรูบิค';
      l.textContent = 'เลือกสีจากแถบสี แล้วแตะช่องบนโมเดลเพื่อใส่สี ลากเพื่อหมุนโมเดล หรือกดปุ่มด้านเพื่อดูทีละด้าน ช่องตรงกลางของแต่ละด้านคงที่';
    }
    $('#btnRescan').textContent = kind === 'scan' ? 'สแกนใหม่ทั้งหมด' : 'กลับไปสแกนด้วยกล้อง';
    buildPalette(); refreshEdit(); show('edit');
    if (kind !== 'scan') snapView('F');
  }

  /* ---------- กล้องและการสแกน ---------- */
  var video, still, sctx, stage, gridbox;
  function setMode(m) {
    S.mode = m;
    stage.className = 'stage ' + m;
    $('#ctlIdle').hidden = m !== 'idle';
    $('#ctlLive').hidden = m !== 'live';
    $('#ctlShot').hidden = m !== 'shot';
  }
  function renderChips() {
    var c = $('#chips'); c.innerHTML = '';
    SCAN.forEach(function (s, i) {
      var b = document.createElement('button'); b.type = 'button';
      b.className = 'chip' + (i === S.step ? ' on' : '') + (S.samples[s.f] ? ' done' : '');
      b.innerHTML = '<b>' + s.f + '</b>' + FACE_TH[s.f];
      b.setAttribute('aria-label', 'ด้าน' + FACE_TH[s.f]);
      b.onclick = function () { gotoStep(i); };
      c.appendChild(b);
    });
  }
  function renderScanNet() {
    var colors = new Array(54).fill(null);
    FACES.forEach(function (f, fi) {
      var sm = S.samples[f]; if (!sm) return;
      for (var j = 0; j < 9; j++) colors[fi * 9 + j] = rgbCss(sm[j]);
    });
    scanNet.set(colors, { hl: SCAN[S.step].f });
  }
  function gotoStep(i) {
    S.step = i;
    $('#instrTitle').textContent = SCAN[i].t; $('#instrText').textContent = SCAN[i].d;
    renderChips(); renderScanNet();
    setMode(S.stream ? 'live' : 'idle');
  }
  function placeGrid() {
    var g = S.grid;
    gridbox.style.left = (g.x * 100) + '%'; gridbox.style.top = (g.y * 100) + '%';
    gridbox.style.width = (g.s * 100) + '%'; gridbox.style.height = (g.s * 100) + '%';
  }
  function updateSwatches() {
    var img = sctx.getImageData(0, 0, still.width, still.height);
    S.cur = V.sampleGrid(img, S.grid);
    var sw = $('#swatches'); sw.innerHTML = '';
    S.cur.forEach(function (c) { var i = document.createElement('i'); i.style.background = rgbCss(c); sw.appendChild(i); });
  }
  function startCamera() {
    $('#camMsg').textContent = '';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      $('#camMsg').textContent = 'หน้านี้เปิดกล้องตรง ๆ ไม่ได้ ใช้ปุ่ม “ถ่ายด้วยกล้องมือถือ” หรือ “เลือกรูป” แทนได้';
      return;
    }
    var tries = [
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false },
      { video: true, audio: false }
    ];
    var chain = Promise.reject();
    tries.forEach(function (c) { chain = chain.catch(function () { return navigator.mediaDevices.getUserMedia(c); }); });
    chain.then(function (stream) {
      S.stream = stream; video.srcObject = stream;
      return video.play().catch(function () { /* autoplay อาจถูกบล็อก */ });
    }).then(function () { S.grid = { x: 0.19, y: 0.19, s: 0.62 }; placeGrid(); setMode('live'); })
      .catch(function () {
        S.stream = null;
        $('#camMsg').textContent = 'เปิดกล้องไม่สำเร็จ (อาจยังไม่ได้อนุญาตกล้อง) ใช้ปุ่ม “ถ่ายด้วยกล้องมือถือ” หรือ “เลือกรูป” แทนได้';
        setMode('idle');
      });
  }
  function stopCamera() {
    if (S.stream) { S.stream.getTracks().forEach(function (t) { t.stop(); }); S.stream = null; }
    if (video) video.srcObject = null;
    if (stage && S.mode === 'live') setMode('idle');
  }
  function drawSquare(src, w, h) {
    var s = Math.min(w, h), sx = (w - s) / 2, sy = (h - s) / 2;
    sctx.drawImage(src, sx, sy, s, s, 0, 0, still.width, still.height);
  }
  function shoot() {
    if (!video.videoWidth) return;
    drawSquare(video, video.videoWidth, video.videoHeight);
    afterCapture();
  }
  function afterCapture() {
    S.grid = { x: 0.19, y: 0.19, s: 0.62 }; $('#sizeRange').value = '62';
    placeGrid(); setMode('shot'); updateSwatches();
  }
  function loadFile(file) {
    if (!file) return;
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      drawSquare(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(url); afterCapture();
    };
    img.onerror = function () { $('#camMsg').textContent = 'เปิดรูปนี้ไม่ได้ ลองรูปอื่น'; };
    img.src = url;
  }
  function useShot() {
    S.samples[SCAN[S.step].f] = S.cur;
    var next = -1;
    for (var k = 1; k <= 6; k++) {
      var i = (S.step + k) % 6;
      if (!S.samples[SCAN[i].f]) { next = i; break; }
    }
    if (next < 0) { finishScan(); return; }
    gotoStep(next);
  }
  function finishScan() {
    var centers = {};
    FACES.forEach(function (f) { centers[f] = S.samples[f][4]; });
    S.scheme = V.nameCenters(centers);
    S.cells = V.classify(S.samples);
    stopCamera(); openEdit('scan');
  }
  function enterScan() {
    S.samples = {}; S.step = 0; show('scan'); gotoStep(0); setMode('idle');
    $('#camMsg').textContent = '';
  }
  function bindScan() {
    video = $('#video'); still = $('#still'); sctx = still.getContext('2d', { willReadFrequently: true });
    stage = $('#stage'); gridbox = $('#gridbox');
    $('#btnCam').onclick = startCamera;
    $('#btnShot').onclick = shoot;
    $('#btnStopCam').onclick = function () { stopCamera(); setMode('idle'); };
    $('#btnRetake').onclick = function () { setMode(S.stream ? 'live' : 'idle'); };
    $('#btnUse').onclick = useShot;
    $('#fileCam').onchange = function (e) { loadFile(e.target.files[0]); e.target.value = ''; };
    $('#filePick').onchange = function (e) { loadFile(e.target.files[0]); e.target.value = ''; };
    $('#sizeRange').oninput = function (e) {
      var ns = (+e.target.value) / 100, cx = S.grid.x + S.grid.s / 2, cy = S.grid.y + S.grid.s / 2;
      S.grid.s = ns;
      S.grid.x = Math.max(0, Math.min(1 - ns, cx - ns / 2));
      S.grid.y = Math.max(0, Math.min(1 - ns, cy - ns / 2));
      placeGrid(); updateSwatches();
    };
    var drag = null;
    gridbox.addEventListener('pointerdown', function (e) {
      if (S.mode !== 'shot') return;
      drag = { x: e.clientX, y: e.clientY, gx: S.grid.x, gy: S.grid.y };
      gridbox.setPointerCapture(e.pointerId);
    });
    gridbox.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var w = stage.getBoundingClientRect().width;
      S.grid.x = Math.max(0, Math.min(1 - S.grid.s, drag.gx + (e.clientX - drag.x) / w));
      S.grid.y = Math.max(0, Math.min(1 - S.grid.s, drag.gy + (e.clientY - drag.y) / w));
      placeGrid(); updateSwatches();
    });
    var endDrag = function () { drag = null; };
    gridbox.addEventListener('pointerup', endDrag); gridbox.addEventListener('pointercancel', endDrag);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stopCamera(); });
  }

  /* ---------- หน้าวิธีแก้ ---------- */
  function tileHtml(move, cls) {
    var f = move[0], suf = move.slice(1), fi = FACES.indexOf(f), hex = hexOf(fi);
    return '<span class="m ' + (cls || '') + '" style="background:' + hex + ';color:' + textOn(hex) + '">' + f +
      (suf ? '<sup>' + suf + '</sup>' : '') + '</span>';
  }
  function describe(m) {
    var f = m[0], suf = m.slice(1), fi = FACES.indexOf(f);
    var dir = suf === "'" ? 'ทวนเข็มนาฬิกา 90°' : (suf === '2' ? 'หมุน 180° (ทิศไหนก็ได้)' : 'ตามเข็มนาฬิกา 90°');
    return 'หมุนด้าน' + FACE_TH[f] + ' (สี' + nameOf(fi) + ') ' + dir;
  }
  function stateAt(i) {
    var c = Cube.fromString(S.facelets);
    if (i > 0) c.move(S.moves.slice(0, i).join(' '));
    return c.asString();
  }
  function renderSolve() {
    var n = S.moves.length, i = S.idx;
    var st = stateAt(i);
    var colors = st.split('').map(function (ch, k) {
      if (S.relabel && k % 9 !== 4) ch = S.relabel[ch];
      return hexOf(FACES.indexOf(ch));
    });
    var nxt = i < n ? S.moves[i] : null;
    var ctr = nxt ? (nxt.slice(1) === "'" ? '↺' : (nxt.slice(1) === '2' ? '2' : '↻')) : '';
    solveNet.set(colors, nxt ? { hl: nxt[0], ctrText: ctr } : {});
    cubeS.colors(colors);
    cubeS.arrow(nxt ? nxt[0] : null, nxt ? (nxt.slice(1) === '2' ? 'half' : (nxt.slice(1) === "'" ? 'ccw' : 'cw')) : null);
    $('#btnLook').hidden = true; lookAtMove();
    $('#moveStep').textContent = i < n ? 'ตาที่ ' + (i + 1) + ' จาก ' + n : (n ? 'ครบ ' + n + ' ตาแล้ว' : '');
    if (nxt) {
      $('#moveTile').innerHTML = tileHtml(nxt, 'big');
      $('#moveText').textContent = describe(nxt) + ' (มองเข้าหาด้านนั้น)';
      var nn = S.moves.slice(i + 1, i + 4);
      $('#moveNext').innerHTML = nn.length ? 'ตาต่อไป ' + nn.map(function (m) { return tileHtml(m, 'sm'); }).join('') : 'นี่คือตาสุดท้าย';
    } else {
      $('#moveTile').innerHTML = '';
      $('#moveText').textContent = n ? 'แก้เสร็จแล้ว เก่งมาก!' : 'รูบิคนี้แก้เสร็จอยู่แล้ว';
      $('#moveNext').textContent = '';
    }
    $('#btnPrev').disabled = i === 0;
    $('#btnNext').disabled = i >= n;
    document.querySelectorAll('#movesList button').forEach(function (b, k) {
      b.classList.toggle('cur', k === i);
      b.firstChild.classList.toggle('past', k < i);
    });
  }
  function stopPlay() { if (S.timer) { clearInterval(S.timer); S.timer = null; } var b = $('#btnPlay'); if (b) b.textContent = 'เล่นอัตโนมัติ'; }
  function openSolve(solution) {
    S.moves = solution.trim() ? solution.trim().split(/\s+/) : []; S.idx = 0;
    var hold = $('#holdHint');
    hold.innerHTML = '<span class="sq" style="background:' + hexOf(0) + '"></span><span>ถือให้ศูนย์กลางสี<span class="hi">' + nameOf(0) +
      '</span>อยู่<b>ข้างบน</b> และสี<span class="hi">' + nameOf(2) + '</span><b>หันหาตัว</b> เหมือนท่าเริ่มต้นตอนสแกน แล้วทำทีละตา</span>';
    var ml = $('#movesList'); ml.innerHTML = '';
    S.moves.forEach(function (m, k) {
      var b = document.createElement('button'); b.type = 'button'; b.innerHTML = tileHtml(m);
      b.setAttribute('aria-label', 'ไปตาที่ ' + (k + 1) + ' คือ ' + m);
      b.onclick = function () { stopPlay(); S.idx = k; renderSolve(); };
      ml.appendChild(b);
    });
    var cn = $('#centerNote');
    if (S.relabel) {
      cn.hidden = false;
      cn.innerHTML = '<b>ศูนย์กลางผิดที่</b> ทำตามตาหมุนทั้งหมดก่อน ทุกหน้าจะเป็นสีเดียวกันยกเว้นศูนย์กลาง แล้วจึง:' +
        S.fixTexts.map(function (t) { return '<br>• ' + t; }).join('');
    } else cn.hidden = true;
    show('solve'); renderSolve();
  }
  function bindSolve() {
    $('#btnNext').onclick = function () { if (S.idx < S.moves.length) { S.idx++; renderSolve(); } };
    $('#btnPrev').onclick = function () { stopPlay(); if (S.idx > 0) { S.idx--; renderSolve(); } };
    $('#btnReset').onclick = function () { stopPlay(); S.idx = 0; renderSolve(); };
    $('#btnPlay').onclick = function () {
      if (S.timer) { stopPlay(); return; }
      if (S.idx >= S.moves.length) S.idx = 0;
      $('#btnPlay').textContent = 'หยุดเล่น';
      S.timer = setInterval(function () {
        if (S.idx >= S.moves.length) { stopPlay(); return; }
        S.idx++; renderSolve();
      }, 1300);
      renderSolve();
    };
    $('#btnAgain').onclick = function () { show('home'); };
    // ปัดซ้าย = ตาถัดไป, ปัดขวา = ย้อนกลับ ; ปุ่มลูกศรบนคีย์บอร์ดก็ใช้ได้
    var sx = null, dock = $('#dock');
    dock.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    dock.addEventListener('touchend', function (e) {
      if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 50) $(dx < 0 ? '#btnNext' : '#btnPrev').click();
    });
    document.addEventListener('keydown', function (e) {
      if ($('#screen-solve').hidden) return;
      if (e.key === 'ArrowRight') $('#btnNext').click(); else if (e.key === 'ArrowLeft') $('#btnPrev').click();
    });
  }

  /* ---------- คำนวณ ---------- */
  function doSolve() {
    var f = faceletString(), err = V.validate(f, Cube);
    S.relabel = null; $('#fixBox').hidden = true;
    if (err) {
      $('#editErr').textContent = err;
      if (f.indexOf('?') < 0 && /ชิ้นส่วน|บิด|กลับด้าน|สลับ/.test(err)) {
        var dg = V.diagnoseCenters(f, Cube);
        if (dg) { S.fix = dg; showFix(dg); }
      }
      return Promise.resolve();
    }
    S.facelets = f;
    var b = $('#btnSolve'); b.disabled = true; b.textContent = 'กำลังคำนวณ…';
    return solver.solve(f).then(function (sol) {
      if (sol === null || sol === undefined) throw new Error('ไม่พบวิธีแก้');
      openSolve(sol);
    }).catch(function (e) {
      $('#editErr').textContent = 'คำนวณไม่สำเร็จ: ' + (e && e.message ? e.message : 'ลองตรวจสีอีกครั้ง');
    }).then(function () { b.disabled = false; b.textContent = 'คำนวณวิธีแก้'; });
  }

  function cycleText(cyc) {
    // map[X]=Y : ชิ้นสี(ศูนย์กลาง X) ต้องไปอยู่ตำแหน่งที่ศูนย์กลางตอนนี้คือสีของ Y
    var names = cyc.map(function (x) { return nameOf(FACES.indexOf(x)); });
    return cyc.length === 2 ? 'สลับฝาศูนย์กลาง ' + names[0] + ' ↔ ' + names[1] : 'สลับฝาศูนย์กลางวนกัน ' + names.join(' → ') + ' → ' + names[0];
  }
  function fixTexts(dg) { return dg.cycles.map(cycleText); }
  function showFix(dg) {
    $('#fixText').innerHTML = '<b>ชิ้นมุมและขอบประกอบถูกต้อง แต่ศูนย์กลางวางผิดที่</b> (ถ้าสีทั้ง 54 ช่องถูกแล้ว) ต้องทำ: ' +
      fixTexts(dg).map(function (t) { return '<br>• ' + t; }).join('') +
      '<br>กดปุ่มด้านล่างเพื่อให้แอปคำนวณตาหมุนสำหรับชิ้นมุม/ขอบ แล้วค่อยสลับฝาศูนย์กลางตอนจบ';
    $('#fixBox').hidden = false;
    $('#fixBox').scrollIntoView({ block: 'nearest' });
  }
  function useFix() {
    var dg = S.fix; if (!dg) return Promise.resolve();
    var b = $('#btnFix'); b.disabled = true;
    S.facelets = dg.t;
    var inv = {}; FACES.forEach(function (f) { inv[dg.map[f]] = f; });
    S.relabel = inv; S.fixTexts = fixTexts(dg);
    return solver.solve(dg.t).then(openSolve).catch(function (e) {
      $('#editErr').textContent = 'คำนวณไม่สำเร็จ: ' + (e && e.message ? e.message : '');
    }).then(function () { b.disabled = false; });
  }

  /* ---------- เริ่มต้น ---------- */
  function startManual() {
    S.scheme = Object.assign({}, DEFAULT_SCHEME);
    S.cells = new Array(54).fill(null); resetCenters(); S.brush = 0; openEdit('manual');
  }
  function startDemo() {
    S.scheme = Object.assign({}, DEFAULT_SCHEME);
    var c = new Cube(); c.move(DEMO_SCRAMBLE);
    S.cells = c.asString().split('').map(function (ch) { return FACES.indexOf(ch); });
    S.brush = 0; openEdit('manual');
    $('#editTitle').textContent = 'ลูกตัวอย่าง';
    $('#editLead').textContent = 'นี่คือรูบิคที่สับไว้แล้ว กด “คำนวณวิธีแก้” ได้เลย หรือแตะแก้สีเองก็ได้';
  }
  function init() {
    editNet = createNet($('#editNet'), paint);
    scanNet = createNet($('#scanNet'));
    solveNet = createNet($('#solveNet'));
    build3d(); bindScan(); bindSolve();
    $('#goHome').onclick = function () { show('home'); };
    $('#btnStart').onclick = enterScan;
    $('#btnManual').onclick = startManual;
    $('#btnDemo').onclick = startDemo;
    $('#btnSolve').onclick = doSolve;
    $('#btnFix').onclick = useFix;
    $('#btnClear').onclick = function () { S.cells = new Array(54).fill(null); resetCenters(); refreshEdit(); };
    $('#btnRescan').onclick = enterScan;
    $('#tab3d').onclick = function () { tab(true); };
    $('#tabNet').onclick = function () { tab(false); };
    if (window.RCSGuide) RCSGuide.render($('#guideBody'));
    show('home'); solver.init();
  }
  function tab(is3d) {
    $('#tab3d').classList.toggle('on', is3d); $('#tabNet').classList.toggle('on', !is3d);
    $('#tab3d').setAttribute('aria-selected', String(is3d)); $('#tabNet').setAttribute('aria-selected', String(!is3d));
    $('#pane3d').hidden = !is3d; $('#paneNet').hidden = is3d;
  }

  // ช่องทางสำหรับทดสอบอัตโนมัติ
  window.RCS = {
    S: S, V: V, Cube: Cube, solver: solver, faceletString: faceletString, openEdit: openEdit, doSolve: doSolve,
    classifyFace: function (samples) { S.samples = samples; finishScan(); return faceletString(); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
