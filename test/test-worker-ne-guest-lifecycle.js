'use strict';
// Real production guest-worker.js, shared module and broker. The page owns no
// executable instance: EXE -> PE DllMain -> legacy NE lifecycle.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {GuestThreadHost} = require('../lib/guest-thread-host');
const {createHostImports} = require('../lib/host-imports');
const {neGuestCaller} = require('./helpers/ne-guest-caller');
const {neLifecycleImage} = require('./helpers/ne-lifecycle-image');
// Parallel DLL lifecycle row ABI, as defined in dll-loader.js.
const DLL_LIFE = {STATE:0,PINS:12,INITIALIZING:1,LIVE:2};
const R = require('../lib/region-map.generated');

function loadCaller(base, dll, name) {
  const f = neGuestCaller(base, {dll, calls:[]});
  const u32 = n => [n&255,n>>>8&255,n>>>16&255,n>>>24];
  f.bytes.write(name+'\0', 0x2840-0x1000+0x200);
  f.bytes.set([0x68,...u32(base+0x2840),0xff,0x15,...u32(base+0x1904),
    0xa3,...u32(f.result),0xb8,1,0,0,0,...(dll?[0xc2,12,0]:[0xc3])],0x1200);
  return f;
}

async function runCase(module, memory, mode) {
  const imports = createHostImports({getMemory:()=>memory.buffer,renderer:null,resourceJson:{}});
  imports.host.memory = memory;
  // The fixture VFS contains the PE images exposed by findDll below.
  imports.host.has_dll_file = () => 1;
  const exe = mode==='direct' ? neGuestCaller() : loadCaller(0x400000,false,'C:\\Outlaws\\OUTER.DLL');
  const files = new Map([['demo.dll',neLifecycleImage({moduleUsage:true})]]);
  if(mode==='missing')files.delete('demo.dll');
  if(mode==='malformed')files.set('demo.dll',new Uint8Array(4));
  if(mode==='init-trap')files.set('demo.dll',neLifecycleImage({trapInit:true}));
  if(mode==='wep-trap')files.set('demo.dll',neLifecycleImage({trapWep:true}));
  if(mode==='dependency'||mode==='missing-import') {
    files.set('demo.dll',neLifecycleImage({importEntry:{module:'HELPER',symbol:mode==='dependency'?'VALUE':'ABSENT'}}));
    files.set('helper.dll',neLifecycleImage());
  }
  let lookupStarted, releaseLookup;
  const started=new Promise(resolve=>lookupStarted=resolve);
  const ready=new Promise(resolve=>releaseLookup=resolve);
  const lookups = [], mapped = [];
  const host = new GuestThreadHost({memory,module,hostImports:imports.host,
    sigs:require('../lib/host-import-sigs.generated.json').sigs,
    workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0,
    findDll:async(file,full)=>{
      lookups.push([file,full]);
      if(file==='demo.dll'&&(mode==='cancel'||mode==='parked')) {lookupStarted();await ready;}
      return files.get(file.toLowerCase())||null;
    },
    onDllMapped:record=>mapped.push(record),log:console.log});
  try {
    await host.start();
    await host.loadPe(exe.bytes,'caller.exe');
    const outer = neGuestCaller(await host.callExport('get_next_dll_addr'),{dll:true});
    files.set('outer.dll',outer.bytes);
    const stack=0x7408000;
    await host.callExport('set_esp',stack);
    await host.callExport('guest_write32',stack,0);
    await host.callExport('set_eip',exe.entry);
    if(mode==='direct') {
      for(let i=0;i<30;i++) {
        const r=await host.link.slice(1000);
        assert.equal(r.trapped||null,null);
        assert.notEqual(r.yield,18,'ordinary slices service NE on their owning Worker');
        if(!r.eip)break;
        assert(i<29,'bounded direct NE caller');
      }
      const handle=await host.callExport('guest_read32',exe.result);
      assert(handle>=32);
      assert.equal(await host.callExport('guest_read32',exe.result+4),handle);
      assert(await host.callExport('guest_read32',exe.result+8));
      assert.equal(await host.callExport('get_esp'),stack+4);
      console.log('PASS actual Worker ordinary slices service NE without borrowing page exports');
      return;
    }
    const first=await host.link.slice(1000);
    assert.equal(first.yield,5,JSON.stringify(first));
    const before=await host.callExport('get_esp');
    const lifeBase=await host.callExport('get_dll_lifecycle_table');
    const gateBase=await host.callExport('get_dll_callback_lock');
    const owner=await host.callExport('get_dll_callback_owner');
    const view=new DataView(memory.buffer);
    const field=n=>view.getUint32(lifeBase+n,true);
    const service=host.serviceDllYield();
    // Attach rejection handlers before intentionally retiring the endpoint.
    const failure=service.then(()=>null,error=>error);
    if(mode==='cancel'||mode==='parked') {
      await started;
      assert.equal(field(DLL_LIFE.STATE),DLL_LIFE.INITIALIZING);
      assert(field(DLL_LIFE.PINS)>0);
      assert.equal(Atomics.load(new Int32Array(memory.buffer,gateBase,2),0),owner,'original callback owner holds the process gate across source I/O');
      let exported=false;
      const queued=host.callExport('get_eip').then(()=>exported=true,()=>{});
      await new Promise(resolve=>setTimeout(resolve,10));
      assert.equal(exported,false,'unrelated commands cannot borrow parked callback context');
      if(mode==='cancel') {
        const link=host.link;
        await host.stop();
        releaseLookup();
        await queued;
        assert(await failure,'cancelled service never acknowledges completion');
        const receipt=link._loaderRetirementReceipt;
        assert.equal(receipt.endpointIdentity,link.endpointIdentity);
        assert.equal(receipt.dllCallbacksRetired,true);
        assert.equal(receipt.callbackGenerators,receipt.callbackUnwinds);
        assert.equal(field(DLL_LIFE.STATE),4,'cancelled image remains failed and quarantined');
        assert(field(DLL_LIFE.PINS)>0);
        console.log('PASS actual Worker cancellation joins callback owner and retains initializer quarantine');
        return;
      }
      releaseLookup();await queued;
    }
    const error=await failure;
    if(['init-trap','wep-trap','missing-import'].includes(mode)) {
      assert(error,'initializer failure must propagate');
      assert.equal(error.outcome.completed,false);
      assert.notEqual(field(DLL_LIFE.STATE),DLL_LIFE.LIVE);
      assert(field(DLL_LIFE.PINS)>0,'failed image remains pinned for quarantine');
      if(mode==='missing-import')assert.match(JSON.stringify(error),/Missing NE import HELPER.ABSENT/);
      // A failed WEP retains its native module and reference; failure before
      // LibEntry completion rolls back instead. Inspect the process-owned table.
      const arena=view.getUint32(R.BASE.WIN16_PROCESS_ARENA,true);
      const wa=await host.callExport('guest_to_wasm',arena);
      const rows=Array.from({length:24},(_,i)=>view.getUint32(wa+943*65536+0x8c00+i*32,true));
      assert.equal(rows.filter(Boolean).length,mode==='wep-trap'?1:0);
      console.log('PASS actual Worker '+mode+' propagates failure and preserves quarantine/NE ownership');
      return;
    }
    if(error)throw error;
    assert.equal(await host.callExport('get_esp'),before,'nested initialization preserves the parked PE caller stack');
    for(let i=0;i<20;i++) {
      const r=await host.link.slice(1000);
      assert.equal(r.trapped||null,null);
      if(!r.eip)break;
      assert(i<19,'bounded return');
    }
    const read=p=>host.callExport('guest_read32',p);
    assert(await read(exe.result),'outer initializer completed before publication');
    // Loader placement is authoritative; fixture RVAs survive relocation.
    const outerMap=mapped.find(r=>r.fileName.toLowerCase().endsWith('outer.dll'));
    assert(outerMap);
    const result=outerMap.result.loadAddr+0x2700;
    const handle=await read(result);
    if(mode==='missing'||mode==='malformed')assert.equal(handle,mode==='missing'?2:11);
    else assert(handle>=32&&handle<=65535);
    assert.equal(await read(result+4),handle,'ready module retained');
    if(mode==='missing'||mode==='malformed')assert.equal(await read(result+8),0);
    else assert(await read(result+8),'named export resolved');
    assert.equal(await read(result+8),await read(result+12),'ordinal matches named export');
    assert.equal(await read(result+16),0,'missing export stays missing');
    const arena=new DataView(memory.buffer).getUint32(R.BASE.WIN16_PROCESS_ARENA,true);
    if(arena) {
      const wa=await host.callExport('guest_to_wasm',arena),view=new DataView(memory.buffer);
      for(let i=0;i<24;i++)assert.equal(view.getUint32(wa+943*65536+0x8c00+i*32,true),0,'final free completes WEP and releases all native module ownership');
    }
    assert.equal(await host.callExport('get_esp'),stack+4,'nested callbacks restore the original caller stack');
    assert(lookups.some(([name])=>name==='demo.dll'),'NE sources cross production Worker lookup protocol');
    if(mode==='dependency')assert(lookups.some(([name])=>name==='helper.dll'));
    console.log('PASS actual production Worker '+mode+' nested PE initializer -> NE load/retain/GPA/free/WEP and caller restoration');
  } finally { await host.stop(); }
}
async function main() {
  const module=await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM||'build/wine-assembly.wasm'));
  for(const mode of ['success','direct','parked','dependency','missing','malformed','init-trap','missing-import','wep-trap','cancel'])
    await runCase(module,new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),mode);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
