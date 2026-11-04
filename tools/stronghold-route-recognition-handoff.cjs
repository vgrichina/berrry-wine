'use strict';
// One shared recognition seam for install-route and every original route caller.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {PNG}=require('pngjs');
const base=require('./stronghold-preset-driver-attachment.cjs');
const title=require('./stronghold-title-recognition.cjs');
const ROOT=path.resolve(__dirname,'..');
const NAVIGATION=path.join(ROOT,'scratch/runs/20261104-stronghold-current-request-native/navigation.cjs');
const NAVIGATION_SHA='3b939dc837d3a15264a99bf4bc495fefcaae495ae4e8c3e45916d364fff81bbb';
const WRAPPER=path.join(ROOT,'scratch/runs/20261104-stronghold-setup-preset-native-world/navigation.cjs');
const CLOSURE_MANIFEST=path.join(ROOT,'scratch/runs/20261104-stronghold-choosetype-recognition-onward/composition.json');
const CLOSURE_MANIFEST_SHA='ac2639e1dd33bb0a9fb8a73a86cc6a9cd38b2fe1be082fe17eacf44595fef3be';
const HOVER_SHARED=[
 {box:[110,315,660,75],sha256:'76c89d4845510f8bcd264f216161ad05d262b3c53efb3dbc2e5f70f05f5f2f38'},
 {box:[160,480,260,120],sha256:'41696e3a577197f9c7e8eecc26b05e79633386ab1def6d22fd56552e70d5ef3a'}
];
// Diagnostic only. These two crops are byte-identical between the authentic
// original ChooseType and hover; no hover-specific text acceptance is inferred.
function inspectNextHoverShared(png){
 const p=PNG.sync.read(png);if(p.width!==1200||p.height!==900)throw Error('hover diagnostic geometry required');
 return HOVER_SHARED.map(({box,sha256})=>{
  const [x,y,w,h]=box,rgb=Buffer.alloc(w*h*3);let k=0;
  for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){
   const o=(j*1200+i)*4;if(p.data[o+3]!==255)throw Error('nonopaque hover diagnostic');
   for(let c=0;c<3;c++)rgb[k++]=p.data[o+c];
  }const actual=base.hash(rgb);return {box,expected:sha256,actual,exact:actual===sha256};
 });
}
function sealedHashes(){
 const bytes=base.retained(CLOSURE_MANIFEST);
 if(base.hash(bytes)!==CLOSURE_MANIFEST_SHA)throw Error('sealed original closure manifest mismatch');
 return JSON.parse(bytes).retainedClosure;
}
function assertClosure(hashes){
 const sealed=new Map(sealedHashes().map(r=>[path.resolve(ROOT,r.path),r.sha256]));
 for(const row of hashes)if(sealed.get(path.resolve(ROOT,row.path))!==row.sha256)throw Error('retained helper source changed '+row.path);
}
function towerCrop(bytes){
 const p=PNG.sync.read(bytes);if(p.width!==1200||p.height!==900)throw Error('ChooseType tower geometry required');
 const b=Buffer.alloc(260*180*3);let k=0;
 for(let y=420;y<600;y++)for(let x=460;x<720;x++){
  const o=(y*1200+x)*4;if(p.data[o+3]!==255)throw Error('nonopaque ChooseType tower');
  for(let c=0;c<3;c++)b[k++]=p.data[o+c];
 }return b;
}
function compareTower(png){
 const ref=base.retained(title.TYPE_REFERENCE);
 if(base.hash(ref)!==title.TYPE_REFERENCE_SHA)throw Error('sealed original ChooseType reference mismatch');
 const a=towerCrop(ref),b=towerCrop(png),tiles=Array.from({length:30},()=>({changed:0,error:0}));let changed=0,error=0;
 for(let y=0;y<180;y++)for(let x=0;x<260;x++){
  const o=(y*260+x)*3,d=Math.max(...[0,1,2].map(c=>Math.abs(a[o+c]-b[o+c])));
  if(d){changed++;error+=d;const t=tiles[Math.floor(y/30)*5+Math.floor(x/52)];t.changed++;t.error+=d;}
 }
 // Authentic original/latest:131/46800 changed pixels,2365 error. All pixels
 // and fixed52x30 tiles participate; no alignment, masks or animation exemption.
 return {accepted:changed<=160&&error<=3000&&tiles.every(t=>t.changed<=35&&t.error<=1200),changed,error,tiles};
}
function composeNavigation(bytes){
 if(base.hash(bytes)!==NAVIGATION_SHA)throw Error('sealed original route navigation mismatch');
 return base.replaceOnce(bytes.toString(),'function scene(bytes){',
  `function scene(bytes){if(require(${JSON.stringify(__filename)}).boundedChooseType(bytes))return 'choose-type';`);
}
function boundedChooseType(png){return title.compareType(png).accepted&&compareTower(png).accepted;}
function compileClosure(source,filename,routeSource,hashes=base.closureHashes(filename)){
 assertClosure(hashes);
 const actual=base.closureHashes(filename);assertClosure(actual);
 const supplied=new Map(hashes.map(r=>[path.resolve(ROOT,r.path),r.sha256]));
 if(actual.some(r=>supplied.get(path.resolve(ROOT,r.path))!==r.sha256))throw Error('complete sealed closure required');
 // Retain the original loader's source checks, then compose both recognition
 // seams. All callers in the closure see the same route scene implementation.
 const loader=base.replaceOnce(base.compileClosure.toString(),
  'file===filename?source:file===routeFile?routeSource:bytes.toString()',
  'file===filename?source:file===routeFile?routeSource:file===NAVIGATION?composeNavigation(bytes):file===MENU?title.composeNavigation(bytes):bytes.toString()');
 return new Function('ROOT','Module','module','retained','hash','closureHashes','path','NAVIGATION','composeNavigation','MENU','title','return ('+loader+')')
  (ROOT,Module,module,base.retained,base.hash,base.closureHashes,path,NAVIGATION,composeNavigation,title.NAVIGATION,title)(source,filename,routeSource,hashes);
}
function originalNavigation(){return title.compileClosure(base.retained(WRAPPER).toString(),WRAPPER,'');}
function prepare(options){
 const p=title.prepare(options);
 assertClosure(p.evidence.retainedClosure);
 p.evidence.routeRecognition={path:__filename,sha256:base.hash(fs.readFileSync(__filename)),navigation:NAVIGATION,navigationSHA256:NAVIGATION_SHA,
  reference:title.TYPE_REFERENCE,referenceSHA256:title.TYPE_REFERENCE_SHA,closureManifest:CLOSURE_MANIFEST,closureManifestSHA256:CLOSURE_MANIFEST_SHA,header:'unchanged bounded header',tower:{box:[460,420,260,180],tiles:[52,30],changed:160,error:3000,tileChanged:35,tileError:1200},allPixels:true};
 return p;
}
module.exports={NAVIGATION,NAVIGATION_SHA,WRAPPER,towerCrop,compareTower,boundedChooseType,composeNavigation,compileClosure,originalNavigation,inspectNextHoverShared,prepare};
