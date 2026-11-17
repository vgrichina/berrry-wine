'use strict';

// Boundary diagnosis, not qualification of a word-aligned FT implementation.
// The genuine DSETUPE caller is a QT caller. Its untouched INT3 relay currently
// falls through to the adjacent published FT relay. Do not use this diagnostic
// as authorization to admit that argument packet as an FT activation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const {ftImages} = require('./test-native-ft-relay');
const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24];
const hex = n => '0x' + (n >>> 0).toString(16).padStart(8, '0');

function qtCaller() {
  const f = ftImages({index: 1});
  // Same frame arithmetic as genuine 10004739..10004770: EBP, flags,
  // 60 scratch bytes, WORD HWND, eight DWORD arguments, CALL QT relay.
  // Synthetic target 1 replaces genuine target 2; no original bytes execute.
  const c = [0xb9, ...u32(0x10001), 0x55, 0x89, 0xe5, 0x51, 0x83, 0xec, 60,
    0x66, 0x68, 0x0a, 0x00];
  for (const arg of [0x200000, 0x1751f4, 0x1fd5f0, 0x1fd4ec,
    0x17b908, 0, 0, 0x90001a3f]) c.push(0x68, ...u32(arg));
  const qt = f.data + 36;
  c.push(0xe8, ...u32(qt - (f.invoke + c.length + 5)));
  const body = f.invoke + c.length;
  // Genuine QT continuation reconstructs EAX from DX:AX, unmaps, LEAVE,
  // RET 36. It never fills an FT bitmap or calls FT_Thunk/FT_Exit.
  c.push(0xc1, 0xe0, 16, 0x0f, 0xac, 0xd0, 16, 0xc9, 0xc2, 36, 0);
  f.bytes.fill(0xcc, f.raw(0x2600), f.raw(0x2700));
  f.bytes.set(c, f.raw(0x2600));
  return {...f, qt, body};
}

