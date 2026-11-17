'use strict';
// New authored controls only. No imports of emulator/runtime/controller helpers.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {test}=require('node:test');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

// Event notification replaces the child's repeated 5ms confirmation polling.
// Absolute due time remains owned by the caller; waking grants no authority.
function releaseSignal() {
  let pending=null;
  return Object.freeze({
    wake(){pending?.();},
    waitUntil(due){
      assert.equal(pending,null,'one release waiter');
      return new Promise(resolve=>{
        const finish=()=>{clearTimeout(timer);pending=null;resolve();};
        const timer=setTimeout(finish,Math.max(0,due-Date.now()));pending=finish;
      });
    },
  });
}

function validateConfirmation(ack,expected) {
  assert.equal(ack.state,'CONFIRMED');
  for(const key of ['nonce','childToken','leaseToken','pid','startedAt'])assert.equal(ack[key],expected[key],key);
  assert.deepEqual(ack.native,expected.native,'native process/thread/window generation');
  assert.deepEqual(ack.pageIdentity,expected.pageIdentity,'actual renderer/module/page identity');
}

// A confirmation ACK and the parent's final fresh checks are independent work.
// Start both after ARM, join both (including failures), then allow COMPLETE.
// An ACK alone cannot admit DOWN. The independent watchdog remains authoritative.
async function confirmAndCheck({confirm,finalChecks,current,complete,now,startedAt}) {
  const jobs=[confirm,finalChecks].map(work=>Promise.resolve().then(work));
  const results=await Promise.allSettled(jobs);
  for(const result of results)if(result.status==='rejected')throw result.reason;
  current(results[0].value);
  assert(now()>=startedAt&&now()-startedAt<=500,'COMPLETE exceeded fixed 500ms');
  const receipt=await complete();
  assert(now()>=startedAt&&now()-startedAt<=500,'independent COMPLETE arrived late');
  return receipt;
}

// An immutable audit view owns private copies, validates exact Git blob bytes,
// and computes audit metadata once. This removes repeated *audit ledger* work;
// admission must still read/hash every selected file at each final freshness gate.
// Owned mutable paths are never members of this view.
function immutableAuditView(items,owned=[]) {
  const excluded=new Set(owned),data=new Map();
  for(const item of items){
    assert(typeof item.path==='string'&&!path.isAbsolute(item.path)&&!item.path.split('/').includes('..'));
    assert(!excluded.has(item.path)&&!data.has(item.path));
    const bytes=Buffer.from(item.bytes);
    const oid=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
    assert.equal(oid,item.oid,'immutable Git blob mismatch');
    data.set(item.path,{bytes,sha256:sha(bytes)});
  }
  return Object.freeze({
    read(name){const item=data.get(name);assert(item,'source absent from verified immutable view');return Buffer.from(item.bytes);},
    audit(name){const item=data.get(name);assert(item);return Object.freeze({path:name,sha256:item.sha256});},
  });
}

