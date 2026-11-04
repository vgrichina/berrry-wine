'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {PNG}=require('pngjs');const {scene,mainToCrusader,assertTransition}=require('./navigation-plan.cjs');
const root=path.resolve(__dirname,'../../..'),old=path.join(root,'scratch/runs/20261104-stronghold-stable-recovery-combat/review');
const png=(dir,n)=>fs.readFileSync(path.join(dir,n+'.png'));
const geometry={width:800,height:600,rect:{x:10,y:194,width:860,height:668},viewport:{outputW:860,outputH:668,dstX:0,dstY:11,dstW:860,dstH:645,nativeX:0,nativeY:0,nativeW:800,nativeH:600},scaleMode:'nearest',dpr:1};
for(const dir of [old,path.join(__dirname,'review')])for(const n of ['main-menu','custom-menu']){assert.equal(scene(png(dir,n)),'main-menu');assert.throws(()=>assertTransition(png(dir,n),'crusader-type'),/unexpected/);}
assertTransition(png(old,'choose-type'),'crusader-type');
const plan=mainToCrusader(png(old,'main-menu'),geometry);assert.equal(plan.control,'Crusader');assert.equal(plan.native.y,144);assert(plan.client.x>330&&plan.client.x<340&&plan.client.y>355&&plan.client.y<365);
assert.throws(()=>mainToCrusader(png(old,'choose-type'),geometry),/main menu/);
assert.throws(()=>mainToCrusader(png(old,'main-menu'),{...geometry,dpr:2}),/presentation/);
const corrupt=PNG.sync.read(png(old,'choose-type'));corrupt.data[(340*1200+235)*4]^=1;assert.throws(()=>assertTransition(PNG.sync.write(corrupt),'crusader-type'),/unexpected/);
console.log(JSON.stringify({pass:true,retainedAndActualUnchangedMenuRejected:true,correctCrusaderRoute:true,observedTypeAccepted:true,corruptPixelsRejected:true,runtimeExecuted:false}));
