'use strict';
// Reuse the candidate regression's actual installed callback/transport extraction.
// Add an authentic VirtualFS ordinary lazy entry; export only two synthetic bytes.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const root = path.resolve(__dirname, '../../..');
const filename = path.join(root, 'test/test-shell-cli-routing.js');
let s = fs.readFileSync(filename, 'utf8');
const anchor = '  const forks = [], hooks = [], logs = [], strings = new Map();';
if (!s.includes(anchor)) throw Error('fixture changed');
s = s.replace(anchor, `
  const { VirtualFS } = require('../lib/filesystem');
  const lazy = new VirtualFS();
  let loads = 0;
  lazy.setLazyFile('c:\\\\source\\\\tiny.cab', { size: 2, load() {
    loads++; return new Uint8Array([65, 66]);
  } });
  const lazyEntry = lazy.files.get('c:\\\\source\\\\tiny.cab');
  assert.strictEqual(lazyEntry._provider, undefined);
  assert.strictEqual(loads, 0);
  vfs.files.set('c:\\\\source\\\\tiny.cab', lazyEntry);
  ${anchor}`);
const check = "  assert(fs.existsSync(input), 'authentic exporter created child snapshot');";
s = s.replace(check, check + `
  assert.deepStrictEqual([...fs.readFileSync(path.join(input, 'source/tiny.cab'))], [65, 66],
    'actual shell transport must export unread ordinary lazy source bytes');`);
// Extra callback coverage: null/default op, empty verb, WinExec stem, merge ordering.
const end = "    console.log('PASS CLI shell routing:";
if (!s.includes(end)) throw Error('fixture oracle changed');
s = s.replace(end, `
    for (const op of ['', null, 'OPEN', 'wInExEc']) {
      const f = fixture();
      assert.strictEqual(f.launch('"' + f.exe + '"', '', '', 1, op), 33);
      assert.strictEqual(f.forks.length, 1);
      const write = f.vfs.writeFile;
      f.vfs.writeFile = (...args) => {
        assert.strictEqual(f.context.h.process_ctl(0, 0x4004, 0), 259,
          'completion must remain unpublished during every merge write');
        return write(...args);
      };
      finish(f);
    }
    const stem = fixture();
    stem.vfs.files.set('c:\\\\work\\\\stem.exe', { data: Buffer.from('offline fixture, never executed') });
    assert.strictEqual(stem.launch('stem'), 33);
    assert.strictEqual(arg(stem.forks[0], 'exe-guest-path'), 'c:\\\\work\\\\stem.exe');
    finish(stem);
${end}`);
const m = new Module(filename, module);
m.filename = filename;
m.paths = Module._nodeModulePaths(path.dirname(filename));
m._compile(s, filename);
console.log('PASS coupled actual callback + actual ordinary-lazy VFS export; default/case/stem/merge-order coverage');
