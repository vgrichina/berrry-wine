'use strict';
// Ordinary authored dialogs: accept, return from DialogBox, create a second
// dialog, and exit. This proves entry ordering without host-driven pumping.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
function fixture(){
 const b=require('./test-vb5-native-dialog-identity.cjs').fixture({simpleButton:true}),raw=r=>r-0x1000+0x200,u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 // End each modal normally from WM_INITDIALOG; record two separate HWNDs.
 const code=Buffer.from([0x81,0x7c,0x24,8,...u32(0x110),0x75,14,0x6a,1,0xff,0x74,0x24,8,0xff,0x15,...u32(0x401954),0x31,0xc0,0xb8,1,0,0,0,0xc2,16,0]);
 code.copy(b,raw(0x2300));code.copy(b,raw(0x2400));return b;
}
async function run(out){
 fs.mkdirSync(out,{recursive:true});const exe=path.join(out,'authored-agreement.exe');fs.writeFileSync(exe,fixture());
 const wd=cp.spawn(process.execPath,['-e',"let pid;let t=setTimeout(()=>{if(pid)try{process.kill(-pid,'SIGKILL')}catch{};process.exit(2)},20000);console.log('ARMED');process.stdin.on('data',b=>pid=+b);process.stdin.on('end',()=>clearTimeout(t))"]);let wo='',we='';wd.stdout.on('data',b=>wo+=b);wd.stderr.on('data',b=>we+=b);const ww=new Promise(r=>wd.on('close',r));while(!wo.includes('ARMED'))await new Promise(r=>setTimeout(r,5));
 const p=cp.spawn(process.execPath,['--require',path.resolve('tools/native-lifecycle-trace.cjs'),'test/run.js','--exe='+exe,'--no-build','--real-ticks','--max-seconds=12','--max-batches=1000000','--quiet-blocks','--quiet-api','--trace-api=EndDialog,DestroyWindow,ExitProcess,DialogBoxParamA,CreateWindowExA'],{detached:true,env:{...process.env,WINE_NATIVE_LIFECYCLE_TRACE:out}});wd.stdin.write(String(p.pid));let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);const exit=await new Promise(r=>p.on('close',r));wd.stdin.end();const wx=await ww;
 fs.writeFileSync(path.join(out,'native.log'),stdout+stderr);const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2));save('native-wait.json',{pid:p.pid,exit,actualWait:true,stdoutEOF:p.stdout.readableEnded,stderrEOF:p.stderr.readableEnded});save('watchdog-wait.json',{pid:wd.pid,exit:wx,actualWait:true,stdoutEOF:wd.stdout.readableEnded,stderrEOF:wd.stderr.readableEnded,prearmed:true,stdout:wo,stderr:we});
 assert.equal(exit,0,stderr);assert.equal(wx,0);
 const rows=fs.readdirSync(out).filter(n=>n.endsWith('.jsonl')).flatMap(n=>fs.readFileSync(path.join(out,n),'utf8').trim().split('\n').map(JSON.parse));
 const api=rows.filter(r=>r.kind==='api-enter'),ends=api.filter(r=>r.name==='EndDialog');assert(ends.length>=3,JSON.stringify(api));assert(new Set(ends.map(r=>r.args[0])).size>=3);assert(api.some(r=>r.name==='CreateWindowExA'));assert(api.some(r=>r.name==='ExitProcess'));assert(!rows.some(r=>r.kind==='trace-limit'));
 save('proof.json',{passed:true,noOriginal:true,ordinaryAuthoredDialogOrdering:true,apiNames:api.map(r=>r.name),endDialogHWNDs:ends.map(r=>r.args[0]),nativeExit:true,prearmedWatchdog:true});console.log('PASS ordinary modal teardown -> main creation -> modal completion -> ExitProcess trace');
}
// Modeless wizard pages can be separated by a windowless interval. A queued
// thread message drives the next page after DestroyWindow returns. USER must
// not substitute WM_QUIT for that message. The final explicit quit must still
// end GetMessage, and ExitProcess must still reach the host.
function modelessFixture({explicitQuit=false}={}){
 const b=require('./test-sims-child-mount-native.cjs').untitledModal();
 const names=['RegisterClassA','DefWindowProcA','CreateWindowExA','DestroyWindow','PostMessageA','GetMessageA','PostQuitMessage'];
 const raw=r=>r-0x1000+0x200,u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 b.fill(0,raw(0x1940),raw(0x1980));let p=0x1b00;
 for(const [i,n]of names.entries()){b.writeUInt32LE(p,raw(0x1940+i*4));b.write(n+'\0',raw(p+2));p+=n.length+3;}
 b.write('Wizard agreement\0',raw(0x2570));b.write('Wizard next page\0',raw(0x25b0));
 const c=[],fix=[],labels={};const e=(...v)=>c.push(...v),push=n=>e(0x68,...u32(n)),call=i=>e(0xff,0x15,...u32(0x401940+i*4));
 const jump=(op,label)=>{e(...op,0,0,0,0);fix.push([c.length-4,label]);};
 const create=title=>{for(const n of [0,0x400000,0,0,200,300,30,30,0x90000000,title,0x402500,0])push(n);call(2);};
 const get=()=>{for(const n of [0,0,0,0x402700])push(n);call(5);};
 const exit=n=>{push(n);e(0xff,0x15,...u32(0x401900),0xcc);};
 e(0xa1,...u32(0x401944),0xa3,...u32(0x402604));push(0x402600);call(0);
 create(0x402570);e(0x89,0xc6);
 for(const n of [0,0,0x8001,0])push(n);call(4);
 if(explicitQuit){push(0);call(6);}
 e(0x56);call(3);
 labels.read=c.length;get();e(0x85,0xc0);jump([0x0f,0x84],explicitQuit?'success':'failure');
 e(0x81,0x3d,...u32(0x402704),...u32(0x8001));jump([0x0f,0x85],'read');
 if(explicitQuit)jump([0xe9],'failure');
 create(0x4025b0);push(0);call(6);get();e(0x85,0xc0);jump([0x0f,0x85],'failure');
 labels.success=c.length;exit(0);labels.failure=c.length;exit(71);
 for(const [at,label]of fix){const v=Buffer.alloc(4);v.writeInt32LE(labels[label]-at-4);for(let i=0;i<4;i++)c[at+i]=v[i];}
 assert(c.length<0x500);b.set(c,raw(0x2000));return b;
}
async function modelessRun(out,{expectSynthetic=false}={}){
 const {supervise}=require('../tools/native-supervise.cjs');
 fs.mkdirSync(out,{recursive:true});
 for(const explicitQuit of [false,true]){
  const dir=path.join(out,explicitQuit?'explicit':'transition');fs.mkdirSync(dir);
  const exe=path.join(dir,'wizard.exe');fs.writeFileSync(exe,modelessFixture({explicitQuit}));
  const log=fs.openSync(path.join(dir,'native.log'),'wx');
  const receipt=await supervise(path.join(dir,'supervisor'),[process.execPath,'--require',path.resolve('tools/native-lifecycle-trace.cjs'),'test/run.js','--exe='+exe,'--no-build','--real-ticks','--max-seconds=8','--max-batches=1000000','--quiet-api','--quiet-blocks','--trace-api=DestroyWindow,GetMessageA,PostQuitMessage,ExitProcess,CreateWindowExA'],{deadline:Date.now()/1000+20,cleanup_deadline:Date.now()/1000+25,env:{...process.env,WINE_NATIVE_LIFECYCLE_TRACE:dir},stdio:['ignore',log,log]});fs.closeSync(log);
  assert.equal(receipt.leaked,false);
  const rows=fs.readdirSync(dir).filter(n=>n.endsWith('.jsonl')).flatMap(n=>fs.readFileSync(path.join(dir,n),'utf8').trim().split('\n').map(JSON.parse));
  const apis=rows.filter(r=>r.kind==='api-enter');
  assert(apis.some(r=>r.name==='DestroyWindow'));
  const exits=apis.filter(r=>r.name==='ExitProcess');assert.equal(exits.length,1);
  const synthetic=expectSynthetic&&!explicitQuit;
  assert.equal(exits[0].args[0],synthetic?71:0);
  assert.equal(apis.filter(r=>r.name==='CreateWindowExA').length,explicitQuit||synthetic?1:2);
  assert.equal(rows.some(r=>r.kind==='state'&&r.quit===1),synthetic);
  assert.equal(apis.filter(r=>r.name==='PostQuitMessage').length,synthetic?0:1);
  assert.equal(rows.some(r=>r.kind==='state'&&r.quit===2),!synthetic);
  fs.writeFileSync(path.join(dir,'proof.json'),JSON.stringify({pass:true,explicitQuit,expectSynthetic,exitCode:exits[0].args[0],apiNames:apis.map(r=>r.name)},null,2));
 }
 console.log('PASS modeless windowless transition and genuine explicit quit/ExitProcess');
}
module.exports={fixture,run,modelessFixture,modelessRun};if(require.main===module)(process.argv[3]==='modeless'?modelessRun(path.resolve(process.argv[2]),{expectSynthetic:process.argv.includes('--expect-synthetic')}):run(path.resolve(process.argv[2])).then(()=>modelessRun(path.join(path.resolve(process.argv[2]),'modeless')))).catch(e=>{console.error(e);process.exitCode=1;});
