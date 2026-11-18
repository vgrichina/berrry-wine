'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),net=require('node:net'),assert=require('node:assert/strict');
const c=require('../tools/native-supervisor-common.cjs');
// Ordinary authored PE: NULL-owner warning before any main HWND, then a
// visibly distinct second NULL-owner modal. No proprietary image is modified.
function fixture(){
 const b=require('./test-sims-child-mount-native.cjs').untitledModal(),raw=r=>r-0x1000+0x200;
 const u=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24],code=[];
 const push=n=>code.push(0x68,...u(n)),call=n=>code.push(0xff,0x15,...u(n));
 b.writeUInt32LE(0x1c00,raw(0x1904));b.write('GetTickCount\0',raw(0x1c02));
 for(const text of [0x402580,0x402680]){
  for(const n of [0x30,0x402540,text,0])push(n);call(0x40194c);
  if(text===0x402580){
   call(0x401904);code.push(0x89,0xc6);const loop=code.length;
   call(0x401904);code.push(0x29,0xf0,0x3d,...u(350),0x72,0);code[code.length-1]=(loop-code.length)&255;
  }
 }
 push(0);call(0x401900);code.push(0xcc);b.fill(0,raw(0x2000),raw(0x2500));b.set(code,raw(0x2000));
 b.fill(0,raw(0x2540),raw(0x2600));b.write('Authored Drakan warning route\0',raw(0x2540));
 b.write('First NULL-owner warning before main.\0',raw(0x2580));b.write('SECOND visible modal transition.\0',raw(0x2680));return b;
}
async function main(out){
 out=path.resolve(out);fs.mkdirSync(out,{recursive:true});const a=require('../tools/drakan-authentic-reviewed.cjs');a.R=out;
 const exe=path.join(out,'authored.exe');fs.writeFileSync(exe,fixture(),{flag:'wx'});
 const prep=require('../tools/blood2-immutable-preparation.cjs'),base='6308e7a3be6c98ab150d07c2f178d8cd09f4b2e6';
 const rows=prep.collect([],{revision:base,media:[{path:path.relative(path.resolve(__dirname,'..'),exe),size:fs.statSync(exe).size,sha256:c.sha256(fs.readFileSync(exe))}]});
 for(const file of ['lib/renderer-input.js','lib/cli-native-scene.js']){const row=rows.find(r=>r.path===file),b=fs.readFileSync(path.resolve(__dirname,'..',file));Object.assign(row,{sha256:c.sha256(b),body:b.toString('base64')});}
 const frozen=prep.freeze(rows,fs.readFileSync(process.env.DRAKAN_TEST_MODULE));
 const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});a.URL='http://127.0.0.1:'+port+'/ctl';
 Object.assign(process.env,{DRAKAN_CONTROL_OUT:out,DRAKAN_CONTROL_URL:a.URL});
 const at=c.now(),deadline=at+240;a.save('launch.json',{at,deadline,gameplayCutoff:deadline-180,reserveSeconds:180,nativeScene:true,bindingContract:'native-reviewed-context-v1',inputPolicy:{confirmationMs:500,physicalUpMs:1750,observationMs:3000,gameFreshnessSeconds:15,menuFreshnessSeconds:30}});
 require('../tools/blood2-durable-launcher.cjs').launch({run:out,command:[process.execPath,'test/run.js','--exe='+exe,'--no-build','--threads','--real-ticks','--screen=1024x712','--control='+port,'--max-seconds=35','--quiet-api','--quiet-blocks','--no-close'],env:frozen.env,fds:frozen.fds,deadline:at+40,cleanupDeadline:at+55});frozen.close();
 try{
  const end=c.now()+15;for(;;){try{const s=await a.call({action:'snapshot'},.5);if(s.nativeMessageBox&&s.physicalUp)break;}catch{}assert(c.now()<end);await c.sleep(25);}
  await a.capture('first');const first=a.read('first.json');assert.equal(first.snapshot.mainHwnd,'0x0');assert.equal(first.snapshot.nativeMessageBox.controlClass,16);
  if(process.env.DRAKAN_CAPTURE_BASELINE){
   const original=c.postJSON;c.postJSON=(url,command,...rest)=>original(url,command.action==='native-presentation-capture'?{...command,action:'native-reviewed-capture'}:command,...rest);
   await assert.rejects(a.submit({review:'first',bind:true,name:'enter',key:13,ms:100,scene:'menu',observation:'Authored delayed transition baseline'}));
   assert.equal(a.read('enter-up.json').state,'ACK');assert(a.read('enter-down.json')[0].consumed);assert(fs.existsSync(path.join(out,'terminal-input-failure.json')));
   a.save('assertions.json',{pass:true,expectedOldFailure:true,consumed:true,independentUP:true,closedWithoutLaterEndpoint:true});return;
  }
  await a.submit({review:'first',bind:true,name:'enter',key:13,ms:100,scene:'menu',observation:'Automated authored NULL-owner warning only'});
  const next=a.read('enter.json');assert.notEqual(next.pngSHA256,first.pngSHA256);assert.notEqual(next.snapshot.modalHwnd,first.snapshot.modalHwnd);
  assert(next.snapshot.windows.some(w=>w.title.includes('SECOND visible')));assert.equal(a.read('enter-up.json').state,'ACK');assert(a.read('enter-down.json')[0].consumed);
  await a.capture('second');await a.submit({review:'second',name:'quit',key:13,ms:100,scene:'menu',route:'ordinary-enter',final:true,observation:'Automated authored second warning; ordinary OK exits'});
  a.save('assertions.json',{pass:true,preMain:true,realNativeNullOwner:true,visibleModalTransition:true,independentUP:true,first:first.pngSHA256,second:next.pngSHA256});
 }finally{
  if(!fs.existsSync(path.join(out,'native-wait.json')))a.save('cancel-request.json',{fixtureOnly:true});
  const end=c.now()+15;while(!fs.existsSync(path.join(out,'owner-complete.json'))){assert(c.now()<end);await c.sleep(25);}
  assert(a.read('owner-complete.json').retainedActualWaits);assert.equal(a.read('owner-complete.json').receipt.leaked,false);
 }
}
module.exports={fixture};if(require.main===module)main(process.argv[2]).catch(e=>{console.error(e);process.exitCode=1;});
