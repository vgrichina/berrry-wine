'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http');
const {preflight}=require('../tools/alice-prepared-control.cjs');
for(const end of [100,101])assert.deepEqual(preflight({intent:'gameplay',key:87,end,at:90,cutoff:100,quitPhase:false}),{allowed:false,state:'NOT_SENT',quitPhase:true,reason:'preserve immutable Quit reserve'});
assert(preflight({intent:'gameplay',key:87,end:99.999,at:90,cutoff:100,quitPhase:false}).allowed);
assert(!preflight({intent:'gameplay',key:87,end:99,at:90,cutoff:100,quitPhase:true}).allowed);
assert(preflight({intent:'quit',key:27,route:'ordinary-escape',end:110,at:101,cutoff:100,quitPhase:true}).allowed);
assert(!preflight({intent:'quit',key:87,route:'ordinary-escape',end:110,at:101,cutoff:100,quitPhase:true}).allowed);
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alice-local-refusal-'));let requests=0;
 const server=http.createServer((req,res)=>{requests++;res.end('{}');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
 const at=Date.now()/1000;fs.writeFileSync(path.join(dir,'endpoint.json'),JSON.stringify({url:'http://127.0.0.1:'+server.address().port+'/ctl'}));
 fs.writeFileSync(path.join(dir,'launch.json'),JSON.stringify({at:at-10,deadline:at+305,gameplayCutoff:at+5,reserveSeconds:300}));
 const before=fs.readFileSync(path.join(dir,'launch.json'));
 const r=await new Promise(resolve=>{const p=cp.spawn(process.execPath,[path.resolve(__dirname,'../tools/alice-prepared-control.cjs'),'pulse','refused','absent-review','87','game'],{env:{...process.env,ALICE_CONTROL_OUT:dir},stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.once('close',code=>resolve({code,out,err}));});
 assert.equal(r.code,0,r.err);assert.match(r.out,/NOT_SENT/);assert.equal(requests,0);
 assert.deepEqual(fs.readFileSync(path.join(dir,'launch.json')),before);
 assert.deepEqual(fs.readdirSync(dir).sort(),['endpoint.json','launch.json','quit-phase.json','refused-rejection.json']);
 const refusal=JSON.parse(fs.readFileSync(path.join(dir,'refused-rejection.json')));assert.equal(refusal.effects,false);assert.equal(refusal.state,'NOT_SENT');
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'quit-phase.json'))).irreversible,true);
 console.log('PASS full-operation cutoff before review/owner/lease/UP: zero HTTP, no input state mutation, known NOT_SENT, irreversible Quit transition; ordinary Quit remains admitted');
 }finally{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