async function freshOwnedChecks(root,pins,read=fs.promises.readFile.bind(fs.promises)) {
  const seen=new Set();
  for(const pin of pins){
    assert(typeof pin.path==='string'&&!path.isAbsolute(pin.path)&&!pin.path.split('/').includes('..'));
    assert(!seen.has(pin.path)&&/^[a-f0-9]{64}$/.test(pin.sha256));seen.add(pin.path);
  }
  assert(seen.size,'fresh source set required');
  const results=await Promise.allSettled(pins.map(async pin=>{
    const bytes=await read(path.join(root,pin.path));
    const digest=Buffer.from(await crypto.webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
    assert.equal(digest,pin.sha256,'fresh source changed '+pin.path);
  }));
  for(const result of results)if(result.status==='rejected')throw result.reason;
}

function registerAuthoredControls(){
test('postarm confirmation starts alongside final checks; all guards precede COMPLETE',async()=>{
  const events=[];let release;const barrier=new Promise(resolve=>release=resolve);
  const task=confirmAndCheck({startedAt:100,now:()=>180,
    confirm:async()=>{events.push('confirm');await barrier;return {nonce:'current'};},
    finalChecks:async()=>{events.push('fresh');await barrier;events.push('checked');},
    current:ack=>{assert.equal(ack.nonce,'current');events.push('current');},
    complete:async()=>{events.push('COMPLETE');return {state:'COMPLETE'};}});
  await tick();assert.deepEqual(events,['confirm','fresh']);release();
  assert.equal((await task).state,'COMPLETE');
  assert.deepEqual(events,['confirm','fresh','checked','current','COMPLETE']);
});

test('confirmation, finite schedule and EOF wake the release child without polling',async()=>{
  const signal=releaseSignal();
  for(const event of ['confirmation','schedule','EOF']){
    let resolved=false;
    const waiter=signal.waitUntil(Date.now()+1000).then(()=>resolved=true);
    assert.throws(()=>signal.waitUntil(Date.now()+1000),/one release waiter/);
    assert.equal(resolved,false,event);signal.wake();await waiter;assert(resolved,event);
    signal.wake(); // No leftover callback may resolve a different wait.
  }
});

test('finite independent UP deadline wakes without parent confirmation or schedule',async()=>{
  const signal=releaseSignal(),due=Date.now()+10;
  await signal.waitUntil(due);assert(Date.now()>=due);
});

test('a refused final check joins pending confirmation and never completes',async()=>{
  let finished=false,release,completed=false;const barrier=new Promise(resolve=>release=resolve);
  const task=confirmAndCheck({startedAt:0,now:()=>10,
    confirm:async()=>{await barrier;finished=true;},finalChecks:async()=>{throw Error('source changed');},
    current:()=>{},complete:()=>{completed=true;}});
  const refused=assert.rejects(task,/source changed/);
  await tick();assert.equal(finished,false);release();await refused;
  assert(finished);assert.equal(completed,false);
});

for(const fault of ['wrong nonce','wrong generation','missing source','stale review','early EOF','permanent UNKNOWN']){
  test('confirmation refuses '+fault+' before COMPLETE',async()=>{
    let completed=false;
    await assert.rejects(confirmAndCheck({startedAt:0,now:()=>20,
      confirm:async()=>({fault}),finalChecks:async()=>{},current:ack=>assert.fail(ack.fault),
      complete:async()=>{completed=true;}}),new RegExp(fault));
    assert.equal(completed,false);
  });
}

test('every confirmation identity field is required independently',()=>{
  const expected={state:'CONFIRMED',nonce:'fresh-nonce',childToken:'current-child',leaseToken:'fresh-lease',
    pid:1234,startedAt:100,native:{processId:1000,threadId:1,generation:'2'},
    pageIdentity:{renderer:'actual-renderer',module:'actual-module',worker:'actual-worker'}};
  validateConfirmation(structuredClone(expected),expected);
  for(const key of Object.keys(expected)){
    const missing=structuredClone(expected);delete missing[key];
    assert.throws(()=>validateConfirmation(missing,expected),undefined,'missing '+key);
    const changed=structuredClone(expected);changed[key]=null;
    assert.throws(()=>validateConfirmation(changed,expected),undefined,'changed '+key);
  }
  for(const group of ['native','pageIdentity'])for(const key of Object.keys(expected[group])){
    const changed=structuredClone(expected);changed[group][key]='foreign';
    assert.throws(()=>validateConfirmation(changed,expected));
  }
});

for(const elapsed of [501,-1])test('no late or negative elapsed COMPLETE: '+elapsed,async()=>{
  let completed=false;
  await assert.rejects(confirmAndCheck({startedAt:100,now:()=>100+elapsed,
    confirm:async()=>({}),finalChecks:async()=>{},current:()=>{},
    complete:async()=>{completed=true;}}),/500ms/);
  assert.equal(completed,false);
});

test('an independent COMPLETE ACK arriving after 500ms is refused',async()=>{
  let at=400;
  await assert.rejects(confirmAndCheck({startedAt:0,now:()=>at,
    confirm:async()=>({}),finalChecks:async()=>{},current:()=>{},
    complete:async()=>{at=501;return {state:'COMPLETE'};}}),/arrived late/);
});

test('immutable view resists caller mutation and excludes owned mutable paths',()=>{
  const bytes=Buffer.from('verified source\n'),original=Buffer.from(bytes);
  const oid=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  const item={path:'lib/source.js',oid,bytes},view=immutableAuditView([item],['tools/owned.cjs']);
  bytes.fill(0);const first=view.read(item.path);first.fill(1);
  assert.deepEqual(view.read(item.path),original);assert.equal(view.audit(item.path).sha256,sha(original));
  assert.throws(()=>immutableAuditView([{...item,bytes:original}],['lib/source.js']));
  assert.throws(()=>immutableAuditView([{...item,bytes:original,oid:'0'.repeat(40)}]),/blob mismatch/);
  assert.throws(()=>view.read('tools/owned.cjs'));
});

test('each final freshness check performs new owned reads and detects mutation/replacement/missing',async()=>{
  let bytes=Buffer.from('current'),reads=0;
  const pins=[{path:'owned.cjs',sha256:sha(bytes)}];
  const read=async()=>{reads++;return Buffer.from(bytes);};
  await freshOwnedChecks('/authored',pins,read);
  bytes=Buffer.from('changed');await assert.rejects(freshOwnedChecks('/authored',pins,read),/changed/);
  bytes=Buffer.from('current');await freshOwnedChecks('/authored',pins,read);
  assert.equal(reads,3);
  await assert.rejects(freshOwnedChecks('/authored',pins,async()=>{throw Error('ENOENT');}),/ENOENT/);
});

test('fresh checks issue every asynchronous read and join failed work',async()=>{
  const issued=[];let release,finished=false;const barrier=new Promise(resolve=>release=resolve);
  const pins=['bad','slow'].map(p=>({path:p,sha256:sha(Buffer.from(p))}));
  const task=freshOwnedChecks('/authored',pins,async filename=>{
    const name=path.basename(filename);issued.push(name);
    if(name==='bad')throw Error('missing');
    await barrier;finished=true;return Buffer.from(name);
  });
  const refused=assert.rejects(task,/missing/);await tick();assert.deepEqual(issued,['bad','slow']);
  assert.equal(finished,false);release();await refused;assert(finished);
});

test('actual owned file IO detects replacement and deletion without inode/digest reuse',async()=>{
  const base=path.resolve(__dirname,'../scratch/runs/20261116-gta2-worker-complete-confirmation');
  await fs.promises.mkdir(base,{recursive:true});
  const dir=await fs.promises.mkdtemp(path.join(base,'authored-files-'));
  const filename=path.join(dir,'owned-input'),bytes=Buffer.from('small authored owned input\n');
  const pins=[{path:'owned-input',sha256:sha(bytes)}];
  try {
    await fs.promises.writeFile(filename,bytes,{flag:'wx'});
    await freshOwnedChecks(dir,pins);
    await fs.promises.writeFile(filename,Buffer.from('different owned contents\n'));
    await assert.rejects(freshOwnedChecks(dir,pins),/changed/);
    await fs.promises.writeFile(filename+'.replacement',bytes,{flag:'wx'});
    await fs.promises.rename(filename+'.replacement',filename);
    await freshOwnedChecks(dir,pins);
    await fs.promises.unlink(filename);
    await assert.rejects(freshOwnedChecks(dir,pins),/ENOENT/);
  } finally {await fs.promises.rm(dir,{recursive:true,force:true});}
});
}

function checkHeavyGate(out) {
  if(process.env.GTA2_PARALLEL_RENDERER_GATE){
    const gate=JSON.parse(fs.readFileSync(process.env.GTA2_PARALLEL_RENDERER_GATE,'utf8'));
    assert.equal(gate.owner199IndependentImmutableRuntime,true,'explicit parallel runtime authorization');
    const view=globalThis.__gta2ImmutableVerifiedViewV1;
    assert(view&&Object.isFrozen(view)&&view.head===process.env.GTA2_VIEW_HEAD,'actual sealed source view');
    assert.equal(sha(fs.readFileSync(path.resolve(__dirname,'../build/wine-assembly.wasm'))),
      process.env.GTA2_FROZEN_MODULE_SHA256,'actual frozen native module');
    const watch=JSON.parse(fs.readFileSync(path.join(out,'..','watchdog-armed.json')));
    assert(watch.independent&&watch.deadline*1000>Date.now(),'independent watchdog prearmed');
    process.kill(watch.pid,0);
    return;
  }
  const gate=JSON.parse(fs.readFileSync(process.env.GTA2_COMPLETE_RELEASE_GATE,'utf8'));
  assert(gate.glFinal&&gate.simsFinal&&gate.personalCurrentClosure&&gate.heavyLaneClaimed,
    'both explicit final releases, personal current closure and owned heavy lock required');
  const heavy=JSON.parse(fs.readFileSync(path.join(out,'..','heavy-lock.json'),'utf8'));
  const heavyInode=String(fs.statSync('/tmp/wine-heavy-runtime.lock').ino);
  assert(fs.readFileSync('/proc/locks','utf8').split('\n').some(line=>{
    const fields=line.trim().split(/\s+/);
    return fields[1]==='FLOCK'&&fields[3]==='WRITE'&&fields[4]===String(heavy.pid)&&fields[5]?.split(':').at(-1)===heavyInode;
  }),'actual current supervisor owns heavy runtime flock');
}

async function actualWatchdogControl(out) {
  checkHeavyGate(out);
  const cp=require('node:child_process'),controller=require('../tools/gta2-paired-controller.cjs');
  fs.mkdirSync(out,{recursive:true});
  const write=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  const token=pid=>{const text=fs.readFileSync('/proc/'+pid+'/stat','utf8');return text.slice(text.lastIndexOf(')')+2).split(' ')[19];};
  const rows=[];
  function launch(name,source) {
    const env={...process.env};delete env.NODE_OPTIONS;
    const child=cp.spawn(process.execPath,['-e',source],{env,detached:true,stdio:['pipe','pipe','pipe']});
    const row={name,child,pid:child.pid,startToken:token(child.pid),sourceSHA256:sha(Buffer.from(source)),stdout:'',stderr:'',buffer:'',messages:[],pending:null,closed:false};
    rows.push(row);child.stdin.on('error',()=>{});
    child.stdout.on('data',bytes=>{
      row.stdout+=bytes;row.buffer+=bytes;let end;
      while((end=row.buffer.indexOf('\n'))>=0){
        const value=JSON.parse(row.buffer.slice(0,end));row.buffer=row.buffer.slice(end+1);
        if(row.pending){const waiter=row.pending;row.pending=null;waiter.resolve(value);}else row.messages.push(value);
      }
    });
    child.stderr.on('data',bytes=>row.stderr+=bytes);
    row.joined=new Promise(resolve=>child.once('close',(code,signal)=>{
      row.closed=true;row.pending?.reject(Error('child closed'));row.pending=null;resolve({pid:child.pid,code,signal});
    }));
    row.next=()=>new Promise((resolve,reject)=>{
      if(row.messages.length)return resolve(row.messages.shift());
      assert(!row.pending&&!row.closed);
      const timer=setTimeout(()=>{row.pending=null;reject(Error('actual watchdog control aggregate deadline'));},3000);
      row.pending={resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}};
    });
    write(name+'-pid.json',{pid:row.pid,startToken:row.startToken,sourceSHA256:row.sourceSHA256});return row;
  }
  let result;
  try {
    const victimSource="const fs=require('node:fs');process.stdout.write(JSON.stringify({state:'READY'})+'\\n');process.stdin.once('data',()=>{Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,2000);fs.writeFileSync("+
      JSON.stringify(path.join(out,'victim-resumed.json'))+",JSON.stringify({state:'UNEXPECTED_LATE_RESUMPTION'}),{flag:'wx'});process.stdin.destroy();});";
    const victim=launch('victim',victimSource);assert.equal((await victim.next()).state,'READY');
    const operationStartedAt=Date.now(),bootstrap={operationStartedAt,releaseIdentity:{pid:victim.pid,startToken:victim.startToken}};
    const source='('+controller.prearmDeadlineService.toString()+')('+JSON.stringify(path.join(out,'guard'))+','+JSON.stringify(bootstrap)+');';
    const guard=launch('guard',source),ready=await guard.next();
    assert.equal(ready.state,'READY');assert.equal(ready.pid,guard.pid);assert.equal(ready.startToken,guard.startToken);
    assert.equal(ready.executedSourceSHA256,guard.sourceSHA256);
    const startedAt=Date.now(),nonce=crypto.randomUUID();
    guard.child.stdin.write(JSON.stringify({action:'start',startedAt,nonce,pid:victim.pid,startToken:victim.startToken})+'\n');
    assert.deepEqual(await guard.next(),{state:'WATCHING',nonce});
    victim.child.stdin.write('BLOCK\n');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,800);
    const callerResumedAt=Date.now();
    const [victimWait,guardWait]=await Promise.all([victim.joined,guard.joined]);
    const receipt=JSON.parse(fs.readFileSync(path.join(out,'guard-UNKNOWN.json'),'utf8'));
    assert.equal(victimWait.signal,'SIGKILL');assert.equal(guardWait.code,0,guard.stderr);
    assert.equal(receipt.state,'EXPIRED');assert.equal(receipt.nonce,nonce);assert.equal(receipt.pid,victim.pid);
    assert.equal(receipt.startToken,victim.startToken);assert.equal(receipt.laterRequestsAllowed,0);
    assert(receipt.firedAt>=startedAt+500&&receipt.quiescentAt<callerResumedAt);
    assert(receipt.signaledAt>=receipt.firedAt&&receipt.quiescentAt>=receipt.signaledAt);
    assert(!fs.existsSync(path.join(out,'victim-resumed.json')));
    result={state:'ACTUAL_COMPILED_WATCHDOG_PASS',startedAt,callerResumedAt,receipt,actualInputRequests:0};
  } finally {
    for(const row of rows){
      if(!row.closed)try{if(token(row.pid)===row.startToken)process.kill(row.pid,'SIGKILL');}catch(error){if(error.code!=='ENOENT'&&error.code!=='ESRCH')throw error;}
      const waited=await row.joined;
      const receipt={...waited,actualWait:true,stdoutEOF:row.child.stdout.readableEnded,stderrEOF:row.child.stderr.readableEnded,
        stdout:row.stdout,stderr:row.stderr,sourceSHA256:row.sourceSHA256};
      write(row.name+'-wait.json',receipt);assert(receipt.stdoutEOF&&receipt.stderrEOF);
      assert(!fs.existsSync('/proc/'+row.pid));
      assert.throws(()=>process.kill(-row.pid,0),error=>error.code==='ESRCH');
    }
  }
  write('result.json',result);return result;
}

