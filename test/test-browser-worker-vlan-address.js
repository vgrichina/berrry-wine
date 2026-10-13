'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(require('path').join(__dirname,'../host.js'),'utf8');
async function scenario({worker=true,joined=true,fail=false}) {
  let shadowIp=0x0a000001,workerIp=0x0a000001,workerCalls=0;
  class Manager {
    constructor(){this.inherited=new Map();}
    recordInheritedWasmGlobal(k,...v){this.inherited.set(k,v);}
    setWasmGlobalAll(k,...v){this.recordInheritedWasmGlobal(k,...v);}
  }
  const context={window:{},console:{...console,warn(){}},setTimeout,clearTimeout,ThreadManager:Manager,
    WebAssembly:{Memory:class{constructor(){this.buffer=new ArrayBuffer(65536);}},
      Module:{customSections:()=>[]},
      instantiate:async()=>({exports:{set_vlan_local_ip:v=>{shadowIp=v>>>0;}}})}};
  vm.runInNewContext(source+'\n;globalThis.WineAssembly=WineAssembly;',context);
  const Wine=context.WineAssembly;
  Wine.getWasmModule=async()=>({});
  const w=new Wine();
  w.apiTable=[];
  w.ensureUiFontsReady=async()=>{};
  w.getImports=()=>({host:{}});
  w.loadFiles=async()=>{};
  w.loadSubstituteFonts=async()=>{};
  w._schedArm=()=>false;
  w._maybeStartGuestWorker=async()=>{
    if(worker) w.guestWorker={callExport:async(name,v)=>{
      if(name!=='set_vlan_local_ip') return;
      workerCalls++;
      await new Promise(resolve=>setTimeout(resolve,0));
      if(fail) throw Error('worker address rejected');
      workerIp=v>>>0;
    }};
  };
  if(joined) w.joinVlan({tag:'client-loopback'},'10.0.0.2');
  if(fail){await assert.rejects(w.init(null),/worker address rejected/);return;}
  await w.init(null);
  const expected=joined?0x0a000002:0x0a000001;
  assert.equal(shadowIp,expected,'page mirror configured');
  if(worker) assert.equal(workerIp,expected,'actual main Worker must receive selected client IP before guest starts');
  assert.equal(workerCalls,worker&&joined?1:0,'one acknowledged main-worker setter when joined');
  assert.deepEqual(Array.from(w.threadManager.inherited.get('set_vlan_local_ip')||[]),joined?[expected]:[],
    'new auxiliary workers inherit the process address; unjoined default stays untouched');
}
(async()=>{
  await scenario({});
  await scenario({worker:false});
  await scenario({joined:false});
  await scenario({fail:true});
  console.log('PASS actual init: joined main-worker acknowledgment, auxiliary inheritance, cooperative/default modes and setter failure');
})().catch(e=>{console.error(e);process.exitCode=1;});
