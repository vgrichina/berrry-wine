'use strict';
// Authored native USER/GL load diagnostic. It cannot certify that an
// unrecorded original frame has the same command mix or scheduling cost.
const assert=require('node:assert/strict');
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
function installPagePhases(root,Wine){
  const p=Wine.prototype,imports=p.getImports;
  p.getImports=function(...args){
    const result=imports.apply(this,args),g=this._browserNativeInput;
    if(g&&!g.__dequeueObserved){
      g.__dequeueObserved=true;
      for(const name of ['observe','dequeued','validate','consumed','prepare','status']){
        const original=g[name];g[name]=function(...values){
          const at=Date.now(),before=g.snapshot(),answer=original.apply(this,values);
          const after=g.snapshot();
          console.log('GLTRON_DEQUEUE_PHASE',JSON.stringify({role:'page',name,at,end:Date.now(),
            observedBefore:before.observedAt,observedAfter:after.observedAt,
            state:answer?.state,token:typeof answer==='number'?answer:answer?.token,
            fence:answer?.fence,queue:root.__dequeueWine?.renderer.inputQueue.length}));
          return answer;
        };
      }
    }
    root.__dequeueWine=this;return result;
  };
  for(const name of ['observePresentationTransfer','observePresentationPublication']){
    const p=root.Win98Renderer.prototype,original=p[name];
    p[name]=function(...args){const at=Date.now(),start=performance.now();
      try{return original.apply(this,args);}finally{
        const w=root.__dequeueWine,b=w?.hostCtx.getGlGpsBridge?.();
        console.log('GLTRON_DEQUEUE_PHASE',JSON.stringify({role:'page',name,at,end:Date.now(),ms:performance.now()-start,
          presents:b?.presenter.presents,stats:b?.device?.stats}));
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
if(require.main===module&&process.argv[2]==='run')run(process.argv[3],process.argv[4],process.argv[5],Number(process.argv[6])).catch(e=>{console.error(e);process.exitCode=1;});
else if(require.main===module){
  const test=require('node:test'),vm=require('node:vm');
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
