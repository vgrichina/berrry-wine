'use strict';
// Complete CDP envelopes are mandatory. Legacy reads await individual durable
// sinks; probe transactions snapshot all six envelopes and proofs, then await
// one durable flush before the final certificate gates. IO stays off CDP's loop.
const fs = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

// Supported normal helper: Linux + /usr/bin/python3 with os.posix_fallocate.
// Inherit the exclusive file description as fd 3; never reopen by pathname.
// No shell, sparse fallback, zero filling, detached child or in-probe allocation.
async function allocateExtents(file, bytes, {launch=spawn, timeoutMs=5000}={}) {
  assert(Number.isSafeInteger(bytes)&&bytes>0&&bytes<=32*1024*1024, 'bounded allocation bytes');
  assert(Number.isFinite(timeoutMs)&&timeoutMs>0&&timeoutMs<=5000, 'bounded allocation timeout');
  assert(process.platform==='linux', 'posix_fallocate helper requires Linux');
  assert(Number.isInteger(file.fd)&&file.fd>=0, 'exclusive allocation FD required');
  const child=launch('/usr/bin/python3',['-I','-c',
    'import os,sys; os.posix_fallocate(3,0,int(sys.argv[1]))',String(bytes)],
    {stdio:['ignore','ignore','pipe',file.fd]});
  let diagnostic='',spawnError,expired=false;
  child.stderr.on('data',b=>{diagnostic=(diagnostic+b.toString()).slice(-4096);});
  child.on('error',error=>{spawnError=error;});
  const timer=setTimeout(()=>{expired=true;child.kill('SIGKILL');},timeoutMs);
  try {
    const [code,signal]=await new Promise(resolve=>child.once('close',(...args)=>resolve(args)));
    if(spawnError)throw spawnError;
    assert(!expired&&code===0&&!signal, 'posix_fallocate helper refused: '+diagnostic);
    const stat=await file.stat();
    assert(stat.isFile()&&stat.size===bytes&&stat.blocks*512>=bytes,
      'real bounded extents required');
  } finally {clearTimeout(timer);}
}

