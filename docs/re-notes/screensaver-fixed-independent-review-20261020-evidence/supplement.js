'use strict';
// Reuse the reviewed fixture in memory; never edit its retained source tree.
const fs=require('fs'),Module=require('module'),assert=require('assert/strict');
const filename='/tmp/wine-screensaver-input-boundary-fix/test/test-screensaver-input.js';
let text=fs.readFileSync(filename,'utf8');
const cut=text.indexOf('(async () => {');
assert(cut>0);
text=text.slice(0,cut)+'module.exports = { fixture };\n';
// Original adapter reports thread 0 while production current_thread_id starts
// at 1, suppressing real focus transfers. Correct only this fixture adapter.
text=text.replace('wnd_get_thread: () => 0', 'wnd_get_thread: () => 1');
text=text.replace('(func (export "posts")',`(func (export "focus_transfer") (param i32) (call $set_focus (local.get 0)))
    (func (export "focus_get") (result i32) (global.get $focus_hwnd))
    (func (export "capture_transfer") (param i32) (result i32) (call $capture_replace (local.get 0)))
    (func (export "posts")`);
const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(require('path').dirname(filename));m._compile(text,filename);
const {fixture}=m.exports;
(async()=>{
  const f=await fixture(), e=f.e;
  const id=n=>[...f.windows.values()].find(w=>w.id===n).h;
  const list=id(0x500),preview=id(1);
  // Real renderer enqueues DOWN and UP before any pump: no click on the first
  // tick, native capture holds until the deferred release on the next tick.
  f.down(preview); f.up(preview); f.pump();
  assert.equal(f.launches.length,0,'same-tick DOWN/UP does not click early');
  assert.equal(e.capture(),preview,'native DOWN owns capture');
  f.pump();assert.deepEqual(f.launches,['WIN98.SCR']);
  assert.equal(e.capture(),0,'native UP releases capture');
  // Live keyboard focus routing, with no target HWND on the event.
  e.focus_transfer(list);assert.equal(e.focus_get(),list);
  f.r.inputQueue.push({type:'key',msg:0x100,wParam:0x28,lParam:0,hwnd:0});
  f.pump();assert.equal(e.send(list,0x188,0,0),1,'keyboard DOWN follows live list focus');
  // Production USER transactions deliver cancellation to the pressed button.
  for(const msg of [0x8,0x215]){
    f.down(preview);f.pump();
    assert.equal(e.capture(),preview);
    if(msg===0x8){e.focus_transfer(list);assert.equal(e.focus_get(),list);assert.equal(e.capture(),0);}
    else {e.capture_transfer(list);assert.equal(e.capture(),list,'capture transfer preserves new owner');}
    f.up(preview);f.pump();f.pump();
    assert.equal(f.launches.length,1,`message ${msg} cancels pending click`);
  }
  // Close enters through queued WM_CLOSE, followed by an event that must not
  // be taken after scratch is freed. Recursive teardown remains an adapter.
  f.r.inputQueue.push({hwnd:f.hwnd,msg:0x10,wParam:0,lParam:0});
  const sentinel={hwnd:preview,msg:0x84,wParam:0,lParam:0};
  f.r.inputQueue.push(sentinel);
  assert.equal(f.pump(),0);assert(f.r.inputQueue.includes(sentinel));
  assert.equal(f.freed.filter(p=>p===0x10000).length,1);
  assert.equal(f.pump(),0);
  console.log('PASS independent supplemental: queued DOWN/UP deferral, native capture acquisition/release/transfer, keyboard live-focus routing, USER focus-transfer and capture-transfer cancellation, queued WM_CLOSE/no subsequent dequeue.');
})().catch(e=>{console.error(e);process.exitCode=1;});
