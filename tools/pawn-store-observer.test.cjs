'use strict';
// Real shipped interpreter, synthetic machine-code controls only. Never Pawn.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const {createHostImports} = require('../lib/host-imports');
const {observe} = require('./pawn-store-observer.cjs');
const root = path.resolve(__dirname,'..');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const wasm = fs.readFileSync(path.join(root,'build/wine-assembly.wasm'));
const pe = fs.readFileSync(path.join(root,'test/binaries/notepad.exe'));
const le = n => [n&255,n>>>8&255,n>>>16&255,n>>>24&255];
async function main() {
  const memory = new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const ctx={exports:null,getMemory:()=>memory.buffer}, imports=createHostImports(ctx);
  imports.host.memory=memory; imports.host.log=()=>{}; imports.host.log_i32=()=>{};
  const e=(await WebAssembly.instantiate(wasm,{host:imports.host})).instance.exports; ctx.exports=e;
  new Uint8Array(memory.buffer).set(pe,e.get_staging()); assert(e.load_pe(pe.length));
  const area=e.guest_alloc(16384)>>>0, pc=area+128, data=area+2048, stack=area+8192;
  const put=(p,b)=>b.forEach((v,i)=>e.guest_write8(p+i,v));
  const seed=code=>{put(pc,code);e.invalidate_code_range(pc,128);e.set_eip(pc);e.set_esp(stack);};
  const opts={memory,ranges:[{lo:data,hi:data+8}],exclusive:()=>true,maxMs:10000};
  const cases=[];
  const finish=(name,h,status)=>{const r=h.stop();assert.equal(r.status,status);cases.push({name,...r});};
  // Prime an ordinary fused block with an interior store. Arming must retire it.
  const code=[0x90,0xb8,...le(0x11223344),0x89,0x05,...le(data),0x90,0xeb,0xfe];
  seed(code);e.run(1);assert.equal(e.guest_read32(data)>>>0,0x11223344);
  e.guest_write32(data,0);e.set_eip(pc);
  const areaPhysical=e.guest_to_wasm(area);
  const guestHash=()=>hash(new Uint8Array(memory.buffer,areaPhysical,16384));
  const registers=()=>['eip','esp','eax','ebx','ecx','edx','esi','edi','ebp'].map(n=>e['get_'+n]());
  const beforeArm={hash:guestHash(),registers:registers()};
  let h=observe(e,opts);
  assert.equal(guestHash(),beforeArm.hash);assert.deepEqual(registers(),beforeArm.registers);
  h.stop();assert.equal(guestHash(),beforeArm.hash);assert.deepEqual(registers(),beforeArm.registers);
  cases.push({name:'arm and stop preserve guest bytes and CPU',pass:true,...beforeArm});
  h=observe(e,opts);h.step();h.step();h.step();
  assert.equal(h.result.records.length,1);assert.equal(h.result.records[0].pc,pc+6);
  assert.equal(h.result.records[0].address,data);assert.equal(h.result.records[0].width,4);
  assert.equal(h.result.records[0].delta,1);assert.equal(h.result.records[0].sameValue,false);
  finish('cached interior MOV precise PC',h,'scope-ended');
  e.set_eip(pc);h=observe(e,opts);h.step();h.step();h.step();
  assert.equal(h.result.records[0].sameValue,true);
  finish('same-value MOV still advances epoch',h,'scope-ended');
  seed([0x88,0x05,...le(data),0x90]);
  h=observe(e,{...opts,ranges:[{lo:data,hi:data+1},{lo:data+4,hi:data+8}]});h.step();
  assert.equal(h.result.records[0].width,1);assert.equal(h.result.records[0].range,0);
  assert.equal(h.result.firstWriters[1],null);
  finish('PV byte width and independent unwritten history range',h,'scope-ended');
  // Two scalar instructions: complete ordered journal, each delta exactly one.
  seed([0x89,0x05,...le(data),0x89,0x05,...le(data+4),0x90]);
  h=observe(e,opts);h.step();h.step();assert.deepEqual(h.result.records.map(r=>r.pc),[pc,pc+6]);
  finish('two native scalar stores ordered',h,'scope-ended');
  // REP has multiple writes at one PC. Protected primitive exposes each element.
  seed([0xf3,0xab,0x90]);e.set_edi(data);e.set_ecx(2);
  h=observe(e,opts);h.step();h.step();assert.equal(h.result.records.length,2);
  assert.deepEqual(h.result.records.map(r=>[r.pc,r.address]),[[pc,data],[pc,data+4]]);
  finish('REP two stores split into ordered elements',h,'scope-ended');
  // Real machine-code negative: deliberately degrade the supplied primitive to
  // instruction-only (the old observer granularity). The actual REP commits two
  // stores in one instruction; the last-writer receipt must remain UNKNOWN.
  seed([0xf3,0xab,0x90]);e.set_edi(data);e.set_ecx(2);
  const degraded={...e,set_rep_store_step:addr=>e.set_instruction_watchpoint(addr)};
  // Share once per actual instance, then expose the same pointer to this
  // deliberately degraded facade (the production share export is one-shot).
  const shared=require('../lib/region-map.generated').BASE.NATIVE_STORE_SHARED;
  degraded.native_store_share=()=>shared;
  h=observe(degraded,opts);h.step();assert.equal(h.result.final.receipt[7],2);
  assert.equal(h.result.records.length,0);finish('unsplit real REP multiplewrites',h,'unknown:multiplewrites');
  seed([0x89,0x05,...le(data),0x90]);
  h=observe(e,{...opts,epochLimit:1});h.step();h.step();
  // second store, not a repeated inspection of the first receipt
  assert.throws(()=>e.set_eip(pc),WebAssembly.RuntimeError);
  finish('protected export refuses EIP mutation',h,'scope-ended');
  seed([0x89,0x05,...le(data),0x89,0x05,...le(data),0x90]);
  h=observe(e,{...opts,epochLimit:1});h.step();h.step();finish('real store epoch overflow',h,'unknown:overflow');
  seed([0x90,0x90]);h=observe(e,opts);e.run(1);h.step();finish('foreign execution creates scope gap',h,'unknown:scope-gap');
  seed([0x90]);h=observe(e,opts);assert.throws(()=>e.guest_write32(data,7),WebAssembly.RuntimeError);
  finish('protected export refuses host write',h,'scope-ended');
  seed([0x90]);h=observe(degraded,opts);e.guest_write32(data,7);h.step();finish('instruction-only host store',h,'unknown:host');
  seed([0x89,0x05,...le(data),0x89,0x05,...le(data),0x90]);
  h=observe(e,{...opts,maxRecords:1});h.step();h.step();finish('bounded journal refuses truncation',h,'unknown:record-bound');
  seed([0x90]);h=observe(e,{...opts,maxSteps:1});h.step();h.step();finish('instruction bound explicit unknown',h,'unknown:scope-bound');
  seed([0x0f,0x0b]);h=observe(e,opts);h.step();finish('unsupported opcode fails closed',h,'unknown:trap-or-unsupported');
  // Exact original writer bytes, mapped into an isolated fixture. This is a
  // coverage control, never execution evidence from the original Pawn process.
  const pawnPath='binaries/wep32-community/Pawn/Pawn.exe', pawn=fs.readFileSync(path.join(root,pawnPath));
  assert.equal(hash(pawn),'21f78408e306d77103484bc90accfd511a141131ed1e14990380ecea19de5a58');
  function original(va,n) {
    const header=pawn.readUInt32LE(60), sections=header+24+pawn.readUInt16LE(header+20);
    for(let i=0;i<pawn.readUInt16LE(header+6);i++) {
      const s=sections+i*40,rva=pawn.readUInt32LE(s+12),size=pawn.readUInt32LE(s+16);
      if(va-0x400000>=rva && va-0x400000+n<=rva+size)
        return pawn.subarray(pawn.readUInt32LE(s+20)+va-0x400000-rva,pawn.readUInt32LE(s+20)+va-0x400000-rva+n);
    }
    throw Error('unmapped original VA');
  }
  const writer=original(0x402a4c,4);assert.equal(writer.toString('hex'),'8f441d00');
  seed([...writer,0x90]);e.set_ebp(data);e.set_ebx(0);e.guest_write32(stack,0x55);
  h=observe(e,opts);h.step();assert.equal(e.get_esp(),stack);assert.equal(h.result.records.length,0);
  finish('exact Pawn POP writer rejected by protected subset',h,'unknown:trap-or-unsupported');
  seed([...writer,0x90]);e.set_ebp(data);e.set_ebx(0);e.guest_write32(stack,0x55);
  h=observe(degraded,opts);h.step();assert.equal(h.result.records[0].pc,pc);
  assert.equal(h.result.records[0].width,4);assert.equal(e.guest_read32(data),0x55);
  finish('exact Pawn POP writer tracked in instruction-only fixture',h,'scope-ended');
  // Sticky invalidation last: it cannot be cleared by rearm on this instance.
  seed([0x90]);h=observe(e,opts);e.set_rep_store_step(0);e.native_store_invalidate();h.step();finish('invalidated receipt',h,'unknown:invalid');
  h=observe(e,opts);finish('sticky invalidation refuses baseline',h,'unknown:baseline');
  const result={pass:true,fixtureOnly:true,moduleSHA256:hash(wasm),peSHA256:hash(pe),
    pawn:{path:pawnPath,sha256:hash(pawn),writerVA:0x402a4c,bytes:writer.toString('hex')},cases};
  if(process.env.PAWN_OBSERVER_RESULT) fs.writeFileSync(process.env.PAWN_OBSERVER_RESULT,JSON.stringify(result,null,2)+'\n');
  console.log('PASS '+cases.length+' real-interpreter observer controls; fixture only');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
