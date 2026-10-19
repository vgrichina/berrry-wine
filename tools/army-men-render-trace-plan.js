'use strict';
// Original July 1998 readme: Numpad6 turns right; Numpad8 moves forward. No sign-dismiss guess.
const apiNames=['IDirectDrawSurface_Blt','IDirectDrawSurface_BltFast','IDirectDrawSurface_Lock','IDirectDrawSurface_Unlock','IDirectDrawSurface_Flip','StretchBlt','BitBlt','<ord>'];
const memorySpecs=['IDirectDrawSurface_Blt:0:8','IDirectDrawSurface_Blt:1:16','IDirectDrawSurface_Blt:2:8','IDirectDrawSurface_Blt:3:16','IDirectDrawSurface_BltFast:0:8','IDirectDrawSurface_BltFast:3:8','IDirectDrawSurface_BltFast:4:16','IDirectDrawSurface_Lock:0:8','IDirectDrawSurface_Lock:1:16','IDirectDrawSurface_Lock:2:108'];
const flags=['--trace-input','--trace-api='+apiNames.join(','),'--trace-api-paused','--trace-api-mem='+memorySpecs.join(',')];
const steps={turn:{key:102,holdMs:250}};
async function observeMovement(send,wait,save,step){
  const spec=steps[step];if(!spec)throw Error('expected turn');
  await send('png',step+'-before.png');
  let released=false;
  try {
    await send('trace',true);
    try {
    // Release even when delivery acknowledgement fails: delivery may have occurred.
    await send('cmd','keydown:'+spec.key);
    await wait(spec.holdMs);
  } finally {
    await send('cmd','keyup:'+spec.key);
    released=true;
    }
  } finally {
    await send('trace',false);
  }
  await send('png',step+'-after.png');
  await send('snapshot');
  save({step,key:spec.key,holdWallMs:spec.holdMs,released,movementRequiresVisualReview:true});
}
module.exports={flags,apiNames,memorySpecs,steps,observeMovement};
if(require.main===module){
  const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
  const [bundle,out,step,reviewed]=process.argv.slice(2);
  assert(bundle&&out&&path.isAbsolute(bundle)&&path.isAbsolute(out)&&steps[step]&&reviewed==='--scene-visually-reviewed');
  assert(fs.existsSync(path.join(out,'child.json'))&&!fs.existsSync(path.join(out,'postflight.json')),'live granted observation only');
  const receipt=path.join(out,step+'-input.json');assert(!fs.existsSync(receipt),'one movement sequence only');
  const events=[];fs.writeFileSync(receipt,JSON.stringify({started:new Date().toISOString(),events}));
  const save=v=>fs.writeFileSync(receipt,JSON.stringify({...v,events},null,2)+'\n');
  const send=async(cmd,arg)=>{
    const args=[path.join(bundle,'runtime/tools/ctl.js'),'-s',':8143',cmd==='trace'?'pipe':cmd];
    if(cmd!=='trace'&&arg)args.push(cmd==='png'?path.join(out,arg):arg);
    try {const result=cp.execFileSync(process.execPath,args,{encoding:'utf8',timeout:3000,maxBuffer:256*1024,input:cmd==='trace'?JSON.stringify({action:'trace-api',on:arg})+'\n':undefined});events.push({cmd,arg,result,at:new Date().toISOString()});save({pending:true});}
    catch(e){events.push({cmd,arg,error:e.message,at:new Date().toISOString()});save({failed:true});throw e;}
  };
  observeMovement(send,ms=>new Promise(r=>setTimeout(r,ms)),save,step).catch(async e=>{
    // Failed release must not leave an unattended held key; ordinary quit only.
    try {await send('quit');} catch (_) {}
    save({failed:true,error:e.message});process.exitCode=1;
  });
}
