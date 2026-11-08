'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {createRetainer, createProofRecorder, createProbeJournal, decodeJournal} = require('./native-source-retention.cjs');
const {createHash}=require('node:crypto');
const {fixture}=require('./strict-software-gate.test.cjs');
const sha=b=>createHash('sha256').update(b).digest('hex');

async function populate(j, change=()=>{}) {
  await j.prepare();j.begin();j.phase({phase:'entry'});
  for(const read of [1,2]) {
    j.read(read);
    for(const [i,role] of ['guest','decoder','compositor'].entries()) {
      const bytes=Buffer.from(role), row={sequence:(read-1)*3+i+1,session:'s',method:'Debugger.getScriptSource',params:{scriptId:String(i)},requestAt:12,responseAt:13,refused:false,
        response:role==='guest'?{bytecode:bytes.toString('base64')}:{scriptSource:role}};
      const p={role,kind:i?'JavaScript':'WebAssembly',session:'s',scriptId:String(i),requestAt:11,responseAt:14,bytes:bytes.length,sha256:sha(bytes),uncached:true};
      change(row,p,read,i);j.retain(row);j.record(p);row.response={};p.sha256='mutated after admission';
    }
    j.phase({phase:'owner',read});
  }
  const png=Buffer.from('actually decoded bytes');j.phase({phase:'pixels',result:{pngSha256:sha(png)}},png);png.fill(0);
  j.phase({phase:'return'});
}
const read=async dir=>decodeJournal(await fs.readFile(path.join(dir,'source-probe-1.journal')));
async function directory(t) {const d=await fs.mkdtemp(path.join(os.tmpdir(),'compound-journal-'));t.after(()=>fs.rm(d,{recursive:true,force:true}));return d;}
function instrument(events,failure) {
 let opens=0;
 return {async open(name,mode) {
  const dir=++opens===2;if(failure==='open')throw Error('open failure');
  const f=await fs.open(name,mode);let syncs=0;
  return {
   async write(bytes,offset,length) {events.push('write');if(failure==='write')throw Error('write failure');if(failure==='late-write')await new Promise(r=>setTimeout(r,3));if(failure==='zero-write')return {bytesWritten:0};return f.write(bytes,offset,failure==='partial-write'?Math.min(length,3):length);},
   async sync() {const stage=dir?'directory-sync':(++syncs===1?'prepare-sync':'sync');events.push(stage);if(failure==='timeout'&&stage==='sync')await new Promise(r=>setTimeout(r,35));if(failure==='blocked-sync'&&stage==='sync'){const until=performance.now()+15;while(performance.now()<until){}}if(failure===stage)throw Error(stage+' failure');await f.sync();},
   async close() {const stage=dir?'directory-close':'close';events.push(stage);if(failure==='late-close'&&!dir)await new Promise(r=>setTimeout(r,25));await f.close();if(failure===stage)throw Error(stage+' failure');},
  };
 }};
}
test('durable name precedes admission; immutable phase/PNG/six-source frames stream with one final sync+close',async t=>{
 const dir=await directory(t),events=[],j=createProbeJournal(dir,{io:instrument(events,'partial-write')});
 await populate(j);assert.deepEqual(events.slice(0,3),['prepare-sync','directory-sync','directory-close']);
 await j.flush();assert.deepEqual(events.slice(-2),['sync','close']);assert.equal(events.filter(x=>x==='directory-sync').length,1);
 const {seal,frames}=await read(dir);assert(seal.complete);assert.equal(seal.records,17);assert.equal(frames.length,18);
 assert.equal(frames.find(x=>x.kind==='response').row.response.bytecode,Buffer.from('guest').toString('base64'));
 assert.equal(frames.find(x=>x.kind==='png').payload.toString(),'actually decoded bytes');await assert.rejects(j.flush());
 const bytes=await fs.readFile(path.join(dir,'source-probe-1.journal'));
 for(const cut of [0,1,7,8,9,bytes.length-1])assert.throws(()=>decodeJournal(bytes.subarray(0,cut)),/partial|missing/);
 const corrupt=Buffer.from(bytes);corrupt[corrupt.length-1]^=1;assert.throws(()=>decodeJournal(corrupt));
});
test('partial/mismatched/refused groups, phases, PNG and byte bounds poison replay and drain',async t=>{
 const mutations=[(e,p,r,i)=>{if(r===2&&i===1)e.sequence=1;},(e,p)=>{p.sha256='0'.repeat(64);},e=>{e.refused=true;},(e,p)=>{p.scriptId='absent';},(e,p)=>{p.role='guest';},(e,p)=>{p.requestAt=99;},e=>{e.responseAt=1;}];
 for(const mutate of mutations) {
  const dir=await directory(t),j=createProbeJournal(dir);await populate(j,mutate);await assert.rejects(j.flush());await j.abort();assert.throws(()=>j.begin());assert.equal((await read(dir)).seal.complete,false);
 }
 for(const mode of ['partial','phases','png','bytes']) {
  const dir=await directory(t),j=createProbeJournal(dir,{maxBytes:mode==='bytes'?1100:32*1024*1024});await j.prepare();j.begin();
  if(mode==='partial'){j.read(1);await assert.rejects(j.flush(),/group/);}
  if(mode==='phases')assert.throws(()=>j.phase({phase:'return'}));
  if(mode==='png'){j.phase({phase:'entry'});j.read(1);j.phase({phase:'owner',read:1});j.read(2);j.phase({phase:'owner',read:2});assert.throws(()=>j.phase({phase:'pixels',result:{pngSha256:'wrong'}},Buffer.from('x')));}
  if(mode==='bytes')assert.throws(()=>j.phase({phase:'entry',data:'x'.repeat(2048)}),/byte bound/);
  await j.abort();assert.throws(()=>j.begin());assert.equal((await read(dir)).seal.complete,false);
 }
});
test('write/sync/close/directory failures and timeout are sticky; late writers finish before refusal returns',async t=>{
 for(const failure of ['open','prepare-sync','directory-sync','directory-close','write','zero-write','sync','close','timeout','blocked-sync','late-write','late-close']) {
  const dir=await directory(t),events=[],j=createProbeJournal(dir,{io:instrument(events,failure),timeoutMs:['timeout','blocked-sync','late-write','late-close'].includes(failure)?5:250});
  if(['open','prepare-sync','directory-sync','directory-close'].includes(failure))await assert.rejects(j.prepare());
  else {await populate(j);await assert.rejects(j.flush());assert(events.includes('close'));}
  assert.throws(()=>j.begin());await j.abort();
 }
});
test('a prepared journal is drained and poisoned when the independent pre-probe census refuses',async t=>{
 const dir=await directory(t),f=fixture(),adapter=create({...f.options,responseDirectory:dir});adapter.setPageSession('page');
 await adapter.install({...f.options,ownerExpression:'w'});await adapter.prepareProbe();
 await adapter.abortProbe(Error('independent census failed before probe'));
 assert(adapter.closed);assert.equal((await read(dir)).seal.complete,false);
 await assert.rejects(adapter.prepareProbe(),/UNKNOWN/);assert.equal(f.pending,0);
});
test('actual process crash leaves an exclusive abandoned partial frame with no recovery admission',async t=>{
 const dir=await directory(t),{spawn}=require('node:child_process');
 const code=`const fs=require('node:fs/promises');const {createProbeJournal}=require(${JSON.stringify(__filename.replace('.test.cjs','.cjs'))});
 const io={async open(...args){const f=await fs.open(...args);if(args[1]==='wx')f.write=async b=>{await f.writeFile(b.subarray(0,11));process.kill(process.pid,'SIGKILL');await new Promise(()=>{});};return f;}};
 (async()=>{const j=createProbeJournal(process.argv[1],{io});await j.prepare();j.begin();j.phase({phase:'entry'});await j.abort();process.stdout.write('CERTIFICATE');})();`;
 const child=spawn(process.execPath,['-e',code,dir]);let stdout='';child.stdout.on('data',b=>stdout+=b);
 const [exit,signal]=await new Promise(r=>child.once('exit',(...v)=>r(v)));assert.equal(exit,null);assert.equal(signal,'SIGKILL');assert.equal(stdout,'');
 assert.throws(()=>decodeJournal(require('fs').readFileSync(path.join(dir,'source-probe-1.journal'))),/partial/);
 const j=createProbeJournal(dir);await assert.rejects(j.prepare(),/EEXIST/);assert.throws(()=>j.begin());
});
test('actual native gate stages every phase after PNG decode and rejects retirement/stale evidence during final flush',async t=>{
 for(const failure of ['none','retirement','context','source-age','png-age','compound','lane']) {
  const dir=await directory(t),f=fixture({source(f,id){if(failure==='lane'&&id==='d')throw Error('failed source lane');}});
  const original=fs.open;let flushing=false,adapter,decoded=false;
  fs.open=async function(name,...args){const fd=await original.call(fs,name,...args);if(String(name).endsWith('.journal')) {
   const sync=fd.sync.bind(fd);let calls=0;fd.sync=async()=>{if(++calls===2){flushing=true;assert(decoded||failure==='lane');
    if(failure==='retirement')f.w.guestWorker.link._stopping=true;
    if(failure==='context')adapter.event({method:'Runtime.executionContextsCleared',sessionId:'page'});
    if(failure==='source-age'||failure==='png-age')f.advance(251);if(failure==='compound')f.advance(5001);
   }await sync();};
  }return fd;};
  try {
   adapter=create({...f.options,responseDirectory:dir,save(){throw Error('individual phase fsync must be eliminated');},inspect:async png=>{const result=await f.options.inspect(png);decoded=true;return result;}});adapter.setPageSession('page');
   adapter.event({method:'Runtime.executionContextCreated',sessionId:'page',params:{context:{id:1,uniqueId:'page'}}});
   for(const [scriptId,s] of f.scripts)adapter.event({method:'Debugger.scriptParsed',sessionId:'page',params:{scriptId,...s}});
   await adapter.install({...f.options,ownerExpression:'w'});await adapter.prepareProbe();f.copy();
   if(failure==='none') {assert.equal((await adapter.probe({phase:'beforeResume'})).living,false);assert(flushing);assert.equal((await read(dir)).frames.filter(x=>x.kind==='phase').length,5);}
   else {await assert.rejects(()=>adapter.probe({phase:'beforeResume'}));assert(adapter.closed);const count=f.calls.length;await assert.rejects(()=>adapter.probe(),/no replay/);assert.equal(f.calls.length,count);}
   assert.equal(f.pending,0);
  } finally {fs.open=original;}
 }
});
const {create} = require('./native-software-gate.cjs');

