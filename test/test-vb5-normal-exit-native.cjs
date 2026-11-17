'use strict';
// Authored USER/x86 fixtures only. No original media or review claims.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
function elapsedWait(ms){
 const code=[];
 if(ms){
  code.push(0xff,0x15,4,0x19,0x40,0,0x89,0xc3);
  const loop=code.length;
  code.push(0xff,0x15,4,0x19,0x40,0,0x29,0xd8,0x3d,ms&255,(ms>>>8)&255,(ms>>>16)&255,ms>>>24,0x72);
  code.push((loop-code.length-1)&255);
 }
 return code;
}
function fixture(mode='normal'){
 const b=require('./test-sims-child-mount-native.cjs').untitledModal(),raw=r=>r-0x1000+0x200;
 b.writeUInt32LE(0x1a20,raw(0x1904));b.write('GetTickCount\0',raw(0x1a22));
 const at=b.indexOf(Buffer.from([0x83,0xf8,2,0x0f,0x95,0xc0]));assert(at>0);
 // Uncapped CLI Sleep intentionally advances its batch clock. Observe the
 // actual --real-ticks clock instead: the normal fixture must remain alive
 // through independent physical UP, without changing any runtime clock.
 const ms=mode==='early'?0:mode==='live'?5000:500;
 const code=elapsedWait(ms);
 if(mode==='crash')code.push(0x0f,0x0b);
 else code.push(0x6a,mode==='nonzero'?7:0,0xff,0x15,0,0x19,0x40,0,0xcc);
 b.fill(0,at,at+64);b.set(code,at);
 return b;
}
module.exports={fixture,elapsedWait};
async function workerTests(out){
 const {GuestThreadHost}=require('../lib/guest-thread-host'),{createHostImports}=require('../lib/host-imports');
 const module=await WebAssembly.compile(fs.readFileSync(process.env.DELPHI5_MODULE_FD||'build/wine-assembly.wasm'));
 const cases=[];
 for(const mode of ['normal','nonzero','crash','retirement']){
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  let exitCode=null;
  const imports=createHostImports({getMemory:()=>memory.buffer,renderer:null,resourceJson:{},onExit:code=>{exitCode=code;}});imports.host.memory=memory;
  const logs=[],host=new GuestThreadHost({memory,module,hostImports:imports.host,sigs:require('../lib/host-import-sigs.generated.json').sigs,
   workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:5,log:s=>logs.push(s)});
  const call=(n,...args)=>host.callExport(n,...args);let link,observed;
  try{
   await host.start();link=host.link;await host.loadPe(fixture(mode),'normal-exit-worker.exe');
   await call('set_process_id',1000);await call('set_current_thread_id',1);
   await call('set_eip',0x402000);await call('set_esp',0x7408000);await call('guest_write32',0x7408000,0);
   for(let i=0;i<300&&!await call('modal_dialog_hwnd');i++){
    if([1,6,7,15].includes(await call('get_yield_reason')))await call('clear_yield');
    const r=await link.slice(128);assert(!r.trapped,JSON.stringify(r));
   }
   const h=await call('modal_dialog_hwnd');assert(h);
   assert.equal(await call('wnd_lookup_live',h),1);
   if(mode==='retirement'){
    await call('wnd_lookup_retire',h);assert.equal(await call('wnd_lookup_live',h),0);
    observed={retired:true,normalExit:false};
   }else{
    await call('modal_cancel_if_hwnd',h);
    // Advance real host time for the guest Sleep, never rewrite its clocks.
    const due=Date.now()+4000;
    while(Date.now()<due){
     const y=await call('get_yield_reason');
     if(exitCode!==null){observed={normalExit:mode==='normal',exitCode};break;}
     if([1,6,7,15].includes(y))await call('clear_yield');
     const r=await link.slice(128);
     if(r.trapped){observed={normalExit:false,trapped:r.trapped};break;}
     await new Promise(r=>setTimeout(r,5));
    }
    assert(observed,'Worker exit deadline');
    if(mode==='normal')assert.equal(observed.exitCode,0);
    if(mode==='nonzero')assert.equal(observed.exitCode,7);
    if(mode==='crash')assert(observed.trapped);
   }
   assert(logs.some(s=>s.includes('instantiated')));
   cases.push({mode,actualCPUWorker:true,hwnd:h,...observed});
  }finally{await host.stop();}
  assert(link._stopped);cases.at(-1).workerStopJoined=true;
 }
 fs.writeFileSync(path.join(out,'worker-results.json'),JSON.stringify({passed:true,cases},null,2)+'\n');
}
if(require.main===module){
 const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
 if(process.argv[3]==='--generate')for(const mode of ['normal','nonzero','crash','early','live'])fs.writeFileSync(path.join(out,mode+'.exe'),fixture(mode),{flag:'wx'});
 else workerTests(out).catch(e=>{console.error(e);process.exitCode=1;});
}
