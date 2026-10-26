'use strict';
// Independent rejecting reproducer for a742e90d. No production file is edited.
// Module._compile loads the actual host with one source mutation, then loads
// the unchanged benchmark against that export. All cache entries are restored.
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const Module = require('node:module');
const hostPath = require.resolve('../../../lib/d3d9-host');
const helperPath = require.resolve('../../../tools/d3d9-rgba-benchmark');
function readSource(path) {
  const fd=fs.openSync(path,'r'), parts=[], chunk=Buffer.alloc(65536);
  try {
    let count,total=0;
    while((count=fs.readSync(fd,chunk,0,chunk.length,null))) {
      total+=count;assert(total<=2097152,'source capture bound');
      parts.push(Buffer.from(chunk.subarray(0,count)));
    }
    return Buffer.concat(parts).toString('utf8');
  } finally {fs.closeSync(fd);}
}
const hostBytes = readSource(hostPath);
const helperBytes = readSource(helperPath);
const anchor = 'const src=new Uint8Array(memory,g2w(bits),byteLength);';
assert.equal(hostBytes.split(anchor).length, 2, 'one actual source-view site');
function load(mutate = source => source, mutateHelper = source => source) {
  const saved = [hostPath, helperPath].map(p => [p, require.cache[p]]);
  function compile(filename, source) {
    const m = new Module(filename, module);
    m.filename = filename; m.paths = Module._nodeModulePaths(require('node:path').dirname(filename));
    require.cache[filename] = m;
    m._compile(source, filename); m.loaded = true;
    return m.exports;
  }
  try {
    compile(hostPath, mutate(hostBytes));
    return compile(helperPath, mutateHelper(helperBytes));
  } finally {
    for (const [p, value] of saved) {
      if (value) require.cache[p] = value; else delete require.cache[p];
    }
  }
}
const mutants = {
  'indexed full-source scan': {
    code: 'let sum=0;for(let j=0;j<src.length;j++)sum=(sum+src[j])>>>0;this._independentProbe={bytes:src.length,sum};',
    prefix: '',
  },
  'captured-U8 source copy and allocation': {
    code: 'const copy=new IndependentCapturedU8(src);this._independentProbe={bytes:copy.length,copy};',
    prefix: 'const IndependentCapturedU8=Uint8Array;\n',
  },
  'ArrayBuffer-backed U8 allocation': {
    code: 'const extra=new Uint8Array(new ArrayBuffer(src.length));this._independentProbe={bytes:extra.length,extra};',
    prefix: '',
  },
};
for (const [name, {code, prefix}] of Object.entries(mutants)) {
  for (const side of [16,32,64]) test(`gate must reject real producer regression: ${name} ${side}x${side}`, async () => {
    const h = load(source => prefix + source.replace(anchor, anchor + code));
    const rows=await h.runCounts(side);
    assert.equal(rows.length,14,'candidate budgets and exact-pixel/key/churn checks all accepted mutant');
      const f = h.fixture(side);
      try {
        assert.equal(f.draw(), 1); await f.drain();
        const counts = h.measure(f); await f.drain();
        assert.equal(f.bridge._independentProbe.bytes, f.bytes, 'mutated actual producer executed');
        const probe = f.bridge._independentProbe;
        if (probe.copy) assert.deepEqual(probe.copy, f.source(), 'real source copy retained');
        if (probe.extra) assert.equal(probe.extra.buffer.byteLength, f.bytes, 'real backing allocation retained');
        if ('sum' in probe) assert.equal(probe.sum, f.source().reduce((a,b)=>(a+b)>>>0,0), 'all source bytes read');
        assert.deepEqual(f.seen.at(-1).pixels, f.expected(), 'semantics preserved');
        console.log(JSON.stringify({mutation:name,side,actualAddedBytes:probe.bytes,counts}));
        // Candidate silently passes this budget, producing an intentional FAIL.
        assert.throws(() => h.budget(counts,f.bytes,f.bytes,true), undefined,
          'extra real source work must exceed the performance gate');
      } finally { await f.close(); }
  });
}

test('suppressed scan instrumentation is rejected', async () => {
  const h = load(source => 'const IndependentEvery=Uint8Array.prototype.every;\n' +
    source.replace('src.every((byte,index)=>byte===cached.source[index])',
      'IndependentEvery.call(src,(byte,index)=>byte===cached.source[index])'));
  const f = h.fixture(64);
  try {
    assert.equal(f.draw(), 1); await f.drain();
    const counts = h.measure(f); await f.drain();
    assert.equal(counts.sourceReads,0); assert.equal(counts.snapshotReads,f.bytes);
    assert.throws(() => h.budget(counts,f.bytes,f.bytes,true), /source scan complexity/);
  } finally { await f.close(); }
});

test('improved counts cannot accept a broken identity cache', async () => {
  const h = load(source => source.replace('src.every((byte,index)=>byte===cached.source[index])', 'true'),
    source => source.replace('budget(counts, f.bytes, scenario.reads(f.bytes), scenario.hit);', '/* independently bypass counts to test the semantic oracle */'));
  await assert.rejects(h.runCounts(64), /sparse-interior exact RGBA/);
});

test('throwing producer restores own methods, snapshots and native globals', async () => {
  const h=load(),f=h.fixture(64),U8=Uint8Array;
  const saved={every:U8.prototype.every,slice:U8.prototype.slice,set:U8.prototype.set};
  try {
    assert.equal(f.draw(),1);await f.drain();
    const snap=f.bridge._textureSnapshots.get(f.records[0]+64),original=snap.source;
    Object.defineProperty(f.bridge,'_residentLevel',{configurable:true,writable:true,value(){throw Error('producer throw');}});
    const own=Object.getOwnPropertyDescriptor(f.bridge,'_residentLevel');
    assert.throws(()=>h.measure(f),/producer throw/);
    assert.equal(Uint8Array,U8);for(const k of Object.keys(saved))assert.equal(U8.prototype[k],saved[k]);
    assert.equal(snap.source,original);
    assert.deepEqual(Object.getOwnPropertyDescriptor(f.bridge,'_residentLevel'),own);
    assert.equal(Object.hasOwn(f.bridge,'_rememberTexture'),false);
  } finally {await f.close();}
});

test('measure restores the global constructor present on entry, including throw', async () => {
  const h=load(),f=h.fixture(64),original=Uint8Array;
  const entry=new Proxy(original,{});
  try {
    assert.equal(f.draw(),1);await f.drain();
    globalThis.Uint8Array=entry;
    assert.throws(()=>h.measure(f,()=>{throw Error('canary');}),/canary/);
    assert.equal(globalThis.Uint8Array,entry,'preserve prior instrumentation instead of overwriting it');
  } finally {globalThis.Uint8Array=original;await f.close();}
});
