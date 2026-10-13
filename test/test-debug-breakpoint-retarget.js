'use strict';
// Real-WASM debugger regression. No compile or browser. Optional arguments:
// node test/test-debug-breakpoint-retarget.js WASM_PATH PE_FIXTURE
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const {createHostImports}=require('../lib/host-imports');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
  const [wasmPath=process.env.WINE_ASSEMBLY_WASM||'build/wine-assembly.wasm',fixturePath=process.env.BREAKPOINT_FIXTURE||'test/binaries/notepad.exe']=process.argv.slice(2);
  const wasm=fs.readFileSync(wasmPath),fixture=fs.readFileSync(fixturePath),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const ctx={exports:null,getMemory:()=>memory.buffer},base=createHostImports(ctx);base.host.memory=memory;base.host.log=()=>{};base.host.log_i32=()=>{};
  const {instance}=await WebAssembly.instantiate(wasm,{host:base.host}),e=instance.exports;ctx.exports=e;
  new Uint8Array(memory.buffer).set(fixture,e.get_staging());assert(e.load_pe(fixture.length));
  const A=e.guest_alloc(4096)>>>0,B=A+3,C=A+6,stack=e.guest_alloc(4096)>>>0;
  // A:inc eax;jmp B. B:inc ebx;jmp C. C:inc ecx;jmp A.
  [0x40,0xeb,0x00,0x43,0xeb,0x00,0x41,0xeb,0xf7].forEach((b,i)=>e.guest_write8(A+i,b));e.invalidate_code_range(A,9);
  const reset=()=>{e.clear_bp();e.set_eip(A);e.set_esp(stack+4092);e.set_eax(0);e.set_ebx(0);e.set_ecx(0);};
  const halt=(addr)=>{e.run(1000);assert.equal(e.get_last_run_halt(),5);assert.equal(e.get_eip()>>>0,addr);};
  // Verify both decoded cold blocks and hot chain targets.
  for(const chain of [0,1]){
    e.set_block_chain(chain);reset();const hits=Number(e.get_chain_hits());e.run(30);
    if(chain)assert(Number(e.get_chain_hits())>hits,'warm-up must really exercise block chaining');reset();
    e.set_bp(A);halt(A);assert.equal(e.get_eax(),0);
    e.set_bp(B);halt(B);assert.equal(e.get_eax(),1,'retarget B must stop on its first hit');assert.equal(e.get_ebx(),0);
    e.set_bp(C);halt(C);assert.equal(e.get_ebx(),1);assert.equal(e.get_ecx(),0,'retarget C must stop on first hit');
    reset();e.set_bp(A);halt(A);e.set_bp(A);halt(A);assert.equal(e.get_eax(),1,'same-address rearm resumes once rather than halting forever');
    reset();e.set_bp(A);halt(A);e.clear_bp();e.set_bp(A);halt(A);assert.equal(e.get_eax(),0,'clear then rearm starts a fresh breakpoint');
    reset();e.set_logical_frame(A,0);const initial=e.get_logical_frame_count()>>>0;e.set_bp(A);halt(A);assert.equal(e.get_logical_frame_count()>>>0,initial,'halt occurs before marker');
    e.set_bp(B);halt(B);assert.equal(e.get_logical_frame_count()>>>0,initial+1,'retarget cannot cross another logical iteration');
    e.set_logical_frame(0,0);e.clear_bp();
  }
  console.log(JSON.stringify({passed:true,wasmSha256:hash(wasm),fixtureSha256:hash(fixture),checks:['retarget first hit','same-address resume','clear/rearm','warm chain targets','pre-marker phase']}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
