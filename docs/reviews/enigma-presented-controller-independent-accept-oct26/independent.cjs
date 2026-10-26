'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {MENU,createController}=require('../../../tools/enigma-presented-menu-controller.cjs');
const parts=require('./runner-slices.json');
const png=fs.readFileSync(path.join(__dirname,'../../re-notes/enigma-start-game-menu-click-api-oct26/predecessor-menu.png'));
function fixture(fault) {
 const files=new Map(),events=[];let paints=0;
 const canvas={width:640,height:480,ready:fault==='eager',toBufferSync(){assert(this.ready);events.push('serialize');return Buffer.from(png)}};
 const renderer={canvas,windows:{main:{hwnd:1,title:MENU.title,visible:true}},repaint(){paints++;canvas.ready=true}};
 const original=renderer.repaint;
 const fakeFS={existsSync:p=>files.has(p),writeFileSync:(p,b)=>files.set(p,b),statSync:p=>({isFile:()=>true,size:files.get(p).length}),readFileSync:p=>files.get(p)};
 const context=vm.createContext({Buffer,renderer,fs:fakeFS,process:{getBuiltinModule:n=>n==='fs'?fakeFS:require('node:'+n)}});
 vm.runInContext(`
 const tickState={batch:100000},instance={exports:{get_eip:()=>0}},memory={},g2w=()=>0,ctx={},resolveAddr=()=>0,moduleBases={};
 let controlFrozen=true,controlRunCredits=0,videoRecorder=null;
 const batchClock={getTickMsPerBatch:()=>1},scheduledInput=[],liveOutstanding=new Map();
 let dxPresentHook=null;const presentDxIfDirty=()=>{};
 ${parts.presentForRead}
 ${parts.dxPresentHook}
 ${parts.parseInputEntries}
 ${parts.snapshotAndSafeValue}
 ${parts.controlEval}
 ${parts.controlPng}
 ${parts.handleControlCommand}
 globalThis.command=handleControlCommand;
 globalThis.schedule=scheduledInput;
 globalThis.state={tickState};
 globalThis.freezeFault=()=>{controlFrozen=false};
 globalThis.recordFault=()=>{videoRecorder={}};
 globalThis.creditsFault=()=>{controlRunCredits=1};
 globalThis.noHook=()=>{dxPresentHook=null};
 `,context);
 let evals=0;
 const ask=async cmd=>{
  events.push(cmd.action||cmd.cmd);
  try {
   if(cmd.action==='snapshot') {
    if(fault==='live')context.freezeFault();if(fault==='credits')context.creditsFault();if(fault==='recording')context.recordFault();
   }
   if(cmd.action==='png'&&fault==='noHook')context.noHook();
   if(cmd.action==='eval') {
    evals++;
    if(evals===3) {
     // Faults at the cleanup request boundary; retain real runner handler.
     if(fault==='lostWitness')vm.runInContext('for(const k of Object.getOwnPropertySymbols(globalThis))if(Symbol.keyFor(k)?.startsWith("wine.enigma.presented-menu."))delete globalThis[k]',context);
     if(fault==='lateBatch')context.state.tickState.batch++;
     if(fault==='replacedWrapper')renderer.repaint=()=>{};
     if(fault==='cleanupError')return {ok:false,error:'injected cleanup transport error'};
    }
   }
   let value=await context.command(cmd);
   if(cmd.action==='png'&&fault==='badPath')value.path='/wrong.png';
   if(cmd.action==='png'&&fault==='changedFrame'){let b=Buffer.from(files.get(cmd.path));b[b.length-20]^=1;files.set(cmd.path,b)}
   if(cmd.action==='eval'&&evals===2&&fault==='badEnvelope')return {ok:false,error:'injected read error'};
   return {ok:true,value};
  }catch(e){return {ok:false,error:e.message}}
 };
 return {run:createController(ask,'/owned/fresh.png'),context,renderer,original,events,get paints(){return paints}};
}
(async()=>{
 const results=[];
 for(const name of ['lazy','eager','live','credits','recording','noHook','badPath','changedFrame','badEnvelope','replacedWrapper','cleanupError','lostWitness','lateBatch']) {
  const f=fixture(name);let error=null;
  try{await f.run()}catch(e){error=e.message}
  const clicks=f.context.schedule.filter(e=>e.action==='click');
  const positive=['lazy','eager'].includes(name),defect=['lostWitness','lateBatch'].includes(name);
  if(positive){assert.equal(error,null);assert.equal(clicks.length,1);assert.equal(clicks[0].x,344);assert.equal(clicks[0].y,212);assert.equal(f.renderer.repaint,f.original)}
  else if(!defect){assert(error);assert.equal(clicks.length,0)}
  else {assert.equal(clicks.length,1,'unchanged candidate reproducer must queue unsafe click');if(name==='lostWitness'){assert.equal(error,null);assert.notEqual(f.renderer.repaint,f.original)}else assert.match(error,/acknowledgement invalid/)}
  await assert.rejects(f.run(),/consumed/);assert.equal(f.context.schedule.filter(e=>e.action==='click').length,clicks.length);
  const row={name,error,queuedClicks:clicks.length,wrapperRestored:f.renderer.repaint===f.original,paints:f.paints,result:defect?'DEFECT_REPRODUCED':'PASS'};
  results.push(row);console.log(JSON.stringify(row));
 }
 console.log(JSON.stringify({verdict:'REJECT',controls:11,unchangedDefects:2,guestExecutions:0,results}));
})().catch(e=>{console.error(e);process.exitCode=1});
