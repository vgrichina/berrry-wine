'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {createRetainer, createProofRecorder, createProbeJournal} = require('./native-source-retention.cjs');
const {createHash}=require('node:crypto');
const {fixture}=require('./strict-software-gate.test.cjs');
const sha=b=>createHash('sha256').update(b).digest('hex');

function populate(j, change=()=>{}) {
  j.begin();
  for(const read of [1,2]) {
    j.read(read);
    for(const [i,role] of ['guest','decoder','compositor'].entries()) {
      const bytes=Buffer.from(role), row={sequence:(read-1)*3+i+1,session:'s',method:'Debugger.getScriptSource',params:{scriptId:String(i)},requestAt:12,responseAt:13,refused:false,
        response:role==='guest'?{bytecode:bytes.toString('base64')}:{scriptSource:role}};
      const p={role,kind:i?'JavaScript':'WebAssembly',session:'s',scriptId:String(i),requestAt:11,responseAt:14,bytes:bytes.length,sha256:sha(bytes),uncached:true};
      change(row,p,read,i);j.retain(row);j.record(p);row.response={};p.sha256='mutated after admission';
    }
  }
}

test('one immutable six-envelope/two-read transaction flushes file and directory before completion',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'probe-journal-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const events=[],io={async open(name,mode){const f=await fs.open(name,mode);return {
    async writeFile(body){events.push('write');await f.writeFile(body);},
    async sync(){events.push(mode==='r'?'directory-sync':'file-sync');await f.sync();},
    async close(){events.push('close');await f.close();},
  };}};
  const j=createProbeJournal(dir,{io});populate(j);assert.deepEqual(await fs.readdir(dir),[]);await j.flush();
  assert.deepEqual(events,['write','file-sync','close','directory-sync','close']);
  const [head,...lines]=(await fs.readFile(path.join(dir,'source-probe-1.jsonl'),'utf8')).trimEnd().split('\n');
  const seal=JSON.parse(head);assert.equal(seal.complete,true);assert.equal(seal.records,12);assert.equal(seal.sha256,sha(lines.join('\n')+'\n'));
  assert.equal(JSON.parse(lines[0]).row.response.bytecode,Buffer.from('guest').toString('base64'));
  assert.equal(JSON.parse(lines[1]).row.sha256,sha(Buffer.from('guest')));
  await assert.rejects(j.flush());
});

test('partial/duplicate/mismatched/refused groups cannot be sealed and poison replay',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'probe-invalid-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const mutations=[(e,p,r,i)=>{if(r===2&&i===1)e.sequence=1;},(e,p)=>{p.sha256='0'.repeat(64);},
    e=>{e.refused=true;},(e,p)=>{p.scriptId='absent';},(e,p)=>{p.role='guest';},
    (e,p)=>{p.requestAt=99;},e=>{e.responseAt=1;},(e,p,r,i)=>{if(i===1)e.params.scriptId='0';}];
  for(let n=0;n<mutations.length;n++) {
    const d=path.join(dir,String(n));await fs.mkdir(d);const j=createProbeJournal(d);populate(j,mutations[n]);
    await assert.rejects(j.flush());await j.abort();assert.throws(()=>j.begin());
    assert.equal(JSON.parse((await fs.readFile(path.join(d,'source-probe-1.jsonl'),'utf8')).split('\n')[0]).complete,false);
  }
  const partial=createProbeJournal(dir);partial.begin();partial.read(1);await assert.rejects(partial.flush(),/group/);await partial.abort();assert.throws(()=>partial.begin());
  const bounded=createProbeJournal(dir,{maxBytes:4});bounded.begin();bounded.read(1);assert.throws(()=>bounded.retain({sequence:1}),/byte bound/);
});

