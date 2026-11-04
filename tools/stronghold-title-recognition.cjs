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
 const old=require(DRIVER).titleScene(png);if(old!=='unknown')return old;
 return compare(png).accepted?'title-dialog':'unknown';
}
function titleEnter(options){return original().titleEnter(options);}
function prepare(options){
 const p=require('./stronghold-local-runtime.cjs').prepare(options);
 p.source=base.replaceOnce(p.source,"require('../20261104-stronghold-current-request-native/title-driver.cjs').titleEnter",`require(${JSON.stringify(__filename)}).titleEnter`);
 p.evidence.titleRecognition={driver:DRIVER,driverSHA256:DRIVER_SHA,reference:REFERENCE,referenceSHA256:REFERENCE_SHA,allPixels:true,freshnessAndReviewUnchanged:true};
 p.evidence.compositionSHA256=base.hash(p.source);return p;
}
module.exports={crop,compare,titleScene,titleEnter,prepare,DRIVER,DRIVER_SHA,REFERENCE,REFERENCE_SHA};
