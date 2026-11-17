'use strict';
// Authored native USER/GL load diagnostic. It cannot certify that an
// unrecorded original frame has the same command mix or scheduling cost.
const assert=require('node:assert/strict');
// Separate bounded original diagnostic. Only public renderer records and the
// existing native-input/import boundary are observed; no guest exports run.
function installOriginalWorkerPhases(root){
  if(root.__originalPhases)throw Error('duplicate phase observer');
  const state=root.__originalPhases={events:0,limit:24000,recordBytes:0,recordLimit:16384,records:0,rows:[],dropped:0,flushed:0};
  // Hot imports only append scalars. Serialization and CDP transport happen
  // from a separate task, never inside a native import or renderer call.
  const log=row=>{state.events++;if(state.events<=state.limit)state.rows.push(row);else state.dropped++;};
  state.flush=()=>{const rows=state.rows;state.rows=[];state.flushed+=rows.length;
    console.log('GLTRON_ORIGINAL_BATCH',JSON.stringify({rows,dropped:state.dropped,events:state.events,flushed:state.flushed,at:Date.now(),recordBytes:state.recordBytes,records:state.records}));};
  if(root.setInterval)root.setInterval(state.flush,1000);
  const wait=root.Atomics?.wait;
  if(wait)root.Atomics.wait=function(...args){const at=Date.now(),start=performance.now();
    try{return wait.apply(this,args);}finally{log({role:'guest',name:'Atomics.wait',edge:'span',at,end:Date.now(),ms:performance.now()-start,index:args[1],expected:args[2],timeout:args[3],call:state.active?.call,import:state.active?.name});}};
  const hook=(name,install)=>{let value=root[name];Object.defineProperty(root,name,{configurable:true,get:()=>value,set(v){value=v;install(v);}});if(value)install(value);};
  hook('GuestRpc',api=>{
    const original=api.createWorkerImports;
    api.createWorkerImports=function(memory,sigs,post,options){
      const slot=options?.slot||0;let active=null,sequence=0;
      const result=original.call(this,memory,sigs,function(message,...rest){
        if(active){active.posted=true;if(active.name==='check_input')log(active.entry);log({role:'guest',edge:'post',at:Date.now(),slot,call:active.call,name:active.name,type:message.t});}
        return post.call(this,message,...rest);
      },options);
      for(const name of ['check_input','input_validate','input_consumed','gpu_stream_kick','gpu_gl_call']){
        const fn=result.imports.host[name];if(!fn)continue;
        result.imports.host[name]=function(...args){
          if(name==='gpu_stream_kick'&&args[1]===0)return fn.apply(this,args);
          const before=active,call=++sequence,at=Date.now(),start=performance.now();active={call,name};state.active=active;
          // Entry is emitted before a blocking native import, so cancellation
          // cannot erase the evidence of a still-running render wait.
          active.entry={role:'guest',edge:'enter',name,slot,call,at,args:args.slice(0,3)};
          if(name!=='check_input')log(active.entry);
          try{const answer=fn.apply(this,args);if(name!=='check_input'||active.posted||answer)log({role:'guest',edge:'return',name,slot,call,at,end:Date.now(),ms:performance.now()-start,answer});return answer;}
          catch(error){log({role:'guest',edge:'throw',name,slot,call,at,end:Date.now(),error:String(error)});throw error;}
          finally{active=before;state.active=before;}
        };
      }return result;
    };
  });
  for(const name of ['GpuStreamSoftware','GpuStreamWebGL'])hook(name,api=>{
    const p=api.Executor.prototype,execute=p.execute;let frame=0,counts={};
    p.execute=function(rec){
      const at=Date.now(),start=performance.now();counts[rec.name]=(counts[rec.name]||0)+1;
      const row={role:'render',name:rec.name,seq:rec.seq,frame,at,fields:{...rec.fields},inputs:[]};
      // Renderer input bytes only, bounded once per run. A cap is explicit;
      // never claim a replayable workload when required inputs are omitted.
      const retained=state.records++<64;
      for(const ref of retained?(rec.refs||[]):[])if(ref.input){
        if(state.recordBytes+ref.len<=state.recordLimit){row.inputs.push({pos:ref.pos,bytes:Array.from(rec.arena(ref.pos,ref.len))});state.recordBytes+=ref.len;}
        else row.inputs.push({pos:ref.pos,length:ref.len,omitted:true});
      }
      if(retained||rec.name==='PRESENT')log({...row,edge:'enter',inputsRetained:retained});
      try{return execute.apply(this,arguments);}finally{
        const ms=performance.now()-start;
        if(retained||ms>=20||rec.name==='PRESENT')log({role:'render',edge:'return',name:rec.name,seq:rec.seq,frame,at,end:Date.now(),ms,width:this.width,height:this.height});
        if(rec.name==='PRESENT'){log({role:'render',edge:'frame',at:Date.now(),frame,counts,recordBytes:state.recordBytes});counts={};frame++;}
      }
    };
  });
}
function installWorkerPhases(root){
  const rows=[];let rpc=root.GuestRpc;
  root.__dequeueWorkerPhases=rows;
  const keep=row=>{rows.push(row);if(rows.length>512)rows.shift();};
  const install=api=>{
    if(api.__dequeueObserved)return;api.__dequeueObserved=true;
    rpc=api;const create=api.createWorkerImports;
    api.createWorkerImports=function(...args){
      const result=create.apply(this,args),h=result.imports.host;
      for(const name of ['check_input','input_validate','input_consumed','gpu_stream_kick','gpu_gl_call']){
        const original=h[name];if(!original)continue;
        h[name]=function(...values){
          const at=Date.now(),start=performance.now();
          try{return original.apply(this,values);}finally{
            const ms=performance.now()-start;
            if(name!=='gpu_gl_call'||ms>=5){
              const row={role:'guest',name,at,end:Date.now(),ms,args:values.slice(0,2)};keep(row);
              if(name==='check_input'||name==='input_consumed'||ms>=20)console.log('GLTRON_DEQUEUE_PHASE',JSON.stringify(row));
            }
          }
        };
      }return result;
    };
  };
  Object.defineProperty(root,'GuestRpc',{configurable:true,get:()=>rpc,set:install});
  if(rpc)install(rpc);
  for(const name of ['GpuStreamSoftware','GpuStreamWebGL']){
    let api=root[name];const install=value=>{
      api=value;const p=value.Executor.prototype;if(p.__dequeueObserved)return;p.__dequeueObserved=true;
      const execute=p.execute;
      p.execute=function(rec){const at=Date.now(),start=performance.now();
        try{return execute.apply(this,arguments);}finally{
          const ms=performance.now()-start;
          if(rec.name==='PRESENT'||ms>=20)console.log('GLTRON_DEQUEUE_PHASE',JSON.stringify({role:'render',name:rec.name,seq:rec.seq,at,end:Date.now(),ms}));
        }
      };
    };
    Object.defineProperty(root,name,{configurable:true,get:()=>api,set:install});if(api)install(api);
  }
}
function installPagePhases(root,Wine,limit=12000){
  let emitted=0,dropped=0;const rows=[];const log=row=>{if(emitted<limit){rows.push(row);emitted++;}else dropped++;};
  const flush=()=>{const batch=rows.splice(0);console.log('GLTRON_ORIGINAL_BATCH',JSON.stringify({rows:batch,events:emitted,dropped,at:Date.now()}));};
  root.__dequeuePageFlush=flush;if(root.setInterval)root.setInterval(flush,1000);
  const p=Wine.prototype,imports=p.getImports;
  p.getImports=function(...args){
    const result=imports.apply(this,args),g=this._browserNativeInput;
    if(g&&!g.__dequeueObserved){
      g.__dequeueObserved=true;
      for(const name of ['observe','dequeued','validate','consumed','prepare','status']){
        const original=g[name];g[name]=function(...values){
          const at=Date.now(),before=g.snapshot(),answer=original.apply(this,values);
          const after=g.snapshot();
          log({role:'page',name,at,end:Date.now(),
            observedBefore:before.observedAt,observedAfter:after.observedAt,
            state:answer?.state,token:typeof answer==='number'?answer:answer?.token,
            fence:answer?.fence,queue:root.__dequeueWine?.renderer.inputQueue.length,slot:after.slot});
          return answer;
        };
      }
      const renderer=this.renderer,down=renderer.handleKeyDown;
      renderer.handleKeyDown=function(...args){
        const at=Date.now(),before=g.snapshot();log({role:'page',name:'physicalDown',edge:'enter',at,code:args[0],observed:before.observedAt,slot:before.slot});
        try{return down.apply(this,args);}finally{const after=g.snapshot();log({role:'page',name:'physicalDown',edge:'return',at,end:Date.now(),observed:after.observedAt,slot:after.slot});}
      };
    }
    root.__dequeueWine=this;return result;
  };
  for(const name of ['observePresentationTransfer','observePresentationPublication']){
    const p=root.Win98Renderer.prototype,original=p[name];
    p[name]=function(...args){const at=Date.now(),start=performance.now();
      try{return original.apply(this,args);}finally{
        const w=root.__dequeueWine,b=w?.hostCtx.getGlGpsBridge?.();
        log({role:'page',name,at,end:Date.now(),ms:performance.now()-start,
          presents:b?.presenter.presents,stats:b?.device?.stats});
      }
    };
  }
}
async function run(out,commit,backend,triangles){
  const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
  const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
  assert(Number.isInteger(triangles)&&triangles>=1&&triangles<=16384);
  const retained=path.join(root,'scratch/runs/20261117-gltron-continuous-capture-release-arm-gameplay/original-software');
  const pin=JSON.parse(fs.readFileSync(retained+'/module.json'));
  const modulePath=fs.realpathSync(retained+'/tested-'+pin.sha256+'.wasm'),wasm=fs.readFileSync(modulePath);
  assert.equal(sha(wasm),pin.sha256);assert.equal(commit,pin.commit);
  const runtime=require('../tools/boids-current-runtime.cjs'),files=runtime.gitFiles(commit);
  const oldSource=JSON.parse(fs.readFileSync(retained+'/source.json'));
  for(const {path:n,sha256}of oldSource.source)if(/^src\//.test(n)||/^tools\/(watx|region|build-compile)/.test(n))assert.equal(sha(files.get(n)),sha256,n);
  runtime.compile=()=>wasm;
  const native=require('../tools/gltron-current-native-capture.cjs'),fixture=native.fixture;
  native.fixture=()=>fixture({drawOnce:true,timerMs:16,triangles,width:800,height:600});
  const controller=require('../tools/gltron-browser-controller.cjs'),connect=controller.connection;
  controller.connection=function(...args){const c=connect.apply(this,args),send=c.send;
    c.send=function(method,params={},session){
      if(method==='Runtime.evaluate'&&params.expression===controller.GL_OBSERVER)
        params={...params,expression:params.expression+';('+installWorkerPhases.toString()+')(globalThis);true'};
      if(method==='Runtime.evaluate'&&params.expression.includes('installNativeRouteObserver'))
        params={...params,expression:params.expression+';('+installPagePhases.toString()+')(globalThis,WineAssembly);true'};
      return send(method,params,session);
    };return c;
  };
  fs.writeFileSync(out+'/workload.json',JSON.stringify({commit,backend,triangles,width:800,height:600,
    timerMs:16,drawOnce:true,realGuestUSER:true,realGuestWorker:true,realRenderWorker:true,
    originalFrameCommandMixMatched:false,observers:'passive import durations; no guest calls, pump, clock or observation timestamp changes',
    retainedModule:{path:modulePath,sha256:pin.sha256,verifiedBeforeExecution:true},
    helperSHA256:sha(fs.readFileSync(__filename))},null,2)+'\n',{flag:'wx'});
  await require('../tools/gltron-current-original.cjs').run(out,commit,true,backend,true);
  const duplicate=out+'/tested-'+pin.sha256+'.wasm';
  assert.equal(sha(fs.readFileSync(duplicate)),pin.sha256);
  fs.unlinkSync(duplicate);fs.linkSync(modulePath,duplicate);
}
async function phaseRun(out,backend,authored){
  const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
  const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
  const commit='60371e9f3bf83f1fbcfab790f1e34977b06e9ec7';
  const previous=path.resolve('scratch/runs/20261117-gltron-native-user-context-dequeue-latency/load8-software');
  const pin=JSON.parse(fs.readFileSync(previous+'/module.json')),source=JSON.parse(fs.readFileSync(previous+'/source.json'));
  const runtime=require('../tools/boids-current-runtime.cjs'),files=runtime.gitFiles(commit);
  for(const row of source.source)if(row.path==='host.js'||/^src\/|^lib\//.test(row.path))assert.equal(sha(files.get(row.path)),row.sha256,row.path);
  const modulePath=fs.realpathSync(previous+'/tested-'+pin.sha256+'.wasm'),wasm=fs.readFileSync(modulePath);assert.equal(sha(wasm),pin.sha256);
  if(process.env.GLTRON_NATIVE_ATTRIBUTION==='1'){
    const localRequire=require('node:module').createRequire(path.resolve('tools/boids-current-runtime.cjs'));
    const namedCompile=new Function('require','fs','path','ROOT','return ('+runtime.compile.toString().replace('{tailCalls:true}',"{tailCalls:true,nameSection:'wine-assembly'}")+')')(localRequire,fs,path,path.resolve('.'));
    const named=namedCompile(files),stripNames=buffer=>{const parts=[buffer.subarray(0,8)];let p=8;const u=()=>{let n=0,shift=0,v;do{v=buffer[p++];n|=(v&127)<<shift;shift+=7;}while(v&128);return n>>>0;};while(p<buffer.length){const at=p,id=buffer[p++],size=u(),end=p+size;let omit=false;if(id===0){const len=u();omit=buffer.subarray(p,p+len).toString()==='name';}if(!omit)parts.push(buffer.subarray(at,end));p=end;}return Buffer.concat(parts);};
    assert.equal(sha(stripNames(named)),sha(stripNames(wasm)),'exact named compile code sections match retained module');
    const sections=WebAssembly.Module.customSections(new WebAssembly.Module(named),'name');assert.equal(sections.length,1);
    fs.writeFileSync(out+'/exact-module-names.bin',Buffer.from(sections[0]),{flag:'wx'});
    fs.writeFileSync(out+'/exact-module-map.json',JSON.stringify({commit,moduleSHA256:pin.sha256,namedCompileSHA256:sha(named),codeSectionsEqual:true,nameSectionSHA256:sha(Buffer.from(sections[0])),compile:'Git-backed in-memory compile; only custom name section removed for comparison; no source archive'})+'\n',{flag:'wx'});
  }
  runtime.compile=()=>wasm;
  const controller=require('../tools/gltron-browser-controller.cjs'),connect=controller.connection;
  const attribution=process.env.GLTRON_NATIVE_ATTRIBUTION==='1';
  if(attribution&&!authored){const q=JSON.parse(fs.readFileSync(process.env.GLTRON_ATTRIBUTION_QUALIFICATION));assert.equal(q.qualified,true);assert.equal(q.moduleSHA256,pin.sha256);}
  controller.connection=function(...args){const c=connect.apply(this,args),send=c.send;
    const sessions=new Map(),profileTasks=new Set();
    const saveProfile=(name,value)=>fs.writeFileSync(out+'/'+name,JSON.stringify(value)+'\n',{flag:'wx'});
    const sample=async(id)=>{const start={wall:Date.now(),monotonic:performance.now()};try{
      await send('Profiler.enable',{},id);await send('Profiler.setSamplingInterval',{interval:5000},id);await send('Profiler.start',{},id);
      sessions.set(id,{start,chunk:0});
    }catch(error){saveProfile('profile-arm-'+id+'.json',{start,error:String(error)});}};
    // Bounded profile chunks preserve worker stacks and actual WASM indices.
    // Sampling describes sampled execution, never OS CPU utilization.
    const timer=attribution?setInterval(()=>{for(const [id,state]of sessions){if(state.busy||c.closed||state.chunk>=180)continue;state.busy=true;
      const task=(async()=>{try{const stopAt=Date.now(),r=await send('Profiler.stop',{},id);
        saveProfile('worker-profile-'+id+'-'+state.chunk+++'.json',{start:state.start,stopRequestedAt:stopAt,end:Date.now(),sessionId:id,moduleSHA256:pin.sha256,profile:r.profile,limitations:'sampling wall time includes blocking and scheduler gaps; not OS CPU utilization'});
        if(!c.closed){state.start={wall:Date.now(),monotonic:performance.now()};await send('Profiler.start',{},id);}
      }catch(error){sessions.delete(id);saveProfile('profile-end-'+id+'.json',{at:Date.now(),error:String(error),terminalWindowMissing:true});}finally{state.busy=false;}})();profileTasks.add(task);task.finally(()=>profileTasks.delete(task));
    }},1000):null;timer?.unref();
    let event=()=>{};Object.defineProperty(c,'event',{configurable:true,set(fn){event=fn;},get(){return v=>{
      if(attribution&&v.method==='Target.attachedToTarget'&&v.params.targetInfo.type==='worker')saveProfile('profile-target-'+v.params.sessionId+'.json',v.params);
      const a=v.params?.args;
      if(v.method==='Runtime.consoleAPICalled'&&a?.[0]?.value==='GLTRON_ORIGINAL_BATCH'){const b=JSON.parse(a[1].value);fs.appendFileSync(out+'/passive-phases.jsonl',b.rows.map(row=>JSON.stringify({sessionId:v.sessionId,...row})).join('\n')+'\n');fs.writeFileSync(out+'/phase-boundary-'+v.sessionId+'.json',JSON.stringify({...b,rows:undefined})+'\n');return;}
      if(v.method==='Runtime.consoleAPICalled'&&['GLTRON_ORIGINAL_PHASE','GLTRON_DEQUEUE_PHASE'].includes(a?.[0]?.value)){
        fs.appendFileSync(out+'/passive-phases.jsonl',JSON.stringify({sessionId:v.sessionId,consoleTimestamp:v.params.timestamp,...JSON.parse(a[1].value)})+'\n');return;
      }event(v);
    };}});
    c.send=function(method,params={},session){
      if(method==='Runtime.evaluate'&&params.expression===controller.GL_OBSERVER)params={...params,expression:params.expression+';('+installOriginalWorkerPhases.toString()+')(globalThis);true'};
      if(method==='Runtime.evaluate'&&params.expression.includes('installNativeRouteObserver'))params={...params,expression:params.expression+';('+installPagePhases.toString()+')(globalThis,WineAssembly);true'};
      if(attribution&&method==='Runtime.runIfWaitingForDebugger')return sample(session).then(()=>send(method,params,session));
      if(method==='Browser.close')clearInterval(timer);
      return send(method,params,session);
    };return c;
  };
  if(authored){const native=require('../tools/gltron-current-native-capture.cjs'),fixture=native.fixture;native.fixture=()=>fixture({drawOnce:true,timerMs:16,triangles:8,width:800,height:600});}
  const observer=fs.readFileSync(__filename),observerCommit=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  if(!authored)assert.equal(sha(cp.execFileSync('git',['show',observerCommit+':test/test-gltron-native-dequeue-workload.cjs'])),sha(observer),'original requires published observer');
  fs.writeFileSync(out+'/diagnostic.json',JSON.stringify({commit,observerCommit,observerSHA256:sha(observer),backend,authored,modulePath,moduleSHA256:pin.sha256,moduleVerifiedBeforeExecution:true,runtimeSourceUnchanged:true,rendererDataOnly:true,recordByteCap:16384,recordCap:64,phaseEventCap:24000,originalInvocations:authored?0:1})+'\n',{flag:'wx'});
  const write=fs.writeFileSync;
  fs.writeFileSync=function(file,bytes,...rest){if(file===out+'/tested-'+pin.sha256+'.wasm'){assert.equal(sha(bytes),pin.sha256);fs.linkSync(modulePath,file);return;}return write.call(this,file,bytes,...rest);};
  try{await require('../tools/gltron-current-original.cjs').run(out,commit,authored,backend,true);}finally{fs.writeFileSync=write;}
  const duplicate=out+'/tested-'+pin.sha256+'.wasm';assert.equal(sha(fs.readFileSync(duplicate)),pin.sha256);fs.unlinkSync(duplicate);fs.linkSync(modulePath,duplicate);
}
if(require.main===module&&process.argv[2]==='phase-run')phaseRun(process.argv[3],process.argv[4],process.argv[5]==='authored').catch(e=>{console.error(e);process.exitCode=1;});
else if(require.main===module&&process.argv[2]==='run')run(process.argv[3],process.argv[4],process.argv[5],Number(process.argv[6])).catch(e=>{console.error(e);process.exitCode=1;});
else if(require.main===module){
  const test=require('node:test'),vm=require('node:vm');
  test('original observer prearms IPC/import and renderer phases without changing native answers',()=>{
    let time=0;const logs=[],error=Error('renderer error'),root={},host={check_input(x){return x+2;},gpu_stream_kick(){throw error;}},postRows=[];
    vm.runInNewContext('('+installOriginalWorkerPhases.toString()+')(root)',{root,Date:{now:()=>++time},performance:{now:()=>++time},console:{log:(tag,row)=>{const b=JSON.parse(row);logs.push(...(b.rows||[b]));}}});
    root.GuestRpc={createWorkerImports(memory,sigs,post){host.check_input=function(x){post({t:'rpc'});return x+2;};return {imports:{host}};}};
    root.GuestRpc.createWorkerImports(null,{},m=>postRows.push(m),{slot:3});assert.equal(host.check_input(5),7);assert.throws(()=>host.gpu_stream_kick(),e=>e===error);
    root.__originalPhases.flush();
    const original={execute(rec){assert.equal(this,original);return rec.seq;}};function Executor(){}Executor.prototype=original;
    root.GpuStreamSoftware={Executor};assert.equal(original.execute({name:'PRESENT',seq:4,fields:{width:800},refs:[]}),4);
    assert.deepEqual(logs.filter(r=>r.name==='check_input').map(r=>r.edge),['enter','post','return']);assert.equal(postRows.length,1);assert(logs.some(r=>r.edge==='throw'));root.__originalPhases.flush();assert(logs.some(r=>r.edge==='frame'));
  });
  test('legacy GL and waits buffer spans, preserve results and expose overflow',()=>{
    let now=0;const batches=[],root={Atomics:{wait(){return 'timed-out';}}};
    vm.runInNewContext('('+installOriginalWorkerPhases.toString()+')(root)',{root,Date:{now:()=>++now},performance:{now:()=>++now},console:{log:(tag,b)=>batches.push(JSON.parse(b))}});
    const host={gpu_gl_call(op,ptr,len){assert.equal(this,host);assert.deepEqual([op,ptr,len],[0x10001,64,80]);return root.Atomics.wait(null,2,1,1000);}};
    root.GuestRpc={createWorkerImports:()=>({imports:{host}})};root.GuestRpc.createWorkerImports(null,null,()=>{},{slot:4});
    assert.equal(host.gpu_gl_call(0x10001,64,80),'timed-out');assert.equal(batches.length,0,'no synchronous import logging');
    root.__originalPhases.flush();const rows=batches[0].rows;assert.equal(rows.find(r=>r.name==='Atomics.wait').import,'gpu_gl_call');assert.deepEqual(Array.from(rows[0].args),[0x10001,64,80]);
    root.__originalPhases.limit=root.__originalPhases.events+1;host.gpu_gl_call(0x10001,64,80);root.__originalPhases.flush();assert.equal(batches[1].rows.length,1);assert.equal(batches[1].dropped,2);
  });
  test('passive Worker spans preserve import receivers, arguments, results and exceptions',()=>{
    let clock=0;const logs=[],error=Error('native refusal'),host={check_input(a){assert.equal(this,host);return a+1;},gpu_stream_kick(){throw error;}};
    const root={};const context={Date:{now:()=>++clock},performance:{now:()=>++clock},console:{log:(...a)=>logs.push(a)}};
    vm.runInNewContext('('+installWorkerPhases.toString()+')(root)',{...context,root});
    root.GuestRpc={createWorkerImports:()=>({imports:{host}})};root.GuestRpc.createWorkerImports();
    assert.equal(host.check_input(7),8);assert.throws(()=>host.gpu_stream_kick(),e=>e===error);
    assert.equal(root.__dequeueWorkerPhases.length,2);assert.equal(logs.length,1);
  });
  test('existing native capture, continuous, parked and delayed recipes keep their published PE bytes',()=>{
    const {fixture}=require('../tools/gltron-current-native-capture.cjs');
    const sha=b=>require('node:crypto').createHash('sha256').update(b).digest('hex');
    for(const [options,publishedSHA]of [
      [{},'a282fde427480359786e060285a52a0cb94517e2df9ab7a40a9b91bb90e43bbf'],
      [{drawOnce:true,timerMs:16},'3157e998f0271d1a66b446a0a2e2efe037f440107f7e7d181c81797e4503f484'],
      [{messageDriven:true,drawOnce:true},'cd686ad6faba5afe64618d182488ca68a233ff42a3437a4cf5ae583eb390eb95'],
      [{drawOnce:true,timerMs:16,firstInputDelay:1800,afterFirstInputDelay:1800},'892ef34f1508fa43ebc680d01dcb726cea16bea37672cc0098402ff6e1cc9021'],
    ])assert.equal(sha(fixture(options)),publishedSHA);
  });
}
module.exports={installWorkerPhases,installPagePhases};
