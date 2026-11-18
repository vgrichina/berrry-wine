'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const progress=require('../lib/cli-native-progress');
async function run(out,modulePath,old=false){
 fs.mkdirSync(out,{recursive:true});
 const bytes=fs.readFileSync(modulePath),module=new WebAssembly.Module(bytes);
 const pe=fs.readFileSync(require('../tools/ut-goty-progress-dialog.cjs').prepare(out+'/fixture')),results=[];
 for(const worker of [false,true]){
  const h=await require('./render-helper').bootRenderHarness({prebuiltModule:module}),e=h.exports,memory=h.memory;
  let host,call=(n,...a)=>e[n](...a),slice=async()=>e.run(256);
  new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));e.set_process_id(1000);e.set_current_thread_id(1);
  if(worker){const imports=require('../lib/host-imports').createHostImports(h.hostCtx).host;imports.memory=memory;
   host=new(require('../lib/guest-thread-host').GuestThreadHost)({memory,module,hostImports:imports,sigs:require('../lib/host-import-sigs.generated.json').sigs,workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0});
   await host.start();await host.loadPe(pe,'progress-dialog.exe');call=(n,...a)=>host.callExport(n,...a);slice=async()=>{const r=await host.link.slice(256);assert(!r.trapped,JSON.stringify(r));};}
  try{
   await call('set_process_id',1000);await call('set_current_thread_id',1);await call('set_esp',0x7408000);await call('guest_write32',0x7408000,0);
   let bar=0,parent=0;
   for(let n=0;n<800;n++){if([1,6,7,15].includes(await call('get_yield_reason')))await call('clear_yield');await slice();
    for(let i=0;i<256;i++){const k=e.wnd_slot_hwnd(i);if(k&&e.ctrl_get_class(k)===17){bar=k;parent=e.wnd_get_parent(k);}}
    if(bar&&e.wnd_get_userdata_export(parent)>0&&[7,15].includes(await call('get_yield_reason')))break;}
   assert(bar);assert(e.wnd_get_userdata_export(parent)>0,'guest subclass naturally received WM_PAINT');
   const {REGIONS}=require('../lib/region-map.generated'),view=new DataView(memory.buffer);let record=0;
   for(let i=0;i<256;i++){const a=REGIONS.WND_RECORDS.base+i*24;if(view.getUint32(a,true)===bar){record=a;break;}}assert(record);
   const state=view.getUint32(record+20,true),proc=e.wnd_get_proc_export(bar)>>>0,generation=String(e.wnd_lookup_generation(bar));
   const sw=state-e.get_image_base()+e.get_guest_base();
   const diag={bar,parent,generation,live:e.wnd_lookup_live(bar),style:e.wnd_get_style_export(bar)>>>0,procedure:proc,state,values:[0,4,8,12].map(o=>view.getInt32(sw+o,true)),legacyAvailability:e.native_progress_get(bar,0),paintCount:e.wnd_get_userdata_export(parent)};
   assert.deepEqual(diag.values,[7,913,318,10]);assert(proc>0&&proc<0xfffe0000);assert.equal(diag.legacyAvailability,0);
   const get=()=>progress.observe(e,bar,generation),before=Buffer.from(new Uint8Array(memory.buffer)),s=get();
   assert(before.equals(Buffer.from(new Uint8Array(memory.buffer))),'read-only storage observation');
   const row={hwnd:'0x'+bar.toString(16),generation,live:true,processId:1000,threadId:1,controlClass:17,style:diag.style,parent:'0x'+parent.toString(16),progress:s};
   if(old){assert.equal(s.available,false);assert(!progress.qualified(row));}
   else{
    assert(s.available);assert(progress.qualified(row));assert.equal(s.paintOwner,'guest-subclass');assert.deepEqual([s.min,s.max,s.pos,s.step],diag.values);
    assert.throws(()=>progress.observe(e,bar,'wrong'),/generation|identity/);
    for(const change of [{parent:'0x999'},{generation:'99'},{style:0},{threadId:99},{processId:99}])assert(!progress.qualified({...row,...change}));
    view.setUint32(record+20,0,true);assert.equal(get().available,false);assert.equal(get().diagnostic.status,-4);view.setUint32(record+20,state,true);
    for(const p of [0,0xffff0001,0xffff0004]){view.setUint32(record+4,p,true);assert.equal(get().available,false);}view.setUint32(record+4,proc,true);
    view.setInt32(sw+8,914,true);assert(!progress.qualified({...row,progress:get()}));
    const refused={...row,progress:get()},failure=require('../lib/cli-native-scene').captureFailures({windows:[refused]},true);
    assert(failure.controls.includes('control.progressUnavailable'));assert.equal(failure.controlDetails[0].progressDiagnostic.pos,914);
    assert.equal(failure.controlDetails[0].progressDiagnostic.rangeValid,false);view.setInt32(sw+8,318,true);
    view.setInt32(sw+4,6,true);assert(!progress.qualified({...row,progress:get()}));view.setInt32(sw+4,913,true);
    let reads=0;assert.throws(()=>progress.observe({...e,native_progress_storage_get:(...a)=>{const v=e.native_progress_storage_get(...a);if(++reads===2)view.setUint32(record+4,proc+1,true);return v;}},bar,generation),/identity|retired/);view.setUint32(record+4,proc,true);
    const parentGeneration=String(e.wnd_lookup_generation(parent));await call('wnd_lookup_retire',parent);assert.equal(get().available,false,'retired owner refused');assert(parentGeneration!=='0');
   }
   h.renderer.flushRepaint();fs.writeFileSync(out+'/'+(worker?'worker':'native')+'.png',h.canvas.toBuffer('image/png'));
   await call('wnd_destroy_tree',parent);assert.equal(e.wnd_lookup_live(bar),0);assert.equal(get(),null);
   results.push({worker,old,diag,observation:s,destroyed:true});
  }finally{if(host)await host.stop();if(h.renderer._caretBlinkTimer)clearTimeout(h.renderer._caretBlinkTimer);}
 }
 fs.writeFileSync(out+'/proof.json',JSON.stringify({passed:true,moduleSHA256:require('node:crypto').createHash('sha256').update(bytes).digest('hex'),results},null,2));
 console.log('PASS '+(old?'old subclass predicate refusal':'retained progress storage, identity/range/state/subclass/owner negatives')+' native+CPUWorker');
}
if(require.main===module)run(path.resolve(process.argv[2]),process.argv[3]||'build/wine-assembly.wasm',process.argv[4]==='old').catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
