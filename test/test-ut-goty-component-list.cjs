'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {bootRenderHarness}=require('./render-helper');
const {observe,qualified}=require('../lib/cli-native-common-controls');
async function run(out,modulePath,old=false){
 fs.mkdirSync(out,{recursive:true});
 const module=new WebAssembly.Module(fs.readFileSync(modulePath));
 const pe=fs.readFileSync(require('../tools/ut-goty-listbox-wizard.cjs').prepare(path.join(out,'fixture'),{components:true}));
 const results=[];
 for(const worker of [false,true]){
  const h=await bootRenderHarness({prebuiltModule:module}),e=h.exports,memory=h.memory;
  let host,call=(n,...a)=>e[n](...a),slice=async()=>e.run(256);
  new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));
  e.set_process_id(1000);e.set_current_thread_id(1);
  if(worker){
   const ctx=h.hostCtx;
   const imports=require('../lib/host-imports').createHostImports(ctx).host;imports.memory=memory;
   host=new (require('../lib/guest-thread-host').GuestThreadHost)({memory,module,hostImports:imports,
    sigs:require('../lib/host-import-sigs.generated.json').sigs,workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0});
   await host.start();await host.loadPe(pe,'component-list.exe');call=(n,...a)=>host.callExport(n,...a);
   slice=async()=>{const r=await host.link.slice(256);assert(!r.trapped,JSON.stringify(r));};
  }
  try{
   await call('set_process_id',1000);await call('set_current_thread_id',1);await call('set_esp',0x7408000);await call('guest_write32',0x7408000,0);
   let list=0,parent=0;
   for(let n=0;n<500;n++){
    if([1,6,7,15].includes(await call('get_yield_reason')))await call('clear_yield');
    await slice();
    for(let i=0;i<256;i++){const k=e.wnd_slot_hwnd(i);if(k&&e.ctrl_get_class(k)===4){list=k;parent=e.wnd_get_parent(k);}}
    if(list&&e.listbox_get_count(list)===4&&e.wnd_get_userdata_export(parent)===15)break;
   }
   assert(list);assert.equal(e.wnd_get_style_export(list)>>>0,0x52a00121);
   assert(e.wnd_get_proc_export(list)>0&&e.wnd_get_proc_export(list)<0xfffe0000,'actual guest subclass');
   assert.equal(e.wnd_get_userdata_export(parent),15,'real guest WM_DRAWITEM received all four exact DWORDs');
   h.renderer.repaint();
   fs.writeFileSync(path.join(out,worker?'worker.png':'native.png'),h.canvas.toBuffer('image/png'));
   const generation=String(e.wnd_lookup_generation(list)),get=()=>observe(e,list,memory,generation);
   const before=Buffer.from(new Uint8Array(memory.buffer)),s=get();
   assert.deepEqual(Buffer.from(new Uint8Array(memory.buffer)),before,'read only: no callback, allocation or memory write');
   const row={hwnd:'0x'+list.toString(16),generation,live:true,processId:1000,threadId:1,
    controlClass:4,style:0x52a00121,parent:'0x'+parent.toString(16),commonControl:s};
   if(old){assert.equal(s.available,false);assert(!qualified(row));}
   else{
    assert.equal(s.available,true);assert(qualified(row));
    assert.deepEqual(s.state.items.map(v=>v.data),[0,0xffffffff,0x12345678,7]);
    assert.equal(s.state.textAvailable,false);assert.equal(s.state.paintOwner,'guest-subclass');
    assert.equal(e.native_listbox_get(list,0),-1,'string getter still refuses opaque items');
    assert.equal(e.native_listbox_item_data(list,4),-1n);assert.equal(e.native_listbox_item_data(list,-1),-1n);
    for(const change of [{style:0x50000000},{parent:'0x999'},{generation:'999'},
      {commonControl:{...s,state:{...s.state,procedure:'0xffff0001'}}},
      {commonControl:{...s,state:{...s.state,rowPaintOwner:{...s.state.rowPaintOwner,procedure:'0x0'}}}},
      {commonControl:{...s,state:{...s.state,items:s.state.items.map(v=>({...v,text:'invented'}))}}},
      {commonControl:{...s,state:{...s.state,items:s.state.items.map(v=>({...v,checked:true}))}}}])
      assert(!qualified({...row,...change}),'reject changed identity, unsupported callback, fabricated labels/checks');
    assert.throws(()=>observe(e,list,memory,'wrong'));
    // A changing getter must fail the paired retained-state read.
    let flips=0;const unstable={...e,native_listbox_item_data:(...a)=>e.native_listbox_item_data(...a)+(BigInt(flips++>=4))};
    assert.equal(observe(unstable,list,memory,generation).available,false);
    const {REGIONS}=require('../lib/region-map.generated'),u=new DataView(memory.buffer);
    let record=0;
    for(let i=0;i<256;i++){const a=REGIONS.WND_RECORDS.base+i*24;if(u.getUint32(a,true)===list){record=a;break;}}
    assert(record);
    const state=u.getUint32(record+20,true),procedure=u.getUint32(record+4,true);
    u.setUint32(record+20,0,true);assert.equal(get().available,false,'missing state refused');u.setUint32(record+20,state,true);
    for(const sentinel of [0,0xffff0001,0xffff0004]){
     u.setUint32(record+4,sentinel,true);assert.equal(get().available,false,'unsupported dispatch refused');
    }
    u.setUint32(record+4,procedure,true);
    const changingProcedure={...e,native_listbox_item_data:(...a)=>{const v=e.native_listbox_item_data(...a);u.setUint32(record+4,procedure+1,true);return v;}};
    assert.throws(()=>observe(changingProcedure,list,memory,generation),'callback replaced during observation');
    u.setUint32(record+4,procedure,true);
   }
   await call('wnd_destroy_tree',parent);
   assert.equal(e.wnd_lookup_live(list),0);assert.equal(get(),null,'retired list never revives');
   results.push({worker,old,exactDataDrawMask:15,observation:s,retired:true});
  }finally{if(host)await host.stop();}
 }
 fs.writeFileSync(path.join(out,'component-proof.json'),JSON.stringify({passed:true,results},null,2)+'\n');
 console.log('PASS '+(old?'old refusal':'opaque retained storage and guest owner drawing')+' native+normal CPUWorker');
}
if(require.main===module)run(path.resolve(process.argv[2]),process.argv[3]||'build/wine-assembly.wasm',process.argv[4]==='old').catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
