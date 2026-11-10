'use strict';
// Offline exact composed fixture/capture consumers, controlled Worker/WASM/CDP
// services, real host frame publication, and independent retained-PNG pixels.
// No browser, native raster execution, review approval or input is implied.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {PNG}=require('pngjs'),Host=require('../lib/gl-render-host.js');
const route=require('./q3-current-foreign-closure-v1.cjs'),root=path.resolve(__dirname,'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const prior='scratch/runs/20261109-q3-readiness-wire-cause-2335';
const out=path.resolve(process.argv[2]);assert(out.startsWith(root+'/scratch/runs/'));fs.mkdirSync(out,{recursive:true});
const bytes=fs.readFileSync(root+'/'+prior+'/fixture-startup.png');
const receipt=JSON.parse(zlib.gunzipSync(fs.readFileSync(root+'/'+prior+'/prepared/fixture-first-image.json.gz')));
assert.equal(bytes.length,receipt.size);assert.equal(sha(bytes),receipt.sha256);
const composed=route.composition(route.version).compose();
const current=require('./q3-current-module.cjs');
const Module=require('node:module'),generated=new Module(root+'/scratch/runs/20261108-q3-gl-readiness-gameplay/generated.cjs',module);
generated.filename=root+'/scratch/runs/20261108-q3-gl-readiness-gameplay/generated.cjs';generated.paths=module.paths;
generated._compile(composed.fixtureSource,generated.filename);
let html;const response={setHeader(){},end(value){html=value;}};
assert.equal(current.readableFixtureHandler(generated.exports)({url:'/generated-readiness?backend=webgl'},response),true);
assert.throws(()=>current.readableFixtureHTML(html),/readable fixture seam/,'already transformed source fails closed');
const source=html.slice(html.indexOf('async function fixture(backend)'),html.indexOf('\n})("webgl")')+2)+'\nfunction handle';
assert(source.endsWith('}\nfunction handle'));
const body=source.slice(source.indexOf('async function fixture(backend)'),source.indexOf('\nfunction handle'));
assert(body.startsWith('async function fixture'));
const draws=[],canvases=[],calls=[],listeners=[];let bridge,memory,allocated=0x10000;
const table=require('../src/api_table.json');
function canvas(){const c={width:300,height:150,style:{},getContext(kind){assert.equal(kind,'2d');return ctx;}};
 const ctx={imageSmoothingEnabled:true,createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},
 putImageData(image,x,y){c.pixels=Uint8Array.from(image.data);assert.deepEqual([x,y],[0,0]);},
 drawImage(...args){draws.push({canvas:c,args,smoothing:this.imageSmoothingEnabled});}};canvases.push(c);return c;}
const raw=async(name,...args)=>{
 if(name==='guest_alloc'){const at=allocated;allocated+=args[0]+16;return at;}
 if(name==='guest_to_wasm')return args[0];
 if(name==='guest_read32')return new DataView(memory.buffer).getUint32(args[0],true);
 if(name==='get_staging')return 0x200000;
 if(name==='get_thunk_base')return 0x300000;
 if(name==='get_eip')return 0;
 if(name==='call_func'){
  const d=new DataView(memory.buffer),code=new Uint8Array(memory.buffer);let at=args[0],pushed=[];
  while(code[at]===0x68){pushed.push(d.getUint32(at+1,true));at+=5;}
  assert.equal(code[at],0xb8);assert.equal(code[at+5],0xff);assert.equal(code[at+6],0xd0);assert.equal(code[at+7],0xa3);
  const api=table[d.getUint32(0x104,true)].name;calls.push({api,args:pushed.reverse()});
  d.setUint32(d.getUint32(at+8,true),1,true);return 0;
 }
 return 1;
};
class Link{constructor(){this.callExport=raw;this.slot=0;this.worker={};this.module={};this.endpointIdentity='owned';}async start(){}async slice(){return 1;}}
class Manager{constructor(){this.ready=Promise.resolve();}createEndpoint(){return {ready:Promise.resolve()};}}
class Bridge extends Host.Bridge{constructor(o){super(o);bridge=this;}}
const context={WebAssembly:{Memory:class{constructor(){this.buffer=new ArrayBuffer(4*1024*1024);memory=this;}}},
 fetch:async url=>({arrayBuffer:async()=>fs.readFileSync(root+url),json:async()=>JSON.parse(fs.readFileSync(root+url))}),
 WINE_REDLINE_STARTUP:{compile:async()=>({}),park:async()=>{},retired(){}},
 document:{createElement:canvas,body:{append(c){assert.equal(c.id,'screen');}}},
 createHostImports:()=>({host:{}}),RenderWorker:{Manager},GLRenderHost:{Bridge},GuestWorkerLink:Link,
 GuestRpc:{createMainBroker:()=>({})},RegionMap:{BASE:{THUNK_BASE:0x100}},
 addEventListener(type,fn){listeners.push({type,fn});},GLCommandStream:{},Int32Array,Uint8Array,ArrayBuffer,DataView,console};