async function verifiedViewGuards(out) {
  checkHeavyGate(out);fs.mkdirSync(out,{recursive:true});
  const native=require('../tools/gta2-browser-release-binding.cjs'),controller=require('../tools/gta2-paired-controller.cjs');
  const root=path.resolve(__dirname,'..'),view=globalThis.__gta2ImmutableVerifiedViewV1;
  assert(view&&Object.isFrozen(view));assert.equal(Object.getOwnPropertyDescriptor(globalThis,'__gta2ImmutableVerifiedViewV1').configurable,false);
  assert.equal(view.immutableDigest('build/wine-assembly.wasm'),null,'module bytes never use immutable source digest');
  assert.equal(view.immutableDigest('tools/gta2-paired-controller.cjs'),null,'owned helper bytes always fresh');
  const input=path.join(out,'owned-current-input');fs.writeFileSync(input,'first',{flag:'wx'});
  const paths=['tools/gta2-browser-release-binding.cjs','tools/gta2-paired-controller.cjs',controller.HELPER,
    'build/wine-assembly.wasm','lib/renderer-input.js',path.relative(root,view.sourcePath),path.relative(root,input)];
  const pins={files:paths.map(file=>({path:file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
  await native.verifyPinsAsync(pins);
  const changed=structuredClone(pins);changed.files.find(p=>p.path==='lib/renderer-input.js').sha256='0'.repeat(64);
  await assert.rejects(native.verifyPinsAsync(changed),/current immutable source changed/);
  const provenance=structuredClone(pins);provenance.files.find(p=>path.resolve(root,p.path)===view.sourcePath).sha256='0'.repeat(64);
  await assert.rejects(native.verifyPinsAsync(provenance),/exact executed immutable view preload/);
  const missing=structuredClone(pins);missing.files=missing.files.filter(p=>path.resolve(root,p.path)!==view.sourcePath);
  await assert.rejects(native.verifyPinsAsync(missing),/preload pin required/);
  fs.writeFileSync(input,'replacement');await assert.rejects(native.verifyPinsAsync(pins),/current source changed/);
  fs.unlinkSync(input);await assert.rejects(native.verifyPinsAsync(pins),/ENOENT/);
  const result={status:'ACTUAL_VERIFIED_VIEW_GUARDS_PASS',cases:7,mutableAlwaysFresh:true,allFinalPinInvocationsRetained:true};
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
}
async function transportControls(out) {
  checkHeavyGate(out);fs.mkdirSync(out,{recursive:true});
  const http=require('node:http'),{connection,LoopbackWebSocket}=require('../tools/gta2-paired-controller.cjs');
  const results=[],frame=(opcode,body,final=true)=>{
    body=Buffer.isBuffer(body)?body:Buffer.from(body);const n=body.length<126?0:body.length<=65535?2:8,h=Buffer.alloc(2+n);
    h[0]=(final?128:0)|opcode;h[1]=n===0?body.length:n===2?126:127;
    if(n===2)h.writeUInt16BE(body.length,2);if(n===8)h.writeBigUInt64BE(BigInt(body.length),2);return Buffer.concat([h,body]);
  };
  for(const kind of ['large-fragmented','bad-upgrade','masked-server','invalid-utf8','orphan-continuation','fragmented-control','early-eof']){
    const server=http.createServer(),sockets=new Set(),unknown=[];let requests=0,received=Buffer.alloc(0),c;
    server.on('upgrade',(request,socket)=>{
      sockets.add(socket);socket.on('error',()=>{});socket.on('close',()=>sockets.delete(socket));
      const accept=crypto.createHash('sha1').update(request.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+(kind==='bad-upgrade'?'wrong':accept)+'\r\n\r\n');
      socket.on('data',bytes=>{
        received=Buffer.concat([received,bytes]);
        while(received.length>=2){
          const n=received[1]&127,extra=n===126?2:n===127?8:0;if(received.length<2+extra+4)return;
          const length=extra===0?n:extra===2?received.readUInt16BE(2):Number(received.readBigUInt64BE(2));
          if(received.length<6+extra+length)return;
          const opcode=received[0]&15,mask=received.subarray(2+extra,6+extra),body=Buffer.from(received.subarray(6+extra,6+extra+length));
          assert(received[1]&128);for(let i=0;i<body.length;i++)body[i]^=mask[i&3];received=received.subarray(6+extra+length);
          if(opcode===8){socket.end(frame(8,Buffer.alloc(0)));continue;}if(opcode===10)continue;
          assert.equal(opcode,1);const command=JSON.parse(body);requests++;
          if(kind==='early-eof'){socket.end();continue;}
          if(kind==='masked-server'){socket.write(Buffer.from([0x81,0x80,1,2,3,4]));continue;}
          if(kind==='invalid-utf8'){socket.write(frame(1,Buffer.from([0xff])));continue;}
          if(kind==='orphan-continuation'){socket.write(frame(0,'{}'));continue;}
          if(kind==='fragmented-control'){socket.write(frame(9,'ping',false));continue;}
          const message=Buffer.from(JSON.stringify({id:command.id,result:{bytecode:Buffer.alloc(2260203,0x6f).toString('base64')}}));let offset=0;
          const next=()=>{if(socket.destroyed)return;const end=Math.min(offset+16384,message.length),opcode=offset?0:1;
            socket.write(frame(opcode,message.subarray(offset,end),end===message.length));offset=end;
            if(offset<message.length){if(offset===16384)socket.write(frame(9,'independent-ping'));setImmediate(next);}
          };next();
        }
      });
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    try{
      c=connection('ws://127.0.0.1:'+server.address().port,value=>unknown.push(value),LoopbackWebSocket);
      if(kind==='bad-upgrade')await assert.rejects(c.ready,/UNKNOWN/);
      else{
        await c.ready;
        if(kind==='large-fragmented'){
          let yielded=false;setImmediate(()=>{yielded=true;});
          for(let i=0;i<2;i++){
            const result=await c.send('Debugger.getScriptSource',{scriptId:String(i)});
            assert.equal(sha(Buffer.from(result.bytecode,'base64')),sha(Buffer.alloc(2260203,0x6f)));
          }
          assert(yielded);assert.equal(requests,2);assert.equal(unknown.length,0);c.stop();
        }else await assert.rejects(c.send('Debugger.getScriptSource',{scriptId:'fresh'}),/UNKNOWN/);
      }
      if(kind!=='large-fragmented'){
        const count=requests;await assert.rejects(c.send('Input.dispatchKeyEvent',{type:'keyDown'}),/permanently closed/);
        assert.equal(requests,count);assert.equal(unknown.length,1);assert.equal(unknown[0].laterRequestsAllowed,0);
      }
      results.push({kind,status:'PASS',requests,unknown:unknown.length});
    }finally{c?.stop();for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}
  }
  const result={status:'ACTUAL_LOOPBACK_TRANSPORT_CONTROLS_PASS',results,inputRequests:0};
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
}
async function browserFixture(out,mode,fault='none') {
  // Explicit heavy mode only. Nothing below is imported/executed in light tests.
  checkHeavyGate(out);
  assert(['none','wrong-generation','missing-source','changed-source-pin',
    'stalled-parent-prearm','stalled-parent-after-down'].includes(fault));
  const controller=require('../tools/gta2-paired-controller.cjs');
  const current=require('./test-gta2-current-scene-prearm.cjs');
  const predecessor=require('./test-gta2-final-pin-prearm-scheduling.cjs');
  const harness=require('./test-gta2-fresh-attestation-prearm.cjs');
  const original=controller.releaseGesture,originalConnection=controller.connection;let actualConnection;
  controller.connection=(...args)=>(actualConnection=originalConnection(...args));
  controller.releaseGesture=async args=>{
    const cfg=fault==='none'?args.cfg:structuredClone(args.cfg),beforeDown=args.beforeDown;
    const protocol=args.c.protocol;
    args.c.protocol=value=>{
      protocol(value);
      fs.appendFileSync(path.join(out,'main-wire-protocol.jsonl'),JSON.stringify({gesture:args.name,...value})+'\n');
    };
    if(fault==='wrong-generation')cfg.review.native.context.focus.generation='authored-stale-generation';
    if(fault==='missing-source')cfg.pins.files.push({path:path.relative(path.resolve(__dirname,'..'),path.join(out,'never-created-owned-input')),sha256:'0'.repeat(64)});
    if(fault==='changed-source-pin')cfg.pins.files.find(pin=>pin.path==='lib/renderer-input.js').sha256='0'.repeat(64);
    let stalled=false;
    const block=stage=>{
      assert(!stalled,'one actual parent stall');stalled=true;
      fs.writeFileSync(path.join(out,args.name+'-'+stage+'-stall-begin.json'),JSON.stringify({at:Date.now(),stage,ms:stage==='prearm'?700:1800})+'\n',{flag:'wx'});
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,stage==='prearm'?700:1800);
      fs.writeFileSync(path.join(out,args.name+'-'+stage+'-stall-end.json'),JSON.stringify({at:Date.now(),stage})+'\n',{flag:'wx'});
    };
    const send=args.c.send;
    if(fault==='stalled-parent-after-down')args.c.send=async(method,params,...rest)=>{
      const result=await send(method,params,...rest);
      if(!stalled&&method==='Input.dispatchKeyEvent'&&params.type==='keyDown')block('after-down');
      return result;
    };
    try{return await original({...args,cfg,beforeDown:async()=>{
      await beforeDown?.();if(fault==='stalled-parent-prearm'&&!stalled)block('prearm');
    }});}finally{args.c.send=send;args.c.protocol=protocol;}
  };
  try{const result=await harness.browserFixture(out,mode,{dlls:true,
    fixtureFactory:predecessor.authoredPE,
    extraPins:['test/test-gta2-current-scene-prearm.cjs','test/test-gta2-final-pin-prearm-scheduling.cjs',
      'test/test-gta2-worker-complete-confirmation.cjs',
      'tools/gta2-verified-source-view.cjs','tools/gta2-renderer-startup-runtime.cjs',
      'tools/gta2-renderer-startup-launcher.cjs','test/test-gta2-renderer-startup-publication.cjs'],
    captureWitness:async({label,png,evaluate,record})=>{
      const witness=await current.readPublishedPixels(evaluate);
      record(label+'-pixel-witness.json',witness);
      record(label+'-pixels.json',{witness,proof:current.verifyPublishedPixels(png,witness)});
    }});
    if(fs.existsSync(path.join(out,'failure.json'))){
      assert(actualConnection?.closed,'actual failure connection permanently closed');
      const protocol=path.join(out,'protocol-timings.jsonl'),before=fs.readFileSync(protocol);
      const refused=[];
      for(const [kind,method,params] of [
        ['replay','Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',windowsVirtualKeyCode:13}],
        ['rebind','Runtime.evaluate',{expression:'__gta2NativeReleasePageV1.bind({})'}],
        ['after-UNKNOWN','Target.getTargets',{}]]){
        await assert.rejects(actualConnection.send(method,params),/permanently closed/);refused.push(kind);
      }
      assert(fs.readFileSync(protocol).equals(before),'zero wire requests after terminal');
      fs.writeFileSync(path.join(out,'terminal-local-refusals.json'),JSON.stringify({state:'REFUSED_BEFORE_WIRE',refused,laterRequests:0})+'\n',{flag:'wx'});
    }
    return result;
  }finally{controller.releaseGesture=original;controller.connection=originalConnection;}
}

if(require.main===module){
  if(process.argv[2]==='--browser')browserFixture(path.resolve(process.argv[3]),process.argv[4],process.argv[5]??'none')
    .catch(error=>{console.error(error);process.exitCode=1;});
  else if(process.argv[2]==='--actual-watchdog')actualWatchdogControl(path.resolve(process.argv[3]))
    .then(value=>console.log(JSON.stringify(value))).catch(error=>{console.error(error);process.exitCode=1;});
  else if(process.argv[2]==='--transport-controls')transportControls(path.resolve(process.argv[3]))
    .then(value=>console.log(JSON.stringify(value))).catch(error=>{console.error(error);process.exitCode=1;});
  else if(process.argv[2]==='--view-guards')verifiedViewGuards(path.resolve(process.argv[3]))
    .then(value=>console.log(JSON.stringify(value))).catch(error=>{console.error(error);process.exitCode=1;});
  else registerAuthoredControls();
}
module.exports={confirmAndCheck,immutableAuditView,freshOwnedChecks,validateConfirmation,releaseSignal,browserFixture,actualWatchdogControl};
