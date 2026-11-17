'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {createReader} = require('./readers');

const stamp = '2026-11-16T12:00:00Z';
const record = extra => ({candidateId:'probe', startedAt:stamp, outcome:'passed',
  summary:'fresh 漢😀', structuralProbe:true, ...extra});
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ops-run-work-'));
  t.after(() => fs.rm(root, {recursive:true, force:true}));
  const reader = createReader({root, codexRoot:false, claudeRoot:false, processes:false});
  const write = async (id, value, source = 'scratch/runs') => {
    const dir = path.join(root, source, id);
    await fs.mkdir(dir, {recursive:true});
    await fs.writeFile(path.join(dir,'result.json'), JSON.stringify(value));
    return dir;
  };
  return {root, reader, write};
}

test('unchanged run history avoids content reads, buffer allocations and JSON parsing', async t => {
  const {reader, write, root} = await fixture(t);
  const files = new Set();
  for (let i=0; i<12; i++) {
    const dir = await write(String(i), record({padding:'x'.repeat(128*1024)}), i%2 ? 'ops/runs' : 'scratch/runs');
    files.add(path.join(dir,'result.json'));
  }
  const work = {opens:0, bytes:0, bufferBytes:0, parses:0};
  const open = fs.open.bind(fs), parse = JSON.parse;
  t.mock.method(fs, 'open', async (...args) => {
    const h = await open(...args);
    if (files.has(args[0])) {
      work.opens++;
      const read = h.read.bind(h);
      h.read = async (buffer, ...rest) => {
        work.bufferBytes += buffer.length;
        const result = await read(buffer, ...rest);
        work.bytes += result.bytesRead;
        return result;
      };
    }
    return h;
  });
  t.mock.method(JSON, 'parse', (text, ...rest) => {
    if (typeof text === 'string' && text.includes('"structuralProbe":true')) work.parses++;
    return parse(text, ...rest);
  });
  const cold = await reader.snapshot(), coldWork = {...work};
  for (const key of Object.keys(work)) work[key]=0;
  for (let i=0; i<3; i++) {
    const next = await reader.snapshot();
    assert.deepEqual(next.runs, cold.runs);
    assert.equal(next.runs.length,12);
  }
  t.diagnostic(JSON.stringify({fixture:'12 runs, 128 KiB ignored payload each, three warm snapshots', cold:coldWork, warm:work}));
  assert.equal(coldWork.opens,12);
  assert.equal(coldWork.parses,12);
  assert.deepEqual(work,{opens:0,bytes:0,bufferBytes:0,parses:0});
  // Changing one run must reread exactly that run, without a TTL delay.
  await write('0',record({summary:'new result',padding:'y'.repeat(128*1024)}));
  const updated = await reader.snapshot();
  assert.equal(updated.runs.find(r=>r.id==='0').summary,'new result');
  assert.equal(work.opens,1);
  assert.equal(work.parses,1);
  t.diagnostic(JSON.stringify({singleChangedRun:work}));
  // A current task and appended session remain fresh alongside cached history.
  await fs.writeFile(path.join(root,'TODOS.md'), '- [ ] Fresh task\n  id: probe-task\n');
  assert.equal((await reader.snapshot()).tasks[0].id,'probe-task');
});

test('run cache refreshes edits, growth, truncation, rotation, deletion and explicit DOS association', async t => {
  const {reader, write, root} = await fixture(t);
  const dir = await write('one',record()), file = path.join(dir,'result.json');
  assert.equal((await reader.snapshot()).runs[0].summary,'fresh 漢😀');
  await fs.writeFile(file,JSON.stringify(record({summary:'edited',outcome:'failed'})));
  assert.equal((await reader.snapshot()).runs[0].outcome,'failed');
  await fs.appendFile(file,' '.repeat(8192));
  assert.equal((await reader.snapshot()).runs[0].summary,'edited');
  await fs.writeFile(file,'{');
  let state = await reader.snapshot();
  assert.equal(state.runs.length,0);
  assert.ok(state.warnings.some(w=>w.startsWith('scratch/runs/one/result.json:')));
  await fs.writeFile(file+'.new',JSON.stringify(record({summary:'rotated'})));
  await fs.rename(file+'.new',file);
  assert.equal((await reader.snapshot()).runs[0].summary,'rotated');
  // Same-length rewrite with the original mtime still changes ctime.
  const before = await fs.stat(file);
  await fs.writeFile(file,JSON.stringify(record({summary:'changed'})));
  await fs.utimes(file,before.atime,before.mtime);
  assert.equal((await reader.snapshot()).runs[0].summary,'changed');
  await fs.unlink(file);
  assert.equal((await reader.snapshot()).runs.length,0);
  await write('one',record({summary:'recreated'}));
  assert.equal((await reader.snapshot()).runs[0].summary,'recreated');
  await write('dos',record({candidateId:null}));
  assert.equal((await reader.snapshot()).runs.length,1);
  const manifest = path.join(root,'test/toyvm-dos-corpus/manifest.json');
  await fs.mkdir(path.dirname(manifest),{recursive:true});
  await fs.writeFile(manifest,JSON.stringify({titles:[{toyvm:{evidence:[{run:'scratch/runs/dos'}]}}]}));
  assert.equal((await reader.snapshot()).runs.length,2);
  await fs.writeFile(manifest,JSON.stringify({titles:[]}));
  assert.equal((await reader.snapshot()).runs.length,1);
  await fs.rm(dir,{recursive:true});
  assert.equal((await reader.snapshot()).runs.length,0);
});

