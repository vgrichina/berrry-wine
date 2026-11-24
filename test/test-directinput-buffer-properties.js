'use strict';

// Full production x86 -> published COM vtables -> dispatcher -> real input host.
// The RPC variant uses the production synchronous broker in process.
const assert = require('node:assert/strict');
const fs = require('node:fs'), crypto = require('node:crypto');
const { bootRenderHarness } = require('./render-helper');
const RPC = require('../lib/guest-rpc');
const signatures = require('../lib/host-import-sigs.generated.json').sigs;
const regions = require('../lib/region-map.generated');
const apis = require('../src/api_table.json');
const zlib = require('node:zlib');

const failures = [];
let checks = 0;
function equal(actual, expected, name) {
  checks++;
  try { assert.deepEqual(actual, expected, name); }
  catch (error) { failures.push({ name, actual, expected }); }
}

(async () => {
  const wasm = process.argv[2] ? fs.readFileSync(process.argv[2]) : require('./compile-src').compileSrcWasm();
  const bytes = wasm[0] === 0x1f ? zlib.gunzipSync(wasm) : wasm;
  console.log('production module SHA256=' + crypto.createHash('sha256').update(bytes).digest('hex'));
  if (process.env.DI_BUFFER_MODULE_OUT) fs.writeFileSync(process.env.DI_BUFFER_MODULE_OUT, zlib.gzipSync(bytes));
  const module = await WebAssembly.compile(bytes);
  for (const rpc of [false, true]) {
    let rpcCalls = 0;
    const h = await bootRenderHarness({ prebuiltModule: module, fonts: 'none',
      beforeInstantiate(ctx, host) {
        host.get_ticks = () => 1000;
        ctx.renderer._guestNowMs = () => 1000;
        ctx.renderer._inputNowMs = () => 1000;
        if (!rpc) return;
        const sigs = Object.fromEntries(['get_mouse_buttons_live', 'di_mouse_receipt', 'queue_mouse_input', 'di_keyboard_buffer', 'get_key_down_state', 'queue_keyboard_input']
          .map(name => [name, signatures[name]]));
        const broker = RPC.createMainBroker(host.memory, { ...host }, sigs);
        const worker = RPC.createWorkerImports(host.memory, sigs, m => {
          rpcCalls++; broker.serveRpc(m.slot);
        }, { slot: 2 });
        Object.assign(host, worker.imports.host);
      } });
    const { exports: e, memory, renderer } = h;
    const pe = fs.readFileSync(require('node:path').join(__dirname, 'binaries/calc.exe'));
    new Uint8Array(memory.buffer).set(pe, e.get_staging());
    assert(e.load_pe(pe.length), 'fixture PE initializes process; application is never run');
    e.init_dx_com_thunks();
    const wr = (p, v) => e.guest_write32(p, v >>> 0), rd = p => e.guest_read32(p) >>> 0;
    const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
    const view = new DataView(memory.buffer), stack = alloc(8192) + 4096;
    let calls = 0;
    function invoke(args, obj, slot, target) {
      const code = [], word = v => code.push(v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24);
      for (const arg of args.slice().reverse()) { code.push(0x68); word(arg); }
      if (obj) {
        assert(rd(rd(obj) + slot * 4), 'published production method');
        code.push(0xb8); word(obj); code.push(0x8b, 0x00, 0xff, 0x90); word(slot * 4);
      } else { code.push(0xb8); word(target); code.push(0xff, 0xd0); }
      const result = alloc(8);
      code.push(0xa3); word(result); code.push(0x89, 0x25); word(result + 4); code.push(0xc3);
      const pc = alloc(code.length); code.forEach((v, i) => e.guest_write8(pc + i, v));
      e.set_esp(stack); e.call_func(pc, 0, 0, 0, 0);
      for (let i = 0; i < 100 && e.get_eip(); i++) e.run(10000);
      assert.equal(e.get_eip(), 0, 'finite x86 return');
      equal(rd(result + 4), stack - 20, 'stdcall cleanup');
      equal(e.get_esp() >>> 0, stack - 16, 'x86 caller RET');
      calls++; return rd(result);
    }
    const com = (obj, slot, ...args) => invoke([obj, ...args], obj, slot);
    const out = alloc(4), guid = alloc(16);
    const thunkWa = regions.BASE.THUNK_BASE, saved = view.getUint32(thunkWa + 4, true);
    const thunk = (thunkWa - e.get_guest_base() + e.get_image_base()) >>> 0;
    try {
      view.setUint32(thunkWa + 4, apis.find(a => a.name === 'DirectInputCreateA').id, true);
      equal(invoke([0x400000, 0x700, out, 0], 0, 0, thunk), 0, 'factory HRESULT');
    } finally { view.setUint32(thunkWa + 4, saved, true); }
    const root = rd(out); assert(root);

    for (const keyboard of [false, true]) {
      [keyboard ? 0x6f1d2b61 : 0x6f1d2b60, 0x11cfd5a0, 0x4544c7bf, 0x00005453]
        .forEach((v,i)=>wr(guid+i*4,v));
      equal(com(root,3,guid,out,0),0,'CreateDevice');
      const device=rd(out), fmt=alloc(24), objs=alloc(4096);
      const list=keyboard ? Array.from({length:256},(_,i)=>[i,(i<<8)|12])
        : [[0,3],[4,0x103],[8,0x203],[12,0x30c],[13,0x40c],[14,0x50c],[15,0x60c]];
      [24,16,2,keyboard?256:16,list.length,objs].forEach((v,i)=>wr(fmt+i*4,v));
      list.forEach(([ofs,type],i)=>[0,ofs,type,0].forEach((v,j)=>wr(objs+i*16+j*4,v)));
      equal(com(device,11,fmt),0,'valid format');
      const propArea=alloc(52), prop=propArea+16;
      const raw=(p,n)=>new Uint8Array(memory.buffer,e.guest_to_wasm(p)>>>0,n);
      function setSize(n,hr) {
        raw(propArea,52).fill(165);
        [20,16,0,0,n].forEach((v,i)=>wr(prop+i*4,v));
        const before=Buffer.from(raw(propArea,52)).toString('hex');
        equal(com(device,6,1,prop),hr,'SetProperty '+n+' '+(keyboard?'keyboard':'mouse'));
        equal(Buffer.from(raw(propArea,52)).toString('hex'),before,'SetProperty input and perimeter untouched');
      }
      function getSize(n) {
        raw(propArea,52).fill(165);
        [20,16,0,0,0xa5a5a5a5].forEach((v,i)=>wr(prop+i*4,v));
        equal(com(device,5,1,prop),0,'GetProperty');
        equal(Array.from({length:5},(_,i)=>rd(prop+i*4)),[20,16,0,0,n],'property header/capacity');
        equal([...raw(propArea,16),...raw(prop+20,16)],Array(32).fill(165),'GetProperty perimeter');
      }
      setSize(3,0); getSize(3); equal(com(device,7),0,'Acquire');
      const dataArea=alloc(192), data=dataArea+16, countArea=alloc(36), count=countArea+16;
      function poll(flags,n,hr,expected,pointer=data) {
        raw(dataArea,192).fill(165); raw(countArea,36).fill(165); wr(count,n);
        equal(com(device,10,20,pointer,count,flags),hr,'GetDeviceData HRESULT');
        const got=rd(count); equal(got,expected.length,'exact count');
        assert(got<=8,'finite output');
        if(pointer) {
          equal(Array.from({length:got},(_,i)=>[rd(data+i*20),rd(data+i*20+4)|0,rd(data+i*20+8),rd(data+i*20+12)]),expected,'literal offset/value/time/sequence order');
          for(let i=0;i<got;i++)equal(rd(data+i*20+16),0xa5a5a5a5,'stride padding');
        }
        const end=pointer?got*20:0;
        equal([...raw(dataArea,16),...raw(data+end,176-end)],Array(192-end).fill(165),'untouched output guards');
        equal([...raw(countArea,16),...raw(count+4,16)],Array(32).fill(165),'count guards');
      }
      poll(0,8,0,[]);
      if(keyboard) {
        // Four real producer transitions overflow the supported two-event queue.
        renderer.handleKeyDown(65); renderer.handleKeyUp(65);
        renderer.handleKeyDown(32); renderer.handleKeyUp(32);
      } else renderer.handleRelativeMouseMove(7,-3,{guestCounts:true});
      const records=keyboard?[[30,128,1000,1],[30,0,1000,2]]:[[0,7,1000,0],[4,-3,1000,1]];
      poll(1,8,keyboard?1:0,records);
      setSize(5,0x800700aa); getSize(3);
      setSize(0,0x800700aa); getSize(3);
      poll(1,8,keyboard?1:0,records);
      poll(1,1,keyboard?1:0,[records[0]]);
      poll(0,1,keyboard?1:0,[records[0]]);
      poll(1,8,0,[records[1]]); poll(0,8,0,[records[1]]); poll(0,8,0,[]);
      // After the read clears overflow, new input is admitted at the unchanged size.
      if(keyboard) {renderer.handleKeyDown(32); renderer.handleKeyUp(32);}
      else renderer.handleRelativeMouseMove(-2,5,{guestCounts:true});
      const next=keyboard?[[57,128,1000,5],[57,0,1000,6]]:[[0,-2,1000,2],[4,5,1000,3]];
      poll(1,8,0,next); poll(0,8,0,next); poll(0,8,0,[]);
      equal(com(device,8),0,'Unacquire'); setSize(5,0); getSize(5);
      equal(com(device,2),0,'actual final device Release');
    }
    equal(com(root,2),0,'actual final root Release');
    if(rpc)assert(rpcCalls>0,'production synchronous RPC exercised');
    console.log(JSON.stringify({route:rpc?'production synchronous RPC in process':'direct production host',calls,rpcCalls,checks,failures}));
  }
  assert.equal(failures.length,0,JSON.stringify(failures));
  console.log('PASS buffer property acquired guard and overflow/read transitions '+checks+' checks');
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
