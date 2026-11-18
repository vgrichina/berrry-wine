'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const c=require('../tools/native-supervisor-common.cjs'),admit=require('../tools/drakan-launch-readiness.cjs');
async function main(out){
 out=path.resolve(out);fs.mkdirSync(out,{recursive:true});
 const module=fs.readFileSync(process.env.DRAKAN_TEST_MODULE),exe=path.join(out,'authored.exe');
 fs.writeFileSync(exe,require('../tools/drakan-startup-readiness.cjs').fixture(),{flag:'wx'});
 const prep=require('../tools/blood2-immutable-preparation.cjs'),rows=prep.collect([],{revision:'6308e7a3be6c98ab150d07c2f178d8cd09f4b2e6',media:[{path:path.relative(process.cwd(),exe),size:fs.statSync(exe).size,sha256:c.sha256(fs.readFileSync(exe))}]});
 const frozen=prep.freeze(rows,module),results=[];
 try{for(const mode of ['delayed','earlyexit','timeout']){
  const run=path.join(out,mode);fs.mkdirSync(run);const at=c.now();c.save(run,'launch.json',{at,deadline:at+30});
  const command=mode==='earlyexit'?[process.execPath,'-e','process.exit(7)']:[process.execPath,'test/run.js','--exe='+exe,'--no-build','--threads','--real-ticks','--screen=1024x712','--max-seconds=15','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--no-close'];
  let launchPromise;
  if(mode==='delayed'){
   assert.throws(()=>c.readJSON(run+'/native-pid.json'),/ENOENT/,'old immediate read fails');
   launchPromise=c.sleep(300).then(()=>require('../tools/blood2-durable-launcher.cjs').launch({run,command,env:frozen.env,fds:frozen.fds,deadline:at+20,cleanupDeadline:at+25}));
   const ready=await admit.wait(run);assert(ready.at-at>=.3);await launchPromise;
   // The real compiled native PE/Worker must execute, not only spawn.
   const end=c.now()+10;while(!fs.readFileSync(run+'/native.stdout.log','utf8').includes('MessageBox')){assert(c.now()<end,'authored native warning');await c.sleep(25);}
   c.save(run,'cancel-request.json',{fixtureOnly:true});
  }else{
   require('../tools/blood2-durable-launcher.cjs').launch({run,command,env:frozen.env,fds:frozen.fds,deadline:at+20,cleanupDeadline:at+25});
   if(mode==='earlyexit'){
    while(!fs.existsSync(run+'/native-wait.json')){assert(c.now()<at+10);await c.sleep(10);}
    await assert.rejects(admit.wait(run),/launch closed/);
   }else{
    // 1ms cannot admit receipts from asynchronous detached supervision.
    await assert.rejects(admit.wait(run,{timeoutMs:1}),/expired/);
    c.save(run,'cancel-request.json',{fixtureOnly:true});
   }
  }
  while(!fs.existsSync(run+'/owner-complete.json')){assert(c.now()<at+26);await c.sleep(25);}
  const owner=c.readJSON(run+'/owner-complete.json');assert(owner.retainedActualWaits);assert.equal(owner.receipt.leaked,false);results.push({mode,pass:true,owner});
 }}finally{frozen.close();}
 c.save(out,'assertions.json',{pass:true,oldImmediateReceiptReadFails:true,delayedRealNativePEPasses:true,earlyExitRefused:true,timeoutRefused:true,endpointRequests:0,results});
}
main(process.argv[2]).catch(e=>{console.error(e);process.exitCode=1});
