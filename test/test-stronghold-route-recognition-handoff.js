'use strict';
// Execute actual original install-route and route-review-choose, stopping at
// the first physical Custom Game move sentinel. No browser or guest execution.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {PNG}=require('pngjs');
const a=require('../tools/stronghold-route-recognition-handoff.cjs'),b=require('../tools/stronghold-preset-driver-attachment.cjs'),title=require('../tools/stronghold-title-recognition.cjs');
const run=path.resolve('scratch/runs/20261104-stronghold-current-hover-diagnostic');
const latest='scratch/runs/20261104-stronghold-choosetype-recognition-onward/browser/route-install-checkpoint';
const png=b.retained(latest+'.png'),state=JSON.parse(b.retained(latest+'.json')).state;
const nav=a.compileClosure(b.retained(a.WRAPPER).toString(),a.WRAPPER,'');
assert.equal(a.originalNavigation().scene(png),'unknown');assert.equal(nav.scene(png),'choose-type');
assert.equal(nav.scene(b.retained(title.TYPE_REFERENCE)),'choose-type');
assert.equal(nav.scene(b.retained('scratch/runs/20261104-stronghold-menu-recognition-onward/browser/menu-native-boundary-4.png')),'choose-type');
assert(a.inspectNextHoverShared(b.retained(title.TYPE_REFERENCE)).every(r=>r.exact));
assert(a.inspectNextHoverShared(b.retained('scratch/runs/20261104-stronghold-current-request-native/review/route-native-boundary-3.png')).every(r=>r.exact));
assert(a.inspectNextHoverShared(png).every(r=>!r.exact),'known next shared hover gate mismatch must be diagnosed offline');
const currentHover=path.join(run,'browser/route-native-boundary-3.png');
const currentHoverFresh=path.join(run,'browser/route-native-boundary-4.png');
for(const file of [a.HOVER_REFERENCE,currentHover,currentHoverFresh]){
 const bytes=b.retained(file);assert(a.compareHover(bytes).accepted);assert.equal(nav.scene(bytes),'choose-type-custom-hover');
}
assert.equal(a.originalNavigation().scene(b.retained(currentHover)),'unknown');
const hoverNegatives=[];
for(const [region,{box:[x,y,w,h]}]of a.HOVER_REGIONS.entries()){
 for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[5,5]]){
  const p=PNG.sync.read(b.retained(currentHover)),q=PNG.sync.read(b.retained(currentHover));
  for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){const o=(j*1200+i)*4,s=((j+dy)*1200+i+dx)*4;q.data.set(p.data.subarray(s,s+4),o);}
  hoverNegatives.push(['hover region'+region+' shift'+dx+','+dy,PNG.sync.write(q)]);
 }
 const opaque=PNG.sync.read(b.retained(currentHover));opaque.data[(y*1200+x)*4+3]=254;
 assert.throws(()=>a.compareHover(PNG.sync.write(opaque)),/nonopaque/);
}
for(const [name,box,count,extreme]of [['map tile changed',[160,480,40],66,false],['header tile error',[110,315,40],3,true],['description tile changed',[240,676,40],17,false],['heading exact',[345,630,40],1,false]]){
 const p=PNG.sync.read(b.retained(a.HOVER_REFERENCE)),[x,y,w]=box;
 for(let i=0;i<count;i++){const o=((y+Math.floor(i/w))*1200+x+i%w)*4;p.data[o]=extreme?(p.data[o]<128?255:0):p.data[o]^1;}
 hoverNegatives.push([name,PNG.sync.write(p)]);
}
hoverNegatives.push(['unhovered current ChooseType',png],['unhovered original ChooseType',b.retained(title.TYPE_REFERENCE)],['wrong scene',b.retained(title.MENU_REFERENCE)]);
for(const [name,bytes]of hoverNegatives)assert.equal(a.compareHover(bytes).accepted,false,name);
assert.throws(()=>a.compareHover(PNG.sync.write(new PNG({width:1199,height:900}))),/geometry/);
const stats=a.compareTower(png);assert.equal(stats.changed,131);assert.equal(stats.error,2365);
const historical=[];
for(const dir of ['20261104-stronghold-current-request-native/review','20261104-stronghold-setup-preset-native-world/review','20261104-stronghold-resolved-binding-native/recovered/browser']){
 for(const file of fs.readdirSync('scratch/runs/'+dir).filter(f=>f.startsWith('route-')&&f.endsWith('.png'))){
  const bytes=b.retained('scratch/runs/'+dir+'/'+file),original=a.originalNavigation().scene(bytes);
  assert.notEqual(original,'unknown');assert.equal(nav.scene(bytes),original);historical.push({dir,file,scene:original,sha256:b.hash(bytes)});
 }
}
const shell=b.retained('scratch/runs/20261104-stronghold-resolved-binding-native/recovered/browser/route-native-boundary-7.png');
assert.equal(nav.scene(shell),'demo-selection-unavailable');require('../tools/stronghold-owning-callback-observer.cjs').assertHistoricalShell(shell);
for(const [file,expected]of [
 ['scratch/runs/20261104-stronghold-explicit-idle-input/review/skirmish-selection.png','arrival-unavailable'],
 ['scratch/runs/20261104-stronghold-browser-village/review/zephyr-ready.png','zephyr-ready']])assert.equal(nav.scene(b.retained(file)),expected);
