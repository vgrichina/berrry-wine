'use strict';
// Full emitted caller and numbered production transport. CDP is an explicit
// offline peer carrying real retained PNG pixels; this is not a guest run.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const current=require('./nox-current-driver.cjs'),state=require('./nox-menu-state.cjs'),{PNG}=require('pngjs');
const root=process.cwd(),g=path.resolve(process.argv[2]),evidence=path.resolve(process.argv[3]);
const source=fs.readFileSync(g+'/browser-run.cjs','utf8'),bound=require(g+'/bound-input.cjs'),transport=require(g+'/transport.cjs');
current.verify(root,JSON.parse(fs.readFileSync(g+'/runtime-pins.json')),g);
const moduleBytes=fs.readFileSync(g+'/nox-consumption.wasm'),moduleHash=current.sha(moduleBytes);
const caller=source.slice(source.indexOf('let noxAnchor=null;'),source.indexOf('\n(async()=>{'));
const paths={a:'20261110-nox-passive-menu-staff-target-0915/review/001-observe',b:'20261110-nox-settled-network-staff-0610/review/main-menu-settled',quit:'20261110-nox-supported-worker-staff-target-0905/review/001-main',title:'20261110-nox-settled-network-staff-0610/review/startup'};
const fixtures={};
for(const [key,p] of Object.entries(paths)){const file=root+'/scratch/runs/'+p,png=fs.readFileSync(file+'.png'),canvas=JSON.parse(fs.readFileSync(file+'-state.json')).canvas;
 const im=PNG.sync.read(png),r=canvas.rect,s=Math.min(r.width/640,r.height/480),left=r.left+(r.width-640*s)/2,top=r.top+(r.height-480*s)/2,data=new Uint8Array(640*480*4);
 for(let y=0;y<480;y++)for(let x=0;x<640;x++){const i=(Math.floor(top+(y+.5)*s)*im.width+Math.floor(left+(x+.5)*s))*4;data.set(im.data.subarray(i,i+4),(y*640+x)*4);}fixtures[key]={png,canvas,data};}
