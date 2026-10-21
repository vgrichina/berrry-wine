'use strict';
// Exact dispatcher source slices compiled to small Wasm. Callback CALL/RET,
// USER tables and host geometry are fixtures, NOT a full guest/runtime test.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const assert = require('assert/strict'), crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
const read = p => process.env.SLICE_REV
  ? cp.execFileSync('git', ['show', process.env.SLICE_REV + ':' + p], {cwd: root, encoding:'utf8'})
  : fs.readFileSync(path.join(root, p), 'utf8');
const {compile} = require(process.env.WATX_COMPILER || path.join(root, 'tools/watx.js'));
let source = read('src/09b-dispatch.wat');
const generic = source.slice(source.indexOf('    ;; CreateWindowEx continuation'), source.indexOf('    ;; ── First-ShowWindow'));
let chain = source.slice(source.indexOf('    ;; ── First-ShowWindow'), source.indexOf('    ;; CACA0026:'));
if (process.env.SLICE_MUTANT === 'wrong-target') chain = chain.replace(
  '(local.set $arg4 (call $gl32 (i32.load offset=16 (global.get $reg_base))))',
  '(local.set $arg4 (global.get $main_hwnd))');
if (process.env.SLICE_MUTANT === 'zero-result') chain = chain.replace(
  '(call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (local.get $arg0))',
  '(call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (i32.const 0))');
if (process.env.SLICE_MUTANT === 'keep-success') chain = chain.replace(
  '(call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (local.get $arg0))', '');
if (process.env.SLICE_MUTANT === 'stale-client') chain = chain.replace(
  '(local.set $arg0 (call $client_rect_wh_packed (local.get $arg4)))',
  '(local.set $arg0 (global.get $pending_wm_size))');
const body = generic + chain;
const globals = [...new Set([...body.matchAll(/global\.(?:get|set) \$(\w+)/g)].map(m=>m[1]))];
const initial = {reg_base:128, createwnd_ret_thunk:0xCACA0001, createwnd_activate_thunk:0xCACA0022,
  createwnd_setfocus_thunk:0xCACA0023, createwnd_move_thunk:0xCACA0024,
  createwnd_size_thunk:0xCACA0031, createwnd_size_ret_thunk:0xCACA003D, WNDPROC_DIALOG:-99};
const imports = {wnd_table_find:[1,1], wnd_table_get:[1,1], host_get_window_rect:[2,0],
  client_rect_wh_packed:[1,1], wnd_min_get:[1,1], wnd_max_get:[1,1]};
const stubs = {create_window_abort:[1,0],startup_create_show:[1,0],dialog_apply_init_focus:[3,0],
  wnd_get_style:[1,1],show_window_activate_top_level:[2,0],host_activate_window:[1,1],
  dialog_default_proc:[4,1],paint_scratch_take:[0,1],dlg_record_for_hwnd:[1,1],
  paint_drain_native_control_paints:[0,1],paint_flush_shown_native_children:[1,1],
  host_invalidate:[1,0],defwndproc_do_nccalcsize:[1,0],nc_flags_set:[2,0],invalidate_hwnd:[1,0]};
const sig = ([n,r]) => `${n?'(param '+Array(n).fill('i32').join(' ')+')':''} ${r?'(result i32)':''}`;
const wat = `(memory 1) (export "memory" (memory 0))
${Object.entries(imports).map(([n,s])=>`(import "h" "${n}" (func $${n} ${sig(s)}))`).join('\n')}
${Object.entries(stubs).map(([n,s])=>`(func $${n} ${sig(s)} ${s[1]?'(i32.const 0)':''})`).join('\n')}
(func $gl32 (param $p i32) (result i32) (i32.load (local.get $p)))
(func $gs32 (param $p i32) (param $v i32) (i32.store (local.get $p) (local.get $v)))
(defmacro (load.field $type $field $p) (i32.load $p))
(defmacro (load.field.memarg $type $field $p) (i32.load offset=4 $p))
${globals.map(n=>`(global $${n} (mut i32) (i32.const ${initial[n]||0})) (export "${n}" (global $${n}))`).join('\n')}
(func (export "dispatch") (param $name_rva i32)
${[0,1,2,3,4].map(n=>`(local $arg${n} i32)`).join('\n')}
${body})`;
const compiled=compile(wat,new Map(),{mode:'production'});
let e,d;
const live=new Set(), clients=new Map(), state=new Map();
const h={wnd_table_find:n=>live.has(n)?n:-1, wnd_table_get:n=>live.has(n)?0x8000+n:0,
  host_get_window_rect:(n,p)=>{d.setInt32(p,31,true);d.setInt32(p+4,47,true);},
  client_rect_wh_packed:n=>clients.get(n), wnd_min_get:n=>state.get(n)===1?1:0,
  wnd_max_get:n=>state.get(n)===2?1:0};