test('three uncached source lanes retain every complete envelope before resolving', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'source-retention-'));
  t.after(() => fs.rm(directory, {recursive: true, force: true}));
  const timings = [], responses = [
    {scriptSource: '', bytecode: Buffer.alloc(2182663, 123).toString('base64')},
    {scriptSource: '\u03bb decoder\n'.repeat(20000)}, {scriptSource: 'compositor\n'.repeat(22000)},
  ];
  let calls = 0;
  const adapter = create({workers: new Map(), retain: createRetainer(directory, {timing: x => timings.push(x)}),
    send: async (method, params) => {calls++; return responses[Number(params.scriptId)];}});
  for (let read = 0; read < 2; read++) {
    const lanes = await Promise.allSettled(responses.map(async (response, i) => {
      const value = await adapter.send('Debugger.getScriptSource', {scriptId: String(i)}, 'actual-session');
      const sequence = read * 3 + i + 1;
      const row = JSON.parse(await fs.readFile(path.join(directory, `source-response-${sequence}.json`), 'utf8'));
      assert.deepEqual(row.response, response);
      assert.equal(row.session, 'actual-session');
      assert.equal(row.method, 'Debugger.getScriptSource');
      assert(row.responseAt >= row.requestAt);
      assert.deepEqual(value, response);
    }));
    assert(lanes.every(x => x.status === 'fulfilled'), JSON.stringify(lanes));
  }
  assert.equal(calls, 6);
  assert.equal(timings.length, 6);
  await assert.rejects(createRetainer(directory)({sequence: 1}), /EEXIST/);
  assert.throws(() => createRetainer('relative'), /absolute/);
  assert.throws(() => create({responseDirectory: directory, retain() {}}), /choose one/);
  const native = create({workers: new Map(), responseDirectory: directory,
    send: async () => ({scriptSource: 'complete native directory sink'})});
  // Exclusive creation remains authoritative even for a newly created adapter.
  await assert.rejects(native.send('Debugger.getScriptSource', {scriptId: '0'}, 'session'), /EEXIST/);
});

