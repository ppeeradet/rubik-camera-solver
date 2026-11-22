/* guide.js — คู่มือตรวจรูบิคก่อนแก้ (คู่สี มุม ขอบ ศูนย์กลาง) วาดภาพด้วย SVG ไม่ต้องใช้รูปภายนอก */
(function (root) {
  'use strict';
  var HEX = { W: '#f2f5f3', Y: '#dfe51a', R: '#c21d2c', O: '#e8570c', G: '#46d41e', B: '#0aa2bb' };
  var TH = { W: 'ขาว', Y: 'เหลือง', R: 'แดง', O: 'ส้ม', G: 'เขียว', B: 'ฟ้า' };
  var INK = '#1c2230';

  function poly(pts, fill, w) {
    return '<polygon points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') +
      '" fill="' + fill + '" stroke="' + INK + '" stroke-width="' + (w || 2) + '" stroke-linejoin="round"/>';
  }
  function add(a, b, k) { return [a[0] + b[0] * k, a[1] + b[1] * k]; }
  // หน้าลูกบาศก์ 3x3 แบบเอียง: o=จุดเริ่ม u,v=เวกเตอร์ทั้งด้าน
  function face3(o, u, v, color, center) {
    var out = '';
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) {
      var p0 = add(add(o, u, c / 3), v, r / 3), a = add(p0, u, 1 / 3), b = add(a, v, 1 / 3), d = add(p0, v, 1 / 3);
      out += poly([p0, a, b, d], HEX[color], 1.6);
    }
    if (center) { var m = add(add(o, u, 0.5), v, 0.5); out += '<circle cx="' + m[0] + '" cy="' + m[1] + '" r="4" fill="rgba(28,34,48,.55)"/>'; }
    return out;
  }
  function svgWrap(w, h, inner, label) {
    return '<svg class="gsvg" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + label + '">' + inner + '</svg>';
  }
  function text(x, y, t, size, anchor, fill) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="' + (anchor || 'middle') + '" font-family="Prompt,Noto Sans Thai,sans-serif" font-weight="700" font-size="' +
      (size || 12) + '" fill="' + (fill || INK) + '" stroke="#fbf9f4" stroke-width="3" paint-order="stroke">' + t + '</text>';
  }

  // รูปลูกบาศก์ ท่ามาตรฐาน: เหลืองบน ฟ้าหน้า แดงขวา
  function cubeDiagram() {
    var inner = face3([48, 60], [52, -30], [52, 30], 'Y', true) + face3([48, 60], [52, 30], [0, 60], 'B', true) + face3([100, 90], [52, -30], [0, 60], 'R', true);
    inner += text(100, 20, 'บน = เหลือง', 13) + text(4, 164, 'หน้า = ฟ้า', 13, 'start') + text(236, 164, 'ขวา = แดง', 13, 'end');
    return svgWrap(240, 170, inner, 'ลูกบาศก์ท่ามาตรฐาน เหลืองอยู่บน ฟ้าอยู่หน้า แดงอยู่ขวา');
  }
  // มุมหนึ่งชิ้น: colors เรียงตามเข็มนาฬิกา เมื่อมองจากนอกมุม เริ่มจากสีที่อยู่บน
  function corner(c, bad) {
    var T = [[50, 8], [86, 28], [50, 48], [14, 28]], L = [[14, 28], [50, 48], [50, 92], [14, 72]], R = [[50, 48], [86, 28], [86, 72], [50, 92]];
    var inner = poly(T, HEX[c[0]]) + poly(R, HEX[c[1]]) + poly(L, HEX[c[2]]);
    if (bad) inner += '<path d="M10 10 L90 90 M90 10 L10 90" stroke="#c21d2c" stroke-width="9" stroke-linecap="round"/>';
    return svgWrap(100, 100, inner, 'มุม ' + c.map(function (x) { return TH[x]; }).join(' '));
  }
  function edge(c, bad) {
    var inner = '<rect x="4" y="14" width="40" height="40" rx="6" fill="' + HEX[c[0]] + '" stroke="' + INK + '" stroke-width="2"/>' +
      '<rect x="44" y="14" width="40" height="40" rx="6" fill="' + HEX[c[1]] + '" stroke="' + INK + '" stroke-width="2"/>';
    if (bad) inner += '<path d="M14 10 L74 58 M74 10 L14 58" stroke="#c21d2c" stroke-width="8" stroke-linecap="round"/>';
    return svgWrap(88, 68, inner, 'ขอบ ' + c.map(function (x) { return TH[x]; }).join(' '));
  }
  function dot(c) { return '<i class="gdot" style="background:' + HEX[c] + '"></i>'; }
  function names(c) { return c.map(function (x) { return TH[x]; }).join(' · '); }

  // มุมทั้ง 8 ชิ้น (ตามเข็มนาฬิกาจากภายนอก) ในท่า เหลืองบน ฟ้าหน้า แดงขวา
  var CORNERS = [['Y', 'R', 'B'], ['Y', 'B', 'O'], ['Y', 'O', 'G'], ['Y', 'G', 'R'], ['W', 'B', 'R'], ['W', 'O', 'B'], ['W', 'G', 'O'], ['W', 'R', 'G']];
  var EDGES = {
    'ขอบที่มีสีเหลือง (4)': [['Y', 'B'], ['Y', 'R'], ['Y', 'G'], ['Y', 'O']],
    'ขอบที่มีสีขาว (4)': [['W', 'B'], ['W', 'R'], ['W', 'G'], ['W', 'O']],
    'ขอบชั้นกลาง (4)': [['B', 'R'], ['B', 'O'], ['G', 'R'], ['G', 'O']]
  };

  function sec(title, body, open) {
    return '<details class="gsec"' + (open ? ' open' : '') + '><summary>' + title + '</summary><div class="gin">' + body + '</div></details>';
  }
  function pairRow(a, b) {
    return '<div class="gpair">' + dot(a) + '<b>' + TH[a] + '</b><span>ตรงข้ามกับ</span>' + dot(b) + '<b>' + TH[b] + '</b></div>';
  }

  function html() {
    var s = '';
    s += '<p class="note">ใช้เมื่อรูบิคตกแล้วมีชิ้นหลุด หรือประกอบใหม่เอง ตรวจตามนี้ก่อนจะรู้ว่าลูกที่ประกอบแก้ได้หรือไม่ ไม่ต้องอ่านทั้งหมด เปิดเฉพาะหัวข้อที่ต้องการ ถ้าข้าม แอปก็ตรวจให้อัตโนมัติตอนกดคำนวณ</p>';

    s += sec('1) คู่สีตรงข้ามและท่าถือมาตรฐาน',
      '<p>รูบิคมาตรฐาน 3 คู่สีนี้จะอยู่ด้านตรงข้ามกันเสมอ และไม่มีวันอยู่ในชิ้นเดียวกัน</p>' +
      pairRow('W', 'Y') + pairRow('B', 'G') + pairRow('R', 'O') +
      '<p>ท่าถือเพื่อตรวจ: <b>เหลืองอยู่บน ฟ้าหันหาตัว</b> แล้วต้องได้ <b>แดงอยู่ขวา</b> ส้มซ้าย เขียวหลัง ขาวล่าง</p>' +
      '<div class="gfig"><div class="scene g3" id="guideScene" aria-label="โมเดลรูบิคท่ามาตรฐาน ลากเพื่อหมุนดู"><div class="cube3d" id="guideCube"></div></div></div><p class="note ctr-note">ลากนิ้วบนโมเดลเพื่อหมุนดูทุกด้าน <button class="btn ghost small" id="guideReset" type="button">กลับท่ามาตรฐาน</button></p>' +
      '<p><b>ถ้าส้มอยู่ขวา แดงอยู่ซ้าย</b> (กลับด้านเหมือนส่องกระจก) แปลว่าฝาศูนย์กลางถูกสลับตอนประกอบ ชิ้นมุม/ขอบอาจถูกแต่ศูนย์กลางผิดที่ แอปตรวจเคสนี้ได้และบอกว่าต้องสลับฝาคู่ไหน</p>' +
      '<p class="note">ศูนย์กลาง 6 จุดไม่ขยับเมื่อหมุนด้านต่าง ๆ จึงใช้เป็นตัวบอกสีของแต่ละด้านได้</p>', true);

    s += sec('2) นับสี: ต้องมีสีละ 9 ช่อง',
      '<p>นับสติกเกอร์ทุกสีรวมศูนย์กลาง ต้องได้ ขาว เหลือง แดง ส้ม ฟ้า เขียว สีละ <b>9</b> ช่องพอดี</p>' +
      '<p>ถ้าสีไหนเกินหรือขาด แปลว่าสติกเกอร์ลอกแล้วแปะผิด หรือมีชิ้นจากลูกอื่นปนมา ซึ่งแก้ได้ต้องถอดชิ้นนั้นออกมาตรวจ</p>' +
      '<p class="note">สีบางรุ่นใกล้กัน เช่น ฟ้าอมเขียวกับเขียว, เหลืองมะนาวกับขาวนวล ให้ดูใกล้ ๆ ในแสงสว่าง</p>');

    s += sec('3) มุม 8 ชิ้น (ชิ้นละ 3 สี)',
      '<p>แต่ละมุมมี <b>สีละ 1 จากแต่ละคู่</b> (ขาว/เหลือง 1 สี, ฟ้า/เขียว 1 สี, แดง/ส้ม 1 สี) จึงมีได้ 8 แบบ และต้องมีครบทุกแบบ <b>ห้ามซ้ำ</b></p>' +
      '<div class="gcards">' + CORNERS.map(function (c) { return '<figure>' + corner(c) + '<figcaption>' + names(c) + '</figcaption></figure>'; }).join('') + '</div>' +
      '<p>วิธีอ่าน: วางมุมให้สีแรกอยู่บน แล้วอ่านสีตามเข็มนาฬิกา (บน → ขวา → ซ้าย) เมื่อมองมุมนั้นจากด้านนอก ต้องตรงกับในภาพ</p>' +
      '<p>ตัวอย่างที่ <b>ผิด</b>: มุมที่มีสีตรงข้ามอยู่ด้วยกัน เช่น เหลือง + ขาว หรือมี 2 สีจากคู่เดียวกัน เป็นไปไม่ได้</p>' +
      '<div class="gcards">' + '<figure>' + corner(['Y', 'W', 'B'], true) + '<figcaption>เหลือง · ขาว · ฟ้า</figcaption></figure>' +
      '<figure>' + corner(['R', 'O', 'G'], true) + '<figcaption>แดง · ส้ม · เขียว</figcaption></figure></div>' +
      '<p class="note">ถ้าสีครบแต่เรียงตามเข็มเป็นกลับด้านจากตาราง แปลว่าสติกเกอร์ติดผิดหรือกำลังดูท่ากระจก ตรวจท่าถือในหัวข้อ 1 ก่อน</p>');

    var eh = '<p>ขอบมี <b>2 สี</b> ไม่เป็นคู่ตรงข้าม และไม่ซ้ำกัน ต้องมีครบ 12 แบบดังนี้</p>';
    Object.keys(EDGES).forEach(function (k) {
      eh += '<h3 class="gh">' + k + '</h3><div class="gcards e">' + EDGES[k].map(function (c) { return '<figure>' + edge(c) + '<figcaption>' + names(c) + '</figcaption></figure>'; }).join('') + '</div>';
    });
    eh += '<p>ตัวอย่างที่ <b>ผิด</b>: ขอบสีตรงข้าม เช่น ฟ้า + เขียว หรือสีเดียวกันทั้งสองข้าง</p><div class="gcards e"><figure>' + edge(['B', 'G'], true) + '<figcaption>ฟ้า · เขียว</figcaption></figure><figure>' + edge(['R', 'R'], true) + '<figcaption>แดง · แดง</figcaption></figure></div>';
    s += sec('4) ขอบ 12 ชิ้น (ชิ้นละ 2 สี)', eh);

    s += sec('5) วิธีตรวจทีละชิ้นอย่างเร็ว',
      '<ol class="gol"><li>ตรวจศูนย์กลาง 6 จุดตามหัวข้อ 1</li><li>นับสีให้ครบสีละ 9 ช่อง</li>' +
      '<li>ไล่ดูมุมทั้ง 8 ชิ้น ทำเครื่องหมายแต่ละแบบจากตารางหัวข้อ 3 ว่าเจอแล้ว ถ้าเจอซ้ำหรือขาดแบบไหน ชิ้นนั้นมีปัญหา</li>' +
      '<li>ไล่ดูขอบ 12 ชิ้นเช่นเดียวกัน</li>' +
      '<li>กรอกสีทั้ง 54 ช่องลงแอป แล้วกดคำนวณ แอปจะตรวจที่เหลือให้ (บิด กลับด้าน สลับ)</li></ol>');

    s += sec('6) ข้อผิดพลาดที่พบบ่อยตอนประกอบใหม่',
      '<table class="gtab"><thead><tr><th>อาการ</th><th>ข้อความที่แอปแจ้ง</th><th>วิธีแก้ที่ลูก</th></tr></thead><tbody>' +
      '<tr><td>มุม 1 ชิ้นหมุนค้างอยู่ในช่อง</td><td>มีมุมบิดอยู่ 1 มุม</td><td>ถอดมุมนั้นออกแล้วใส่กลับโดยหมุนให้ถูกทิศ</td></tr>' +
      '<tr><td>ขอบ 1 ชิ้นใส่กลับหัว</td><td>มีขอบกลับด้านอยู่ 1 ชิ้น</td><td>ถอดขอบนั้นแล้วใส่กลับด้าน</td></tr>' +
      '<tr><td>สลับชิ้นผิด 2 ชิ้น (มุม 2 ชิ้นหรือขอบ 2 ชิ้น)</td><td>มีชิ้นสลับตำแหน่งแบบที่เป็นไปไม่ได้</td><td>สลับ 2 ชิ้นนั้นกลับ</td></tr>' +
      '<tr><td>สีของมุม/ขอบผิดคู่ หรือซ้ำ</td><td>มีชิ้นส่วนที่ไม่มีอยู่จริง</td><td>ตรวจตารางหัวข้อ 3 และ 4 ว่าชิ้นไหนผิดแบบ ดูว่าสติกเกอร์ลอกหรือใส่ชิ้นสลับ</td></tr>' +
      '<tr><td>ฝาศูนย์กลางสลับกัน</td><td>ชิ้นมุมและขอบถูก แต่ศูนย์กลางวางผิดที่</td><td>สลับฝาศูนย์กลางตามที่แอปบอก (แอปคำนวณตาหมุนของมุม/ขอบให้ก่อนได้)</td></tr>' +
      '</tbody></table>' +
      '<p class="note">ตอนถอดชิ้น ให้ค่อย ๆ งัดและบิดเบา ๆ อย่าใช้แรงกระชาก ชิ้นบางรุ่นมีสปริงและสกรูซ่อนอยู่ใต้ศูนย์กลาง อย่าให้หาย</p>');
    return s;
  }
  function render(el) { el.innerHTML = html(); }
  var api = { render: render, html: html, corners: CORNERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.RCSGuide = api;
})(typeof self !== 'undefined' ? self : this);
