'use strict';
// Complete CDP envelopes are mandatory. Legacy reads await individual durable
// sinks; probe transactions snapshot all six envelopes and proofs, then await
// one durable flush before the final certificate gates. IO stays off CDP's loop.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

// One probe, two reads, three independent uncached lanes per read. Admission
// snapshots are strings: later mutation cannot change the transaction on disk.
// The seal is evidence completeness, never a certificate or a replay token.
function createProbeJournal(directory, {io=fs, timeoutMs=250, maxBytes=32*1024*1024,
  timing=()=>{}} = {}) {
  assert(path.isAbsolute(directory), 'absolute probe journal directory required');
  assert(Number.isFinite(timeoutMs)&&timeoutMs>0&&timeoutMs<=250, 'bounded journal timeout <=250ms');
  assert(Number.isSafeInteger(maxBytes)&&maxBytes>0&&maxBytes<=32*1024*1024, 'bounded journal bytes');
  let serial=0, active=null, poisoned=null;
  function check() { if(poisoned)throw poisoned;assert(active&&!active.sealed, 'active unsealed probe journal required'); }
  function add(kind,row) {
    check();
    try {
      assert([1,2].includes(active.read), 'source read group required');
      const body=JSON.stringify({kind,read:active.read,row});
      assert(active.bytes+Buffer.byteLength(body)<=maxBytes, 'probe journal byte bound');
      assert(active.counts[kind]<6, 'probe journal six row bound');
      active.rows.push(body);active.bytes+=Buffer.byteLength(body);
      active.counts[kind]++;
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
  async function write(complete, start=performance.now()) {
    const tx=active;assert(tx&&!tx.sealed,'one journal flush');tx.sealed=true;
    const payload=tx.rows.join('\n')+'\n';
    const body=JSON.stringify({version:1,probe:tx.id,complete,records:tx.rows.length,sha256:hash(payload)})+'\n'+payload;
    // A crash/partial write has no successful flush receipt and cannot admit
    // input. Exclusive creation prevents a subsequent process overwriting it.
    const work=(async()=>{
      const file=await io.open(path.join(directory,`source-probe-${tx.id}.jsonl`),'wx');
      try {await file.writeFile(body);await file.sync();} finally {await file.close();}
      // File contents alone do not make a newly created directory entry durable.
      const dir=await io.open(directory,'r');try {await dir.sync();} finally {await dir.close();}
    })();
    let timer;
    try {
      await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('probe journal flush timeout')),Math.max(0,timeoutMs-(performance.now()-start)));})]);
      assert(performance.now()-start<=timeoutMs,'probe journal flush timeout');
    } catch(error) {poisoned??=error;throw error;}
    finally {
      clearTimeout(timer);
      // Even on timeout, do not leave an FD writer racing shutdown or replay.
      await Promise.allSettled([work]);
      timing({probe:tx.id,complete,bytes:Buffer.byteLength(body),flushMs:performance.now()-start,failed:!!poisoned});
    }
  }
  return {
    begin() {if(poisoned)throw poisoned;assert(!active||active.sealed,'concurrent probe journal');active={id:++serial,read:0,rows:[],counts:{response:0,proof:0},bytes:0,sealed:false};},
    read(n) {check();assert(n===active.read+1&&n<=2,'ordered two-read journal');active.read=n;},
    retain:row=>add('response',row), record:row=>add('proof',row),
    async flush() {
      const start=performance.now();
      check();try {validate(active.rows.map(JSON.parse));} catch(error) {poisoned=error;throw error;}
      await write(true,start);
    },
    async abort() {poisoned??=Error('aborted probe journal; no replay');if(active&&!active.sealed)await write(false);},
    get active() {return !!active&&!active.sealed;},
  };
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

module.exports = {createRetainer, createProofRecorder, createProbeJournal};