// One probe, two reads, three independent uncached lanes per read. Admission
// snapshots are strings: later mutation cannot change the transaction on disk.
// The seal is evidence completeness, never a certificate or a replay token.
function createProbeJournal(directory, {io=fs, timeoutMs=250, maxBytes=32*1024*1024,
  timing=()=>{}, allocate=allocateExtents} = {}) {
  assert(path.isAbsolute(directory), 'absolute probe journal directory required');
  assert(Number.isFinite(timeoutMs)&&timeoutMs>0&&timeoutMs<=250, 'bounded journal timeout <=250ms');
  assert(Number.isSafeInteger(maxBytes)&&maxBytes>0&&maxBytes<=32*1024*1024, 'bounded journal bytes');
  let serial=0, active=null, poisoned=null;
  function check() { if(poisoned)throw poisoned;assert(active&&active.ready&&!active.sealed, 'active unsealed probe journal required'); }
  function add(kind,row) {
    check();
    try {
      if(kind!=='phase')assert([1,2].includes(active.read), 'source read group required');
      const body=JSON.stringify({kind,read:active.read,row});
      assert(active.counts[kind]<(kind==='phase'?5:6), 'probe journal row bound');
      frame(kind,null,Buffer.alloc(0),body);
      active.rows.push(body);active.counts[kind]++;
    } catch(error) {poisoned=error;throw error;}
  }
  function validate(rows) {
    const seen=new Set();let firstKeys, firstMax=0;
    for(const read of [1,2]) {
      const envelopes=rows.filter(x=>x.read===read&&x.kind==='response').map(x=>x.row);
      const proofs=rows.filter(x=>x.read===read&&x.kind==='proof').map(x=>x.row);
      assert.equal(envelopes.length,3,'complete three-response group required');
      assert.equal(proofs.length,3,'complete three-proof group required');
      assert.deepEqual(proofs.map(p=>p.role).sort(),['compositor','decoder','guest']);
      const keys=new Set();
      for(const e of envelopes) {
        assert(Number.isSafeInteger(e.sequence)&&e.sequence>0&&!seen.has(e.sequence),'duplicate response sequence');seen.add(e.sequence);
        if(read===1)firstMax=Math.max(firstMax,e.sequence);else assert(e.sequence>firstMax,'overlapping read groups');
        assert(e.method==='Debugger.getScriptSource'&&!e.refused&&e.response&&!e.response.error,'successful uncached response required');
        assert(Number.isFinite(e.requestAt)&&Number.isFinite(e.responseAt)&&e.responseAt>=e.requestAt,'original response timestamps required');
        const key=JSON.stringify([e.session,e.params?.scriptId]);assert(!keys.has(key),'duplicate source lane');keys.add(key);
        const matches=proofs.filter(p=>p.session===e.session&&p.scriptId===e.params?.scriptId);
        assert.equal(matches.length,1,'unique matching source proof required');const p=matches[0];
        assert(p.uncached===true&&Number.isFinite(p.requestAt)&&Number.isFinite(p.responseAt)&&p.requestAt<=e.requestAt&&p.responseAt>=e.responseAt,'proof timestamp mismatch');
        const wasm=p.role==='guest';assert.equal(p.kind,wasm?'WebAssembly':'JavaScript','source proof kind mismatch');
        const source=wasm?e.response.bytecode:e.response.scriptSource;
        assert(typeof source==='string'&&source.length,'complete source required');
        const bytes=Buffer.from(source,wasm?'base64':'utf8');
        assert.equal(bytes.length,p.bytes,'source proof size mismatch');assert.equal(hash(bytes),p.sha256,'source proof hash mismatch');
      }
      const identities=proofs.map(p=>JSON.stringify([p.role,p.session,p.scriptId,p.kind,p.sha256])).sort();
      if(read===1)firstKeys=identities;else assert.deepEqual(identities,firstKeys,'source identities changed between reads');
    }
  }
  // prepare() runs before the compound clock. Reserve real extents and persist its
  // name before any response is requested; keep its exclusive FD for streaming.
  async function prepare() {
    if(poisoned)throw poisoned;
    assert(!active||active.sealed,'concurrent probe journal');
    const tx=active={id:++serial,read:0,rows:[],counts:{response:0,proof:0,phase:0,png:0},bytes:0,sealed:false,ready:false,tail:Promise.resolve(),digest:createHash('sha256')};
    try {
      tx.file=await io.open(path.join(directory,`source-probe-${tx.id}.journal`),'wx');
      await allocate(tx.file,maxBytes);
      await tx.file.sync();
      const dir=await io.open(directory,'r');try {await dir.sync();} finally {await dir.close();}
      tx.ready=true;
    } catch(error) {poisoned??=error;if(tx.file)await Promise.allSettled([tx.file.close()]);tx.sealed=true;throw error;}
  }
  function frame(kind,row,payload=Buffer.alloc(0),snapshot) {
    const tx=active,base=snapshot??JSON.stringify({kind,read:tx.read,row});
    const body=Buffer.from(base.slice(0,-1)+',"payloadBytes":'+payload.length+',"payloadSha256":"'+hash(payload)+'"}');
    const header=Buffer.alloc(8);header.writeUInt32BE(body.length);header.writeUInt32BE(payload.length,4);
    const bytes=Buffer.concat([header,body,payload]);
    assert(tx.bytes+bytes.length+(kind==='seal'?0:1024)<=maxBytes,'probe journal byte bound');
    const position=tx.bytes;tx.bytes+=bytes.length;if(kind!=='seal')tx.digest.update(bytes);
    // Every frame owns its bytes. Never await disk from a CDP receive lane.
    tx.tail=tx.tail.then(async()=>{
      let offset=0;
      while(offset<bytes.length) {
        const result=await tx.file.write(bytes,offset,bytes.length-offset,position+offset);
        assert(Number.isSafeInteger(result.bytesWritten)&&result.bytesWritten>0&&result.bytesWritten<=bytes.length-offset,'partial journal write made no progress');
        offset+=result.bytesWritten;
      }
    });
    tx.tail.catch(error=>{poisoned??=error;});
  }
  async function finish(complete,start=performance.now()) {
    const tx=active;assert(tx&&!tx.sealed,'one journal flush');tx.sealed=true;
    const seal={version:2,probe:tx.id,complete,records:tx.rows.length,bytes:tx.bytes,sha256:tx.digest.digest('hex')};
    // A seal is content evidence only. Successful sync AND close are required
    // before a live gate can consider certification; recovery never certifies.
    const work=(async()=>{try {frame('seal',seal);await tx.tail;await tx.file.truncate(tx.bytes);await tx.file.sync();} finally {await Promise.allSettled([tx.tail]);await tx.file.close();}})();
    let timer;
    try {
      await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('probe journal flush timeout')),Math.max(0,timeoutMs-(performance.now()-start)));})]);
      assert(performance.now()-start<=timeoutMs,'probe journal flush timeout');
      if(complete&&poisoned)throw poisoned;
    } catch(error) {poisoned??=error;throw error;}
    finally {
      clearTimeout(timer);
      await Promise.allSettled([work]);
      timing({probe:tx.id,complete,bytes:tx.bytes,flushMs:performance.now()-start,failed:!!poisoned});
    }
  }
  return {
    prepare,
    begin() {check();assert(active.ready&&!active.begun,'prepared journal required');active.begun=true;},
    read(n) {check();assert(n===active.read+1&&n<=2,'ordered two-read journal');active.read=n;},
    retain:row=>add('response',row), record:row=>add('proof',row),
    phase(row,png) {
      check();try {
        const stages=['entry','owner','owner','pixels','return'];
        assert.equal(row.phase,stages[active.counts.phase],'ordered complete phase journal');
        if(row.phase==='owner')assert.equal(row.read,active.counts.phase,'phase read group mismatch');
        if(png) {assert.equal(row.phase,'pixels');assert.equal(hash(png),row.result.pngSha256,'decoded PNG hash mismatch');}
        else assert.notEqual(row.phase,'pixels','actual decoded PNG required');
        add('phase',row);
        if(png) {frame('png',{sha256:hash(png),bytes:png.length},Buffer.from(png));active.counts.png++;}
      } catch(error) {poisoned??=error;throw error;}
    },
    async flush() {
      const start=performance.now();check();
      try {
        validate(active.rows.map(JSON.parse));
        assert.equal(active.counts.phase,5,'complete five phases required');assert.equal(active.counts.png,1,'one actual decoded PNG required');
      } catch(error) {poisoned??=error;throw error;}
      await finish(true,start);
    },
    async abort() {
      poisoned??=Error('aborted probe journal; no replay');
      if(active&&!active.sealed) {
        // Preserve already admitted frames even if bounds leave no seal space.
        try {await finish(false);} finally {await Promise.allSettled([active.tail]);}
      }
    },
    get active() {return !!active&&active.ready&&!active.sealed;},
  };
}

