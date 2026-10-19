'use strict';
// Original July 1998 readme: Numpad8 moves forward. No sign-dismiss guess.
const flags=['--trace-input'];
async function observeMovement(send,wait,save){
  await send('png','movement-before.png');
  let released=false;
  try {
    // Release even when delivery acknowledgement fails: delivery may have occurred.
    await send('cmd','keydown:104');
    await wait(750);
  } finally {
    await send('cmd','keyup:104');
    released=true;
  }
  await send('png','movement-after.png');
  await send('snapshot');
  save({key:104,holdWallMs:750,released,movementRequiresVisualReview:true});
}
module.exports={flags,observeMovement};
if(require.main===module){
  const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
  const [bundle,out,reviewed]=process.argv.slice(2);
  assert(bundle&&out&&path.isAbsolute(bundle)&&path.isAbsolute(out)&&reviewed==='--bootcamp-visually-reviewed');
  assert(fs.existsSync(path.join(out,'child.json'))&&!fs.existsSync(path.join(out,'postflight.json')),'live granted observation only');
  const receipt=path.join(out,'movement-input.json');assert(!fs.existsSync(receipt),'one movement sequence only');
  const events=[];fs.writeFileSync(receipt,JSON.stringify({started:new Date().toISOString(),events}));
  const save=v=>fs.writeFileSync(receipt,JSON.stringify({...v,events},null,2)+'\n');
  const send=async(cmd,arg)=>{
    const args=[path.join(bundle,'runtime/tools/ctl.js'),'-s',':8143',cmd];
    if(arg)args.push(cmd==='png'?path.join(out,arg):arg);
    try {const result=cp.execFileSync(process.execPath,args,{encoding:'utf8',timeout:3000,maxBuffer:256*1024});events.push({cmd,arg,result,at:new Date().toISOString()});save({pending:true});}
    catch(e){events.push({cmd,arg,error:e.message,at:new Date().toISOString()});save({failed:true});throw e;}
  };
  observeMovement(send,ms=>new Promise(r=>setTimeout(r,ms)),save).catch(async e=>{
    // Failed release must not leave an unattended held key; ordinary quit only.
    try {await send('quit');} catch (_) {}
    save({failed:true,error:e.message});process.exitCode=1;
  });
}
