'use strict';
// Independent oracles using the submitted, sealed slice assembler as machinery.
// Production text ALWAYS comes from the named commit, never the checkout.
const fs = require('fs'), cp = require('child_process'), vm = require('vm');
const assert = require('assert/strict'), crypto = require('crypto'), path = require('path');
const CANDIDATE = 'b09ba2e350bf8789210c8bf6ad2fa3299b15045b';
const BASE = '8bcd437fa4852417b13d375e54e07280621a161a';
const revision = process.env.REVIEW_REV || CANDIDATE;
const mutation = process.env.REVIEW_MUTATION || '';
const output = process.argv[2];
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const result = { revision, mutation, inputs: {}, effectiveInputs: {}, probes: [], controls: [] };
function gate() {
  const s = fs.statfsSync('.');
  assert(s.bavail * s.bsize >= 2285895680, `RESOURCE BLOCKER ${s.bavail*s.bsize}<2285895680`);
}
function git(args) {
  return cp.execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32*1024*1024, stdio: ['ignore','pipe','pipe'] });
}
const cache = new Map();
function read(p) {
  if (cache.has(p)) return cache.get(p);
  let s = git(['show', `${revision}:${p}`]);
  result.inputs[p] = sha(s);
  const changes = {
    info: ['src/09a-handlers3-sync.wat', '(call $startup_show_value)))', '(i32.const 1)))'],
    eligibility: ['src/09a5-handlers-window.wat', '(i32.and (i32.eqz (local.get $owner))', '(i32.and (i32.const 1)'],
    latch: ['src/09a5-handlers-window.wat', '(i32.atomic.rmw.xchg offset=8 (global.get $STARTUP_SHOW_STATE) (i32.const 0))', '(i32.atomic.load offset=8 (global.get $STARTUP_SHOW_STATE))'],
    activation: ['src/09a5-handlers-window.wat', '(call $startup_show_activates (local.get $startup_cmd))', '(i32.const 1)'],
    // Diagnostic counterfactual, NOT a proposed production fix: make the
    // renderer-state observation reject the identified early-show ordering.
    defer: ['src/09a5-handlers-window.wat', '(then (drop (call $host_show_window (local.get $hwnd) (local.get $startup_cmd))))',
      '(then (nop))'],
    rollback: ['src/09b-dispatch.wat', '(call $host_destroy_window (local.get $hwnd))',
      '(i32.atomic.store offset=8 (global.get $STARTUP_SHOW_STATE) (i32.const 1))\n(call $host_destroy_window (local.get $hwnd))'],
    nullguard: ['src/09a5-handlers-window.wat',
      '(if (i32.lt_s (call $wnd_table_find (local.get $arg0)) (i32.const 0))',
      '(if (i32.or (i32.eqz (local.get $arg0)) (i32.lt_s (call $wnd_table_find (local.get $arg0)) (i32.const 0)))'],
  };
  const m = changes[mutation];
  if (m && m[0] === p) {
    assert(s.includes(m[1]), 'mutation target absent');
    s = s.replace(m[1], m[2]);
    result.controls.push({ path:p, before:result.inputs[p], after:sha(s) });
  }
  result.effectiveInputs[p] = sha(s); cache.set(p,s); return s;
}
function harness() {
  const p = 'docs/reviews/shell-startup-complete-path-fix-20261020.js';
  let text = git(['show', `${CANDIDATE}:${p}`]);
  result.assembler = { revision: CANDIDATE, path:p, sha256:sha(text) };
  text = text.slice(0, text.indexOf('async function main(){'));
  const a = text.indexOf('function source(p) {'), b = text.indexOf('function form(s, at)');
  text = text.slice(0,a) + 'const source = readExact;\n' + text.slice(b);
  text = text.replace("const BASE = '8bcd437fa4852417b13d375e54e07280621a161a';", `const BASE = '${revision}';`);
  text = text.replace("const codes=['0001','0022','0023','0024','0031','0029'];",
    "const codes=['0001','0022','0023','0024','0031','0029','002E','0027'];");
  text = text.replace("selected.add('startup_show_set');", revision === BASE ? '' : "selected.add('startup_show_set');");
  text = text.replace("'wnd_get_style','wnd_min_get','wnd_max_get'", "'wnd_get_style','wnd_min_get','wnd_max_get','wnd_table_set','wnd_table_find','wnd_table_remove'");
  text += `
    inventory(); selected.add('post_resize_messages');
    selected.add('wnd_table_remove');
    const c=compiler();
    globalThis.api = { funcs, selected, result, make:()=>fixture(c) };
  `;
  const context = { require, console:{log(){},warn(){},error(){}}, process, readExact:read, WebAssembly,
    TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView, Buffer, setTimeout, clearTimeout, setImmediate };
  vm.runInNewContext(text, context, { filename:p, timeout:30000 });
  return context.api;
}
const RETURN = 0xABCDEF, HWND = 0x10001, PROC = 0x401000;
function setup(f, cmd) {
  const e=f.e, d=new DataView(f.memory.buffer), reg=e.get_reg_base(), stack=0x500000;
  if (cmd !== undefined && e.set_startup_show) e.set_startup_show(cmd);
  const cls=e.get_CLASS_RECORDS();
  d.setUint32(cls,0xC001,true); d.setUint32(cls+4,0xC001,true); d.setUint32(cls+12,PROC,true);
  for (const [n,v] of Object.entries({ createwnd_nccreate_ret_thunk:0xCACA0029,createwnd_ret_thunk:0xCACA0001,
    createwnd_activate_thunk:0xCACA0022,createwnd_setfocus_thunk:0xCACA0023,
    createwnd_move_thunk:0xCACA0024,createwnd_size_thunk:0xCACA0031,
    child_create_nccreate_ret_thunk:0xCACA002E,child_create_ret_thunk:0xCACA0027 })) {
    if (e['set_'+n]) e['set_'+n](v);
  }
  function frame(at=stack,ret=RETURN) { d.setUint32(reg+16,at,true); d.setUint32(at,ret,true); e.set_eip(ret); }
  function create(style=0x00C00000,owner=0,at=stack,ret=RETURN) {
    frame(at,ret);
    for (const [off,v] of [[24,10],[28,160],[32,100],[36,owner],[40,0],[44,0x400000],[48,0]]) d.setUint32(at+off,v,true);
    e.handle_CreateWindowExA(0,0xC001,0,style,10,0);
  }
  function callback() {
    const esp=d.getUint32(reg+16,true);
    return {esp,ret:d.getUint32(esp,true),hwnd:d.getUint32(esp+4,true),
      msg:d.getUint32(esp+8,true),wp:d.getUint32(esp+12,true),lp:d.getUint32(esp+16,true),eip:e.get_eip()};
  }
  function resume(c,value=c.msg===0x81?1:0) { d.setUint32(reg,value,true);d.setUint32(reg+16,c.esp+20,true);e.continue(c.ret); }
  function finish(ret=RETURN,hook=()=>{}) {
    const messages=[];
    for (let i=0;e.get_eip()!==ret && i<20;i++) {
      const c=callback();assert.equal(c.eip,PROC,'registered callback EIP');
      messages.push(c); hook(c); resume(c);
    }
    assert.equal(e.get_eip(),ret,'continuation terminates at caller');
    return messages;
  }
  function show(cmd,hwnd=HWND,at=stack,ret=RETURN) {
    frame(at,ret);e.handle_ShowWindow(hwnd,cmd,0,0,0,0);return finish(ret);
  }
  return {e,d,reg,stack,frame,create,callback,resume,finish,show,
    latch:()=>e.get_STARTUP_SHOW_STATE?d.getUint32(e.get_STARTUP_SHOW_STATE()+8,true):null,
    retval:()=>d.getUint32(reg,true)};
}
function main() {
  gate();
  const h=harness();
  result.modules=h.result.modules;
  function probe(name,fn) {
    if (process.env.REVIEW_PROBE && !name.includes(process.env.REVIEW_PROBE)) return;
    for (let tries=0;tries<25;tries++) {
      try {
        const f=h.make(), s=setup(f);
        const observation=fn(f,s);
        result.probes.push({name,observation}); return;
      } catch (e) {
        const m=e.message.match(/^UNIMPLEMENTED FIXTURE DEPENDENCY (\w+)/);
        if (m && h.funcs.has(m[1]) && !h.selected.has(m[1])) {h.selected.add(m[1]);continue;}
        throw e;
      }
    }
    throw Error('dependency expansion cap');
  }
  probe('GetStartupInfo A/W exact canaries and retained command', (f,s)=>{
    for (const cmd of [0,2,3,4,7,8,11]) {
      if(s.e.set_startup_show)s.e.set_startup_show(cmd);
      for(const encoding of ['A','W']) {
        const p=0x700000;new Uint8Array(f.memory.buffer,p-4,76).fill(0xAB);s.frame();
        s.e['handle_GetStartupInfo'+encoding](p,0,0,0,0,0);
        assert.equal(s.d.getUint32(p,true),68);
        assert.equal(s.d.getUint32(p+44,true),1);
        assert.equal(s.d.getUint16(p+48,true),cmd,'startup info acceptance');
        assert.equal(s.d.getUint32(p-4,true),0xABABABAB);
        assert.equal(s.d.getUint32(p+68,true),0xABABABAB);
        assert.equal(s.d.getUint32(s.reg+16,true),s.stack+8);
      }
    } return {commands:7,encodings:2};
  });
  probe('full ShowWindow eligibility, first-hide consumption, later default and invalid HWND',(f,s)=>{
    s.create();s.finish();s.e.set_show_window_activated(1);s.e.set_active_hwnd(HWND);s.e.set_focus_hwnd(HWND);
    for(const [style,owner,eligible] of [[0,0,true],[0xC00000,0,true],[0x80C00000,0,true],
      [0x80000000,0,false],[0x40C00000,0,false],[0xC0C00000,0,false],[0xC00000,0x2222,false],[0x80C00000,0x2222,false]]) {
      s.e.set_startup_show(0);s.e.wnd_set_style(HWND,style);s.e.wnd_set_owner(HWND,owner);
      s.show(1);assert.equal(s.latch(),eligible?0:1);
      assert.equal(!!(s.e.wnd_get_style(HWND)&0x10000000),!eligible);
    }
    s.e.wnd_set_style(HWND,0xC00000);s.e.wnd_set_owner(HWND,0);
    s.e.set_startup_show(2);s.show(1,0xDEAD);assert.equal(s.latch(),1);
    assert.equal(s.retval(),0);assert.equal(s.e.get_last_error(),1400);
    s.show(0);assert.equal(s.latch(),0);s.show(1);assert.equal(s.e.wnd_min_get(HWND),0);
    s.show(10);assert.equal(s.e.wnd_min_get(HWND),1);
    s.e.startup_info_init(0x700000);assert.equal(s.d.getUint16(0x700030,true),2);
    return {eligibilityCases:8,invalidError:1400};
  });
  probe('NULL HWND consumes first-show latch',(f,s)=>{
    s.e.set_startup_show(0);
    assert(s.e.wnd_table_find(0)>=0,'zero lookup means an empty slot, not a live HWND');
    s.show(1,0);
    assert.equal(s.retval(),0);assert.equal(s.latch(),0);
    const lastError=s.e.get_last_error();
    assert.notEqual(lastError,1400);
    s.create(0x10C00000);s.finish();
    assert.equal(f.renderer.windows[HWND].visible,true,'invalid NULL show stole SW_HIDE');
    return {invalidReturn:0,lastError,latchAfterInvalid:0,nextWindowVisible:true};
  });
  for(const [label,style,owner] of [['child',0x50C00000,HWND],
    ['owned popup',0x90C00000,HWND],['bare popup',0x90000000,0]]) {
    probe('actual excluded creation '+label,(f,s)=>{
      s.create();s.finish();s.e.set_startup_show(0);
      s.create(style,owner);const messages=s.finish();
      assert.equal(s.retval(),HWND+1);assert.equal(s.latch(),1);
      assert.equal(f.renderer.windows[HWND+1].visible,true);
      s.create(0x10C00000,0);s.finish();
      assert.equal(s.retval(),HWND+2);assert.equal(s.latch(),0);
      assert.equal(f.renderer.windows[HWND+2].visible,false);
      return {messages:messages.map(x=>({hwnd:x.hwnd,msg:x.msg})),
        excludedDidNotConsume:true,nextEligibleHidden:true};
    });
  }
  for(const cmd of [0,2,3,4,6,7,8,11]) probe('creation callback boundary startup '+cmd,(f,s)=>{
    s.e.set_startup_show(cmd);s.create(0x10C00000);
    const first=s.callback(), before={visible:f.renderer.windows[HWND].visible,
      iconic:s.e.wnd_min_get(HWND),zoomed:s.e.wnd_max_get(HWND),latch:s.latch()};
    assert.equal(first.msg,0x81);
    // This is a defect-observation oracle: the show decision is committed
    // BEFORE the first creation callback (even before it can refuse creation).
    assert.equal(before.visible,![0,2,6,7,11].includes(cmd));
    assert.equal(before.iconic,[2,6,7,11].includes(cmd)?1:0);
    assert.equal(before.zoomed,cmd===3?1:0);assert.equal(before.latch,0);
    const messages=s.finish();
    assert.equal(s.retval(),HWND);
    assert.equal(s.d.getUint32(s.reg+16,true),s.stack+52);
    assert.equal(messages.some(x=>x.msg===0x1c),[2,3].includes(cmd));
    return {before,messages:messages.map(x=>({msg:x.msg,wp:x.wp,lp:x.lp}))};
  });
  // The direct dialog branch is part of the complete ShowWindow handler.
  // Record calls at its real dialog_default_proc boundary; do not pretend to
  // execute DLGPROC or qualify dialog internals.
  probe('dialog-marker ShowWindow minimized state and emitted arguments',(f,s)=>{
    s.create();s.finish();s.e.wnd_table_set(HWND,s.e.get_WNDPROC_DIALOG());
    const calls=[];f.boundary.dialog_default_proc=(...args)=>{calls.push(args);return 0;};
    if(s.e.set_startup_show)s.e.set_startup_show(2);
    s.e.set_pending_wm_size(0x006400A0);
    s.show(s.e.set_startup_show?1:2);
    const activation=calls.find(x=>x[1]===6), size=calls.find(x=>x[1]===5);
    assert.equal(s.e.wnd_min_get(HWND),1);
    assert.equal(s.retval(),1,'remaining dialog branch still returns constant true');
    assert.equal(activation[2],1,'remaining dialog branch omits iconic bit');
    assert.equal(size[2],0,'remaining dialog branch reports restored');
    assert.equal(size[3],0x006400A0);
    return {wasVisible:false,retval:s.retval(),iconic:s.e.wnd_min_get(HWND),activation,size,
      qualification:'complete handler; recording dialog_default_proc boundary, no DLGPROC execution'};
  });
  probe('nested hidden owned creation during outer WM_CREATE',(f,s)=>{
    if(s.e.set_startup_show)s.e.set_startup_show(1);
    s.create(0x10C00000);
    let nested,outer;
    outer=s.finish(RETURN,c=>{
      if(c.msg!==1)return;
      const at=c.esp-256,ret=0xABC123;
      s.create(0x80C00000,HWND,at,ret);
      nested=s.finish(ret).map(x=>({hwnd:x.hwnd,msg:x.msg}));
      assert.equal(s.retval(),HWND+1);s.d.setUint32(s.reg+16,c.esp,true);s.e.set_eip(PROC);
    });
    assert(nested.some(x=>x.msg===0x1c && x.hwnd===HWND));
    assert(!outer.some(x=>x.msg===0x1c));
    assert.equal(s.retval(),HWND);
    return {nested,outer:outer.map(x=>({hwnd:x.hwnd,msg:x.msg})),
      qualification:'actual nested CreateWindow handlers/continuations, ret16 driver'};
  });
  // Removal is an explicit destructive-callback adapter. It exercises the
  // real WND deletion and continuation, not the complete DestroyWindow API.
  probe('removed target at activation callback still receives continuation',(f,s)=>{
    s.create();s.finish();if(s.e.set_startup_show)s.e.set_startup_show(2);
    s.frame();s.e.handle_ShowWindow(HWND,s.e.set_startup_show?1:2,0,0,0,0);
    const c=s.callback();assert.equal(c.msg,0x1c);
    s.e.wnd_table_remove(HWND);assert.equal(s.e.wnd_table_find(HWND),-1);
    s.resume(c);const after=s.callback();
    assert.equal(after.msg,6);assert.equal(after.hwnd,HWND);
    return {after,qualification:'real record removal; full DestroyWindow and guest instructions not executed'};
  });
  for(const stage of ['NCCREATE','CREATE']) probe('failed '+stage+' consumes startup choice before successful window',(f,s)=>{
    // Abort's actual control flow and record deletion run. Only notification,
    // timers/post purge and renderer teardown are recording cleanup boundaries.
    for(const n of ['wnd_send_message','timer_kill_hwnd','post_queue_purge_hwnd','host_destroy_window'])
      f.boundary[n]=(...args)=>{f.trace.push({name:n,args});return 0;};
    s.e.set_startup_show(0);s.create(0x10C00000);
    if(stage==='CREATE')s.resume(s.callback(),1);
    const c=s.callback();assert.equal(c.msg,stage==='CREATE'?1:0x81);
    s.resume(c,stage==='CREATE'?-1:0);
    assert.equal(s.e.get_eip(),RETURN);assert.equal(s.retval(),0);
    assert.equal(s.e.wnd_table_find(HWND),-1);
    assert.equal(s.latch(),0);
    s.create(0x10C00000);s.finish();
    assert.equal(s.retval(),HWND+1);
    assert.equal(f.renderer.windows[HWND+1].visible,true,'successful retry lost supplied SW_HIDE');
    return {failedResult:0,latchAfterFailure:0,successfulRetryVisible:true,
      qualification:'complete creation/abort/continuations; WM_NCDESTROY send and cleanup boundaries recorded'};
  });
  result.modules=h.result.modules;
  result.status='independent-observations-reproduced';
}
try { main(); } catch(e) { result.error=e.stack;result.status='oracle-rejected';process.exitCode=1; }
if(output) {gate();fs.writeFileSync(path.resolve(output),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify({status:result.status,probes:result.probes.length,error:result.error}));