async function diagnose() {
  assert(process.env.WA_TEST_WASM, 'explicit immutable module required');
  const bytes = fs.readFileSync(process.env.WA_TEST_WASM);
  const memory = new WebAssembly.Memory({initial:8192, maximum:8192, shared:true});
  const {createHostImports} = require('../lib/host-imports');
  const imports = createHostImports({getMemory:()=>memory.buffer, renderer:null, resourceJson:{}});
  imports.host.memory = memory;
  const e = (await WebAssembly.instantiate(bytes, imports)).instance.exports;
  const {serviceNeGuestYieldSync, retireNativeFtConnections} = require('../lib/ne-guest-bridge');
  const context = {exports:e, memoryBuffer:memory.buffer};
  const load = f => {
    new Uint8Array(memory.buffer).set(f.bytes, e.get_staging());
    assert.equal(e.load_pe(f.bytes.length), f.entry);
    e.invalidate_code_range(f.base, 0x3000);
    e.set_eip(f.entry); e.set_esp(0x7408000); e.guest_write32(0x7408000, 0);
    for (let i=0; i<100 && e.get_eip(); i++) {
      e.run(256);
      if (e.get_yield_reason()===18) serviceNeGuestYieldSync({...context, findDllSync:()=>f.ne});
      else assert.equal(e.get_yield_reason(), 0);
    }
    assert.equal(e.get_eip(), 0); assert.equal(e.guest_read32(f.result), 1);
    assert(Array.from({length:32}, (_,i)=>e.guest_read8(f.data+36+i)).every(b=>b===0xcc),
      'QT publication is still unsupported and leaves original CC bytes');
    assert.equal(e.guest_read8(f.data+68), 0x0f, 'adjacent FT relay is published');
  };
  const records = [];
  // Observe both alignments without continuing the invalid FT activation.
  for (const shift of [0, 2]) {
    const f = qtCaller(); load(f);
    e.set_eip(f.invoke); e.set_esp(0x74fd494+shift);
    e.guest_write32(0x74fd494+shift, 0);
    const visited = []; let fault;
    for (let i=0; i<80; i++) {
      visited.push(e.get_eip()>>>0);
      try {e.run(1);} catch (error) {fault=String(error); break;}
      if (e.win16_ft_checkpoint()) break;
    }
    assert(visited.includes(f.qt), 'real CALL enters QT first');
    assert(visited.includes(f.qt+31), 'last original INT3 executes');
    assert(visited.includes(f.qt+32), 'INT3 falls into adjacent FT');
    const s = 0x74fd42a+shift;
    assert.equal(e.guest_read32(s+4)>>>0, 0x90001a3f, 'FT caller-return slot is packed QT argument');
    if (shift===0) {
      assert(fault, 'current alignment guard traps the original QT-shaped packet');
      assert.equal(e.get_esp(), s); assert.equal(e.get_ebp(), 0x74fd490);
      assert.equal(e.guest_read32(s), f.body); assert.equal(e.win16_ft_checkpoint(), 0n);
    } else {
      assert(!fault); assert(e.win16_ft_checkpoint(), 'aligned version wrongly acquires an FT parent');
      assert.equal(e.get_ebp(), s); assert.equal(e.get_esp(), s-64);
      assert.equal(e.get_eip(), f.body, 'FT returns into a QT continuation');
    }
    records.push({kind:'qt-fallthrough',shift,esp:hex(s),body:hex(f.body),
      bogusFtCallerReturn:hex(e.guest_read32(s+4)),fault:fault??null,
      ftFrameAcquired:!!e.win16_ft_checkpoint(),visited:visited.map(hex)});
    if (e.win16_ft_checkpoint()) assert.equal(e.win16_ft_abort_call(), 1);
    retireNativeFtConnections(context);
    assert.equal(e.win16_ft_checkpoint(), 0n);
    assert.equal(e.get_sync_msg_depth(), 0);
    assert.equal(e.guest_read32(f.data+8), 0, 'retirement restores original table');
    assert.equal(e.guest_read8(f.data+68), 0xcc, 'retirement restores original FT bytes');
  }
  // Distinguish real FT inputs from the QT counterexample. The current word
  // rejection is a limitation, not a demonstrated fix for genuine DSETUPE.
  for (const shift of [0, 2]) {
    const f = ftImages(); load(f); e.set_eip(f.invoke);
    e.set_esp(0x7408000+shift); e.guest_write32(0x7408000+shift, 0);
    let fault;
    for (let i=0; i<100 && e.get_eip(); i++) {
      try {
        e.run(256);
        if (e.get_yield_reason()===18) serviceNeGuestYieldSync({...context, findDllSync:()=>f.ne});
      } catch (error) {fault=String(error); break;}
    }
    if (!shift) {
      assert(!fault); assert.equal(e.get_eip(), 0);
      assert.equal(e.guest_read32(f.log+100), f.expectedReturn);
      assert.equal(e.guest_read32(f.log+116), 0x7408000);
    } else assert(fault, 'baseline genuine FT word-stack support remains unqualified');
    records.push({kind:'actual-ft-baseline',shift,fault:fault??null});
    retireNativeFtConnections(context);
    assert.equal(e.win16_ft_checkpoint(), 0n);
  }
  const result = {moduleSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),
    diagnosis:'QT_INT3_FALLTHROUGH_INTO_FT_NOT_VALID_FT_CALLER', repairQualified:false, records};
  if (process.env.NEVERHOOD_WORD_STACK_RESULT)
    fs.writeFileSync(process.env.NEVERHOOD_WORD_STACK_RESULT, JSON.stringify(result,null,2)+'\n');
  console.log('PASS native boundary diagnosis: QT fallthrough at both alignments; separate FT baseline; no ABI repair claim');
  return result;
}

if (require.main===module) diagnose().catch(error=>{console.error(error);process.exitCode=1;});
module.exports = {qtCaller, diagnose};
