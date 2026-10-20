#!/usr/bin/env node
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const host = read('host.js'), shell = read('lib/browser-shell.js');
const context = vm.createContext({ console, setTimeout, clearTimeout });
vm.runInContext(host + '\nglobalThis.Host = WineAssembly;', context);
const proto = context.Host.prototype;
function processDouble() {
  const wine = Object.create(proto);
  wine.renderer = { repaint() {} };
  wine.memory = {};
  wine.stop = () => { wine._stopped = true; wine.running = false; };
  wine._frozenRegister = wine._installVisibilityPause = wine._installInputWake = () => {};
  wine._maybePauseForHidden = () => false;
  return wine;
}
async function main() {
  let opens = 0, pumps = 0;
  const wine = processDouble();
  wine.init = async () => {
    assert.equal(wine._watAppRequested, true);
    await wine._maybeStartGuestWorker({});
    wine.instance = { exports: { scrsave_open: () => { opens++; return 100; }, wat_app_pump: () => ++pumps < 2 } };
  };
  assert.equal(await wine.loadWatApp('scrsave'), true);
  assert.equal(opens, 1);
  let scheduled;
  wine._scheduleStep = (fn, ms) => { assert.equal(ms, 50); scheduled = fn; };
  wine.run();
  assert.equal(pumps, 1); assert.ok(scheduled);
  await scheduled(); assert.equal(pumps, 2); assert.equal(wine._stopped, true);
  assert.throws(() => wine.run(), /not ready/);
  await assert.rejects(() => wine.loadExe('forbidden.exe'), /Applet/);
  const unready = processDouble(); unready._watAppRequested = true;
  assert.throws(() => unready.run(), /not ready/);
  for (const fault of ['missing-open', 'missing-pump', 'zero', 'throw', 'cancel', 'worker']) {
    const w = processDouble();
    w.init = async () => {
      w.instance = { exports: {
        scrsave_open: () => { if (fault === 'throw') throw Error('fixture'); return fault === 'zero' ? 0 : 1; },
        wat_app_pump: () => 1,
      } };
      if (fault === 'missing-open') delete w.instance.exports.scrsave_open;
      if (fault === 'missing-pump') delete w.instance.exports.wat_app_pump;
      if (fault === 'cancel') w.stop();
      if (fault === 'worker') w.guestWorker = {};
    };
    await assert.rejects(() => w.loadWatApp('scrsave'));
    assert.equal(w._stopped, true, fault); assert.equal(w._watAppLoading, false);
  }
  const manifest = require('../lib/wat-manifest').WAT_FILES;
  const actual = fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.wat')).sort();
  assert.deepEqual([...manifest].sort(), actual);
  assert.equal(manifest.filter(f => f === '09ca-screensavers.wat').length, 1);
  const sources = manifest.map(f => read('src/' + f)).join('\n');
  // Verify each fixture boundary against the real source's current signature.
  for (const [name, [params, results]] of Object.entries(require('./test-screensaver-applet').signatures)) {
    const header = sources.match(new RegExp(`\\(func \\$${name}\\b((?:\\s*\\((?:param|result|export)[^)]*\\))*)`));
    assert.ok(header, name);
    const types = kind => [...header[1].matchAll(new RegExp(`\\(${kind} ([^)]*)\\)`, 'g'))]
      .flatMap(m => m[1].trim().split(/\s+/).filter(t => /^(i32|i64|f32|f64)$/.test(t)));
    assert.equal(types('param').length, params, name + ' parameters');
    assert.equal(types('result').length, results, name + ' results');
    assert.ok([...types('param'), ...types('result')].every(t => t === 'i32'), name);
  }
  const controls = read('src/09c3-controls.wat');
  assert.match(controls, /Class 33 = USER's preregistered MDICLIENT/);
  assert.match(controls, /Class 34 = COMCTL32 SysAnimate32/);
  assert.match(controls, /i32\.const 35\)\)\s*\(then \(return \(call \$scrsave_wndproc/);
  assert.match(shell, /wine = new WineAssembly\(\);\s*wine\._watAppRequested = !!app\.watApp/);
  assert.match(shell, /if \(!app.watApp && window.processBoot/);
  assert.ok(shell.indexOf('await wine.loadWatApp(app.watApp)') < shell.indexOf('let dynamicExeBytes'));
  assert.match(host, /\/\\\.\(exe\|scr\)\$\/i\.test\(file\)/);
  const fallback = host.match(/if \((\/.*?\/i\.test\(file\) && shell\.launchExe\(file\))\)/g)
    .find(s => s.includes('(exe|scr)'));
  const launch = new Function('file', 'shell', `return ${fallback.slice(4, -1)};`);
  const launched = [];
  for (const file of ['WIN98.SCR', 'win98.scr', 'notepad.exe']) {
    assert.equal(launch(file, { launchExe: f => { launched.push(f); return true; } }), true);
  }
  assert.deepEqual(launched, ['WIN98.SCR', 'win98.scr', 'notepad.exe']);
  assert.equal(launch('WIN98.SCR.txt', { launchExe() { throw Error('unexpected launch'); } }), false);
  assert.equal(launch('missing.scr', { launchExe: () => false }), false);
  const init = host.slice(host.indexOf('  async init(canvas)'), host.indexOf('  async _maybeStartGuestWorker'));
  assert.ok(init.indexOf('await this.loadSubstituteFonts()') < init.indexOf('this.instance = await WebAssembly.instantiate'));
  assert.match(init, /await Promise.all\(\[fontsReady, wasmReady, apiTableReady\]\)/);
  // Exercise the registry gate for only this no-payload applet. Media-bearing
  // entries need the external asset tree and remain outside this small test.
  const gate = read('tools/check-apps-registry.js');
  function registryCheck(missing) {
    let exit;
    vm.runInNewContext(gate, {
      __dirname: path.join(root, 'tools'), console: { log() {} },
      process: { exit: code => { exit = code; } },
      require: name => {
        if (name === 'fs') return { ...fs, readFileSync: (file, enc) => {
          const txt = fs.readFileSync(file, enc);
          return missing ? txt.replace('(export "scrsave_open")', '') : txt;
        } };
        if (name === 'path') return path;
        if (name.endsWith('/apps.js')) return { APPS: { screensavers: { watApp: 'scrsave' } } };
        if (name.endsWith('/vfs-seed.js')) return { win16FileCandidates() { throw Error('no payload'); } };
        if (name === '../lib/wat-manifest') return { WAT_FILES: manifest };
        throw Error(name);
      },
    });
    return exit;
  }
  assert.equal(registryCheck(false), 0);
  assert.equal(registryCheck(true), 1, 'missing applet export must fail registry validation');
  console.log('PASS host fixture: no-PE startup/pump, bounded scheduling, six failure/cancel cases; manifest, current signatures, MDI/Animate dispatch, shell/font wiring');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
