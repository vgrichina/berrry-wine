'use strict';
// A frozen, Git-backed Warcraft driver. Never loads held working-tree helpers.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const crypto=require('node:crypto'),Module=require('node:module'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const PINS=Object.freeze({
  graph:'34c794d549c4ad71dfe40c1647e4ffd0c7a4f8af',
  capture:'72dc77da08bf2ec6b988badbf85018391de3bd61',
  native:'7bca66241',renderer:'cf1812312',
  module:'10bdae2c56c79eeb5d0b4ebbc602c8a233e36351380da274a70f7f5e25363564',
  moduleBytes:2418815,
});
const POLICY=Object.freeze({sourceMs:30000,reviewMs:15000,freshMs:5000,nativeMs:500,holdMs:1500,commandMs:20000,floor:1500000000});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function git(commit,name){return cp.execFileSync('git',['show',commit+':'+name],{cwd:ROOT,maxBuffer:8*1024*1024});}
// This authored fixture dependency was retained as a qualified untracked input.
// It is not media or a substitute for a Git version of production code.
const INPUTS=Object.freeze({'test/test-gltron-browser-live-input.cjs':'b64e5f260308d68d91be2658aa566bdba19f7aa218854852429c67c69fc478ce'});
function qualifiedSource(commit,name){
  if(!INPUTS[name])return git(commit,name);
  const b=fs.readFileSync(ROOT+'/'+name);assert.equal(sha(b),INPUTS[name],'qualified authored input drift');return b;
}
function qualifiedLoader(commit=PINS.native){
  const cache=new Map(),pins=[];
  function load(name){
    assert(!path.isAbsolute(name)&&!name.split('/').includes('..'),'relative qualified path required');
    if(cache.has(name))return cache.get(name).exports;
    const file=ROOT+'/'+name,b=qualifiedSource(commit,name),m=new Module(file,module);
    pins.push({path:name,commit,sha256:sha(b),bytes:b.length});cache.set(name,m);
    m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));
    const builtin=m.require.bind(m);
    m.require=q=>{
      let rel;
      if(q.startsWith('.'))rel=path.posix.normalize(path.posix.join(path.posix.dirname(name),q));
      else if(q.startsWith(ROOT+'/'))rel=q.slice(ROOT.length+1);
      else return builtin(q);
      if(!path.extname(rel))rel+='.js';return load(rel);
    };
    if(name.endsWith('.json'))m.exports=JSON.parse(b);else m._compile(b.toString(),file);
    return m.exports;
  }
  return {load,pins};
}
function frozenGraph(modulePath){
  const loader=qualifiedLoader(),files=loader.load('tools/boids-current-runtime.cjs').gitFiles(PINS.graph);
  const overlays=['lib/renderer.js','lib/renderer-input.js','lib/guest-rpc.js','lib/browser-native-input.js'];
  for(const p of overlays)files.set(p,git(p==='lib/renderer.js'?PINS.renderer:p==='lib/browser-native-input.js'?PINS.native:PINS.capture,p));
  const bytes=fs.readFileSync(modulePath);
  assert.equal(bytes.length,PINS.moduleBytes);assert.equal(sha(bytes),PINS.module);
  const wasm=new WebAssembly.Module(bytes);
  const required=['capture_publication_word','get_authoritative_capture_hwnd','wnd_lookup_live','wnd_lookup_generation','get_window_thread','get_user_pump_observation'];
  const exports=new Set(WebAssembly.Module.exports(wasm).map(x=>x.name));
  for(const name of required)assert(exports.has(name),'missing native ABI '+name);
  files.set('build/wine-assembly.wasm',bytes);
  const native=loader.load('tools/hexen2-native-consumption-input.cjs');
  files.set('host.js',Buffer.from(files.get('host.js').toString()+native.hostBootstrap()));
  return {files,loader,wasm,native,manifest:{graph:PINS.graph,module:{existingPath:path.relative(ROOT,modulePath),bytes:bytes.length,sha256:sha(bytes)},
    files:[...files].map(([name,b])=>({path:name,bytes:b.length,sha256:sha(b)})),imports:WebAssembly.Module.imports(wasm),required}};
}
// This runs inside the page. Only reads completed production observations;
// does not request a repaint, execute guest code, or manufacture a producer.
function observeProducer(w){
  const manager=w?._renderWorkerManager,g=w?.hostCtx?.getGlGpsBridge?.(),r=w?.renderer;
  return {running:!!w?.running,stopped:!!w?._stopped,guest:!!w?.guestWorker,
    ports:[...(manager?.ports?.values()||[])].map(p=>({id:p.id,closed:!!p.closed,api:p.options?.api,backend:p.options?.backend})),
    gps:g?{endpoint:g.endpoint?.id,closed:!!g.endpoint?.closed,backend:g.backend,error:String(g.workerAsyncError||''),
      closing:!!g.workerClosing,presents:g.presenter?.presents||0,writeSeq:g.presenter?.layer?.writeSeq||0,
      device:!!g.device,workerEpoch:g.workerEpoch}:null,
    d3d:w?.hostCtx?.d3dStats||w?.hostCtx?.stats||null,
    publication:r?._immutablePublicationSequence||0,
    currentDisplay:!!r?._currentDisplayRecord,
    windows:Object.values(r?.windows||{}).filter(v=>v.visible&&!v.isChild&&v.processId===w.processId&&v.wasm===w.instance).map(v=>({hwnd:v.hwnd,title:v.title}))};
}
function producerKey(v){
  if(!v.running||v.stopped||!v.guest||!v.currentDisplay||v.publication<=0||v.windows.length!==1)return null;
  const g=v.gps,p=v.ports.find(p=>p.id===g?.endpoint);
  if(!g||!p||p.closed||g.closed||g.closing||g.error||!g.device||g.presents<=0||g.writeSeq<=0)return null;
  assert.equal(p.api,'gl-gps','current native bridge needs actual GL GPS producer');
  assert.equal(p.backend,'software','software first; WebGL is a separate scope');
  return JSON.stringify([p.id,p.api,p.backend,g.workerEpoch,v.windows[0].hwnd]);
}
function createReadiness(){
  let prior=null,bound=null;
  return {observe(v){const key=producerKey(v);
    if(bound){assert.equal(key,bound,'bound producer changed or retired');return true;}
    const advanced=key&&prior?.key===key&&v.publication>prior.publication&&v.gps.presents>prior.presents&&v.gps.writeSeq>prior.writeSeq;
    prior=key?{key,publication:v.publication,presents:v.gps.presents,writeSeq:v.gps.writeSeq}:null;
    if(advanced)bound=key;return !!bound;},get bound(){return bound;}};
}
function scope({close,record=()=>{},floor=()=>{const v=fs.statfsSync('/home');return Number(v.bavail)*Number(v.bsize);},deadline}){
  let terminal=false,reason=null,requests=0;
  function stop(why){if(!terminal){terminal=true;reason=why;record({event:'CLOSED',at:Date.now(),reason,requests});close(why);}}
  function check(){if(terminal)throw Error('WARCRAFT_UNKNOWN permanently closed: '+reason);
    if(floor()<=POLICY.floor){stop('actual /home floor');throw Error(reason);}
    if(Date.now()>=deadline){stop('immutable deadline');throw Error(reason);}}
  return {check,stop,get terminal(){return terminal;},get requests(){return requests;},
    async request(fn){check();requests++;let timer;
      try{const value=await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{timer=setTimeout(()=>{stop('command deadline');reject(Error('WARCRAFT_UNKNOWN command deadline'));},Math.min(POLICY.commandMs,deadline-Date.now()));})]);check();return value;}
      catch(e){stop(e.message);throw e;}finally{clearTimeout(timer);}}};
}
// A dedicated CDP command namespace on the already attached connection. The
// signal follows the actual WebSocket send, never a pre-send fence or ACK.
let wireId=0;
function sendPublished(connection,method,params,sessionId,beforeSend,onPublished){
  const id=--wireId,body=JSON.stringify({id,method,params,sessionId}),ws=connection.ws;
  return new Promise((resolve,reject)=>{
    let timer;
    const finish=(error,value)=>{clearTimeout(timer);ws.removeEventListener('message',message);
      ws.removeEventListener('close',retired);ws.removeEventListener('error',retired);error?reject(error):resolve(value);};
    const retired=()=>finish(Error('UNKNOWN published CDP connection retired; never replay'));
    const message=e=>{let v;try{v=JSON.parse(e.data);}catch(error){finish(error);return;}
      if(v.id!==id)return;
      if(v.sessionId!==sessionId)return finish(Error('UNKNOWN published CDP session changed'));
      finish(v.error?Error(JSON.stringify(v.error)):null,v.result);};
    ws.addEventListener('message',message);ws.addEventListener('close',retired);ws.addEventListener('error',retired);
    timer=setTimeout(()=>finish(Error('UNKNOWN published CDP ACK; never replay')),3000);
    try{assert(!connection.closed&&ws.readyState===1,'published CDP connection unavailable');
      beforeSend();assert(!connection.closed&&ws.readyState===1,'published CDP connection retired at fence');
      ws.send(body);onPublished();
    }catch(error){finish(error);}
  });
}
// Require the authority's actual review field before creating a private proof.
// Geometry/observation prose alone is not a reviewed gesture.
function manualIntent(command,sequence,source,now=Date.now()){
  assert(command?.action==='gesture'&&Number.isSafeInteger(sequence)&&sequence>0);
  assert(typeof command.intent?.review==='string'&&command.intent.review.trim(),
    'manual gesture requires intent.review from personal whole-frame review');
  assert(/^[a-f0-9]{64}$/.test(source?.sha256||'')&&Number.isSafeInteger(source.at));
  assert(now>=source.at&&now-source.at<POLICY.sourceMs,'manual source expired');
  const intent={...structuredClone(command.intent),name:'action-'+sequence,
    nonce:crypto.randomUUID(),imageSHA256:source.sha256,reviewedAt:now};
  require('./native-mouse-consumption-input.cjs').exactInput(intent);
  return intent;
}
// Runtime.evaluate must await the evaluated operation inside the diagnostic
// envelope. A Promise nested in `value` serializes as {}, hiding rejection and
// causing callers to retry a permanently closed session with old diagnostics.
function nativeReadExpression(expression){
  return '(async()=>{const publication=()=>{const r=typeof runningApps!=="undefined"?runningApps[0]?.wine?.renderer:null;return {at:Date.now(),available:!!r,sequence:r?._immutablePublicationSequence??null,current:r?!!r._currentDisplayRecord:null};};try{const value=await eval('+JSON.stringify(expression)+');return {value,diagnostics:globalThis.__mouse?.diagnostics(),publication:publication()};}catch(e){return {error:String(e.stack||e),diagnostics:globalThis.__mouse?.diagnostics(),publication:publication()};}})()';
}
// Decode each actual whole-root XWD once. The retained PNG is evidence, not
// another pixel producer to decode on the expiring native-input path.
function createCaptureCodec(){
  const {PNG}=require('pngjs'),pixels=new WeakMap();
  function encodeXwd(b){
    assert(Buffer.isBuffer(b)&&b.length>=100,'short XWD');
    const header=b.readUInt32BE(0),width=b.readUInt32BE(16),height=b.readUInt32BE(20),
      order=b.readUInt32BE(28),stride=b.readUInt32BE(48),colors=b.readUInt32BE(76),start=header+12*colors;
    assert(header>=100&&b.readUInt32BE(4)===7&&b.readUInt32BE(8)===2,'unsupported XWD header');
    assert(b.readUInt32BE(44)===32&&(order===0||order===1),'unsupported XWD pixels');
    assert(b.readUInt32BE(56)===0xff0000&&b.readUInt32BE(60)===0xff00&&b.readUInt32BE(64)===0xff,'unsupported XWD masks');
    assert(width>0&&height>0&&stride>=width*4&&start+height*stride<=b.length,'invalid XWD bounds');
    const data=Buffer.allocUnsafe(width*height*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=start+y*stride+x*4,j=(y*width+x)*4;
      data[j]=b[i+(order===0?2:1)];data[j+1]=b[i+(order===0?1:2)];
      data[j+2]=b[i+(order===0?0:3)];data[j+3]=255;
    }
    const png=PNG.sync.write({width,height,data},{deflateLevel:1,filterType:0});
    pixels.set(png,{width,height,data});return {png,width,height};
  }
  function read(png){const p=pixels.get(png);assert(p,'capture pixels require their original XWD buffer');
    pixels.delete(png);return {width:p.width,height:p.height,data:Buffer.from(p.data)};}
  return {encodeXwd,read};
}
function loadCaptureAuthority(record=()=>{}){
  const file=ROOT+'/lib/browser-reviewed-frame-equivalence.cjs',m=new Module(file,module);
  m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));
  const original=m.require.bind(m),codec=createCaptureCodec();
  const measured=(phase,fn)=>function(...args){const at=Date.now(),t=performance.now();
    try{return fn.apply(this,args);}finally{record({phase,at,completedAt:Date.now(),ms:performance.now()-t});}};
  m.require=name=>{const value=original(name);
    if(name==='../tools/browser-transients.cjs')return {...value,encodeXwd:measured('capture-xwd-encode-once',codec.encodeXwd)};
    if(name==='pngjs')return {...value,PNG:{...value.PNG,sync:{...value.PNG.sync,read:measured('capture-original-rgba',codec.read)}}};
    if(name==='node:child_process')return {...value,execFileSync:(cmd,...args)=>measured('capture-subprocess-'+cmd,value.execFileSync)(cmd,...args)};
    return value;
  };
  m._compile(fs.readFileSync(file,'utf8'),file);return m.exports;
}
// Passive opt-in diagnostic. Caller objects and their properties never enter
// the ring; no timers, console sink, scene refresh or producer work is added.
function createPassiveNativeTrace(api){
  const capacity=256,width=8,ring=new Float64Array(capacity*width);
  const clock=performance.now.bind(performance),apply=Reflect.apply;
  let count=0;const totals=new Float64Array(7),last=new Float64Array(7);
  const scalar=v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='boolean'?+v:0;
  function record(method,phase,arg,result){
   try {
    const n=count++,i=(n%capacity)*width;
    ring[i]=n;ring[i+1]=clock();ring[i+2]=method;ring[i+3]=phase;
    ring[i+4]=scalar(arg);ring[i+5]=scalar(result);
    ring[i+6]=typeof result==='number'?1:typeof result==='boolean'?2:0;
    ring[i+7]=0;
    if(phase===0){totals[method]++;last[method]=ring[i+1];}
   }catch{/* Diagnostic failure cannot replace callback result/exception. */}
  }
  const names=['_unused','observe','validate','consumed','dequeued','status','close'];
  for(let method=0;method<names.length;method++){
   const name=names[method],descriptor=Object.getOwnPropertyDescriptor(api,name);
   if(!descriptor||typeof descriptor.value!=='function')continue;
   const original=descriptor.value;
   Object.defineProperty(api,name,{...descriptor,value:function(...args){
    record(method,0,args[0],undefined);
    let result;
    try {result=apply(original,this,args);}catch(error){record(method,2,args[0],undefined);throw error;}
    record(method,1,args[0],result);return result;
   }});
  }
  // Only copied numeric cells leave the ring. No references to caller objects.
  Object.defineProperty(api,'traceSnapshot',{value:()=>({capacity,width,count,rows:Array.from(ring)})});
  Object.defineProperty(api,'traceCounters',{value:()=>({count,totals:Array.from(totals),last:Array.from(last)})});
  return api;
 }
function passiveNativeTraceBootstrap(){
  return `;(()=>{const original=globalThis.createBrowserNativeInput;
    globalThis.createBrowserNativeInput=function(...args){return (${createPassiveNativeTrace})(Reflect.apply(original,this,args));};})();`;
}
module.exports={ROOT,PINS,POLICY,INPUTS,sha,git,qualifiedSource,qualifiedLoader,frozenGraph,observeProducer,producerKey,createReadiness,scope,sendPublished,manualIntent,nativeReadExpression,createCaptureCodec,loadCaptureAuthority,createPassiveNativeTrace,passiveNativeTraceBootstrap};
