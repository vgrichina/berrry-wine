'use strict';
const fs=require('fs'),vm=require('vm'),os=require('os'),path=require('path'),assert=require('assert/strict');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'direct-preflight-'));try{
fs.mkdirSync(dir+'/browser');fs.writeFileSync(dir+'/observe-browser.js','');
let s=fs.readFileSync(__dirname+'/browser-driver.cjs','utf8').split('main().catch')[0]+'\nglobalThis.t={command,set:p=>page=p};';
const c={require,__dirname:dir,process:{cwd:()=>dir},setTimeout,clearTimeout,console};vm.runInNewContext(s,c);
let steps=0,bad=false,moved;
const ack=n=>({requested:n,ran:n,steps:steps+=n,frozen:true,hosts:1,tickMs:16,guests:[{requested:n,ran:bad?n-1:n,steps,running:true,frozen:true,tickMs:16}]});
c.t.set({evaluate:async(f,n)=>n===undefined?{tick:{steps}}:ack(n),mouse:{move:async(x,y)=>moved={x,y}}});
fs.writeFileSync(dir+'/browser/review.png','fixture');
await c.t.command({action:'mousemove',x:337.3375,y:360.4433333333333,reviewRef:'review'},0);assert.equal(moved.x,337.3375);assert.equal(moved.y,360.4433333333333);
await c.t.command({action:'step',n:64},1);bad=true;await assert.rejects(c.t.command({action:'step',n:64},2),/incomplete frozen ACK/);bad=false;
for(const x of [NaN,Infinity,-1,1201])await assert.rejects(c.t.command({action:'mousemove',x,y:360,reviewRef:'review'},3),/viewport/);
for(const n of [0,65,1.5])await assert.rejects(c.t.command({action:'step',n},4),/1..64/);
for(let i=0;i<254;i++)await c.t.command({action:'step',n:64},i+5);
await assert.rejects(c.t.command({action:'step',n:64},260),/aggregate/);
console.log(JSON.stringify({pass:true,fractionalCrusaderCoordinates:true,perGuestAckRejected:true,step64Bound:true,aggregate16384:true}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
