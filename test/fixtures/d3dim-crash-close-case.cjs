'use strict';
// Runs inside an actual browser page. The 2x2 producer fixture publishes real
// CLEAR/READBACK/PRESENT records and one malformed opcode. Production Worker,
// decoder and native software executor own all responses and pixel output.
// CLOSE/STOP acknowledgements retire endpoints, not the browser Worker itself.
module.exports=async function browserCase(region){
 const check=(v,m)=>{if(!v)throw Error(m);};const GS=globalThis.GpuStream,D=globalThis.GpuStreamDoorbell;
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const module=await WebAssembly.compile(await(await fetch('/fixture.wasm')).arrayBuffer());
 const sigs=await(await fetch('/lib/host-import-sigs.generated.json')).json();
 const worker=new Worker('/lib/d3d-render-worker.js'),messages=[],errors=[];
 worker.onmessage=e=>messages.push(e.data);worker.onerror=e=>errors.push(e.message);
 const wait=async(fn,label)=>{const end=Date.now()+5000;while(!fn()){check(!errors.length,errors.join(','));check(Date.now()<end,'UNKNOWN '+label);await new Promise(r=>setTimeout(r,2));}};
 const post=m=>worker.postMessage(m),frames=()=>messages.filter(m=>m.message?.t==='frame').map(m=>m.message.frame);
 const make=()=>GpuFixture.makeProducer({buffer:memory.buffer,headerAddr:region+0x200000,ringData:region+0x201000,ringBytes:0x4000,arenaData:region+0x208000,arenaBytes:0x4000});
 let request=0;const kick=(p)=>{const id=++request;post({t:'render-message',endpointId:7,transportId:'request-'+id,message:{t:'render-request',requestId:id,message:{t:'gps-kick',ring:p.header,mode:GS.CONST.KICK_ASYNC}}});return id;};
 const reply=async id=>{await wait(()=>messages.some(m=>m.message?.requestId===id),'reply');return messages.find(m=>m.message?.requestId===id).message;};
 const open=async()=>{const n=messages.length;post({t:'render-open',endpointId:7,options:{api:'d3dim-gps',backend:'software'}});await wait(()=>messages.slice(n).some(m=>m.message?.t==='ready'),'open');};
 const setup=p=>{p.emit('CREATE',{id:1,kind:GS.KIND.RT,fmt:GS.FMT.A8B8G8R8,levels:1,width:2,height:2});p.emit('TARGETS',{color:1});};
 const paint=(p,stamp)=>{p.emit('CLEAR',{mask:1,colormask:15,rgba:0xff332211,z:1,right:2,bottom:2});const dst=p.arenaAlloc(32);p.arenaView(dst,32).fill(0x77);p.emit('READBACK',{rt:1,fmt:GS.FMT.A8B8G8R8,w:2,h:2,pitch:12,dst});const seq=p.emit('PRESENT',{rt:1,w:2,h:2,surface:73,stamp});return {dst,seq};};
 const pixels=(p,v,stamp)=>{const expected=[17,34,51,255,17,34,51,255,119,119,119,119,17,34,51,255,17,34,51,255,119,119,119,119,...Array(8).fill(119)];check(JSON.stringify([...p.arenaView(v.dst,32)])===JSON.stringify(expected),'native readback/pitch/canary');const f=frames().find(f=>f.stamp===stamp);check(f?.api==='d3dim-gps','production frame');check(JSON.stringify([...f.pixels])===JSON.stringify(Array(4).fill([17,34,51,255]).flat()),'frame pixels');};
 try{
  post({t:'render-init',module,memory,sigs:sigs.sigs,imageBase:0x400000});await wait(()=>messages.some(m=>m.t==='render-ready'),'init');await open();let p=make();setup(p);check(!(await reply(kick(p))).error,'setup');
  const first=paint(p,501),bad=p.emitRaw(0xffff,new Uint8Array(0)),tail=paint(p,502),tailBefore=[...p.arenaView(tail.dst,32)];
  check(p.load('read_pos')!==p.load('write_pos'),'real pending records before request');
  const id=kick(p);post({t:'render-close',endpointId:7});
  const failed=await reply(id);check(/unknown op 65535/.test(failed.error),'actual production decoder failure');await wait(()=>messages.some(m=>m.t==='render-closed'),'queued CLOSE ACK');
  pixels(p,first,501);check(p.load('error_seq')===bad&&p.load('error_code')===GS.ERR.UNKNOWN_OP,'shared native failure identity');check(p.load('done_seq')===first.seq,'failure stops at last completed record');check(JSON.stringify([...p.arenaView(tail.dst,32)])===JSON.stringify(tailBefore),'no readback beyond crash');check(!D.armed(p.i32,p.header),'crash/CLOSE detach');
  const closed=messages.findIndex(m=>m.t==='render-closed');check(messages.findIndex(m=>m.message?.frame?.stamp===501)<closed,'frame before CLOSE');
  D.ring(p.i32,p.header);post({t:'render-message',endpointId:7,transportId:'after-close',message:{t:'render-request',requestId:999,message:{t:'gps-kick',ring:p.header,mode:1}}});await wait(()=>messages.some(m=>m.t==='render-done'&&m.transportId==='after-close'),'post CLOSE barrier');check(frames().length===1,'no late crash frame');check(JSON.stringify([...p.arenaView(tail.dst,32)])===JSON.stringify(tailBefore),'post CLOSE trailing readback untouched');
  check(messages.slice(closed+1).some(m=>m.message?.t==='error'&&/missing render endpoint/.test(m.message.error)),'post CLOSE endpoint refused');
  await open();p=make();setup(p);check(!(await reply(kick(p))).error,'replacement setup');const next=paint(p,503),work=kick(p);post({t:'render-stop'});check(!(await reply(work)).error,'replacement work');await wait(()=>messages.some(m=>m.t==='render-stopped'),'STOP ACK');pixels(p,next,503);check(!D.armed(p.i32,p.header),'STOP detach');
  const stopped=messages.findIndex(m=>m.t==='render-stopped');D.ring(p.i32,p.header);post({t:'render-message',endpointId:7,transportId:'after-stop',message:{}});await wait(()=>messages.some(m=>m.t==='render-done'&&m.transportId==='after-stop'),'post STOP barrier');check(frames().length===2&&!messages.slice(stopped+1).some(m=>m.message?.t==='frame'),'no post STOP frames');check(errors.length===0,'no uncaught browser Worker failure');
  check(messages.slice(stopped+1).some(m=>m.message?.t==='error'&&/shared render worker not available/.test(m.message.error)),'post STOP endpoint refused');
  check(messages.filter(m=>m.t==='error'||m.message?.t==='error').length===2,'only expected refused endpoint errors');
  return {pass:true,backend:'software',realBrowserWorker:true,pendingBeforeCrash:true,badSeq:bad,errorCode:GS.ERR.UNKNOWN_OP,firstDone:first.seq,frameStamps:frames().map(f=>f.stamp),queuedClose:true,replacementSameId:true,queuedStop:true,readbackPitchAndCanaries:true,postCloseAndStopBarriers:true,workerErrors:errors,messages:messages.map(m=>({...m,message:m.message?.t==='frame'?{t:'frame',stamp:m.message.frame.stamp,api:m.message.frame.api}:m.message}))};
 }finally{worker.terminate();globalThis.__authoredWorkerTerminated=true;}
};
