'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync(require.resolve('./dungeon-siege-fault-controller'), 'utf8');
for (const mode of ['no-grant', 'wrong-root', 'preflight-refusal']) {
  let probes = 0;
  const p = {argv:['node','controller','20261019-dungeon-siege-observer-original-1','--capture-fault','/receipt'], env:mode==='no-grant'?{}:{WA_DUNGEON_OBSERVER_GRANT:'20261019-dungeon-siege-observer-original-1'}};
  const fakeFs = {readFileSync:()=>JSON.stringify({plan:{root:mode==='wrong-root'?'/tmp/wa-recovery-20261014':'/tmp/wa-dungeon-thread-oct19'}}),realpathSync:x=>x,existsSync:()=>false};
  const fakeCp = {execFileSync:()=>{probes++;return JSON.stringify({ready:false,blockers:['disk admission']});},spawn:()=>assert.fail('No guest launch permitted')};
  assert.throws(()=>vm.runInNewContext(source,{require:n=>n==='node:fs'?fakeFs:n==='node:child_process'?fakeCp:require(n),process:p,__dirname:'/tools'}));
  assert.equal(probes,mode==='preflight-refusal'?1:0);
}
const leaseCode = source.slice(source.indexOf('const leasePath ='), source.indexOf('fs.mkdirSync(out);'));
for (const mode of ['own-absent','own-live','foreign','busy']) {
  let value = mode==='busy'?'foreign':null, removed=false;const hooks={};
  const fakeFs={openSync:()=>{assert.equal(value,null,'Busy lease');return 1;},writeSync:(_,s)=>{value=s;},closeSync(){},existsSync:()=>value!==null,readFileSync:()=>value,unlinkSync:()=>{removed=true;value=null;}};
  const p={pid:1,on:(n,f)=>{hooks[n]=f;},kill:()=>{if(mode!=='own-live')throw Object.assign(Error(),{code:'ESRCH'});}};
  const context=vm.createContext({fs:fakeFs,process:p,id:'id',root:'/isolated',receipt:{plan:{source:'source'}}});
  if(mode==='busy'){assert.throws(()=>vm.runInContext(leaseCode,context));assert(!removed);continue;}
  vm.runInContext(leaseCode,context);if(mode==='foreign')value='foreign';
  vm.runInContext('activePid=123;release()',context);
  assert.equal(removed,mode==='own-absent');
}
assert(source.includes("'--no-threads'"));assert(source.includes("args.splice(args.indexOf('--control=8141'), 1)"));
console.log('PASS fault controller rejects missing grant/wrong root/preflight before spawn; lease busy/live/foreign protections.');
