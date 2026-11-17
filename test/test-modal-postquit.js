'use strict';
// Public calls made by synthetic x86, without game-specific state or addresses.
// Contract: https://devblogs.microsoft.com/oldnewthing/20101008-01/?p=12573
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { bootRenderHarness } = require(path.join(root, 'test/render-helper'));
const apis = require(path.join(root, 'src/api_table.json'));
const extraWat = String.raw`
  (func (export "t_api") (param $id i32) (result i32)
    (local $addr i32)
    (local.set $addr (i32.add (global.get $THUNK_BASE)
      (i32.mul (global.get $num_thunks) (i32.const 8))))
    (i32.store (local.get $addr) (i32.const 0))
    (i32.store offset=4 (local.get $addr) (local.get $id))
    (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
    (call $update_thunk_end)
    (call $w2g (local.get $addr)))
  (func (export "t_lifecycle_marker") (param $value i32)
    (global.set $quit_flag (local.get $value)))
`;
const u32 = n => [n, n >>> 8, n >>> 16, n >>> 24].map(x => x & 255);
(async () => {
 const { exports:e, memory } = await bootRenderHarness({ extraWat });
 const pe = fs.readFileSync(path.join(root, 'test/binaries/calc.exe'));
 new Uint8Array(memory.buffer).set(pe, e.get_staging());
 assert(e.load_pe(pe.length));
 const bytes = new Uint8Array(memory.buffer), view = new DataView(memory.buffer);
 const wa = p => p - e.get_image_base() + e.get_guest_base();
 const alloc = n => e.guest_alloc(n) >>> 0;
 const read = p => view.getUint32(wa(p), true);
 const text = s => { const p=alloc(s.length+1);bytes.set(Buffer.from(s+'\0'),wa(p));return p; };
 const body=text('Public modal quit contract'),caption=text('Modal quit fixture');
 const wide = value => { const b=Buffer.from(value+'\0','utf16le'),p=alloc(b.length);bytes.set(b,wa(p));return p; };
 const bodyW=wide('Public modal quit contract'),captionW=wide('Modal quit fixture');
 const thunks = Object.fromEntries(['PostQuitMessage','MessageBoxA','MessageBoxW','PeekMessageA'].map(name=>[name,e.t_api(apis.find(a=>a.name===name).id)]));
 const call = (name,args) => [...args.toReversed().flatMap(a=>[0x68,...u32(a)]),0xb8,...u32(thunks[name]),0xff,0xd0];
 const run = () => { e.clear_yield(); e.run(10000); };
 function prepare(post,marker=0,api='MessageBoxA') {
  e.t_lifecycle_marker(marker);
  const code=alloc(512),done=alloc(4),msg=alloc(32),stack=alloc(16384)+8192;
  const program=[...(post?call('PostQuitMessage',[0]):[]),...call(api,[0,api==='MessageBoxW'?bodyW:body,api==='MessageBoxW'?captionW:caption,0]),
   0xc7,0x05,...u32(done),...u32(1),
   ...call('PeekMessageA',[msg,0,0,0,0]),0xeb,0xfe];
  bytes.set(program,wa(code));e.set_eip(code);e.set_esp(stack);
  return {code,done,msg,stack};
 }
 for (const marker of [0,1]) {
  const f=prepare(false,marker);
  for(let i=0;i<32;i++)run();
  const dlg=e.modal_dialog_hwnd();assert(dlg);
  assert.equal(read(f.done),0,'ordinary modal must keep waiting without explicit quit');
  e.dialog_handle_key(dlg,13,0);
  for(let i=0;i<4;i++)run();
  assert.equal(read(f.done),1,'normal Enter returns the actual caller');
  assert.equal(e.modal_dialog_hwnd(),0);
  assert.equal(e.get_esp(),f.stack);
  console.log('PASS ordinary modal and lifecycle marker',marker);
 }
 for (const api of ['MessageBoxA','MessageBoxW']) {
  const f=prepare(true,0,api);
  for(let i=0;i<32&&!read(f.done);i++)run();
  console.log('OBSERVED',api,JSON.stringify({done:read(f.done),quit:e.get_quit_flag(),modal:e.modal_dialog_hwnd(),eip:e.get_eip(),yield:e.get_yield_reason(),esp:e.get_esp()}));
  assert.equal(read(f.done),1,'MessageBox must unwind on pending PostQuitMessage and return its caller');
  assert.equal(e.modal_dialog_hwnd(),0,'quit retires the modal window');
  assert.equal(e.get_quit_flag(),2,'outer loop retains explicit WM_QUIT');
  assert.equal(read(f.msg+4),0x12,'outer PeekMessage retrieves the preserved WM_QUIT');
  assert.equal(e.get_esp(),f.stack,'both real stdcall frames unwind exactly');
  console.log('PASS public PostQuitMessage -> '+api+' -> outer PeekMessage');
 }
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
