'use strict';
// Explicit prebuilt module only. Main and nested PE callbacks execute actual
// IAT -> GetModuleHandle -> EAT -> native JMP -> NE lifecycle transactions.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createHostImports}=require('../lib/host-imports');
const {serviceLoadLibraryYieldSync,handleLoadLibraryYield,findVfsDllBytes}=require('../lib/process-boot');
const {loadDll,patchDllImports,callDllMain,finishDllInitialization}=require('../lib/dll-loader');
const {neGuestCaller}=require('./helpers/ne-guest-caller');
const {neLifecycleImage}=require('./helpers/ne-lifecycle-image');
const R=require('../lib/region-map.generated');
const {ThreadManager}=require('../lib/thread-manager');
const {invokeNeEntrySync}=require('../lib/ne-invoke');

async function main() {
  assert(process.env.WA_TEST_WASM,'explicit prebuilt module required');
  const module=await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM));
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  let vfs;
  const imports=createHostImports({getMemory:()=>memory.buffer,renderer:null,resourceJson:{},get vfs(){return vfs;}});
  imports.host.memory=memory;
  const raw=(await WebAssembly.instantiate(module,imports)).exports;
  const bytes=new Uint8Array(memory.buffer),view=new DataView(memory.buffer),wa=p=>raw.guest_to_wasm(p)>>>0;
  const read=p=>view.getUint32(wa(p),true),write=(p,v)=>view.setUint32(wa(p),v,true);
  let finished=0,events=[],removeAfterFirst=false,verifyGpa=false,gpaExecutions=0;
  let e={...raw,win16_bridge_module_release_finish(id){finished++;return raw.win16_bridge_module_release_finish(id);}};
  let stack=0x7408000;
  const records=()=>{
    const arena=view.getUint32(R.BASE.WIN16_PROCESS_ARENA,true);
    if(!arena)return [];
    const hidden=wa(arena)+943*65536;
    return Array.from({length:24},(_,i)=>({state:view.getUint32(hidden+0x8c00+i*32,true),refs:view.getUint32(hidden+0x8c08+i*32,true)})).filter(r=>r.state);
  };
  const service=()=>{
    const serial=e.win16_guest_request_token(),op=e.win16_guest_request_field(serial,0);
    const handle=e.win16_guest_request_field(serial,1)>>>0;
    const beforeEsp=e.get_esp()>>>0;
    assert(serviceLoadLibraryYieldSync({exports:e,memoryBuffer:memory.buffer,
      findDllSync:(file,full)=>findVfsDllBytes(vfs,file,full),neInvokeOptions:{maxBlocks:10000,sliceBlocks:256}}));
    assert.equal(e.get_esp()>>>0,beforeEsp+(op===3?12:8));
    assert.equal(e.win16_guest_request_settle(serial,99),0,'duplicate settlement rejected');
    if(verifyGpa&&op===3&&e.get_eax()) {
      // Execute the exact far pointer returned to the PE caller through the
      // owned NE invocation ABI. This is not a Quick Thunk transition.
      const target=e.get_eax()>>>0,frame=e.win16_bridge_frame_begin();assert(frame);
      try {
        assert(e.win16_bridge_scope_begin(frame));
        const id=e.win16_bridge_module_resolve(handle),ds=e.win16_bridge_module_data(id);
        assert.equal(invokeNeEntrySync(e,{target,ds,instance:ds||id,heap:0,module:id})&0xffff,2);
        gpaExecutions++;
      } finally {assert(e.win16_bridge_frame_end(frame));}
    }
    events.push({op,records:records()});return true;
  };
  function boot(fixture,source=neLifecycleImage({moduleUsage:true})) {
    bytes.set(fixture.bytes,e.get_staging());assert.equal(e.load_pe(fixture.bytes.length)>>>0,fixture.entry);
    // Each case replaces code at the same VA in this retained interpreter.
    e.invalidate_code_range(fixture.entry,0x1000);
    stack=0x7408000;
    if(process.argv.includes('--sparse')) {
      const mapped=e.guest_stack_alloc(65536)>>>0;assert(mapped);
      stack=mapped+65520;
      assert.notEqual(wa(stack),(stack-0x400000+e.get_guest_base())>>>0,'actual sparse stack');
    }
    e.set_eip(fixture.entry);e.set_esp(stack);write(stack,0);
    vfs={files:new Map([['c:\\outlaws\\demo.dll',{data:source}]]),_resolvePath:p=>p.toLowerCase()};
    finished=0;events=[];
  }
  function run() {
    for(let i=0;i<1000;i++) {
      e.run(1000);
      if(e.get_yield_reason()===18) {
        service();
        if(removeAfterFirst&&events.length===1)vfs.files.clear();
      }
      else assert.equal(e.get_yield_reason(),0,'only lifecycle host requests supported');
      if(!e.get_eip())return;
    }
    throw new Error('PE lifecycle caller exceeded bounded slices');
  }
  const fixture=neGuestCaller();boot(fixture);removeAfterFirst=true;verifyGpa=true;run();removeAfterFirst=false;verifyGpa=false;
  assert.equal(gpaExecutions,2);
  assert.equal(e.get_esp()>>>0,stack+4);
  const handle=read(fixture.result);assert(handle>=32&&handle<=65535);
  assert.equal(read(fixture.result+4),handle);assert(read(fixture.result+8));
  assert.equal(read(fixture.result+8),read(fixture.result+12));assert.equal(read(fixture.result+16),0);
  assert.equal(read(fixture.result+20),0,'void FreeLibrary preserves prior EAX');
  assert.equal(read(fixture.result+24),0,'duplicate free also preserves EAX');
  assert.deepEqual(events.map(x=>x.records[0]?.refs||0),[1,2,2,2,2,1,0]);
  assert.equal(finished,1,'real WEP returned before one final unload');assert.deepEqual(records(),[]);

  // Real DLL image, mapped and imported normally. Its initializer issues the
  // same lifecycle calls while callDllMain holds the PE callback gate.
  vfs.files.set('c:\\outlaws\\demo.dll',{data:neLifecycleImage({moduleUsage:true})});
  const dll=neGuestCaller(e.get_next_dll_addr()>>>0,{dll:true});
  const mapped=loadDll(e,memory.buffer,dll.bytes,'C:\\Outlaws\\CALLER.DLL');
  assert.equal(mapped.loadAddr,dll.entry-0x2000,'fixture preferred placement');
  patchDllImports(e,memory.buffer,[{name:'CALLER.DLL',bytes:dll.bytes}],[mapped]);
  const outcome=callDllMain(e,mapped.loadAddr,mapped.dllMain,null,{requireCompletion:true,strictReturn:true,onLoadLibraryYield:service});
  assert(outcome.completed);finishDllInitialization(e,memory.buffer,mapped,outcome);
  assert.equal(read(dll.result),read(dll.result+4));assert.equal(read(dll.result+8),read(dll.result+12));
  assert.equal(finished,2);assert.deepEqual(records(),[]);

  const mainExports=e,secondary=await WebAssembly.instantiate(module,imports);
  secondary.exports.init_thread(1,e.get_image_base(),e.get_code_start(),e.get_code_end(),e.get_thunk_base(),e.get_thunk_end(),e.get_num_thunks(),0);
  const manager=new ThreadManager(module,memory,{exports:raw},()=>imports,{}),thread={instance:secondary,state:'active',tid:1};
  manager.threads=new Map([[123,thread]]);manager._runningThreadHandle=0;
  e=manager.cooperativeCallbackExports(thread);
  const threadStack=(raw.guest_stack_alloc(65536)>>>0)+65520;
  write(threadStack,0);e.set_esp(threadStack);e.set_eip(fixture.entry);run();
  assert.equal(e.get_esp()>>>0,threadStack+4);assert.equal(manager._runningThreadHandle,0);
  assert.equal(read(fixture.result),read(fixture.result+4));assert.deepEqual(records(),[]);
  // The same secondary instance now runs through the actual scheduler path.
  e.set_esp(threadStack);e.set_eip(fixture.entry);write(threadStack,0);
  let scheduledServices=0;
  manager._serviceDllYield=facade=>{scheduledServices++;return serviceLoadLibraryYieldSync({
    exports:facade,memoryBuffer:memory.buffer,findDllSync:(file,full)=>findVfsDllBytes(vfs,file,full)});};
  for(let i=0;i<100&&secondary.exports.get_eip();i++)manager.runSlice(1000,{quantumSteps:1000});
  assert.equal(secondary.exports.get_eip(),0);assert.equal(scheduledServices,14,'thread attach DllMain plus thread body lifecycle');
  assert.deepEqual(records(),[]);assert.equal(manager._runningThreadHandle,0);
  thread.state='exited';assert.throws(()=>e.get_eip(),/retired/);
  e=mainExports;

  const imported=neGuestCaller(0x400000,{ordinalImports:true});boot(imported);run();
  assert.equal(read(imported.result),read(imported.result+4));assert(read(imported.result+8));
  assert.equal(read(imported.result+8),read(imported.result+12));assert.equal(finished,1);

  // A live dependency remains authoritative after its VFS source disappears.
  const parent=neGuestCaller(0x400000,{path:'C:\\Outlaws\\HELPER.DLL',calls:[
    [35,[0x402840]],[35,[0x4029c0]],[36,[{result:1}]],[36,[{result:0}]]
  ]});
  parent.bytes.write('C:\\Outlaws\\PARENT.DLL\0',0x29c0-0x1000+0x200);
  boot(parent);vfs.files.clear();
  vfs.files.set('c:\\outlaws\\helper.dll',{data:neLifecycleImage()});
  vfs.files.set('c:\\outlaws\\parent.dll',{data:neLifecycleImage({importEntry:{module:'HELPER',symbol:'VALUE'}})});
  e.run(1000);assert.equal(e.get_yield_reason(),18);service();
  vfs.files.delete('c:\\outlaws\\helper.dll');run();
  assert(read(parent.result)>=32);assert(read(parent.result+4)>=32);
  assert.deepEqual(events[1].records.map(r=>r.refs),[2,1]);
  assert.deepEqual(events[2].records.map(r=>r.refs),[1]);
  assert.deepEqual(records(),[]);assert.equal(finished,2);

  boot(parent);vfs.files.clear();
  vfs.files.set('c:\\outlaws\\helper.dll',{data:neLifecycleImage()});
  vfs.files.set('c:\\outlaws\\parent.dll',{data:neLifecycleImage({importEntry:{module:'HELPER',symbol:'ABSENT'}})});
  e.run(1000);service();vfs.files.delete('c:\\outlaws\\helper.dll');
  assert.throws(run,/Missing NE import HELPER.ABSENT/);
  assert.deepEqual(records(),[{state:3,refs:1}],'failed parent preserves live dependency ownership');
  require('../lib/ne-lifecycle').createNeLifecycle(e,{buffer:memory.buffer},[]).releaseGuest(read(parent.result));
  assert.deepEqual(records(),[]);

  // Production dynamic PE loader callback, including asynchronous outer lookup
  // and the synchronous VFS lookup required by its nested NE transaction.
  const dynamic=neGuestCaller(0x400000,{calls:[]});
  dynamic.bytes.set([0x68,0x40,0x28,0x40,0,0xff,0x15,4,0x19,0x40,0,0xa3,0,0x27,0x40,0,0xc3],0x1200);
  dynamic.bytes.write('C:\\Outlaws\\DYNAMIC.DLL\0',0x2840-0x1000+0x200);
  boot(dynamic);
  const nested=neGuestCaller(e.get_next_dll_addr()>>>0,{dll:true});
  vfs.files.set('c:\\outlaws\\dynamic.dll',{data:nested.bytes});
  e.run(1000);assert.equal(e.get_yield_reason(),5);
  // The nested NE request is serviced through the same awaitable resolver as
  // the outer PE load (owned asynchronous preflight), never a synchronous
  // lookup that a fetching host could only answer with a Promise.
  const asyncLookups=[];let syncLookups=0;
  await handleLoadLibraryYield({exports:e,memoryBuffer:memory.buffer,
    findDll:async(file,full)=>{asyncLookups.push(file);return findVfsDllBytes(vfs,file,full);},
    findDllSync:(file,full)=>{syncLookups++;return findVfsDllBytes(vfs,file,full);}});
  run();assert(read(dynamic.result));
  assert.equal(syncLookups,0);assert(asyncLookups.length>1,'outer PE and nested NE lookups: '+asyncLookups);
  assert.equal(read(nested.result),read(nested.result+4));
  assert(read(nested.result+8));assert.equal(finished,1);assert.deepEqual(records(),[]);

  const invalid=neGuestCaller(0x400000,{calls:[[37,[0,2]],[36,[0]],[37,[handle,2]],[36,[handle]]]});
  boot(invalid);run();
  for(let i=0;i<4;i++)assert.equal(read(invalid.result+i*4),0,'invalid/stale aliases never resolve or fabricate success');
  assert.deepEqual(records(),[]);

  for(const [name,source,code] of [['missing',null,2],['malformed',new Uint8Array(4),11]]) {
    const f=neGuestCaller(0x400000,{calls:[[35,[0x402840]]]});boot(f,source);
    if(!source)vfs.files.clear();run();assert.equal(read(f.result),code,name);assert.deepEqual(records(),[]);
  }
  const zero=neGuestCaller(0x400000,{calls:[[35,[0x402840]]]});boot(zero,neLifecycleImage({result:0}));
  assert.throws(run,/AX zero/);assert.equal(e.get_yield_reason(),18);assert.deepEqual(records(),[]);
  const oldToken=e.win16_guest_request_token();
  const unresolved=neGuestCaller(0x400000,{calls:[[35,[0x402840]]]});
  boot(unresolved,neLifecycleImage({importEntry:{module:'HELPER',symbol:'ABSENT'}}));
  assert.equal(e.win16_guest_request_settle(oldToken,123),0,'process reset invalidates pending request');
  vfs.files.set('c:\\outlaws\\helper.dll',{data:neLifecycleImage()});
  assert.throws(run,/Missing NE import/);assert.equal(e.get_yield_reason(),18);assert.deepEqual(records(),[]);
  const badWep=neGuestCaller(0x400000,{calls:[[35,[0x402840]],[36,[{result:0}]]]});
  boot(badWep,neLifecycleImage({trapWep:true}));
  let failure;try{run();}catch(error){failure=error;}
  assert(failure?.neRecovery);assert.deepEqual(records(),[{state:4,refs:1}]);assert.equal(finished,0);
  const retainedId=failure.neRecovery.modules[0],frame=e.win16_bridge_frame_begin();assert(frame);
  const target=e.win16_bridge_module_termination(retainedId,0),codeBase=e.win16_seg_base(target>>>19);
  bytes.set([0xb8,1,0,0xca,2,0],wa(codeBase+(target&65535)));
  e.invalidate_code_range(codeBase+(target&65535),6);assert(e.win16_bridge_frame_end(frame));
  failure.neRecovery.retry(retainedId);assert.deepEqual(records(),[]);assert.equal(finished,1);
  const pending=e.win16_guest_request_token(),savedEsp=e.get_esp();
  e.set_esp(savedEsp+4);assert.equal(e.win16_guest_request_settle(pending,0),0,'changed frame cannot settle');
  e.set_esp(savedEsp);e.win16_guest_request_cancel();assert.equal(e.win16_guest_request_settle(pending,0),0);
  const trap=neGuestCaller(0x400000,{calls:[[35,[0x402840]]]});boot(trap,neLifecycleImage({trapInit:true}));
  assert.throws(run);assert.equal(e.get_yield_reason(),18,'trap never resumes suspended PE caller');
  assert.deepEqual(records(),[],'initializer failure rolls back');
  e.win16_guest_request_cancel();
  console.log('PASS actual PE imports/EAT lifecycle, duplicate refs, named/ordinal GPA, WEP, nested DllMain and load-failure cleanup');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
