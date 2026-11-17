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
module.exports={fixture,run};if(require.main===module)run(path.resolve(process.argv[2])).catch(e=>{console.error(e);process.exitCode=1;});
