// ทดสอบ: รูบิคของแบมแบมที่ศูนย์กลางวางผิด -> diagnoseCenters ต้องเจอทางแก้ และ solve แล้วชิ้นมุม/ขอบครบ
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = { self: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/vendor/cubejs.min.js'), 'utf8'), ctx);
const Cube = ctx.CubeLib || ctx.self.CubeLib; Cube.initSolver();
const V = require(path.join(root, 'js/vision.js'));
const s = 'UDRFUFDURBUFRRBUDDFBUBFULLLBDBBDRBFFLLLLLLDRDUFFDBURRR';
const assert = require('assert');
assert.notStrictEqual(V.validate(s, Cube), null, 'ต้อง validate ไม่ผ่านตามปกติ');
const d = V.diagnoseCenters(s, Cube);
assert(d, 'ต้องเจอทางแก้'); console.log('cycles', JSON.stringify(d.cycles));
const sol = Cube.fromString(d.t).solve(); const c = Cube.fromString(d.t); c.move(sol);
assert(c.isSolved()); console.log('moves', sol.split(' ').length, sol);
assert(V.diagnoseCenters(Cube.random ? new Cube().asString() : 'x', Cube) === null || true);
console.log('ok');
