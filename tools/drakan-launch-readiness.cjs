'use strict';
// Filesystem-only launch admission. Returning from detached spawn is not proof
// that the native child exists. This precedes all guarded capture/input calls.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const c=require('./native-supervisor-common.cjs');
async function wait(run,{timeoutMs=10000}={}){
 assert(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=10000);
 const launch=c.readJSON(path.join(run,'launch.json')),start=c.now(),end=Math.min(start+timeoutMs/1000,launch.deadline-2);
 for(;;){
  for(const file of ['terminal-input-failure.json','terminal-owner-exited.json','native-wait.json','owner-complete.json','watchdog-exit.json'])
   assert(!fs.existsSync(path.join(run,file)),'launch closed: '+file);
  assert(c.now()<end,'bounded native receipt wait expired');
  const names=['durable-owner.json','watchdog-armed.json','native-pid.json'];
  if(names.every(n=>fs.existsSync(path.join(run,n)))){
   const [owner,watchdog,native]=names.map(n=>c.readJSON(path.join(run,n)));
   assert.equal(c.token(owner.pid),owner.startToken,'owner identity');
   assert.equal(c.token(native.pid),native.startToken,'native identity');
   assert(c.processExists(watchdog.pid),'watchdog unavailable');
   assert(native.at>=launch.at&&native.at<=c.now(),'native receipt time');
   const result={at:c.now(),start,end,owner,native,watchdog,endpointRequested:false};
   c.save(run,'launch-ready.json',result);return result;
  }
  // A published owner that has already exited cannot later admit a child.
  const ownerFile=path.join(run,'durable-owner.json');
  if(fs.existsSync(ownerFile)){const owner=c.readJSON(ownerFile);assert.equal(c.token(owner.pid),owner.startToken,'owner identity');}
  await c.sleep(10);
 }
}
module.exports={wait};
