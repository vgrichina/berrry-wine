'use strict';
// Independent offline review only; synthetic observations are never VM results.
const fs = require('fs'), path = require('path'), a = require('assert/strict');
const crypto = require('crypto'), {spawnSync} = require('child_process');
const root = path.resolve(__dirname, '../../..');
const donor = '/home/user/wine-assembly-rich-edit-native-callback-fixture-oct23';
const h = require(path.join(root, 'test/test-richedit-stream-ownership-native'));
const old = require(path.join(donor, 'test/test-richedit-stream-ownership-native'));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const log = {native:'UNEXECUTED', checks:[], rejected:[]};
function reject(name, fn) { a.throws(fn, a.AssertionError); log.rejected.push(name); }
const manifest = JSON.parse(fs.readFileSync(path.join(donor, 'scratch/runs/20261023-richedit-stream-native-fixture/SHA256SUMS.json')));
for (const [p, sum] of Object.entries(manifest)) a.equal(hash(fs.readFileSync(path.join(donor,p))),sum,p);
log.checks.push(`donor ${Object.keys(manifest).length} artifact SHA256 seals verified in place`);
function git(dir,...args) {
  const r=spawnSync('git',['-C',dir,...args], {encoding:'utf8',env:{...process.env,GIT_NO_LAZY_FETCH:'1'}});
  a.equal(r.status,0,r.stderr); return r.stdout.trim();
}
const main='bb9c496ed13095cc832fdf607f0937fb9c14b7de';
const source='3c01665cdeb65ca7aebfdae7aec8dba4c3499884';
const file='src/09c3-wndprocs5-edit.wat';
const accepted=git('/home/user/wine-assembly','ls-tree',source,file).split(/\s+/)[2];
a.equal(accepted,'6e07d34aedf6199a419fcbe0bd79b7b6a409dd8f');
a.equal(git(donor,'ls-tree',main,file).split(/\s+/)[2],accepted);
a.equal(git(root,'hash-object',file),accepted);
log.checks.push('accepted source3c01665 and exact remote-main bb9c496 edit blob identical');
for (const kind of ['ordinary','nested','sliced','timeout','nested-timeout','capacity','error']) {
  const x=h.fixtures(kind), y=old.fixtures(kind);
  for (const field of ['exe','code','leafCode','boot']) a.deepEqual(x[field],y[field]);
  h.checkPe(x,kind);
}
log.checks.push('all seven PE/bootstrap/callback/leaf byte outputs unchanged by assertion correction');
const STACK=0x416000, CANARY=0x51ac0ffe;
const names=['eax','ecx','edx','ebx','esp','ebp','esi','edi','eip','steps','handler_set_eip','yield_reason','yield_flag'];
const before=Object.fromEntries(names.map((n,i)=>[n,n==='esp'?STACK:0x11000000+i]));
function observation(kind) {
 const timeout=kind==='timeout',error=kind==='error',nested=kind==='nested';
 const nb=Array.from({length:8},(_,r)=>r===4?STACK-24:0x33000000+r*0x101);
 return {callbackCount:timeout||error?1:2,trap:null,result:timeout||error?0:3,
 error:timeout?1:error?37:0,text:timeout||error?'':'OWN',before,after:{...before},canary:CANARY,
 abi:{cookie:0xc00c1234,capacity:timeout||error?4096:4093,ret:1,buffer:2,pcb:3},
 innerCount:nested?2:1,innerError:nested?0:1,innerText:nested?'in':'',nestedCanary:CANARY,
 nestedBefore:nb,nestedAfter:nb.map((v,r)=>r===0?nested?2:0:v),
 sliced:kind==='sliced'?0x51ce0001:0,siblings:70,siblingResults:210,siblingCallbacks:140};
}
for(const kind of ['ordinary','nested','sliced','timeout','nested-timeout','error']) {
 const o=observation(kind); h.checkObservations(o,kind);
 for(const field of ['callbackCount','result','error','canary','sliced','siblings','siblingResults','siblingCallbacks'])
   reject(`${kind}/${field}`,()=>h.checkObservations({...o,[field]:o[field]+1},kind));
 reject(`${kind}/text`,()=>h.checkObservations({...o,text:'incorrect'},kind));
 reject(`${kind}/unexpected-trap`,()=>h.checkObservations({...o,trap:'unreachable'},kind));
 for(const reg of names) reject(`${kind}/restore-${reg}`,()=>h.checkObservations({...o,after:{...o.after,[reg]:o.after[reg]+1}},kind));
 for(const field of ['cookie','capacity','ret','buffer','pcb']) reject(`${kind}/ABI-${field}`,()=>h.checkObservations({...o,abi:{...o.abi,[field]:field==='cookie'||field==='capacity'?0:0}},kind));
 if(kind.startsWith('nested')) {
  for(const field of ['innerCount','innerError','nestedCanary']) reject(`${kind}/${field}`,()=>h.checkObservations({...o,[field]:o[field]+1},kind));
  reject(`${kind}/innerText`,()=>h.checkObservations({...o,innerText:'wrong'},kind));
  for(let r=0;r<8;r++) reject(`${kind}/nested-register-${r}`,()=>h.checkObservations({...o,nestedAfter:o.nestedAfter.map((v,i)=>i===r?v+1:v)},kind));
 }
}
const cap={callbackCount:63,trap:'unreachable',returned:0,esp:STACK-20,expectedEsp:STACK-20,frame:Array.from({length:5},(_,i)=>CANARY+i)};
h.checkObservations(cap,'capacity');
for(let i=0;i<5;i++) reject(`capacity/frame-slot-${i}`,()=>h.checkObservations({...cap,frame:cap.frame.map((v,j)=>i===j?0:v)},'capacity'));
for(const [field,v] of [['callbackCount',62],['callbackCount',64],['trap',null],['returned',1],['esp',STACK-24]])
 reject(`capacity/${field}/${v}`,()=>h.checkObservations({...cap,[field]:v},'capacity'));
