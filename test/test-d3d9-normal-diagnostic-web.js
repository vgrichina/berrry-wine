#!/usr/bin/env node
'use strict';
// Exercise the production manager, receiver and actual WebGL executor on its
// owning Worker. Only failing normal state is retained, never packet media.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=process.cwd(),puppeteer=require(root+'/node_modules/puppeteer');
const {startStaticServer,closeServer}=require(root+'/test/static-server');
(async()=>{
 const server=await startStaticServer({root,crossOriginIsolated:true});let browser;
 const evidence=process.env.D3D9_DIAGNOSTIC_RUN;
 const save=(name,data)=>{if(evidence)fs.writeFileSync(path.join(evidence,name),JSON.stringify(data,null,2)+'\n');};
 try{
  browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/opt/google/chrome/chrome',defaultViewport:null,
   args:['--no-sandbox','--no-first-run','--no-default-browser-check','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  save('diagnostic-test-process.json',{pid:process.pid,childPid:browser.process().pid,port:server.address().port,
   endpoint:browser.wsEndpoint(),profile:browser.process().spawnargs.find(a=>a.startsWith('--user-data-dir='))?.slice(16)});
  const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/index.html?debug`);
  for(const name of ['render-worker','d3d-command-stream'])await page.addScriptTag({url:'/lib/'+name+'.js'});
  const result=await page.evaluate(async()=>{
   let checks=0;const check=(ok,label)=>{checks++;if(!ok)throw Error(label);};
   const module=await WebAssembly.compile(await (await fetch('/build/wine-assembly.wasm')).arrayBuffer());
   const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
   const sigs=(await (await fetch('/lib/host-import-sigs.generated.json')).json()).sigs,host={memory};
   for(const [name,sig] of Object.entries(sigs))host[name]=sig.results?.length?()=>0:()=>{};
   const e=(await WebAssembly.instantiate(module,{host})).exports;e.d3dim_worker_init(0x400000);
   const manager=new RenderWorker.Manager({module,memory,sigs,imageBase:0x400000,sourceVersion:'normal-diagnostic-control',
    reclaimHeap:head=>e.d3d_render_adopt_free_list(head)});
   const S=D3DCommandStream,OP=S.OPCODES;
   const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
   function draw(scale=1){
    const vertices=new Uint8Array(3*24),v=new DataView(vertices.buffer);
    [[-1,1],[1,1],[-1,-1]].forEach(([x,y],i)=>{[x,y,.5,0,0,1].forEach((n,k)=>v.setFloat32(i*24+k*4,n,true));});
    const world=identity();world[0]=scale;world[12]=.125;
    return {primitive:4,primitiveCount:1,stride:24,vertices,textures:[],
     attributes:[{register:0,usage:0,usageIndex:0,type:2,offset:0},{register:1,usage:3,usageIndex:0,type:2,offset:12}],
     state:{cull:1,zenable:false},fixedFunction:{world,view:identity(),projection:identity(),
      lighting:true,normalizeNormals:true,localViewer:false,specular:false,fog:false,
      material:{diffuse:new Float32Array([1,1,1,1]),ambient:new Float32Array([1,1,1,1]),emissive:new Float32Array([0,0,0,0])},
      lights:[],stages:[{colorOp:2,colorArg1:0,alphaOp:2,alphaArg1:0,texCoordIndex:0,transformFlags:0}]}};
   }
   let port;
   try{
    port=manager.createEndpoint({api:'neutral',backend:'webgl'});await port.ready;
    const consumer=new S.WorkerConsumer(port);
    const queue=(id,generation=1)=>new S.CommandQueue({deviceId:id,generation,consumer});
    const issue=async(q,op,p)=>{const r=q.submit(op,p);try{await q.fence(r.sequence,r.generation);return {receipt:r};}catch(error){return {receipt:r,error};}};
    const create=q=>issue(q,OP.RESOURCE_CREATE,{kind:'device',backend:'webgl',width:8,height:8});
    const q=queue(71);check(!(await create(q)).error,'create');
    check(!(await issue(q,OP.DRAW,draw(2))).error,'preceding healthy draw');
    const bad=draw(0),receipt=q.submit(OP.DRAW,bad),before=JSON.stringify({world:Array.from(bad.fixedFunction.world),attributes:bad.attributes});
    bad.fixedFunction.world.fill(9);bad.fixedFunction.view.fill(8);bad.attributes[1].usage=5;
    let error;try{await q.fence(receipt.sequence,receipt.generation);}catch(value){error=value;}
    check(error?.message==='D3D9 fixed function: singular normal transform','strict original failure');
    const d=error.drawDiagnostic;check(d&&d.version===1,'retained diagnostic');
    check(d.endpointId===port.id&&d.command.deviceId===71&&d.command.sequence===3&&d.command.generation===1&&d.command.opcode===OP.DRAW,'exact failing descriptor');
    check(d.world.values[0]===0&&d.world.values[12]===.125&&d.view.values[0]===1,'failing matrices, no stale healthy/caller state');
    check(d.world.bits[12]===0x3e000000&&d.attributes[1].usage===3&&d.flags.lighting===true,'matrix bits, NORMAL and lighting');
    check(/normalMatrix/.test(d.executorStack)&&/Device.draw/.test(d.executorStack)&&/d3d9-fixed/.test(d.executorStack),'original executor throw stack');
    check(receipt.status==='failed'&&q.inflight===0&&q.bytes===0&&!q._entries.get(3)?.command,'retirement releases original payload');
    const frozen=value=>!value||typeof value!=='object'||(Object.isFrozen(value)&&Object.values(value).every(frozen));
    check(frozen(d)&&Object.getOwnPropertyDescriptor(error,'drawDiagnostic').writable===false,'deep immutable receiving snapshot');
    const retained=JSON.stringify(d);try{d.world.values[0]=10;}catch(_){}try{error.drawDiagnostic=null;}catch(_){}
    check(JSON.stringify(error.drawDiagnostic)===retained,'readout cannot corrupt evidence');
    check(retained.length<16384&&!retained.includes('vertices')&&!retained.includes('textures'),'bounded passive data only');
    check(q.error===error,'sticky first error retained');
    let stopped=false;try{q.submit(OP.DRAW,draw());}catch(value){stopped=value===error;}check(stopped,'failed queue still fails');
    const other=queue(72);check(!(await create(other)).error,'other device create');check(!(await issue(other,OP.DRAW,draw())).error,'other device unaffected');
    // The receiver must fail a later published draw on the same stream too.
    const later=consumer.execute({version:S.VERSION,deviceId:71,generation:1,sequence:4,opcode:OP.DRAW,payload:draw(),resources:[],byteLength:64});
    let laterError;try{await later.completion;}catch(value){laterError=value;}
    check(/earlier render command failed/.test(laterError?.message)&&!laterError.drawDiagnostic,'later cancellation cannot masquerade as original draw');
    // Releasing/recreating on a fresh namespace lets the generation exercise
    // adapter generation authority as well as the receiver's fresh stream.
    const fresh=queue(73,2);check(!(await create(fresh)).error,'fresh generation create');check(!(await issue(fresh,OP.DRAW,draw(3))).error,'fresh healthy draw');
    const next=draw(0);next.fixedFunction.world[12]=.75;next.fixedFunction.normalizeNormals=false;
    const again=await issue(fresh,OP.DRAW,next);
    check(again.error?.drawDiagnostic.world.values[12]===.75&&again.error.drawDiagnostic.flags.normalizeNormals===false,'second failure fresh values');
    check(JSON.stringify(d)===retained,'later failure cannot mutate first snapshot');
    // Generated owning control additionally checks the Error before transport,
    // then mutates its private failing command. Original runs use no wrapper.
    const files=['gpu-backend','d3d-shader-ir','d3d9-shader','d3d9-fixed','render-clear',
      'd3d9-backend','d3d-command-stream','d3d-geometry-batches','d3d9-software-backend','d3d9-render-worker'];
    const source=`importScripts(${files.map(f=>JSON.stringify(location.origin+'/lib/'+f+'.js')).join(',')});
      const adapter=D3D9RenderWorker.create({backend:'webgl'});
      const frozen=v=>!v||typeof v!=='object'||(Object.isFrozen(v)&&Object.values(v).every(frozen));
      const receiver=D3DCommandStream.createCommandReceiver({execute(command){
        try{return adapter.execute(command);}catch(error){
          const d=error.drawDiagnostic,before=JSON.stringify(d);
          const immutable=frozen(d)&&Object.getOwnPropertyDescriptor(error,'drawDiagnostic').writable===false;
          command.payload.fixedFunction.world.fill(17);
          try{d.world.values[0]=99;}catch(_){}
          postMessage({ownerProof:{immutable,unchanged:JSON.stringify(d)===before,diagnostic:d}});throw error;
        }
      }},m=>postMessage(m));onmessage=e=>receiver(e.data);postMessage({ready:true});`;
    const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),worker=new Worker(url);
    let ready,proof;const readyPromise=new Promise(r=>ready=r),proofPromise=new Promise(r=>proof=r);
    worker.addEventListener('message',ev=>{if(ev.data.ready)ready();if(ev.data.ownerProof)proof(ev.data.ownerProof);});
    const bounded=p=>Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(Error('generated owner deadline')),15000))]);
    try{
      await bounded(readyPromise);
      const c=new S.WorkerConsumer(worker),g=new S.CommandQueue({deviceId:81,generation:1,consumer:c});
      // A raw generated Worker has no ready handshake managed by a port.
      c.initialized=true;
      check(!(await create(g)).error,'generated owner create');
      const failed=await issue(g,OP.DRAW,draw(0)),owner=await bounded(proofPromise);
      check(owner.immutable&&owner.unchanged,'pretransport executor error is deeply frozen and independent of command');
      check(failed.error?.drawDiagnostic.world.values[0]===0,'transport retains original despite owning command mutation');
      return {checks,first:d,second:again.error.drawDiagnostic,ownerProof:owner,before,retired:true,otherDevice:true,strict:true};
    }finally{worker.terminate();URL.revokeObjectURL(url);}
   }finally{if(port)await port.terminate();await manager.stop();}
  });
  save('diagnostic-worker-controls.json',result);
  assert.equal(result.strict,true);console.log('PASS real owning WebGL Worker singular diagnostic: '+result.checks+' controls; freshness, immutable bounded capture, strict failure, retirement and isolation');
 }finally{if(browser)await browser.close();await closeServer(server);}
})().catch(error=>{console.error(error);process.exitCode=1;});
