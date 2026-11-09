'use strict';
// Exercise the production GuestThreadHost -> WorkerLink -> NodeWorker path.
// The retained native fixtures remain authored loaders, not gameplay evidence.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {GuestThreadHost}=require('../lib/guest-thread-host');
const {hash}=require('./quake2-owning-load-witness.cjs');
const ROOT=path.resolve(__dirname,'..');

class RuntimeWorker extends EventEmitter {
  postMessage(message) {
    const seq=message.seq;
    const execute=async()=>{
      if(message.t==='init'&&!this.host) {
        this.host=new GuestThreadHost({...message,
          workerUrl:path.join(ROOT,'lib/guest-worker.js'),clockIntervalMs:0,tickMs:()=>0,
          hostImports:new Proxy({}, {get:(_,name)=>()=>{
            if(String(name).startsWith('beep_'))return 0;
            throw Error('unexpected runtime fixture import '+String(name));
          }}),
        });
        await this.host.start();
        this.link=this.host.link;
        return {t:'ready',seq};
      }
      const response=message.t==='quake2LoadObservation'
        ? await this.host.readQuake2LoadObservation() : await this.link._ask(message);
      return {...response,seq};
    };
    execute().then(result=>this.emit('message',result),error=>
      this.emit('message',{t:'error',seq,error:String(error.stack||error)}));
  }
  get threadId(){return this.link?.worker?.threadId??-1;}
  terminate(){
    return this.stopPromise??=(async()=>{
      const worker=this.link?.worker;
      assert(worker&&worker.threadId!==-1,'capture actual Worker exit before production stop');
      const exited=new Promise(resolve=>worker.once('exit',resolve));
      await this.host.stop();
      const code=await exited;
      assert.equal(worker.threadId,-1,'production stop awaited actual NodeWorker exit');
      return this.terminationCode=code;
    })();
  }
}
module.exports={RuntimeWorker};

async function startup(options) {
  const host=new GuestThreadHost({module:await WebAssembly.compile(fs.readFileSync('build/wine-assembly.wasm')),
    memory:new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),
    sigs:require('../lib/host-import-sigs.generated.json').sigs,
    hostImports:new Proxy({}, {get:()=>()=>0}),workerUrl:path.join(ROOT,'lib/guest-worker.js'),
    clockIntervalMs:0,tickMs:()=>0,...options});
  let worker;
  try {
    await host.start();worker=host.link.worker;
    return (await host.readQuake2LoadObservation()).observation;
  } finally {
    await host.stop();assert(!worker||worker.threadId===-1);
  }
}

function fixtures() {
  const Module=require('node:module'),file=path.join(__dirname,'quake2-native-write-epoch.test.cjs');
  let script=fs.readFileSync(file,'utf8');
  assert.equal(hash(script),'d061ab49150a52f9af603ae20763d2fb53ef9fa18f14c55475a59a344004d4cf');
  script=script.slice(0,script.lastIndexOf('(async()=>{'));
  const marker="script=script.replace(marker,additions+'\\n'+marker);";
  assert.equal(script.split(marker).length,2,'exact retained fixture composition');
  const addition='\nreplace('+JSON.stringify("const w=new Worker(path.join(ROOT,'lib/guest-worker.js'));")+','+
    JSON.stringify("const w=new (require('./quake2-runtime-integration.test.cjs').RuntimeWorker)();")+');\n';
  script=script.replace(marker,marker+'\nscript=script.replace(marker,'+JSON.stringify(addition)+"+'\\n'+marker);");
  script+='\nmodule.exports=m.exports;';
  const m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(script,file);
  return m.exports;
}

async function main() {
  const enabled=await startup({quake2LoadObservation:true,quake2NativeWriteObservation:true});
  assert(enabled,'actual GuestThreadHost dropped quake2LoadObservation before owning Worker init');
  assert(enabled.nativeStores,'actual GuestThreadHost dropped quake2NativeWriteObservation');
  assert.equal(enabled.nativeStores.status,'NOT_ARMED');
  if(process.argv.includes('--startup')) {
    console.log(JSON.stringify({pass:true,enabled}));return;
  }
  assert.equal(await startup({}),null,'default off');
  assert.equal(await startup({quake2LoadObservation:'true',quake2NativeWriteObservation:true}),null,'strict opt-in');
  assert.equal(await startup({quake2NativeWriteObservation:true}),null,'load observer separately opt-in');
  const pointOnly=await startup({quake2LoadObservation:true});
  assert(pointOnly&&!pointOnly.nativeStores,'native store observation separately opt-in');
  const f=fixtures(),results=[];
  for(const scenario of ['free','nativeSameModel','nativeRestoreModel','nativeSameTable','nativeRestoreTable','traceGap']) {
    const off=await f.fixture(false,scenario),on=await f.fixture(true,scenario);
    assert.deepEqual(on.state,off.state,scenario+' architecture and lazy flags');
    assert.equal(on.guestHash,off.guestHash,scenario+' declared direct guest regions');
    assert.equal(on.sourceMemoryHash,off.sourceMemoryHash,scenario+' sparse source bytes');
    assert(on.lifecycle.terminationAwaited&&off.lifecycle.terminationAwaited);
    results.push({scenario,off,on});
  }
  console.log(JSON.stringify({pass:true,cpuSHA:hash(fs.readFileSync('build/wine-assembly.wasm')),
    hostSHA:hash(fs.readFileSync(path.join(ROOT,'lib/guest-thread-host.js'))),
    witnessSHA:hash(fs.readFileSync(path.join(__dirname,'quake2-owning-load-witness.cjs'))),
    testSHA:hash(fs.readFileSync(__filename)),results}));
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