// Reproduce the precise old aggregate defect without interpreting any x86.
const badCalls=[{result:0,callbacks:1},{result:6,callbacks:3},...Array.from({length:68},()=>({result:3,callbacks:2}))];
const o=observation('ordinary');
o.siblingResults=badCalls.reduce((s,x)=>s+x.result,0);
o.siblingCallbacks=badCalls.reduce((s,x)=>s+x.callbacks,0);
old.checkObservations(o,'ordinary');
log.checks.push('original oracle accepts compensating bad siblings [0,6] results and [1,3] callbacks at unchanged totals210/140');
const good={result:3,callbacks:2,error:0,text:'OWN',canary:CANARY,after:{...before}};
h.checkSibling(good,before);
for(const [i,b] of badCalls.slice(0,2).entries()) reject(`sibling/compensating-call-${i}`,()=>h.checkSibling({...good,...b},before));
for(const [field,value] of [['text','wrong'],['error',37],['canary',0]]) reject(`sibling/${field}`,()=>h.checkSibling({...good,[field]:value},before));
for(const reg of names) reject(`sibling/restore-${reg}`,()=>h.checkSibling({...good,after:{...before,[reg]:before[reg]+1}},before));
for(const kind of ['sliced','timeout','nested-timeout']) {
 const f=h.fixtures(kind); let field='code';
 if(kind==='sliced') { const i=f.code.indexOf(Buffer.from([0xb9,0xa4,0x42,0x0f,0])); a(i>=0); f.code.writeUInt32LE(1,i+1); }
 else { if(kind==='nested-timeout')field='leafCode'; Buffer.from([0xb8,1,0,0,0]).copy(f[field],f[field].length-5); }
 f[field].copy(f.exe,field==='code'?0x1600:0x1a00);
 old.checkPe(f,kind);
 reject(`${kind}/short-or-nonspinning-fixture`,()=>h.checkPe(f,kind));
}
log.checks.push('original PE checker accepted shortened slice and deleted timeout spins; corrected checker rejects before native load');
const baseline=fs.readFileSync('/home/user/wine-assembly/scratch/runs/20261020-edit-stream-ownership/baseline.wat','utf8');
const s=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
reject('actual-prefixed-source-baseline',()=>h.checkWiring(baseline,s('09a5-handlers-window.wat'),s('09c3-controls.wat'),s('09c0-window-table.wat')));
log.baselineSha256=hash(Buffer.from(baseline));
log.status='OFFLINE_REVIEW_PASS_WITH_NARROW_CORRECTION';
log.rejectCount=log.rejected.length;
fs.writeFileSync(path.join(__dirname,'independent-checks.json'),JSON.stringify(log,null,2)+'\n');
console.log(JSON.stringify({status:log.status,native:log.native,rejectCount:log.rejectCount,checks:log.checks}));