// Diagnostic reader only: even a valid complete seal cannot recover admission.
function decodeJournal(bytes,{maxBytes=32*1024*1024}={}) {
  assert(bytes.length<=maxBytes,'journal byte bound');
  const frames=[];let offset=0,seal;
  while(offset<bytes.length) {
    const begin=offset;assert(bytes.length-offset>=8,'partial frame header');
    const metadata=bytes.readUInt32BE(offset),payload=bytes.readUInt32BE(offset+4);offset+=8;
    assert(metadata>0&&metadata+payload<=maxBytes&&metadata+payload<=bytes.length-offset,'partial or oversized frame');
    let row;try {row=JSON.parse(bytes.subarray(offset,offset+metadata));}
    catch {throw Error('partial or corrupt frame metadata');}offset+=metadata;
    const data=bytes.subarray(offset,offset+payload);offset+=payload;
    assert.equal(row.payloadBytes,payload);assert.equal(row.payloadSha256,hash(data),'frame hash mismatch');
    if(row.kind==='seal') {
      assert(!seal&&offset===bytes.length,'terminal seal required');seal=row.row;
      assert.equal(seal.version,2);assert.equal(seal.records,frames.filter(f=>f.kind!=='png').length);
      assert.equal(seal.bytes,begin);assert.equal(seal.sha256,hash(bytes.subarray(0,begin)),'journal hash mismatch');
    } else frames.push({...row,payload:Buffer.from(data)});
  }
  assert(seal,'missing seal');return {seal,frames};
}

function createRetainer(directory, {timing = () => {}} = {}) {
  assert(path.isAbsolute(directory), 'absolute source response directory required');
  return async row => {
    assert(Number.isSafeInteger(row.sequence) && row.sequence > 0, 'source response sequence required');
    const start = performance.now();
    const body = JSON.stringify(row), serialized = performance.now();
    const file = await fs.open(path.join(directory, `source-response-${row.sequence}.json`), 'wx');
    const opened = performance.now();
    let written, synced;
    try {
      await file.writeFile(body);
      written = performance.now();
      await file.sync();
      synced = performance.now();
    } finally {
      await file.close();
    }
    timing({sequence: row.sequence, bytes: Buffer.byteLength(body),
      stringifyMs: serialized - start, openMs: opened - serialized,
      writeMs: written - opened, fsyncMs: synced - written,
      closeMs: performance.now() - synced, totalMs: performance.now() - start});
  };
}

function createProofRecorder(directory, {timing = () => {}} = {}) {
  assert(path.isAbsolute(directory), 'absolute source proof directory required');
  let tail = Promise.resolve();
  return row => {
    // Snapshot at admission, then serialize append/fsync operations in order.
    // A failed append poisons the queue rather than admitting later records.
    const start = performance.now(), body = JSON.stringify(row) + '\n';
    const serialized = performance.now();
    tail = tail.then(async () => {
      const queued = performance.now();
      const file = await fs.open(path.join(directory, 'software-responses.jsonl'), 'a');
      const opened = performance.now();
      let written, synced;
      try {
        await file.writeFile(body);
        written = performance.now();
        await file.sync();
        synced = performance.now();
      } finally {
        await file.close();
      }
      timing({bytes: Buffer.byteLength(body), stringifyMs: serialized - start,
        queueMs: queued - serialized, openMs: opened - queued,
        writeMs: written - opened, fsyncMs: synced - written,
        closeMs: performance.now() - synced, totalMs: performance.now() - start});
    });
    return tail;
  };
}

module.exports = {createRetainer, createProofRecorder, createProbeJournal, decodeJournal, allocateExtents};
