'use strict';
// Real loopback transport: optional observations cannot serialize/ack a
// pending command. The trace has no writes until process exit and is bounded.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {spawn}=require('node:child_process');
const {startControlServer}=require('../lib/control-server');
const out=process.env.LTRIS_PHASE_TEST_OUT;
async function post(port,body){return new Promise((resolve,reject)=>{const r=http.request({host:'127.0.0.1',port,path:'/ctl',method:'POST'},s=>{let b='';s.on('data',x=>b+=x);s.on('end',()=>resolve(JSON.parse(b)));});r.on('error',reject);r.end(JSON.stringify(body));});}
async function child(){
 let entered=false,resolvePending;const pending=new Promise(r=>resolvePending=r);
 const server=startControlServer({port:0,onCommand:cmd=>{if(cmd.action==='delayed'){entered=true;return pending;}return cmd.value;}});
 await new Promise(r=>server.server.once('listening',r));const port=server.server.address().port;
 let finished=false;const p=post(port,{action:'delayed',guard:{nonce:'phase-delayed'}}).then(v=>{finished=true;return v;});
 while(!entered)await new Promise(r=>setImmediate(r));
 await new Promise(r=>setTimeout(r,75));assert.equal(finished,false);assert.equal(fs.statSync(process.env.WINE_CONTROL_PHASE_TRACE).size,0,'trace I/O deferred');
 resolvePending('real result');assert.deepEqual(await p,{ok:true,value:'real result'});
 for(let i=0;i<240;i++)assert.deepEqual(await post(port,{action:'echo',value:i}),{ok:true,value:i});
 assert.equal(fs.statSync(process.env.WINE_CONTROL_PHASE_TRACE).size,0);server.close();
}
if(process.argv.includes('--child'))child().catch(e=>{console.error(e);process.exitCode=1;});
else (async()=>{
 assert(out,'set LTRIS_PHASE_TEST_OUT to an evidence directory');fs.mkdirSync(out,{recursive:true});
 const file=path.resolve(out,'phases.json');const args=[__filename,'--child'];
 const p=spawn(process.execPath,args,{env:{...process.env,WINE_CONTROL_PHASE_TRACE:file},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',x=>stdout+=x);p.stderr.on('data',x=>stderr+=x);
 const wait=await new Promise(r=>p.on('close',(code,signal)=>r({pid:p.pid,code,signal,actualWait:true,stdoutEOF:p.stdout.readableEnded,stderrEOF:p.stderr.readableEnded,stdout,stderr})));
 fs.writeFileSync(path.join(out,'wait.json'),JSON.stringify(wait,null,2)+'\n');assert.equal(wait.code,0,stderr);assert(wait.stdoutEOF&&wait.stderrEOF);
 const v=JSON.parse(fs.readFileSync(file));assert.equal(v.rows.length,2048);assert(v.dropped>0);
 const rows=v.rows.filter(x=>x.id===1);assert.deepEqual(rows.map(x=>x.phase),['request','body-parsed','command-enter','command-return','promise-resolved','serialize-enter','serialize-return','response-end','response-finish']);
 assert(rows[4].ms-rows[3].ms>=65,'pending wait retained');assert.equal(rows[2].nonce,'phase-delayed');
 console.log('PASS real delayed transport, exact response phases, deferred trace writes, bounded rows, actual child wait/EOF');
})().catch(e=>{console.error(e);process.exitCode=1;});