test('durable IO failure propagates and cannot return the source response', async () => {
  const adapter = create({workers: new Map(), retain: createRetainer('/nonexistent-source-retention-directory'),
    send: async () => ({scriptSource: 'complete but not retained'})});
  await assert.rejects(adapter.send('Debugger.getScriptSource', {scriptId: '1'}, 'session'), /ENOENT/);
});

test('concurrent proof records preserve append order and failure poisons their queue', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'source-proofs-'));
  t.after(() => fs.rm(directory, {recursive: true, force: true}));
  const record = createProofRecorder(directory);
  const rows = Array.from({length: 6}, (_, i) => ({role: i % 3, requestAt: i, uncached: true}));
  const pending = rows.map(row => record(row));
  rows[0].role = 99;
  await Promise.all(pending);
  const saved = (await fs.readFile(path.join(directory, 'software-responses.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual(saved, rows.map((row, i) => i ? row : {...row, role: 0}));
  const bad = createProofRecorder(path.join(directory, 'absent'));
  await assert.rejects(bad({role: 0}), /ENOENT/);
  await fs.mkdir(path.join(directory, 'absent'));
  await assert.rejects(bad({role: 1}), /ENOENT/);
  await assert.rejects(fs.stat(path.join(directory, 'absent/software-responses.jsonl')), /ENOENT/);
});