const negatives=[];
for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[5,5]]){
 for(const [name,x,y,w,h]of [['header',235,340,420,35],['tower',460,420,260,180]]){
  const p=PNG.sync.read(png),q=PNG.sync.read(png);
  for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){const o=(j*1200+i)*4,s=((j+dy)*1200+i+dx)*4;q.data.set(p.data.subarray(s,s+4),o);}
  negatives.push([name+' shift '+dx+','+dy,PNG.sync.write(q)]);
 }
}
const ref=PNG.sync.read(b.retained(title.TYPE_REFERENCE));
const tile=PNG.sync.read(b.retained(title.TYPE_REFERENCE));for(let x=460;x<496;x++)tile.data[(420*1200+x)*4]^=1;
negatives.push(['tower tile concentrated',PNG.sync.write(tile)]);
const tileError=PNG.sync.read(b.retained(title.TYPE_REFERENCE));for(let x=460;x<470;x++){const o=(420*1200+x)*4;tileError.data[o]=tileError.data[o]<128?255:0;}
negatives.push(['tower tile error',PNG.sync.write(tileError)]);
negatives.push(['wrong scene',shell],['crop',PNG.sync.write(new PNG({width:260,height:180}))]);
for(const [name,p]of negatives){try{assert.notEqual(nav.scene(p),'choose-type',name);}catch(e){if(name!=='crop')throw e;assert.match(e.message,/geometry/);}}
const pins=path.join(run,'contract-test/pins.json');
fs.mkdirSync(path.dirname(pins),{recursive:true});fs.writeFileSync(pins,JSON.stringify({files:['build/wine-assembly.wasm','build/wine-assembly.compat.wasm'].map(path=>({path,sha256:b.hash(fs.readFileSync(path))}))}));
const p=a.prepare({run:path.join(run,'offline-entry'),pins});
const original=p.source;
const start=original.indexOf(" if(c.action==='install-route'){"),end=original.indexOf(' if(routeDispatch&&!nativeDriver)',start);
assert(start>0&&end>start);
const installSource='async function install(c){'+original.slice(start,end)+'}\ninstall({action:"install-route"});';
const routeFile=path.join(path.dirname(p.driver),'route-driver.cjs');
const route=a.compileClosure(p.route,routeFile,p.route);
const observation=a.prepare({run:path.join(run,'offline-observation'),pins,observeCurrentHover:true});
const observedRoute=a.compileClosure(observation.route,routeFile,observation.route);
assert(observation.evidence.currentHoverObservation.terminalBeforePress);
assert(!observation.route.includes("fail('hover scene required')"));
async function gate(mode,image=png){
 let shots=0,inputs=0,reviews=0;const geometry=state.main.geometry;
 const dom={session:'offline-route',timeOrigin:1,href:state.main.href,version:'fixture',renderer:1,host:2,canvas:3,presentation:4,dpr:1,rect:geometry.rect,visualViewport:{width:1200,height:900,scale:1,offsetLeft:0,offsetTop:0}};
 const page={evaluate:async fn=>fn.name==='inspectPresentation'?structuredClone(dom):fn.toString().includes('elementFromPoint')?'screen':structuredClone(geometry),mouse:{move:async()=>{inputs++;throw Error('Custom Game move sentinel');}}};
 const snapshot=()=>structuredClone(state);
 const shot=async()=>{shots++;let s=snapshot(),bytes=image;
  // install capture, choose capture, then fresh choose capture.
  if(shots>=3){
   if(mode==='stale-tick')s.main.tick.steps++;
   if(mode==='foreign-target')s.workers[0].id='foreign';
   if(mode==='stale-pixels'){const q=PNG.sync.read(image);q.data[(600*1200+600)*4]^=1;bytes=PNG.sync.write(q);}
  }return {png:bytes,state:s};};
 const review=async c=>{reviews++;return {sha256:mode==='bad-review'?'foreign':c.sha256,scene:c.scene,personallyViewed:mode!=='unviewed',observation:'personally viewed offline fixture'};};
 const ctx={boundary:{run:f=>f()},routeDispatch:null,nativeDriver:null,freshShot:shot,require:id=>id==='./navigation.cjs'?nav:id==='./route-driver.cjs'?route:require(id),personalReview:review,presetAttachment:{},sha:b.hash,page,state:async()=>snapshot(),held:new Set(),mouseHeld:new Set(),commandLive:()=>{},dispatch:()=>{throw Error('unexpected predecessor');}};
 const action=async()=>{await vm.runInNewContext(installSource,ctx);assert.equal(typeof ctx.routeDispatch,'function');await ctx.routeDispatch({action:'route-review-choose'});await ctx.routeDispatch({action:'route-review-hover'});};
 if(mode==='accepted')await assert.rejects(action,/Custom Game move sentinel/);
 else await assert.rejects(action,/ChooseType|geometry|review|execution boundary|stale game/);
 assert.equal(inputs,mode==='accepted'?1:0,mode);return {mode,shots,inputs,reviews};
}
async function replay(observe=false,hoverFile=a.HOVER_REFERENCE,mode='accepted'){
 // Authentic pixels at each checkpoint; only the transport is simulated.
 // Execute the composed route, original presentation/freshness and ACK guards.
 const s=structuredClone(state),g=s.main.geometry,events=[],reviews=[],acks=[];
 let image=png,pressed=false,after=0;
 const hover=b.retained(hoverFile);
 const dom={session:'offline-route-replay',timeOrigin:1,href:s.main.href,version:'fixture',renderer:1,host:2,canvas:3,presentation:4,dpr:1,rect:g.rect,visualViewport:{width:1200,height:900,scale:1,offsetLeft:0,offsetTop:0}};
 function input(msg,mask){
  const m=s.main,e=msg=>({msg,hwnd:65537,mouseX:543,mouseY:292,mouseButtons:mask,wParam:msg===132?0:mask,lParam:(292<<16)|543});
  m.inputQueue=msg===513?[e(132),e(msg)]:[e(msg)];m.mouseButtonsMask=mask;m.inputTelemetry.mouseButtons=mask;
  Object.assign(m.inputTelemetry.hostRendererFields,{active:m.activeInput,queue:m.inputQueue,mask});events.push(msg);
  if(msg===512)image=hover;if(msg===514)pressed=true;
 }
 const page={evaluate:async(fn,n)=>{
  if(fn.name==='inspectPresentation')return structuredClone(dom);
  if(fn.toString().includes('elementFromPoint'))return 'screen';
  if(fn.toString().includes('WineFrozen.step')){
   const m=s.main;m.tick.steps+=n;m.inputQueue=[];m.activeInput=null;m.lastInput=null;
   Object.assign(m.inputTelemetry.hostRendererFields,{active:null,queue:[],mask:m.mouseButtonsMask});
   if(pressed){after+=n;if(after>=256)image=shell;}
   const ack={requested:n,ran:n,steps:m.tick.steps,tickMs:16,frozen:true,hosts:1,guests:[{requested:n,ran:n,steps:m.tick.steps,tickMs:16,frozen:true,running:true}]};acks.push(ack);return ack;
  }return structuredClone(g);
 },mouse:{move:async()=>input(512,0),down:async()=>input(513,1),up:async()=>input(514,0)}};
 const d=(observe?observedRoute:route).createRouteDriver({page,state:async()=>structuredClone(s),shot:async()=>({png:image,state:structuredClone(s)}),controls:()=>({keys:[],buttons:[]}),boundary:{run:f=>f()},live:()=>{},review:async c=>{
  reviews.push({scene:c.scene,sha256:c.sha256});
  if(reviews.length===2){
   if(mode==='stale-tick')s.main.tick.steps++;
   if(mode==='foreign-target')s.workers[0].id='foreign';
   if(mode==='stale-pixels'){const q=PNG.sync.read(image);q.data[(600*1200+600)*4]^=1;image=PNG.sync.write(q);}
  }
  return {scene:c.scene,sha256:reviews.length===2&&mode==='bad-review'?'foreign':c.sha256,personallyViewed:!(reviews.length===2&&mode==='unviewed'),observation:'offline authentic pixels'};
 }});
 await d.dispatch({action:'route-review-choose'});
 if(mode!=='accepted'){
  await assert.rejects(d.dispatch({action:'route-review-hover'}),/personal capture review|stale|boundary|frozen|tick|ACK/);
  await assert.rejects(d.dispatch({action:'route-gesture'}),/terminal/);
  assert.deepEqual(events,[512]);return {mode,events,terminalBeforePress:true};
 }
 await d.dispatch({action:'route-review-hover'});
 if(observe){
  assert.deepEqual(events,[512]);assert.equal(reviews[1].scene,'current-custom-hover-observation');
  await assert.rejects(d.dispatch({action:'route-gesture'}),/terminal/);
  assert.deepEqual(events,[512]);assert(acks.every(a=>a.ran===64));
  return {events,reviews,acks:acks.length,terminalBeforePress:true};
 }
 await d.dispatch({action:'route-gesture'});
 let error;for(let i=0;i<5;i++){try{await d.dispatch({action:'route-arrival'});}catch(e){error=e;break;}}
 assert.match(String(error),/bounded historical shell diagnostic complete/);
 assert.deepEqual(events,[512,513,514]);assert.equal(reviews.length,2);assert(acks.every(a=>a.ran===64));
 await assert.rejects(d.dispatch({action:'route-arrival'}),/terminal/);
 return {events,reviews,acks:acks.length,after,terminal:String(error)};
}
(async()=>{
 const gates=[];for(const mode of ['accepted','stale-tick','foreign-target','stale-pixels','bad-review','unviewed'])gates.push(await gate(mode));
 for(const [name,bytes]of negatives)gates.push({negative:name,...await gate('negative',bytes)});
 // Immutable checks reject modified source bytes and a foreign closure hash.
 assert.throws(()=>a.composeNavigation(Buffer.concat([b.retained(a.NAVIGATION),Buffer.from('\n')])),/mismatch/);
 const hashes=b.closureHashes(routeFile);hashes.find(x=>path.resolve(x.path)===a.NAVIGATION).sha256='0'.repeat(64);
 assert.throws(()=>a.compileClosure(p.route,routeFile,p.route,hashes),/source changed/);
 assert.throws(()=>a.compileClosure(p.route,routeFile,p.route,b.closureHashes(routeFile).filter(r=>path.resolve(r.path)!==a.NAVIGATION)),/complete sealed closure/);
 assert(p.route.includes('shellSamples>=4'));assert(p.source.includes("'route-press-preset'"));
 const replayResult=await replay();
 const observationResult=await replay(true);
 const currentReplay=await replay(false,currentHover),hoverReviewNegatives=[];
 for(const mode of ['bad-review','unviewed','stale-tick','foreign-target','stale-pixels']){
  hoverReviewNegatives.push(await replay(false,currentHover,mode));
  hoverReviewNegatives.push(await replay(true,currentHover,mode));
 }
 fs.writeFileSync(path.join(run,'offline-handoff.json'),JSON.stringify({pass:true,stats,historical,gates,replayResult,currentReplay,observationResult,hoverReviewNegatives,hoverNegatives:hoverNegatives.map(([name])=>name),sourceTamperRejected:true,originalSources:p.evidence.retainedClosure},null,2)+'\n');
 console.log(JSON.stringify({pass:true,historical:historical.length,gates:gates.length,stats,sourceTamperRejected:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
