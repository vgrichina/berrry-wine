'use strict';
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert');
const target=path.join(process.cwd(),'test/test-opengl-drawable-color-buffers.js');
let text=fs.readFileSync(target,'utf8');
const anchor=" const read=(mode,format=0x1908,type=0x1401,w=1,h=1)=>{call('glReadBuffer',[mode]);";
assert.strictEqual(text.split(anchor).length,2);
// Insert after read/clear/point helper definitions, before existing regressions.
const at=" call('glDrawBuffer',[0x405]);clear([1,0,1,1]);";assert.strictEqual(text.split(at).length,2);
text=text.replace(at,String.raw`
 assert(resolve('glLogicOp'),'resolved logic operation required');call('glDisable',[0xbd0]);
 function seedLogic(){
   call('glDrawBuffer',[0x404]);clear([166/255,166/255,166/255,166/255]);
   call('glDrawBuffer',[0x405]);clear([60/255,60/255,60/255,60/255]);
   call('glDrawBuffer',[0x408]);
 }
 function rawPoint(count=1){
   call('glColor4ui',[0x35000000,0x35000000,0x35000000,0x35000000]);call('glBegin',[0]);
   for(let i=0;i<count;i++)call('glVertex3f',[f(-.875),f(-.625),0]);call('glEnd');call('glFinish');if(encoder)encoder.fence();
 }
 seedLogic();call('glLogicOp',[0x1506]);call('glEnable',[0xbf2]);rawPoint();
 assert.deepStrictEqual(read(0x404).slice(0,4),[147,147,147,147],'independent front XOR destination');
 assert.deepStrictEqual(read(0x405).slice(0,4),[9,9,9,9],'independent back XOR destination');
 for(const count of [2,3]){
   seedLogic();rawPoint(count);
   assert.deepStrictEqual(read(0x404).slice(0,4),Array(4).fill(count===2?166:147),'ordered front XOR '+count);
   assert.deepStrictEqual(read(0x405).slice(0,4),Array(4).fill(count===2?60:9),'ordered back XOR '+count);
 }
 for(const mode of [1,4])for(const count of [1,2,3]){
   seedLogic();call('glColor4ui',[0x35000000,0x35000000,0x35000000,0x35000000]);call('glBegin',[mode]);
   for(let i=0;i<count;i++)for(const [x,y] of mode===1?[[-.875,-.625],[.875,-.625]]:[[-1,-1],[1,-1],[-1,1]])call('glVertex3f',[f(x),f(y),0]);
   call('glEnd');call('glFinish');if(encoder)encoder.fence();
   assert.deepStrictEqual(read(0x404).slice(0,4),Array(4).fill(count%2?147:166),'ordered front primitive '+mode+' count '+count);
   assert.deepStrictEqual(read(0x405).slice(0,4),Array(4).fill(count%2?9:60),'ordered back primitive '+mode+' count '+count);
 }
 // One fragment performs depth and stencil once while writing both colors.
 seedLogic();call('glClear',[0x500]);call('glEnable',[0xb71]);call('glDepthFunc',[0x201]);
 call('glEnable',[0xb90]);call('glStencilFunc',[0x207,0,255]);call('glStencilOp',[0x1e00,0x1e00,0x1e02]);rawPoint();
 assert.deepStrictEqual(read(0x404).slice(0,4),[147,147,147,147],'depth accepted front');
 assert.deepStrictEqual(read(0x405).slice(0,4),[9,9,9,9],'depth accepted back');
 call('glDisable',[0xb71]);call('glStencilFunc',[0x202,1,255]);call('glStencilOp',[0x1e00,0x1e00,0x1e00]);rawPoint();
 assert.deepStrictEqual(read(0x404).slice(0,4),[166,166,166,166],'stencil increment once permits next front');
 assert.deepStrictEqual(read(0x405).slice(0,4),[60,60,60,60],'stencil increment once permits next back');
 call('glStencilFunc',[0x202,2,255]);rawPoint();
 assert.deepStrictEqual(read(0x405).slice(0,4),[60,60,60,60],'stencil did not increment twice');
 call('glDisable',[0xb90]);call('glDisable',[0xbf2]);
`+at);
text=text.replace("assert(encoder.snapshot().glQueued>=3,'actual native renderer queued points');","assert(encoder.snapshot().glQueued>=3,'actual native renderer queued points');assert.strictEqual(encoder.snapshot().fallbacks,0,'front/back actual queue zero fallback');");
if(process.argv.includes('--check-expanded')){new(require('vm').Script)(text,{filename:target});console.log('front/back syntax PASS; no native/guest execution');}
else {const m=new Module(target,module);m.filename=target;m.paths=Module._nodeModulePaths(path.dirname(target));m._compile(text,target);}
