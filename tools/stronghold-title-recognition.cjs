'use strict';
// Bounded visual comparison; original presentation, freshness and input driver retained.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {PNG}=require('pngjs');
const base=require('./stronghold-preset-driver-attachment.cjs');
const ROOT=path.resolve(__dirname,'..');
const DRIVER=path.join(ROOT,'scratch/runs/20261104-stronghold-current-request-native/title-driver.cjs');
const DRIVER_SHA='65c5455535feb548b7fd1e5f31fd25c357a0662af195bf67474ecceb34ee6179';
const REFERENCE=path.join(ROOT,'scratch/runs/20261104-stronghold-title-release-drain/review/title-boundary-0.png');
const REFERENCE_SHA='935d282f95b1a6429e879a24f70d63acd9ee42433878115b60519284ac0281a4';
const NAVIGATION=path.join(ROOT,'scratch/runs/20261104-stronghold-explicit-idle-input/navigation-plan.cjs');
const NAVIGATION_SHA='855e59adc9c519d3382727c51823b84066bcbab285aaa04da2105bae31726907';
const MENU_REFERENCE=path.join(ROOT,'scratch/runs/20261104-stronghold-original-route-gameplay/review/title-result.png');
const MENU_REFERENCE_SHA='b467eeafe1283c67086b35b32587ba6aec6df637e31604d4458a13d9111f4229';
const TYPE_REFERENCE=path.join(ROOT,'scratch/runs/20261104-stronghold-explicit-idle-input/review/crusader-type.png');
const TYPE_REFERENCE_SHA='6f8afacc85b1d3fb900e02e568b4424846310121dfbcb19901792945ea9f99b1';
function typeCrop(bytes){
 const p=PNG.sync.read(bytes);if(p.width!==1200||p.height!==900)throw Error('ChooseType screenshot geometry required');
 const b=Buffer.alloc(420*35*3);let k=0;
 for(let y=340;y<375;y++)for(let x=235;x<655;x++){
  const o=(y*p.width+x)*4;if(p.data[o+3]!==255)throw Error('nonopaque ChooseType');
  for(let c=0;c<3;c++)b[k++]=p.data[o+c];
 }return b;
}
function compareType(png){
 const ref=base.retained(TYPE_REFERENCE);if(base.hash(ref)!==TYPE_REFERENCE_SHA)throw Error('sealed original ChooseType reference mismatch');
 const a=typeCrop(ref),b=typeCrop(png),tiles=Array.from({length:30},()=>({changed:0,error:0}));let changed=0,error=0;
 for(let y=0;y<35;y++)for(let x=0;x<420;x++){
  const o=(y*420+x)*3,d=Math.max(...[0,1,2].map(c=>Math.abs(a[o+c]-b[o+c])));
  if(d){changed++;error+=d;const t=tiles[Math.floor(y/7)*6+Math.floor(x/70)];t.changed++;t.error+=d;}
 }
 // Original/local:20 of14700 pixels,1041 error; tile maxima3 pixels/266 error.
 // Small bounded headroom, no shifts/masks/rescaling; every70x7 tile counts.
 return {accepted:changed<=30&&error<=1400&&tiles.every(t=>t.changed<=5&&t.error<=350),changed,error,tiles};
}
function menuCrop(bytes){
 const p=PNG.sync.read(bytes);if(p.width!==1200||p.height!==900)throw Error('menu screenshot geometry required');
 const b=Buffer.alloc(220*30*3);let k=0;
 for(let y=344;y<374;y++)for(let x=190;x<410;x++){
  const o=(y*p.width+x)*4;if(p.data[o+3]!==255)throw Error('nonopaque menu');
  for(let c=0;c<3;c++)b[k++]=p.data[o+c];
 }return b;
}
function compareMenu(png){
 const ref=base.retained(MENU_REFERENCE);if(base.hash(ref)!==MENU_REFERENCE_SHA)throw Error('sealed original menu reference mismatch');
 const a=menuCrop(ref),b=menuCrop(png),tiles=Array.from({length:22},()=>({changed:0,error:0}));let changed=0,error=0;
 for(let y=0;y<30;y++)for(let x=0;x<220;x++){
  const o=(y*220+x)*3,d=Math.max(...[0,1,2].map(c=>Math.abs(a[o+c]-b[o+c])));
  if(d){changed++;error+=d;const t=tiles[Math.floor(y/15)*11+Math.floor(x/20)];t.changed++;t.error+=d;}
 }
 // Measured 29/6600 changed pixels and464 error. All pixels and20x15 tiles count.
 return {accepted:changed<=40&&error<=650&&tiles.every(t=>t.changed<=20&&t.error<=350),changed,error,tiles};
}
function menuScene(png){
 menuCrop(png);
 if(base.hash(base.retained(NAVIGATION))!==NAVIGATION_SHA)throw Error('sealed original navigation mismatch');
 const old=require(NAVIGATION).scene(png);if(old!=='unknown')return old;
 const found=[];if(compareMenu(png).accepted)found.push('main-menu');
 if(compareType(png).accepted)found.push('crusader-type');
 return found.length===1?found[0]:'unknown';
}
function composeNavigation(bytes){
 if(base.hash(bytes)!==NAVIGATION_SHA)throw Error('sealed original navigation mismatch');
 const s=bytes.toString(),start=s.indexOf('function scene(png){'),end=s.indexOf('\nfunction mainToCrusader',start);
 if(start<0||end<0)throw Error('original menu composition seam missing');
 return s.slice(0,start)+`function scene(png){return require(${JSON.stringify(__filename)}).menuScene(png);}\n`+s.slice(end);
}
// Retain the original hash-checked loader, changing only the navigation source
// after its existing per-file hash check. No global require cache mutation.
function compileClosure(source,filename,routeSource,hashes=base.closureHashes(filename)){
 const loader=base.replaceOnce(base.compileClosure.toString(),
  'file===filename?source:file===routeFile?routeSource:bytes.toString()',
  'file===filename?source:file===routeFile?routeSource:file===NAVIGATION?composeNavigation(bytes):bytes.toString()');
 return new Function('ROOT','Module','module','retained','hash','closureHashes','path','NAVIGATION','composeNavigation','return ('+loader+')')
  (ROOT,Module,module,base.retained,base.hash,base.closureHashes,path,NAVIGATION,composeNavigation)(source,filename,routeSource,hashes);
}
function crop(bytes){
 const p=PNG.sync.read(bytes);if(p.width!==1200||p.height!==900)throw Error('title screenshot geometry required');
 const b=Buffer.alloc(500*250*3);let k=0;
 for(let y=300;y<550;y++)for(let x=200;x<700;x++){
  const o=(y*p.width+x)*4;if(p.data[o+3]!==255)throw Error('nonopaque title');
  for(let c=0;c<3;c++)b[k++]=p.data[o+c];
 }return b;
}
function reference(){const b=base.retained(REFERENCE);if(base.hash(b)!==REFERENCE_SHA)throw Error('sealed original title reference mismatch');return crop(b);}
function compare(png){
 const a=reference(),b=crop(png),tiles=Array.from({length:50},()=>({changed:0,error:0}));let changed=0,error=0;
 for(let y=0;y<250;y++)for(let x=0;x<500;x++){
  const o=(y*500+x)*3,d=Math.max(...[0,1,2].map(c=>Math.abs(a[o+c]-b[o+c])));
  if(d){changed++;error+=d;const t=tiles[Math.floor(y/50)*10+Math.floor(x/50)];t.changed++;t.error+=d;}
 }
 // No shifts, masks, rescaling or alignment search. Every pixel participates.
 // Measured original/local difference:359 pixels, max-channel absolute sum4075.
 return {accepted:changed<=500&&error<=6000&&tiles.every(t=>t.changed<=100&&t.error<=1800),changed,error,tiles};
}
let driver;
function original(){
 if(driver)return driver;
 const bytes=base.retained(DRIVER);if(base.hash(bytes)!==DRIVER_SHA)throw Error('sealed original title driver mismatch');
 const s=bytes.toString(),start=s.indexOf('function titleScene(png){'),end=s.indexOf('\nasync function titleEnter',start);
 if(start<0||end<0)throw Error('original title composition seam missing');
 const source=s.slice(0,start)+`function titleScene(png){return require(${JSON.stringify(__filename)}).titleScene(png);}\n`+s.slice(end);
 const m=new Module(DRIVER,module);m.filename=DRIVER;m.paths=Module._nodeModulePaths(path.dirname(DRIVER));m._compile(source,DRIVER);driver=m.exports;return driver;
}
function titleScene(png){
 // Preserve both historical exact scenes and main-menu classification.
 crop(png);
 if(base.hash(base.retained(DRIVER))!==DRIVER_SHA)throw Error('sealed original title driver mismatch');
 const old=require(DRIVER).titleScene(png);if(old!=='unknown')return old;
 if(menuScene(png)==='main-menu')return 'main-menu';
 return compare(png).accepted?'title-dialog':'unknown';
}
function titleEnter(options){return original().titleEnter(options);}
function prepare(options){
 const p=require('./stronghold-local-runtime.cjs').prepare(options);
 p.source=base.replaceOnce(p.source,"require('../20261104-stronghold-current-request-native/title-driver.cjs').titleEnter",`require(${JSON.stringify(__filename)}).titleEnter`);
 p.evidence.titleRecognition={driver:DRIVER,driverSHA256:DRIVER_SHA,reference:REFERENCE,referenceSHA256:REFERENCE_SHA,allPixels:true,freshnessAndReviewUnchanged:true};
 p.evidence.menuRecognition={navigation:NAVIGATION,navigationSHA256:NAVIGATION_SHA,reference:MENU_REFERENCE,referenceSHA256:MENU_REFERENCE_SHA,allPixels:true,tiles:[20,15],limits:{changed:40,error:650,tileChanged:20,tileError:350},originalMenuDriverUnchanged:true};
 p.evidence.typeRecognition={reference:TYPE_REFERENCE,referenceSHA256:TYPE_REFERENCE_SHA,allPixels:true,tiles:[70,7],limits:{changed:30,error:1400,tileChanged:5,tileError:350},originalMenuDriverUnchanged:true};
 p.evidence.compositionSHA256=base.hash(p.source);return p;
}
module.exports={crop,compare,titleScene,titleEnter,prepare,compileClosure,composeNavigation,menuScene,menuCrop,compareMenu,typeCrop,compareType,TYPE_REFERENCE,TYPE_REFERENCE_SHA,NAVIGATION,NAVIGATION_SHA,MENU_REFERENCE,MENU_REFERENCE_SHA,DRIVER,DRIVER_SHA,REFERENCE,REFERENCE_SHA};
