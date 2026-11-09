'use strict';
// Browser test adapter only. Observation replies and native execution come
// exclusively from the unmodified production guest-worker.js in a real Worker.
async function install({fixtureSource,originalSource}) {
  const assert=(value,message)=>{if(!value)throw Error(message||'assertion failed');};
  assert.equal=(a,b,m)=>assert(Object.is(a,b),(m||'equal')+': '+a+' !== '+b);
  assert.notEqual=(a,b,m)=>assert(!Object.is(a,b),m||'notEqual');
  assert.deepEqual=(a,b,m)=>assert(JSON.stringify(a)===JSON.stringify(b),m||'deepEqual');
  class Bytes extends Uint8Array {
    static from(v){return new Bytes(typeof v==='string'?new TextEncoder().encode(v):v);}
    static alloc(n){return new Bytes(n);}
    static concat(v){const b=new Bytes(v.reduce((n,x)=>n+x.length,0));let at=0;for(const x of v){b.set(x,at);at+=x.length;}return b;}
    view(){return new DataView(this.buffer,this.byteOffset,this.byteLength);}
    readUInt32LE(at=0){return this.view().getUint32(at,true);}
    readInt32LE(at=0){return this.view().getInt32(at,true);}
    readFloatLE(at=0){return this.view().getFloat32(at,true);}
    writeUInt32LE(v,at=0){this.view().setUint32(at,v,true);}
    writeInt32LE(v,at=0){this.view().setInt32(at,v,true);}
    writeFloatLE(v,at=0){this.view().setFloat32(at,v,true);}
  }
  const Buffer=Bytes,hash=Quake2OwningLoadCore.hash;
  const ROOT='',path={join:()=>'/lib/guest-worker.js?v=browser-owning-0031'};
  const require=name=>{
    if(name==='../lib/guest-rpc')return GuestRpc;
    if(name==='../lib/region-map.generated')return RegionMap;
    throw Error('unexpected browser fixture dependency '+name);
  };
  const sourceRequests=[];
  async function bytes(url,pin) {
    sourceRequests.push(url);
    const r=await fetch(url);assert(r.ok,'canonical test media HTTP');
    const b=new Bytes(await r.arrayBuffer());
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
    assert.equal(digest,pin,'canonical test media identity');return b;
  }
  const root='/test/binaries/candidates/quake-2-demo-installer/installed-extracted/Install/Data/';
  const exe=peLib.readPE(await bytes(root+'quake2.exe',Quake2OwningLoadCore.EXE_SHA));
  const pak=await bytes(root+'baseq2/pak0.pak','cae257182f34d3913f3d663e1d7cf865d668feda6af393d4ecf3e9e408b48d09');
  let bsp;
  for(let at=pak.readUInt32LE(4);at<pak.readUInt32LE(4)+pak.readUInt32LE(8);at+=64)
    if(new TextDecoder().decode(pak.subarray(at,at+56)).split('\0')[0]==='maps/demo1.bsp')
      bsp=pak.subarray(pak.readUInt32LE(at+56),pak.readUInt32LE(at+56)+pak.readUInt32LE(at+60));
  assert.equal(hash(bsp),'ee13d2e5448d990ced8ca7b0595722518c5221feab68d5a07e2a291391da6457');
  const cpu=await bytes('/build/wine-assembly.wasm',Quake2BrowserLoadObserver.CPU_SHA);
  const sigs=(await (await fetch('/lib/host-import-sigs.generated.json')).json()).sigs;
  const u32=n=>{const b=Bytes.alloc(4);b.writeUInt32LE(n>>>0);return [...b];};
  const original=originalSource;
  class Worker {
    constructor(url){this.worker=new globalThis.Worker(url);}
    on(kind,fn){this.worker.addEventListener(kind,e=>fn(kind==='message'?e.data:e.error||Error(e.message)));}
    postMessage(m){this.worker.postMessage(m);}
    async terminate(){this.worker.terminate();}
  }
  class RuntimeWorker {
    constructor(){this.listeners=new Map();}
    on(kind,fn){this.listeners.set(kind,fn);}
    postMessage(message) {
      const execute=async()=>{
        if(message.t==='init'&&!this.host) {
          this.host=new GuestThreadHost({...message,workerUrl:path.join(),clockIntervalMs:0,tickMs:()=>0,
            hostImports:new Proxy({}, {get:(_,name)=>()=>{
              if(String(name).startsWith('beep_'))return 0;
              throw Error('unexpected browser runtime import '+String(name));
            }})});
          await this.host.start();this.link=this.host.link;return {t:'ready'};
        }
        return message.t==='quake2LoadObservation'?this.host.readQuake2LoadObservation():this.link._ask(message);
      };
      execute().then(r=>this.listeners.get('message')?.({...r,seq:message.seq}),
        error=>this.listeners.get('message')?.({t:'error',seq:message.seq,error:String(error.stack||error)}));
    }
    async terminate(){await this.host.stop();}
  }
  const fixture=eval('('+fixtureSource+')');
  // Reinit has a separate ready protocol; use direct production Worker
  // transport for that one lifecycle control, as the accepted fixture does.
  const runtimeFixture=eval('('+fixtureSource.replace("const w=new Worker(path.join(ROOT,'lib/guest-worker.js'));",
    'const w=new RuntimeWorker();')+')');
  globalThis.runOwningFixture=async(enabled,scenario)=>({...await (scenario==='ownerReplacement'?fixture:runtimeFixture)(enabled,scenario),
    transport:scenario==='ownerReplacement'?'direct browser Worker reinit':'production browser GuestThreadHost/WorkerLink'});
  globalThis.owningFixtureSources=sourceRequests;
}
module.exports={install};