test('write/fsync/close/directory failures and timeout drain writer then remain UNKNOWN',async()=>{
  for(const failure of ['open','write','sync','close','directory-sync','directory-close','timeout']) {
    const events=[];let opens=0;
    const io={async open(){const dir=++opens===2;if(failure==='open')throw Error('open failure');return {
      async writeFile(){events.push('write');if(failure==='write')throw Error('write failure');},
      async sync(){events.push(dir?'directory-sync':'sync');if(failure==='timeout'&&!dir)await new Promise(r=>setTimeout(r,25));if(failure===(dir?'directory-sync':'sync'))throw Error('sync failure');},
      async close(){events.push(dir?'directory-close':'close');if(failure===(dir?'directory-close':'close'))throw Error('close failure');},
    };}};
    const j=createProbeJournal('/unused',{io,timeoutMs:failure==='timeout'?5:250});populate(j);
    await assert.rejects(j.flush());if(failure!=='open')assert(events.includes('close'));if(failure==='timeout')assert(events.includes('directory-close'));
    assert.throws(()=>j.begin());await j.abort();
  }
});

test('process crash before fsync cannot return a certificate or overwrite the abandoned journal',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'probe-crash-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const {spawn}=require('node:child_process');
  const code=`const fs=require('node:fs/promises');const {createProbeJournal}=require(${JSON.stringify(__filename.replace('.test.cjs','.cjs'))});
    const io={async open(...args){const f=await fs.open(...args);f.sync=async()=>{process.kill(process.pid,'SIGKILL');await new Promise(()=>{});};return f;}};
    const j=createProbeJournal(process.argv[1],{io});j.begin();j.read(1);j.abort().then(()=>process.stdout.write('CERTIFICATE'));`;
  const child=spawn(process.execPath,['-e',code,dir]);let stdout='';child.stdout.on('data',b=>{stdout+=b;});
  const [exit,signal]=await new Promise(r=>child.once('exit',(...v)=>r(v)));assert.equal(exit,null);assert.equal(signal,'SIGKILL');assert.equal(stdout,'');
  const j=createProbeJournal(dir);populate(j);await assert.rejects(j.flush(),/EEXIST/);assert.throws(()=>j.begin());
});

test('flush retirement, stale sources/PNG, and failed lanes close the actual native gate after drain',async t=>{
  for(const failure of ['none','retirement','context','source-age','png-age','compound','lane']) {
    const dir=await fs.mkdtemp(path.join(os.tmpdir(),'probe-gate-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
    const f=fixture({source(f,id){if(failure==='lane'&&id==='d')throw Error('failed source lane');}});
    // Use the actual native directory mode; trigger retirement/delay during
    // write via the shared fs object, restoring it before the next case.
    const original=fs.open;let flushed=false,adapter;
    fs.open=async function(name,...args){const fd=await original.call(fs,name,...args);if(String(name).includes('source-probe-')) {
      const sync=fd.sync.bind(fd);fd.sync=async()=>{flushed=true;
        if(failure==='retirement')f.w.guestWorker.link._stopping=true;
        if(failure==='context')adapter.event({method:'Runtime.executionContextsCleared',sessionId:'page'});
        if(failure==='source-age'||failure==='png-age')f.advance(251);
        if(failure==='compound')f.advance(5001);
        await sync();};
    }return fd;};
    try {
      adapter=create({...f.options,responseDirectory:dir});adapter.setPageSession('page');
      adapter.event({method:'Runtime.executionContextCreated',sessionId:'page',params:{context:{id:1,uniqueId:'page'}}});
      for(const [scriptId,s] of f.scripts)adapter.event({method:'Debugger.scriptParsed',sessionId:'page',params:{scriptId,...s}});
      await adapter.install({...f.options,ownerExpression:'w'});f.copy();
      if(failure==='none') {assert.equal((await adapter.probe({phase:'beforeResume'})).living,false);assert(flushed);}
      else {await assert.rejects(()=>adapter.probe({phase:'beforeResume'}));assert(adapter.closed);const count=f.calls.length;await assert.rejects(()=>adapter.probe(),/no replay/);assert.equal(f.calls.length,count);}
      assert.equal(f.pending,0);assert.equal((await fs.readdir(dir)).filter(n=>n.startsWith('source-probe-')).length,1);
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