(async()=>{
 const page=vm.createContext(context);page.self=page;page.window=page;page.Date=Date;page.performance=performance;page.memUtils={};
 vm.runInContext(fs.readFileSync(root+'/lib/renderer-input.js','utf8'),page);
 await vm.runInContext('('+body+')',page)('webgl');assert.equal(context.__generatedReady,true);
 await context.__draw();
 const viewport=calls.find(c=>c.api==='glViewport').args;assert.deepEqual(viewport,[0,0,320,200]);
 const float=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b.readFloatLE();};
 const vertices=calls.filter(c=>c.api==='glVertex3f').map(c=>c.args.map(float));
 assert.deepEqual(vertices,[[-1,-1,0],[1,-1,0],[0,1,0]]);
 assert.deepEqual(calls.filter(c=>['glFinish','SwapBuffers'].includes(c.api)).map(c=>c.api),['glFinish','SwapBuffers']);
 const hwnd=65537,win=bridge.options.renderer.windows[hwnd];assert.equal(win.w,320);assert.equal(win.h,200);
 const historicalMask=[];for(let y=0;y<8;y++){let row='';for(let x=0;x<8;x++){
  const px=2*(x+.5)/8-1,py=1-2*(y+.5)/8;
  const inside=vertices.every((a,i)=>{const b=vertices[(i+1)%3];return (b[0]-a[0])*(py-a[1])-(b[1]-a[1])*(px-a[0])>=0;});row+=inside?'1':'0';
 }historicalMask.push(row);}
 assert.deepEqual(historicalMask,['00000000','00011000','00011000','00111100','00111100','01111110','01111110','11111111']);
 const mask=Array.from({length:200},(_,y)=>Array.from({length:320},(_,x)=>{
 const px=2*(x+.5)/320-1,py=1-2*(y+.5)/200;
 return vertices.every((a,i)=>{const b=vertices[(i+1)%3];return (b[0]-a[0])*(py-a[1])-(b[1]-a[1])*(px-a[0])>=0;})?'1':'0';}).join(''));
 const pixels=Uint8Array.from(mask.join('').split('').flatMap(n=>[+n*255,0,0,255]));
 bridge.frameOwners.set(7,new Map([[hwnd,win]]));
 bridge._presentFrame({hwnd,width:320,height:200,pixels,frameToken:7});assert.equal(draws.length,1);
 const draw=draws[0];assert.equal(draw.canvas,canvases[0]);assert.equal(draw.smoothing,false);
 assert.deepEqual(draw.args.slice(1),[0,0,320,200]);assert.deepEqual([draw.args[0].width,draw.args[0].height],[320,200]);
 assert.deepEqual([draw.canvas.width,draw.canvas.height],[320,200]);assert.deepEqual(Object.keys(draw.canvas.style),[]);
 assert.deepEqual(draw.args[0].pixels,pixels);assert.equal(win._gpuFrameLayer.canvas,draw.args[0]);
 // Real host refuses wrong HWND/token and a same-looking replacement window.
 bridge._presentFrame({hwnd:9,width:320,height:200,pixels,frameToken:7});
 bridge._presentFrame({hwnd,width:320,height:200,pixels,frameToken:8});
 bridge.options.renderer.windows[hwnd]={...win};bridge._presentFrame({hwnd,width:320,height:200,pixels,frameToken:7});
 assert.equal(draws.length,1,'foreign/replaced owner cannot publish');bridge.options.renderer.windows[hwnd]=win;
 // Actual generated trusted-input state reaches the public GL translation.
 const translate=()=>calls.filter(c=>c.api==='glTranslatef').at(-1).args.map(float);
 assert.deepEqual(translate(),[0,0,0]);
 for(const event of [{isTrusted:false,keyCode:13},{isTrusted:true,keyCode:32},{isTrusted:true,keyCode:13,repeat:true}]){
  for(const l of listeners.filter(l=>l.type==='keydown'))l.fn({...event,preventDefault(){}});
  await context.__draw();assert.deepEqual(translate(),[0,0,0]);
 }
 for(const l of listeners.filter(l=>l.type==='keydown'))l.fn({isTrusted:true,keyCode:13,repeat:false,preventDefault(){}});
 await context.__draw();assert.deepEqual(translate(),[.5,0,0]);assert.equal(context.__generatedError,undefined);
 assert.equal(context.__fixture.wine.renderer.peekKeyDownState(13),32768);
 const old=context.__fixture.link.worker;context.__fixture.link.worker={};await assert.rejects(()=>context.__draw(),/owner changed/);context.__fixture.link.worker=old;
 const encode=(data)=>PNG.sync.write({width:320,height:200,data:Buffer.from(data)});
 const exact=PNG.sync.read(encode(pixels));
 function exactPixels(image,shift=0){
  assert.deepEqual([image.width,image.height],[320,200]);
  for(let y=0;y<200;y++)for(let x=0;x<320;x++){
   const inside=x>=shift&&mask[y][x-shift]==='1',i=(y*320+x)*4;
   assert.deepEqual([...image.data.subarray(i,i+4)],[inside?255:0,0,0,255]);
  }
 }
 exactPixels(exact);
 for(const channel of [0,1,3]){const bad={...exact,data:Buffer.from(exact.data)};bad.data[channel]^=1;assert.throws(()=>exactPixels(bad));}
 const moved=Uint8Array.from(mask.flatMap(row=>Array.from({length:320},(_,x)=>[x>=80&&row[x-80]==='1'?255:0,0,0,255]).flat()));
 exactPixels(PNG.sync.read(encode(moved)),80);assert.notEqual(sha(pixels),sha(moved));
 fs.writeFileSync(out+'/expected-startup.png',encode(pixels));fs.writeFileSync(out+'/expected-input.png',encode(moved));
 const png=PNG.sync.read(bytes);assert.deepEqual([png.width,png.height],[945,889]);
 function verifyPixels(png,mask){
 const sample=(x,y)=>+mask[Math.max(0,Math.min(7,y))][Math.max(0,Math.min(7,x))]*255;
 let maxError=0,differing=0;
 for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++){
  const i=(y*png.width+x)*4,inside=x>=8&&x<328&&y>=8&&y<208;
  if(!inside){assert.deepEqual([...png.data.subarray(i,i+4)],[255,255,255,255]);continue;}
  let u=(x-8+.5)/40-.5,v=(y-8+.5)/25-.5,a=Math.floor(u),b=Math.floor(v);u-=a;v-=b;
  const expected=Math.round((1-v)*((1-u)*sample(a,b)+u*sample(a+1,b))+v*((1-u)*sample(a,b+1)+u*sample(a+1,b+1)));
  const error=Math.abs(png.data[i]-expected);maxError=Math.max(maxError,error);if(error)differing++;
  assert(error<=1,'independent bilinear red pixel');assert.deepEqual([...png.data.subarray(i+1,i+4)],[0,0,255]);
 }
 return {pixels:64000,maxError,differing};
 }
 const bilinear=verifyPixels(png,historicalMask);
 const corrupt={...png,data:Buffer.from(png.data)};corrupt.data[((100*png.width)+160)*4+1]=1;
 assert.throws(()=>verifyPixels(corrupt,historicalMask));
 assert.throws(()=>verifyPixels(png,[...historicalMask].reverse()));
 const shifted={...png,data:Buffer.from(png.data)};shifted.data[(8*png.width+7)*4]=0;
 assert.throws(()=>verifyPixels(shifted,historicalMask));
 // Compile the actual composed bound consumer. Only external observation
 // services are controlled; capture/same/readLive/admission code is unchanged.
 let boundSource;route.composition(route.version).compileBoundInput(composed,{_compile(s){boundSource=s;}},root+'/scratch/runs/20261108-q3-gl-readiness-gameplay/bound-input.cjs',out);
 const mod={exports:{}},producer={READ:'producer',select:()=>({tick:1,context:receipt.ready.capture.identity.rendererContext}),advancing:()=>true};
 vm.runInNewContext(boundSource,{module:mod,exports:mod.exports,Buffer,structuredClone,process,require:n=>n==='./trace.cjs'?{span:async(n,f)=>f(),log(){}}:n==='./producer-ready.cjs'?producer:require(n)});
 const bound=mod.exports,cpu=fs.readFileSync(root+'/build/wine-assembly.wasm'),digest=sha(cpu);
 const identity=receipt.ready.capture.identity;assert.equal(digest,identity.moduleSha256);
 for(const replaced of [false,true]){
  const app=structuredClone(identity),protocol=[];
  const workers=new Map([['g',{url:'guest-worker',sessionId:'g',targetId:identity.workerTarget,scripts:[{scriptId:'g',sha256:digest,bytecodeAvailable:true}]}],['r',{url:'d3d-render-worker',sessionId:'r',targetId:identity.rendererTarget,scripts:[{scriptId:'r',sha256:digest,bytecodeAvailable:true}]}]]);
  const evaluate=async expression=>{
   if(expression===bound.PAGE_READ)return {isolated:true,apps:[structuredClone(app)]};
   if(expression===bound.WORKER_READ)return {endpointIdentity:app.guestEndpoint,slot:app.slot,instance:identity.workerInstance};
   if(expression===bound.RENDER_READ)return [{id:app.renderEndpoint,options:{api:'gl'},contexts:[identity.rendererContext],epoch:identity.rendererEpoch}];
   if(expression==='producer')return [];throw Error('unexpected evaluate');
  };
  const send=async(method,params,session)=>{
   protocol.push({method,params,session});
   if(method==='Debugger.getScriptSource')return {bytecode:cpu.toString('base64')};
   assert.equal(method,'Page.captureScreenshot');assert.equal(session,'exact-page-session');assert.equal(JSON.stringify(params),JSON.stringify({format:'png'}));
   if(replaced)app.canvasObject='replacement';return {data:bytes.toString('base64')};
  };
  const chain=bound.createChain({evaluate,send,workers,pageSession:'exact-page-session',app:'dx_tunnel',backend:'webgl',expectedModules:[digest]});
  await chain.establishReady({wait:async()=>{},stableMs:0});
  if(replaced)await assert.rejects(()=>chain.capture('visual'),/identity changed: canvasObject/);
  else {const shot=await chain.capture('visual');assert.equal(shot.capture.sha256,sha(bytes));assert.equal(shot.capture.identity.canvasObject,identity.canvasObject);assert.deepEqual(shot.png,bytes);}
  assert.equal(protocol.filter(p=>p.method==='Page.captureScreenshot').length,1);assert(!protocol.some(p=>p.method.startsWith('Input.')));
 }
 // Execute the owning native control consumer and real numbered ACK
 // transport with controlled capture/Worker services, including both reviews.
 const previousEnv={Q3_INPUT_SERVICE_REVIEW:process.env.Q3_INPUT_SERVICE_REVIEW,Q3_EXECUTION_BOUNDARY_OUT:process.env.Q3_EXECUTION_BOUNDARY_OUT,RENDER_BACKEND:process.env.RENDER_BACKEND};
 try{for(const mode of ['positive','wrong-initial-sha','indistinct-input']){
  const parent=path.join(out,'consumer-'+mode),nativeOut=path.join(parent,'runtime');fs.mkdirSync(nativeOut+'/commands',{recursive:true});
  process.env.Q3_INPUT_SERVICE_REVIEW='1';process.env.Q3_EXECUTION_BOUNDARY_OUT=parent+'/boundary.jsonl.gz';process.env.RENDER_BACKEND='webgl';
  fs.writeFileSync(nativeOut+'/execution-window.json',JSON.stringify({browserStop:new Date(Date.now()+120000).toISOString()}));
  let executed=0;const shot={...receipt.ready.capture,sha256:sha(bytes)};
  const review={sha256:shot.sha256,identity:shot.identity,clear:true,distinct:mode!=='indistinct-input',review:'Controlled external review service.'};
  const write=(name,value)=>fs.writeFileSync(nativeOut+'/'+name+'.json',JSON.stringify(value));
  const exercise=current.readableFixtureControls({}, {
   out:nativeOut,workers:new Map([['g',{url:'guest-worker',scripts:[{sha256:digest}]}]]),
   evaluate:async expression=>{assert.equal(expression,'__draw()');return {};},wait:ms=>new Promise(r=>setTimeout(r,Math.min(ms,5))),
   chain:{establishReady:async options=>{await options.wait();return {identity:shot.identity};}},
   save:(name,value)=>fs.writeFileSync(nativeOut+'/'+name,JSON.stringify(value)),capture:async label=>{write(label+'-capture',shot);fs.writeFileSync(nativeOut+'/'+label+'.png',bytes);fs.writeFileSync(parent+'/input-service-model-review.json',JSON.stringify({...review,sha256:mode==='wrong-initial-sha'?'0'.repeat(64):shot.sha256}));},
   execute:async(command,markDispatch)=>{assert.equal(command.key,'Enter');markDispatch();executed++;write('positive-capture',shot);fs.writeFileSync(nativeOut+'/positive.png',bytes);fs.writeFileSync(parent+'/readable-input-model-review.json',JSON.stringify(review));}
  });
  if(mode==='positive'){await exercise;assert.equal(executed,1);assert(JSON.parse(fs.readFileSync(nativeOut+'/local-controls.json')).passed);}
  else {await assert.rejects(()=>exercise);assert(!fs.existsSync(nativeOut+'/local-controls.json'));assert.equal(executed,mode==='wrong-initial-sha'?0:1);}
 }}finally{for(const [key,value] of Object.entries(previousEnv))if(value===undefined)delete process.env[key];else process.env[key]=value;}
 const result={passed:true,fixtureSourceSHA256:sha(source),boundSourceSHA256:sha(boundSource),retained:{path:prior+'/fixture-startup.png',sha256:sha(bytes),bytes:bytes.length,width:png.width,height:png.height},vertices,viewport,maskSHA256:sha(Buffer.from(mask.join(""))),backing:[320,200],sourceFrame:[320,200],canvasBounds:[8,8,328,208],scale:[1,1],bilinear,pixelNegativeControls:6,inputControls:4,translation:[.5,0,0],ownerRejectionControls:3,captureIdentityControls:2,productionRepair:false,nativeControlConsumerCases:3,nativeAllocation:false,limitations:'Controlled WASM/Worker/CDP services; independent pixel reconstruction, not native engine execution. Native DPR/CSS computed values not retained.'};
 fs.writeFileSync(out+'/controls.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