fixtures.blank={...fixtures.a,data:new Uint8Array(640*480*4)};
fixtures.text={...fixtures.a,data:fixtures.a.data.slice()};for(let y=190;y<205;y++)for(let x=270;x<340;x++)fixtures.text.data.fill(0,(y*640+x)*4,(y*640+x+1)*4);
const spec={kind:'main',rect:[130,110,400,250],labels:state.MAIN_LABELS};
async function fixture(mode){
 const out=evidence+'/'+mode;fs.mkdirSync(out,{recursive:true});fs.mkdirSync(out+'/commands');
 let now=Date.now(),scene=mode==='title-transition'?'title':'a',pixels=scene,effects=0,captures=0,dead=null,afterArm=false,waits=0,menuReads=0;
 const trace=[],workers=new Map([['w',{targetId:'guest',sessionId:'w',url:'guest-worker.js',closed:false,scripts:[{scriptId:'1',sha256:moduleHash,bytecodeAvailable:true}]}]]);
 const identity=Object.fromEntries(bound.FIELDS.map(f=>[f,f]));Object.assign(identity,{processId:1,guestEndpoint:1,endpoint:1,slot:0,renderEndpoint:'none'});
 const page={isolated:true,apps:[{...identity,name:'nox_demo',running:true,stopped:false,guestWorker:true}]};
 const evaluateLive=async e=>{trace.push('owner');if(mode==='change-after-owner-read'&&afterArm&&menuReads>=2)pixels='quit';if(e===bound.PAGE_READ)return structuredClone(page);if(e==='globalThis.__noxConsumption.owner()')return {sha256:moduleHash,size:moduleBytes.length,endpointIdentity:1,slot:0,workerInstance:'instance'};if(e===bound.WORKER_READ)return {endpointIdentity:1,slot:0,instance:'instance'};throw Error(e);};
 const chain=bound.createChain({now:()=>now,pageSession:'p',workers,expectedModules:[moduleHash],evaluate:evaluateLive,send:async method=>{trace.push(method);if(method==='Page.captureScreenshot')return {data:fixtures[scene].png.toString('base64')};if(method==='Debugger.getScriptSource')return {bytecode:moduleBytes.toString('base64')};throw Error(method);}});
 const context={send(){throw Error('unexpected direct CDP');},assert,Buffer,root,Date:class extends Date{static now(){return now;}},bound,deadline:now+300000,chain,workers,out,pageSession:'p',pointerObserverInstalled:false,terminalError:null,fs,sha:current.sha,save:(n,v)=>transport.publish(out+'/'+n,v),log(){},
 wait:async ms=>{assert(ms<=250);now+=ms;waits++;if(mode==='animated-positive')pixels=pixels==='a'?'b':'a';if(mode==='title-during-settle'&&waits===2)pixels='title';},terminal:error=>{if(!dead){dead=error;context.terminalError=error;trace.push('terminal');}return dead;},
 require:n=>{if(n===root+'/tools/nox-menu-state.cjs')return state;if(n==='./native-mouse.cjs')return {perform:async()=>{effects++;trace.push('input');scene='title';return {offline:true};}};if(n==='./ordinary-keys.cjs')return {validate(){},validateCombo(){}};throw Error(n);},
 evaluate:async e=>{trace.push('evaluate');if(e.startsWith('globalThis.__noxConsumption.begin')){if(afterArm){if(mode==='change-after-arm')pixels='quit';if(mode==='wrong-owner-after-arm')page.apps[0].processId=99;if(mode==='stale-after-arm')now+=120001;}return {active:true,cursor:{x:8,y:8}};}
 if(e==='window.noxPointerObserver.snapshot().state')return {reference:{x:8,y:8},canvas:{width:640,height:480},locked:false};
 if(e.includes('getImageData')){if(afterArm)menuReads++;const f=fixtures[pixels];const ctx={document:{getElementById:()=>({width:640,height:480,getBoundingClientRect:()=>({left:0,top:0,width:640,height:480}),getContext:()=>({getImageData:()=>({data:f.data})})})}};return vm.runInNewContext(e,ctx);}
 if(e.includes('getBoundingClientRect'))return {left:0,top:0,width:640,height:480};throw Error(e.slice(0,60));},validCaptureLabel:l=>assert(/^[a-z0-9-]+$/.test(l))};
 async function shot(label){const shot=await chain.capture(label);context.latest=shot.capture;captures++;fs.writeFileSync(out+'/'+label+'.png',shot.png);transport.publish(out+'/'+label+'-state.json',{canvas:fixtures[scene].canvas});return shot.capture;}
 context.capture=shot;vm.createContext(context);vm.runInContext(caller+';globalThis.execute=execute;',context);
 const review=(scene='menu',extra={})=>transport.publish(out+'/'+context.latest.label+'-review.json',{...context.latest,review:'Explicit offline retained frame review',scene,...extra});
 let number=0;
 async function command(c){const n=number++;const pending=transport.request(out,c.id,c,2000);pending.catch(()=>{});for(let i=0;!fs.existsSync(out+'/commands/'+n+'.json');i++){assert(i<100);await new Promise(r=>setTimeout(r,1));}let error;try{await transport.consume(out,n,context.execute);}catch(e){error=e;}try{await pending;}catch(e){if(!error)throw e;}if(error)throw error;}
 await shot('startup');review(mode==='title-transition'?'title':'menu');
 if(mode==='stale'){now+=120001;}
 if(mode==='wrong-owner')page.apps[0].processId=99;
 if(mode==='title-transition'){pixels=scene='a';await command({id:'observe',action:'capture',label:'observed',reviewRef:'startup',flow:'observe-menu',waitMs:0});review();}
 const settle={id:'settle',action:'capture',flow:'settle-menu',label:'settled',reviewRef:context.latest.label,waitMs:250,settleTarget:[216,179,162,33],menuState:spec};
 if(['stale','wrong-owner','title-during-settle'].includes(mode))await assert.rejects(()=>command(settle),/stale|identity changed|text|geometry|modal/);
 else {
 await command(settle);review('menu',{settledMenu:true});afterArm=true;
 if(mode==='quit-overlay')pixels='quit';if(mode==='title-replaced')pixels='title';if(mode==='missing-menu')pixels='blank';if(mode==='missing-label')pixels='text';
 if(mode==='anchor-unchanged'){context.require=n=>n==='./native-mouse.cjs'?{perform:async()=>{effects++;return {};}}:state;await command({id:'anchor',action:'move',label:'anchored',reviewRef:'settled',menuAdmission:true,anchorOriginalCursor:{x:8,y:8},point:[8/640,8/480],waitMs:0});}
 else {const c={id:'multiplay',action:'click',flow:'transition',label:'multiplay',reviewRef:'settled',menuTarget:[216,179,162,33],point:[300/640,198/480],waitMs:0,holdMs:100};
 if(['quit-overlay','title-replaced','missing-menu','missing-label','change-after-arm','change-after-owner-read','wrong-owner-after-arm','stale-after-arm'].includes(mode))await assert.rejects(()=>command(c),/modal|geometry|text|identity changed|freshness/);else await command(c);}
 }
 if(dead){const before=trace.length,cap=captures,count=fs.readdirSync(out+'/commands').length;
 for(const action of ['click','capture','quit']){await assert.rejects(()=>context.execute({id:'later-'+action,action,label:'later',waitMs:0},()=>effects++));await assert.rejects(()=>transport.request(out,'transport-'+action,{id:'transport-'+action,action,label:'later',point:[.5,.5],holdMs:100,waitMs:0},100));}
 assert.equal(trace.length,before);assert.equal(captures,cap);assert.equal(effects,0);assert.equal(fs.readdirSync(out+'/commands').length,count);}
 else assert.equal(effects,1);
 return {mode,passed:true,actualEmittedCaller:true,actualBoundChain:true,actualNumberedTransport:true,offlineCDPPixels:true,sticky:!!dead,effects,captures,maxAgeMs:bound.MAX_AGE_MS};
}
(async()=>{fs.mkdirSync(evidence,{recursive:true});const results=[];for(const mode of ['animated-positive','anchor-unchanged','title-transition','title-during-settle','stale','wrong-owner','quit-overlay','title-replaced','missing-menu','missing-label','change-after-arm','change-after-owner-read','wrong-owner-after-arm','stale-after-arm'])results.push(await fixture(mode));assert(source.includes('},20000)'));assert.equal(bound.MAX_AGE_MS,120000);fs.writeFileSync(evidence+'/results.json',JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify({passed:true,results}));})().catch(e=>{console.error(e);process.exitCode=1;});