e=new WebAssembly.Instance(new WebAssembly.Module(compiled.wasmBinary),{h}).exports;
d=new DataView(e.memory.buffer);
const put=(p,v)=>d.setUint32(p,v>>>0,true), get=p=>d.getUint32(p,true);
const esp=()=>get(144), setsp=p=>put(144,p), dispatch=n=>e.dispatch(n|0);
let cases=0;
function invocation({mode='placement',target=11,action='live',nested=false,min=0,stage=5}, depth=0){
  const top=depth?esp()-64:60000, ret=0x7100+target;
  const normal=mode==='hidden-show'?0:mode==='creation'?target:1;
  const dead=mode==='visible-show'?1:0;
  const nonvolatile = [12,20,24,28].map((offset,i)=>[128+offset,0x12340000+i]);
  for(const [p,v] of nonvolatile)put(p,v);
  live.add(target);clients.set(target,(434<<16)|556);state.set(target,min);
  e.main_hwnd.value=target;e.pending_wm_size.value=(273<<16)|392;
  e.createwnd_implicit_show.value=0;
  if(mode==='creation'){
    setsp(top-8);put(top-8,ret);put(top-4,target);
    e.createwnd_implicit_show.value=1;dispatch(0xCACA0001);
  }else{
    setsp(top-16);[target,dead,ret,normal].forEach((v,i)=>put(top-16+i*4,v));
    // Entry callback ACTIVATEAPP is already returning in this slice fixture.
    dispatch(0xCACA0022);
  }
  let triggered=false, count=0;
  while((e.eip.value>>>0)!==ret){
    assert(++count<12,'bounded chain');
    const pc=e.eip.value>>>0;
    if(pc>=0xCACA0000){dispatch(pc);continue;}
    const sp=esp(), continuation=get(sp), hwnd=get(sp+4), msg=get(sp+8);
    assert.equal(hwnd,target,'callback retains invocation target');
    if(msg===5){assert.equal(get(sp+12),min);assert.equal(get(sp+16),min===1?0:clients.get(target),'current-client SIZE');}
    if(msg===stage){
      triggered=true;
      if(nested){
        const saved=Array.from(new Uint8Array(e.memory.buffer,sp,36));
        invocation({mode:'visible-show',target:target+100,action:'destroy',stage:5},depth+1);
        setsp(sp);
        assert.deepEqual(Array.from(new Uint8Array(e.memory.buffer,sp,36)),saved,'nested invocation preserves outer frame');
      }
      // Replacing main does not replace the invocation's target or outcome.
      if(action.includes('replace')){live.add(999);e.main_hwnd.value=999;}
      if(action.includes('destroy'))live.delete(target);
    }
    put(128,0xdeadbeef); // callback EAX must never become API return value
    setsp(sp+20);dispatch(continuation); // fixture stdcall RET 16
  }
  assert(triggered,'requested callback reached');
  assert.equal(esp(),top,'owned frame and saved pair released exactly once');
  for(const [p,v] of nonvolatile)assert.equal(get(p),v,'nonvolatile register unchanged');
  assert.equal(get(128),action.includes('destroy')?dead:normal,`${mode}/${action}/${stage} return`);
  cases++;
}
for(const mode of ['hidden-show','visible-show','placement','creation'])
 for(const action of ['live','destroy','replace','replace-destroy'])
  for(const nested of [false,true])for(const min of [0,1,2]) invocation({mode,action,nested,min});
for(const mode of ['hidden-show','visible-show','placement','creation'])
 for(const stage of [6,7,3]) invocation({mode,action:'destroy',stage});
// Execute the exact new loader allocation and thread adoption arm, in two
// Wasm instances sharing a tiny fixture memory (not the full thread scanner).
if(!process.env.SLICE_REV){
 const loader=read('src/08-pe-loader.wat'), sync=read('src/13-exports.wat');
 const allocation=loader.slice(loader.indexOf('    ;; Final startup WM_SIZE completion'),loader.indexOf('    ;; Child-CreateWindow CBT'));
 assert(allocation.includes('0xCACA003D'));
 const adoption=sync.match(/\(if \(i32\.eq \(local\.get \$marker\) \(i32\.const 0xCACA003D\)\)\s*\(then \(global\.set \$createwnd_size_ret_thunk \(local\.get \$guest\)\)\)\)/)[0];
 const declaration=read('src/01-header.wat').match(/\(global \$createwnd_size_ret_thunk\s+\(mut i32\) \(i32\.const 0\)\)/)[0];
 const tiny=compile(`(import "h" "memory" (memory 1))
 ${declaration} (export "thunk" (global $createwnd_size_ret_thunk))
 (global $THUNK_BASE i32 (i32.const 1024)) (global $GUEST_BASE i32 (i32.const 0))
 (global $image_base i32 (i32.const 4096)) (global $num_thunks (mut i32) (i32.const 7))
 (export "count" (global $num_thunks))
 (func (export "allocate") ${allocation})
 (func (export "adopt") (param $marker i32) (param $guest i32) ${adoption})`,new Map(),{mode:'production'});
 const memory=new WebAssembly.Memory({initial:1}),module=new WebAssembly.Module(tiny.wasmBinary);
 const a=new WebAssembly.Instance(module,{h:{memory}}).exports;
 const b=new WebAssembly.Instance(module,{h:{memory}}).exports;
 a.allocate();assert.equal(a.count.value,8);assert.equal(a.thunk.value,5176);
 const marker=new DataView(memory.buffer).getUint32(1080,true);assert.equal(marker,0xCACA003D);
 assert.equal(b.thunk.value,0);b.adopt(marker|0,a.thunk.value);assert.equal(b.thunk.value,a.thunk.value);
 console.log('PASS exact loader allocation and thread adoption source slices');
}
console.log(JSON.stringify({status:'PASS',cases,sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),
  moduleSha256:crypto.createHash('sha256').update(compiled.wasmBinary).digest('hex'),
  moduleBytes:compiled.wasmBinary.length,boundary:'source-slice; fixture callbacks and USER/host state; no x86/fullVM'},null,2));