test('cached metadata revalidates artifact existence, symlinks and mutable API output', async t => {
  const {reader, write, root} = await fixture(t);
  const dir = await write('one',record({verification:'reviewed',screenshots:['view.png'],
    performance:{metric:'guest-presents',measuredAt:stamp,renderer:'test',scene:'fixture',host:'synthetic',samples:[{frames:10,durationMs:1000}]},
    gameplayScreenshots:['view.png'],gameplaySceneReview:{reviewer:'test'},artifacts:['later.txt']}));
  const key = 'scratch/runs/one/view.png';
  let state = await reader.snapshot();
  assert.ok(state.warnings.some(w=>w.includes('missing or unsafe artifact view.png')));
  await fs.writeFile(path.join(dir,'view.png'),'synthetic');
  await fs.writeFile(path.join(dir,'later.txt'),'synthetic');
  state = await reader.snapshot();
  assert.equal(state.runs[0].gameplayScreenshots.length,1);
  assert.equal(await reader.artifact(key),path.join(dir,'view.png'));
  state.runs[0].summary='caller mutation';state.runs[0].artifacts.length=0;
  state.runs[0].performance.samples[0].frames=999;
  state = await reader.snapshot();
  assert.equal(state.runs[0].summary,'fresh 漢😀');
  assert.equal(state.runs[0].performance.samples[0].frames,10);
  await fs.unlink(path.join(dir,'view.png'));
  await fs.symlink(path.join(root,'TODOS.md'),path.join(dir,'view.png'));
  await fs.writeFile(path.join(root,'TODOS.md'),'outside run');
  state = await reader.snapshot();
  assert.equal(state.runs[0].screenshots.length,0);
  assert.equal(await reader.artifact(key),null);
  // Metadata symlinks are checked on every refresh, including a warm cache.
  await fs.unlink(path.join(dir,'result.json'));
  await fs.symlink('/etc/hostname',path.join(dir,'result.json'));
  assert.equal((await reader.snapshot()).runs.length,0);
});

test('run reads preserve limits, partial reads, errors and growth-after-stat bounds', async t => {
  const {reader, write} = await fixture(t);
  const dir = await write('one',record()), file = path.join(dir,'result.json');
  const size = (await fs.stat(file)).size, open = fs.open.bind(fs);
  let grow = true, maxEnd = 0, failRead = false, closed = 0;
  t.mock.method(fs,'open',async (...args) => {
    const h = await open(...args);
    if (args[0]===file) {
      const stat = h.stat.bind(h), read = h.read.bind(h), close = h.close.bind(h);
      h.stat = async () => {
        const s = await stat();
        if (grow) {grow=false;await fs.appendFile(file,' '.repeat(2048));}
        return s;
      };
      h.read = async (b,o,n,p) => {
        if (failRead) {failRead=false;throw Object.assign(new Error('synthetic read error'),{code:'EIO'});}
        maxEnd=Math.max(maxEnd,p+n);return read(b,o,Math.min(n,17),p);
      };
      h.close = async () => {closed++;return close();};
    }
    return h;
  });
  assert.equal((await reader.snapshot()).runs.length,1);
  assert.equal(maxEnd,size);
  assert.equal((await reader.snapshot()).runs.length,1);
  await fs.writeFile(file,'x'.repeat(1024*1024+1));
  let state = await reader.snapshot();
  assert.equal(state.runs.length,0);
  assert.ok(state.warnings.some(w=>w.includes('file exceeds 1 MiB read limit')));
  await fs.writeFile(file,JSON.stringify(record({outcome:'invalid'})));
  state = await reader.snapshot();
  assert.ok(state.warnings.some(w=>w.includes('invalid outcome')));
  await fs.writeFile(file,JSON.stringify(record({summary:'recovered'})));
  assert.equal((await reader.snapshot()).runs[0].summary,'recovered');
  await fs.writeFile(file,JSON.stringify(record({summary:'retry after I/O error'})));
  const beforeClose = closed;
  failRead=true;
  state = await reader.snapshot();
  assert.equal(state.runs.length,0);
  assert.ok(state.warnings.some(w=>w.includes('synthetic read error')));
  assert.equal(closed,beforeClose+1,'failed reads close their file handle');
  assert.equal((await reader.snapshot()).runs[0].summary,'retry after I/O error');
});
