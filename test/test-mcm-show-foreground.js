'use strict';
// Reuse the full-module public DirectInput/USER fixture, including actual
// WineAssembly host overrides and accepted-record renderer checks.
const fs = require('node:fs'), Module = require('node:module');
const { Worker, isMainThread, workerData } = require('node:worker_threads');
const assert = require('node:assert/strict');
if (isMainThread) {
  (async () => {
    for (const old of [true, false]) {
      await new Promise((resolve, reject) => {
        const worker = new Worker(__filename, { workerData: { old } });
        worker.on('error', reject);
        worker.on('exit', code => code ? reject(Error('Worker exit ' + code)) : resolve());
      });
    }
    console.log('PASS full-module real ShowWindow/Acquire old-fail/new-pass in OS Workers');
  })().catch(error => { console.error(error); process.exitCode = 1; });
} else {
  const fixture = require.resolve('./test-directinput-foreground-focus.js');
  let source = fs.readFileSync(fixture, 'utf8');
  source = source.slice(0, source.indexOf('const observations=[];'));
  // host.js resolves its native input dependency relative to the repo root.
  source = source.replace('const context = { console,',
    "const context = { require: Module.createRequire(require.resolve('../host.js')), console,");
  source = source.replace(/^#![^\n]*\n/, "const Module = require('node:module');\n");
  source = source.replace('const extraWat = `', `const extraWat = \`
    (func (export "mcm_main") (param $hwnd i32)
      (drop (call $wnd_set_style (local.get $hwnd) (i32.const 0x90000000)))
      (global.set $main_hwnd (local.get $hwnd))
      (global.set $active_hwnd (local.get $hwnd))
      (global.set $show_window_activated (i32.const 1)))
  `);
  if (workerData.old) {
    // Restore the precise old guard in the compiler input, without modifying
    // shared source or bypassing any host/DirectInput acceptance check.
    source = source.replace("file === '13-exports.wat' ? source + extraWat : source",
      `file === '09a5-handlers-window.wat' ? source.slice(0, source.indexOf('  (func $show_window_activate_top_level')) + \`
      (func $show_window_activate_top_level (param $hwnd i32) (param $cmd i32)
        (if (i32.and
          (i32.or (i32.or (i32.eq (local.get $cmd) (i32.const 1))
                          (i32.eq (local.get $cmd) (i32.const 3)))
            (i32.or (i32.eq (local.get $cmd) (i32.const 5))
              (i32.or (i32.eq (local.get $cmd) (i32.const 9))
                      (i32.eq (local.get $cmd) (i32.const 10)))))
          (i32.and (i32.eqz (call $wnd_get_parent (local.get $hwnd)))
                   (i32.ne (global.get $active_hwnd) (local.get $hwnd))))
          (then (drop (call $activate_window_with_host (local.get $hwnd))))))
      \` : file === '13-exports.wat' ? source + extraWat : source`);
  }
  source += `
  try {
    const p=f.processHost(0x10000),e=p.instance.exports;
    f.windowFor(p,0x10001);e.mcm_main(0x10001);
    const d=dev(p,0x10001,6);
    assert.equal(d.acquire(),0);d.unacquire();
    e.api(id('ShowWindow'),0x10001,0,0,0,0);
    assert.equal(p.h.foreground_window(),0,'hide revokes the accepted record');
    assert.equal(d.acquire(),0x80070005,'hidden window cannot acquire');
    for(const cmd of [4,8]) {
      e.api(id('ShowWindow'),0x10001,cmd,0,0,0);
      assert.equal(p.h.foreground_window(),0,'nonactivating show cannot publish foreground');
      assert.equal(d.acquire(),0x80070005);
      e.api(id('ShowWindow'),0x10001,0,0,0,0);
    }
    e.api(id('ShowWindow'),0x10001,5,0,0,0);
    assert.equal(f.renderer.windows[0x10001].visible,true);
    const hr=d.acquire();
    assert.equal(hr,${workerData.old ? '0x80070005' : '0'},'actual public Acquire result');
    console.log('MCM same-HWND SW_SHOW old=${workerData.old} Acquire='+hr.toString(16));
    ${workerData.old ? '' : "assert.equal(p.h.foreground_window(),0x10001);d.unacquire();"}
  } finally { f.close(); }
  `;
  const child = new Module(fixture, module);
  child.filename = fixture;
  child.paths = Module._nodeModulePaths(require('node:path').dirname(fixture));
  child._compile(source, fixture);
}
