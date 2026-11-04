'use strict';
// Real retained PNGs + actual original title/presentation/freshness code; no game launch.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PNG}=require('pngjs');
const api=require('../tools/stronghold-title-recognition.cjs'),base=require('../tools/stronghold-preset-driver-attachment.cjs');
const prior='scratch/runs/20261104-stronghold-portable-local-runtime/browser/';
const real=fs.readFileSync(prior+'title-boundary-0.png');
assert.equal(require(api.DRIVER).titleScene(real),'unknown');
assert.equal(api.titleScene(real),'title-dialog');assert.equal(api.titleScene(base.retained(api.REFERENCE)),'title-dialog');
assert.equal(api.titleScene(fs.readFileSync('scratch/runs/20261104-stronghold-balanced-menu-route/review/title-result.png')),'title-intermediate');
const stats=api.compare(real);assert.equal(stats.changed,359);assert.equal(stats.error,4075);
for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[5,5]]){
 const p=PNG.sync.read(real),q=PNG.sync.read(real);
 for(let y=300;y<550;y++)for(let x=200;x<700;x++){
  const o=(y*p.width+x)*4,s=((y+dy)*p.width+x+dx)*4;q.data.set(p.data.subarray(s,s+4),o);
 }assert.equal(api.titleScene(PNG.sync.write(q)),'unknown','shift '+dx+','+dy);
}
assert.throws(()=>api.titleScene(PNG.sync.write(new PNG({width:500,height:250}))),/geometry/);
for(const file of ['startup-256.png','startup-2560.png']){
 if(fs.existsSync(prior+file))assert.equal(api.titleScene(fs.readFileSync(prior+file)),'unknown',file);
}
const wrong=PNG.sync.read(real);for(let y=333;y<375;y++)for(let x=285;x<610;x++)wrong.data.fill(0,(y*wrong.width+x)*4,(y*wrong.width+x)*4+3);
assert.equal(api.titleScene(PNG.sync.write(wrong)),'unknown','removed heading');
const alpha=PNG.sync.read(real);alpha.data[(350*alpha.width+350)*4+3]=0;assert.throws(()=>api.titleScene(PNG.sync.write(alpha)),/nonopaque/);
const live='scratch/runs/20261104-stronghold-title-recognition-onward/browser/';
if(fs.existsSync(live+'title-boundary-0.png')){
 assert.equal(api.titleScene(fs.readFileSync(live+'title-boundary-0.png')),'title-dialog');
 assert.equal(api.titleScene(fs.readFileSync(live+'title-boundary-2.png')),'unknown','first actual onward blocker stays closed');
}
const state=JSON.parse(fs.readFileSync(prior+'title-boundary-0.json')).state;
const geometry=state.main.geometry;
const dom={session:'offline-personal-gate-fixture',timeOrigin:1,href:state.main.href,version:'fixture',renderer:1,host:2,canvas:3,presentation:4,dpr:1,rect:geometry.rect,visualViewport:{width:1200,height:900,scale:1,offsetLeft:0,offsetTop:0}};
async function gate(mode){
 let shots=0,inputs=0;
 const page={evaluate:async()=>structuredClone(dom),keyboard:{down:async()=>{inputs++;throw Error('offline Enter reached');},up:async()=>{}}};
 const shot=async()=>{shots++;const s=structuredClone(state);let png=real;
  if(mode==='stale-tick'&&shots===2)s.main.tick.steps++;
  if(mode==='foreign-target'&&shots===2)s.workers[0].id='foreign';
  if(mode==='stale-pixels'&&shots===2){const p=PNG.sync.read(real);p.data[(600*p.width+600)*4]^=1;png=PNG.sync.write(p);}
  return{state:s,png};};
 const review=async c=>({sha256:mode==='bad-review'?'foreign':c.sha256,scene:c.scene});
 const action=()=>api.titleEnter({page,state:async()=>structuredClone(state),shot,review,held:new Set(),mouseHeld:new Set(),step:async()=>{throw Error('unexpected step');},closing:()=>false});
 await assert.rejects(action,mode==='accepted'?/offline Enter reached/:mode==='bad-review'?/review mismatch/:mode==='stale-tick'?/crossed execution/:/stale game output\/identity/);
 assert.equal(inputs,mode==='accepted'?1:0);
}
(async()=>{for(const mode of ['accepted','bad-review','stale-tick','foreign-target','stale-pixels'])await gate(mode);
 console.log(JSON.stringify({pass:true,realCaptureAccepted:true,stats,shifted:5,cropped:true,wrongScene:true,staleAndForeignBeforeInput:true,originalReviewAndFreshness:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
