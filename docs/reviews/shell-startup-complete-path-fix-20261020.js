'use strict';
// Source-only production-path fixture. No PE, interpreter, browser or full build.
const fs = require('fs'), cp = require('child_process'), vm = require('vm');
const assert = require('assert/strict'), crypto = require('crypto');
const BASE = '8bcd437fa4852417b13d375e54e07280621a161a';
const result = { base: BASE, inputs: {}, modules: [], checks: [], adapters: [], status: 'fixture-in-progress' };
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
function gate() {
  const s = fs.statfsSync('.');
  console.log(JSON.stringify({gate:{available:s.bavail*s.bsize,required:2285895680}}));
  assert(s.bavail * s.bsize >= 2285895680, `RESOURCE BLOCKER ${s.bavail*s.bsize}<2285895680`);
}
function source(p) {
  let s = fs.existsSync(p) ? fs.readFileSync(p, 'utf8')
    : cp.execFileSync('git', ['show', `${BASE}:${p}`], {encoding:'utf8',maxBuffer:32*1024*1024});
  result.inputs[p] = sha(s);
  const mutations={
    creation:['src/09a5-handlers-window.wat','(local.set $startup_cmd (call $startup_show_select (local.get $arg3) (local.get $parent_hwnd) (i32.const 1)))','(local.set $startup_cmd (i32.const -1))'],
    activation:['src/09a5-handlers-window.wat','(call $startup_show_activates (local.get $startup_cmd))','(i32.const 1)'],
    explicit:['src/09a5-handlers-window.wat','(local.set $arg1 (call $startup_show_select\n      (call $wnd_get_style (local.get $arg0)) (call $wnd_get_owner (local.get $arg0)) (local.get $arg1)))','(nop)'],
    info:['src/09a-handlers3-sync.wat','(call $startup_show_value)))','(i32.const 1)))'],
    continuation:['src/09b-dispatch.wat','(select (i32.const 1)\n            (select (i32.const 2)','(select (i32.const 0)\n            (select (i32.const 2)'],
    renderer:['lib/renderer.js','cmd === 7 || cmd === 11','cmd === 7'],
    iconic:['src/09c4-defwndproc.wat','(i32.eq (local.get $cmd) (i32.const 11))','(i32.const 0)'],
    retval:['src/09a5-handlers-window.wat','(call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $was_visible))','(call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 1))'],
  };
  const m=mutations[process.env.STARTUP_MUTATION];
  if(m&&p===m[0]){
    assert(s.includes(m[1]),'mutation target missing');
    s=s.replace(m[1],m[2]);result.mutation=process.env.STARTUP_MUTATION;
  }
  return s;
}
function form(s, at) {
  assert(at >= 0, 'missing form');
  let depth=0, quote=false, escape=false;
  for(let i=at;i<s.length;i++){
    const c=s[i];
    if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quote=false;continue;}
    if(c==='"'){quote=true;continue;}
    if(c==='(')depth++;
    if(c===')'&&!--depth)return s.slice(at,i+1);
  }
  throw Error('unbalanced form '+s.slice(at,at+90));
}
const clean=s=>s.replace(/;;[^\n]*/g,'');
const funcs=new Map(), globals=new Map(), layouts=new Map(), imports=new Map();
function inventory(){
  const files=cp.execFileSync('git',['ls-tree','--name-only',BASE,'src/'],{encoding:'utf8'}).trim().split('\n').filter(x=>x.endsWith('.wat'));
  for(const p of files){
    const s=clean(source(p));
    for(const m of s.matchAll(/\(func \$(\S+)/g)) funcs.set(m[1],form(s,m.index));
    for(const m of s.matchAll(/\(global \$(\S+)/g)) globals.set(m[1],form(s,m.index));
    for(const m of s.matchAll(/\(layout (\S+)/g)) layouts.set(m[1],form(s,m.index));
    for(const m of s.matchAll(/\(import "host" "[^"]+" \(func \$(\S+)/g)) imports.set(m[1],form(s,m.index));
  }
}
function compiler(){
  const c={console:{log(){},warn(){},error(){}},TextEncoder,TextDecoder,Uint8Array,Float32Array,Float64Array,ArrayBuffer,Map,Set,RegExp,Array,Object,String,Number,Math,Promise,Date,setTimeout,clearTimeout,setImmediate,parseInt,parseFloat,isNaN};
  vm.createContext(c);
  for(const f of ['compiler-parser.js','compiler-stages.js','compiler-codegen.js','compiler.js'])
    vm.runInContext(source('tools/watx-src/'+f),c,{filename:f});
  return c;
}
// Identity guest addressing, deterministic scratch heap; these adapters do not
// select a show command or alter a window's visibility/activation.
const adapters={
  g2w:'(param $p i32) (result i32) (local.get $p)',
  gl32:'(param $p i32) (result i32) (i32.load (local.get $p))',
  gs32:'(param $p i32) (param $v i32) (i32.store (local.get $p) (local.get $v))',
  gs16:'(param $p i32) (param $v i32) (i32.store16 (local.get $p) (local.get $v))',
  guest_memset:'(param $p i32) (param $v i32) (param $n i32) (memory.fill (local.get $p) (local.get $v) (local.get $n))',
  heap_alloc:'(param $n i32) (result i32) (i32.const 0x600000)',
};
// These are graphics/notification sinks, not implementations of window state.
// All other non-selected dependencies trap, naming the exact missing boundary.
const sinks=new Set(['host_invalidate','host_set_window_class','host_set_window_parent',
  'nc_flags_set','defwndproc_do_nccalcsize','post_queue_push','invalidate_hwnd',
  'gdi_refresh_window_dc_system_clips','host_log_i32','paint_seed_child_paints',
  'paint_drain_native_control_paints','paint_flush_shown_native_children','paint_clear_subtree','wnd_uncover_parent',
  'paint_flag_set_inv','defwndproc_do_ncpaint']);
const roots=['handle_CreateWindowExA','handle_ShowWindow','startup_info_init','handle_GetStartupInfoA','handle_GetStartupInfoW'];
const selected=new Set(roots);
selected.add('startup_show_set');
for(const n of `builtin_class_atom gdi_rgn_window_owned_handle paint_flag_store tab_native_state_release ctrl_slot_addr statusbar_native_is native_control_is_marked statusbar_native_mark_slot native_control_mark_slot tab_native_mark_slot ctrl_geom_addr dialog_state_addr dialog_font_addr wnd_extra_addr page_watch_write page_watch_valid page_watch_write_one page_watch_cell scroll_record_addr scroll_aux_addr address_in_loaded_dll dll_load_lock_begin address_in_loaded_dll_locked wnd_extra_get wnd_extra_long_index_ok wnd_screen_w wnd_screen_h`.split(' '))selected.add(n);
for(const n of ['class_name_hash','class_table_lookup','zero_memory','wndproc_ctrl_kind',
  'class_name_to_ctrl_id','dispdib_is_class_name','guest_strlen','paint_scratch_take',
  'show_window_replaces_utility_main','show_window_activate_top_level','wnd_class_is_dialog'])
  selected.add(n);
const core=/^(wnd_(table_|record_|slot_|z_|thread_|get_|set_|min_|max_|apply_show_state|is_effectively_visible)|class_(find_slot|name_key|record_addr|wndclass_addr)|main_hwnd_adopt|is_cw_usedefault_value|is_adjusted_center_coord|wnd_scratch|ctrl_set_ex_style|ctrl_get_ex_style|ctrl_ex_style_|client_rect_get_|dlg_record_for_hwnd|lock_|startup_)/;
function fixture(c){
  const d=clean(source('src/09b-dispatch.wat'));
  const codes=['0001','0022','0023','0024','0031','0029'];
  const branches=codes.map(n=>form(d,d.indexOf(`(if (i32.eq (local.get $name_rva) (i32.const 0xCACA${n}))`)));
  const continuation=`(func $fixture_continue (export "continue") (param $name_rva i32)
    (local $arg0 i32) (local $arg1 i32) (local $arg2 i32) (local $arg3 i32) (local $arg4 i32)
    ${branches.join('\n')} (unreachable))`;
  funcs.set('fixture_continue',continuation);selected.add('fixture_continue');
  for(const [suffix,handler,parameters]of [
    ['get','handle_GetMessageA_fetch','(param $msg_ptr i32)'],
    ['peek','handle_PeekMessageA_fetch','(param $arg0 i32) (param $arg4 i32)']]){
    const body=funcs.get(handler),branch=form(body,body.indexOf('(if (global.get $pending_wm_size)'));
    const name='fixture_pending_'+suffix;
    funcs.set(name,`(func $${name} (export "${name}") ${parameters} (local $packed i32) ${branch})`);
    selected.add(name);
  }
  const bodies=new Map(), boundaries=new Map();
  function add(n){
    if(bodies.has(n)||boundaries.has(n))return;
    if(adapters[n]){bodies.set(n,`(func $${n} ${adapters[n]})`);return;}
    const f=funcs.get(n);
    if(sinks.has(n)||(!selected.has(n)&&!core.test(n)&&
        !/(?:_reset_slot|_addr_for_slot|^wnd_show_|^dlg_record_addr$)/.test(n))){
      let signature;
      if(imports.has(n)) signature=imports.get(n).match(/\(func \$\S+([\s\S]*)\)\)$/)[1];
      else {assert(f,'unknown dependency '+n);signature=f.match(/^\(func \$\S+\s*((?:(?:\((?:export|param|result)\s+[^)]*\))\s*)*)/)[1].replace(/\(export [^)]*\)/g,'');}
      boundaries.set(n,`(import "boundary" "${n}" (func $${n} ${signature}))`);return;
    }
    assert(f,'missing production function '+n);bodies.set(n,f);
    for(const m of f.matchAll(/\b(?:call|return_call) \$(\S+?)(?=[\s)])/g))add(m[1]);
  }
  for(const n of selected)add(n);
  const gs=new Map();
  function global(n){
    if(gs.has(n))return;assert(globals.has(n),'missing global '+n);
    const g=globals.get(n);gs.set(n,g);
    for(const m of g.matchAll(/global.get \$(\S+?)(?=[\s)])/g))global(m[1]);
  }
  for(const b of bodies.values())for(const m of b.matchAll(/global.(?:get|set) \$(\S+?)(?=[\s)])/g))global(m[1]);
  for(const [n,g] of globals)if(/^\(global \$\S+\s+i32\s+\(i32.const /.test(g))global(n);
  const exports=[...roots,'wnd_set_style','wnd_set_owner','wnd_get_style','wnd_min_get','wnd_max_get'].map(n=>`(export "${n}" (func $${n}))`).join('\n');
  const access=[...gs].filter(([,v])=>!v.includes('f64')&&!v.includes('i64')).map(([n,v])=>
    `${v.includes('(mut i32)')?`(func (export "set_${n}") (param $v i32) (global.set $${n} (local.get $v)))`:''}
     (func (export "get_${n}") (result i32) (global.get $${n}))`).join('\n');
  const wat=[source('src/00-regions.wat'),...layouts.values(),
    '(import "host" "memory" (memory 8192 8192 shared))',...boundaries.values(),...gs.values(),...bodies.values(),exports,access].join('\n');
  const built=c.compile(wat,new Map(),{mode:'production'});
  assert(built.success,built.error);
  result.modules.push({source:sha(wat),wasm:sha(built.wasmBinary),bytes:built.wasmBinary.length,functions:[...bodies.keys()],boundaries:[...boundaries.keys()]});
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const trace=[],boundary={};
  for(const n of boundaries.keys())boundary[n]=(...args)=>{
    trace.push({name:n,args});
    if(sinks.has(n))return 0;
    throw Error('UNIMPLEMENTED FIXTURE DEPENDENCY '+n+'('+args.join(',')+')');
  };
  let actual;
  const rctx={module:{exports:{}},console};
  vm.runInNewContext(source('lib/renderer.js'),rctx);
  const renderer=Object.create(rctx.module.exports.Win98Renderer.prototype);
  Object.assign(renderer,{windows:{},_nextZ:1,canvas:{width:640,height:480},
    _computeClientRect:w=>{w.clientRect={x:0,y:0,w:w.w,h:w.h};},
    _growBackingForFixedOverhang(){},notifyShellWindow(){},invalidate(){},scheduleRepaint(){},
    _setKeyboardInputOwner(){},invalidateVisibleTree(){},_flushPendingGeometry(){}});
  const hctx={module:{exports:{}},console};
  vm.runInNewContext(source('lib/host-window.js'),hctx);
  const host=hctx.module.exports.createWindowHost({renderer,getMemory:()=>memory.buffer},
    {readStr:()=>'',getExports:()=>actual}).imports;
  for(const n of ['host_create_window','host_show_window','host_activate_window','host_get_window_rect','host_get_window_client_size']){
    if(boundaries.has(n))boundary[n]=(...args)=>{trace.push({name:n,args});return host[n.slice(5)](...args);};
  }
  // WebAssembly captured the original imported function references: adapters
  // delegate through the mutable boundary table without replacing production.
  const dispatchBoundary=Object.fromEntries(Object.keys(boundary).map(n=>[n,(...a)=>boundary[n](...a)]));
  actual=new WebAssembly.Instance(new WebAssembly.Module(built.wasmBinary),{host:{memory},boundary:dispatchBoundary}).exports;
  renderer.wasm={exports:actual};renderer.wasmMemory=memory;
  return {e:actual,memory,trace,boundary,renderer,
    sibling:()=>new WebAssembly.Instance(new WebAssembly.Module(built.wasmBinary),{host:{memory},boundary:dispatchBoundary}).exports};
}
async function main(){
  gate();inventory();const c=compiler();
  for(let attempt=0;attempt<40;attempt++){
  try{
  result.checks.length=0;
  for(const cmd of [undefined,0,1,2,3,4,5,6,7,8,9,11]){
  for(const visible of [true,false]){
  const f=fixture(c);
  const {e,memory}=f, dv=new DataView(memory.buffer);
  if(cmd!==undefined)e.set_startup_show(cmd);
  const reg=e.get_reg_base(), stack=0x500000, cls=e.get_CLASS_RECORDS();
  for(const encoding of ['A','W']){
    const ptr=0x700000;new Uint8Array(memory.buffer,ptr-1,70).fill(0xA7);
    dv.setUint32(reg+16,stack,true);
    e['handle_GetStartupInfo'+encoding](ptr,0,0,0,0,0);
    assert.equal(dv.getUint32(ptr,true),68);
    assert.equal(dv.getUint32(ptr+44,true),1);
    assert.equal(dv.getUint16(ptr+48,true),cmd??1);
    assert.equal(dv.getUint8(ptr-1),0xA7);assert.equal(dv.getUint8(ptr+68),0xA7);
    assert.equal(dv.getUint32(reg+16,true),stack+8);
  }
  for(const [n,v]of Object.entries({createwnd_nccreate_ret_thunk:0xCACA0029,createwnd_ret_thunk:0xCACA0001,
    createwnd_activate_thunk:0xCACA0022,createwnd_setfocus_thunk:0xCACA0023,
    createwnd_move_thunk:0xCACA0024,createwnd_size_thunk:0xCACA0031}))e['set_'+n](v);
  dv.setUint32(cls,0xC001,true);dv.setUint32(cls+4,0xC001,true);dv.setUint32(cls+12,0x401000,true);
  dv.setUint32(reg+16,stack,true);
  for(const [off,v]of [[0,0xABCDEF],[24,10],[28,160],[32,100],[36,0],[40,0],[44,0x400000],[48,0]])dv.setUint32(stack+off,v,true);
  e.handle_CreateWindowExA(0,0xC001,0,visible?0x10C00000:0x00C00000,10,0);
  const messages=[];
  const params=[];
  function finish(){
  for(let i=0;i<12&&e.get_eip()!==0xABCDEF;i++){
    assert.equal(e.get_eip(),0x401000,'real production continuation targets registered guest wndproc');
    const esp=dv.getUint32(reg+16,true),ret=dv.getUint32(esp,true);
    messages.push(dv.getUint32(esp+8,true));
    params.push([dv.getUint32(esp+8,true),dv.getUint32(esp+12,true),dv.getUint32(esp+16,true)]);
    dv.setUint32(reg,messages.at(-1)===0x81?1:0,true);
    dv.setUint32(reg+16,esp+20,true);
    e.continue(ret);
  }
  assert.equal(e.get_eip(),0xABCDEF);
  }
  finish();
  assert.equal(dv.getUint32(reg,true),0x10001,'CreateWindow callback return HWND');
  const activates=cmd===undefined||[1,2,3,5,9].includes(cmd);
  const minimized=[2,6,7,11].includes(cmd),surfaceVisible=cmd!==0&&!minimized;
  assert.deepEqual(messages,visible&&activates?[0x81,1,0x1c,6,7,3,5]:[0x81,1]);
  assert.equal(dv.getUint32(reg+16,true),stack+52);
  if(!visible){
    messages.length=0;params.length=0;
    dv.setUint32(reg+16,stack,true);dv.setUint32(stack,0xABCDEF,true);
    e.set_eip(0xABCDEF);
    e.handle_ShowWindow(0x10001,1,0,0,0,0);
    finish();
    assert.equal(dv.getUint32(reg+16,true),stack+12);
    assert.equal(dv.getUint32(reg,true),0,'first ShowWindow returns previous hidden visibility');
    assert.deepEqual(messages,activates?[0x1c,6,7,3,5]:[]);
  }
  assert.equal(f.renderer.windows[0x10001].visible,surfaceVisible);
  assert.equal(!!f.renderer.windows[0x10001]._minimized,minimized);
  assert.equal(e.wnd_min_get(0x10001),minimized?1:0,'guest iconic state');
  assert.equal(e.wnd_max_get(0x10001),cmd===3?1:0,'guest maximized state');
  assert.equal(!!(e.wnd_get_style(0x10001)&0x10000000),cmd!==0,'guest visible style');
  // Actual pending-size branches, given nonzero geometry so the fixture's
  // NCCALCSIZE sink cannot accidentally conceal wrong iconic notifications.
  for(const peek of [true,false]){
    e.set_pending_wm_size(0x006400A0);
    dv.setUint32(reg+16,stack,true);
    e[peek?'fixture_pending_peek':'fixture_pending_get'](0x700000,0);
    assert.equal(dv.getUint32(0x700004,true),5);
    assert.equal(dv.getUint32(0x700008,true),minimized?1:cmd===3?2:0);
    assert.equal(dv.getUint32(0x70000C,true),minimized?0:0x006400A0);
    assert.equal(e.get_pending_wm_size(),peek?0x006400A0:0);
  }
  if(visible&&cmd!==undefined)
    assert.equal(f.trace.find(x=>x.name==='host_create_window').args[1]&0x10000000,0,'no initially exposed surface');
  assert.equal(f.renderer._foregroundWindow?.hwnd,activates?0x10001:undefined);
  if(cmd===2){
    assert.deepEqual(params.find(p=>p[0]===5),[5,1,0],'minimized WM_SIZE');
    assert.equal(params.find(p=>p[0]===6)?.[1],0x10001,'minimized WM_ACTIVATE');
  }
  result.checks.push({name:'A/W, complete creation/ret16/activation/first explicit show',cmd,visible,messages:[...messages],params:[...params]});
  function show(command,hwnd=0x10001,instance=e){
    messages.length=0;params.length=0;
    dv.setUint32(reg+16,stack,true);dv.setUint32(stack,0xABCDEF,true);
    e.set_eip(0xABCDEF);
    instance.handle_ShowWindow(hwnd,command,0,0,0,0);
    if(instance===e)finish();
    assert.equal(dv.getUint32(reg+16,true),stack+12);
  }
  // A later normal show no longer substitutes the startup command.
  show(1);
  assert.equal(f.renderer.windows[0x10001].visible,true);
  // SW_SHOWDEFAULT retains the original command after the first-show latch.
  show(10);
  assert.equal(f.renderer.windows[0x10001].visible,surfaceVisible);
  assert.equal(!!f.renderer.windows[0x10001]._minimized,minimized);
  // A second instance reads the same process state without resetting it.
  const sibling=f.sibling();
  sibling.startup_info_init(0x700000);
  assert.equal(dv.getUint16(0x700030,true),cmd??1);
  if(cmd!==undefined){
    e.set_startup_show(cmd);
    show(1,0xDEAD);
    assert.equal(dv.getUint32(e.get_STARTUP_SHOW_STATE()+8,true),1,'invalid HWND cannot consume startup');
    // Use the existing real WND record, with child/owner identity set through
    // production accessors, to isolate ShowWindow eligibility from creation.
    for(const [style,owner]of [[0x40C00000,0],[0x80C00000,0x1234],[0x80000000,0]]){
      e.wnd_set_style(0x10001,style);e.wnd_set_owner(0x10001,owner);
      show(1);
      assert.equal(dv.getUint32(e.get_STARTUP_SHOW_STATE()+8,true),1,'child/owned/bare popup cannot consume startup');
    }
    e.wnd_set_style(0x10001,0x00C00000);e.wnd_set_owner(0x10001,0);
    // This sibling executes the real explicit handler; arm its activation
    // latch to avoid guest callback scheduling in a thread not being driven.
    sibling.set_main_hwnd(0x10001);sibling.set_show_window_activated(1);
    sibling.set_active_hwnd(0x10001);sibling.set_focus_hwnd(0x10001);
    show(1,0x10001,sibling);
    assert.equal(dv.getUint32(e.get_STARTUP_SHOW_STATE()+8,true),0,'shared first-show latch');
    assert.equal(f.renderer.windows[0x10001].visible,surfaceVisible);
    // An explicit first hide is honored and consumes the eligibility latch;
    // a later normal show does not unexpectedly substitute minimized startup.
    e.set_startup_show(2);show(0);
    assert.equal(dv.getUint32(e.get_STARTUP_SHOW_STATE()+8,true),0);
    show(1);assert.equal(e.wnd_min_get(0x10001),0);
    show(10);assert.equal(e.wnd_min_get(0x10001),1);
  }
  }}
  result.status='complete-source-paths-pass';
  result.adapters=[
    'Complete production CreateWindowExA, ShowWindow, A/W GetStartupInfo, WND accessors and six continuation branches compiled with vendored compiler; actual host-window and renderer create/show/activate methods.',
    'Identity guest addressing, deterministic scratch allocation, preseeded registered class record. Guest callbacks are observed at the actual EIP and stack; harness supplies successful NCCREATE/CREATE results and executes ret16 before entering the production continuation. No x86 interpreter or PE.',
    'Graphics, clipping, paint and posted-notification sinks are listed in the source and module boundary inventory; they do not choose visibility, iconic state or activation. Client geometry setup and canvas effects are adapters, so this is not pixel/paint qualification.',
    'Sibling instance shares actual memory and startup latch; its main/active/focus globals are initialized to the already activated test window for the non-callback shared-state check. Child/owned eligibility uses real WND setters, not complete child creation.',
  ];
  // A real custom guest class will be registered by writing the exact class
  // table layout in fixture setup; guest callback return is ret16 plus the
  // production continuation branch, never synthetic activation.
  console.log(JSON.stringify({status:result.status,module:result.modules.at(-1).wasm,checks:result.checks}));
  return;
  }catch(error){
    const m=error.message.match(/^UNIMPLEMENTED FIXTURE DEPENDENCY (\w+)/);
    if(!m||!funcs.has(m[1])||imports.has(m[1])||selected.has(m[1]))throw error;
    selected.add(m[1]);console.log('Including actual dependency '+m[1]);
  }
  }
  throw Error('fixture dependency expansion exceeded 40 production functions');
}
main().catch(error=>{result.error=error.stack;console.error(error);process.exitCode=1;}).finally(()=>{
  gate();fs.writeFileSync(`../${process.env.STARTUP_MUTATION?'negative-'+process.env.STARTUP_MUTATION:'fixture'}.json`,JSON.stringify(result,null,2)+'\n');
});
