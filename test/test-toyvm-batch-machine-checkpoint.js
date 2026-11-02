'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const v8 = require('node:v8');
const crypto = require('node:crypto');
const root = process.env.TOYVM_ROOT || path.join(__dirname, '..');
const { createBatchMachineRunner, resumeBatchMachineRunner } = require(path.join(root, 'tools/toyvm/batch-checkpoint'));
const { STUB_SEG, STUB_OFF } = require(path.join(root, 'tools/toyvm/dos'));
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
function asm(build) {
  const code = [], labels = {}, refs = [], data = [];
  const emit = (...x) => code.push(...x), word = x => emit(x & 255, x >>> 8 & 255);
  const mark = n => { labels[n] = 0x100 + code.length; };
  const address = (n, delta = 0) => { refs.push([code.length, n, delta]); word(0); };
  const ptr = (op, n, delta = 0) => { emit(op); address(n, delta); };
  const mov = (op, n) => { emit(op); word(n); };
  const bytes = (n, b) => data.push([n, Buffer.from(b)]);
  const branch = (op, n) => { emit(0x0f, op); refs.push([code.length, n, 0, true]); word(0); };
  build({ emit, word, mark, address, ptr, mov, bytes, branch });
  for (const [n, b] of data) { mark(n); emit(...b); }
  for (const [at, n, delta, relative] of refs) { assert(n in labels); const a = labels[n] + delta - (relative ? 0x100 + at + 2 : 0); code[at] = a & 255; code[at + 1] = a >>> 8 & 255; }
  return Uint8Array.from(code);
}
const writeFile = (a, name, data) => {
  a.ptr(0xba, name); a.mov(0xb9, 0); a.mov(0xb8, 0x3c00); a.emit(0xcd, 0x21, 0x89, 0xc3);
  a.ptr(0xba, data); a.mov(0xb8, 0x4000); // DOS write; count is supplied by caller
};
const grand = asm(a => {
  // Real DOS chdir, FindFirst and read under an EXEC-created PSP.
  a.ptr(0xba, 'dir'); a.mov(0xb8, 0x3b00); a.emit(0xcd, 0x21);
  a.ptr(0xba, 'name'); a.mov(0xb9, 0); a.mov(0xb8, 0x4e00); a.emit(0xcd, 0x21);
  a.ptr(0xba, 'name'); a.mov(0xb8, 0x3d00); a.emit(0xcd, 0x21, 0x89, 0xc3);
  a.mov(0xb9, 2); a.mov(0xba, 0x300); a.mov(0xb8, 0x3f00); a.emit(0xcd, 0x21);
  // Independent guest compares make an incorrect DOS read a non-42 exit.
  a.emit(0x81, 0x3e, 0, 3, 0x4f, 0x4b); a.branch(0x85, 'failure');
  a.mov(0xb8, 0x13); a.emit(0xcd, 0x10);
  a.mov(0xba, 0x3c8); a.emit(0xb0, 7, 0xee, 0x42, 0xb0, 11, 0xee, 0xb0, 22, 0xee, 0xb0, 33, 0xee);
  a.mov(0xb8, 0xa000); a.emit(0x8e, 0xc0, 0x26, 0xc6, 0x06, 0, 0, 7);
  a.ptr(0xba, 'back'); a.mov(0xb8, 0x3b00); a.emit(0xcd, 0x21);
  a.mov(0xb8, 0x4c2a); a.emit(0xcd, 0x21); a.mark('failure'); a.mov(0xb8, 0x4c63); a.emit(0xcd, 0x21);
  a.bytes('dir', '..\\DATA\\NEST\0'); a.bytes('back', '\\BIN\0'); a.bytes('name', 'MARK.BIN\0');
});
const player = asm(a => {
  // Nested EXEC through actual INT21 services, then use AH4D to persist its exit.
  a.emit(0x0e, 0x07); a.mov(0xbb, 0x1000); a.mov(0xb8, 0x4a00); a.emit(0xcd, 0x21);
  a.emit(0x8c, 0xc8, 0xa3); a.address('params', 4); // command tail segment
  a.ptr(0xbb, 'params'); a.ptr(0xba, 'exe'); a.mov(0xb8, 0x4b00); a.emit(0xcd, 0x21);
  a.mov(0xb8, 0x4d00); a.emit(0xcd, 0x21, 0xa2, 0, 3);
  writeFile(a, 'name', 'sentinel'); a.mov(0xb9, 1); a.emit(0xcd, 0x21);
  a.mov(0xb8, 0x4c07); a.emit(0xcd, 0x21);
  a.bytes('exe', 'GRAND.COM\0'); a.bytes('name', 'RESULT.BIN\0'); a.bytes('sentinel', '*');
  a.mark('params'); a.word(0); a.address('tail'); a.word(0); a.word(0); a.word(0); a.word(0); a.word(0);
  a.mark('tail'); a.emit(0, 13);
});
const launcher = asm(a => {
  // Generate actual called batch, including an argument, through DOS writes.
  writeFile(a, 'name', 'body'); a.mov(0xb9, 15); a.emit(0xcd, 0x21); a.mov(0xb8, 0x3e00); a.emit(0xcd, 0x21);
  a.mov(0xb8, 0x4c00); a.emit(0xcd, 0x21);
  a.bytes('name', 'DINO.BAT\0'); a.bytes('body', 'PLAYER.COM go\r\n');
});
const options = { entry: 'GTA.BAT', budget: 100000, directories: ['EMPTY'],
  files: [['GTA.BAT', Buffer.from('cd BIN\r\nK.COM\r\ncall DINO.BAT\r\ncd ..\r\n')],
    ['BIN/K.COM', launcher], ['BIN/DINO.BAT', Buffer.from('WRONG.COM\r\n')],
    ['BIN/PLAYER.COM', player], ['BIN/GRAND.COM', grand], ['DATA/NEST/MARK.BIN', Buffer.from('OK')]],
  sessionOptions: { intFast: false, slice: 7, stuckLimit: 0 } };
const paused = r => r.machine.execStack.length === 1 && r.vm.get('cs') === STUB_SEG &&
  r.vm.get('gip') === STUB_OFF + 0x21 && r.vm.get('ax') === 0x3f00;
async function toRead(r) {
  for (let i = 0; i < 1000 && !paused(r); i++) { assert(!r.done, JSON.stringify({progress:{...r.progress,childRecipe:undefined},exited:r.machine.exited,exitCode:r.machine.exitCode,dispatched:r.dispatched,cs:r.vm.get('cs'),ip:r.vm.get('gip'),stuck:r.session.stuckAt,blocked:r.session.blockedOn32,stop:r.session.protectedTransferStop})); await r.step(); }
  assert(paused(r), 'real nested EXEC child must reach DOS read stub');
  assert.equal(r.machine.files.get(5).pos, 0);
  assert.equal(r.machine.currentDirectory, 'data/nest', 'real DOS chdir survived handback');
  const dta = (r.machine.curPsp << 4) + 0x80;
  assert.equal(new DataView(r.vm.mem.buffer).getUint32(dta + 0x1a, true), 2, 'literal FindFirst size');
  assert.equal(Buffer.from(r.vm.mem.subarray(dta + 0x1e, dta + 0x26)).toString(), 'MARK.BIN');
  assert.equal(r.progress.frames.length, 2);
  assert.equal(Buffer.from(r.progress.frames[1].bytes).toString(), 'PLAYER.COM go\r\n');
  assert.equal(r.machine.execStack[0].psp, r.machine.pspSeg);
}
async function finish(r) {
  for (let i = 0; i < 2000 && !r.done; i++) await r.step();
  assert(r.progress.completed);
  assert.deepEqual(r.progress.runs.map(x => [x.executable, x.args, x.exitCode]),
    [['bin/k.com', '', 0], ['bin/player.com', 'go', 7]]);
  const psp = r.machine.pspSeg << 4;
  assert.equal(r.vm.mem[psp + 0x300], 42, 'independent nested DOS EXEC exit oracle');
  assert.equal(Buffer.from(r.machine.readWholeFile('\\BIN\\RESULT.BIN')).toString(), '*');
  assert.equal(Buffer.from(r.machine.readWholeFile('\\DATA\\NEST\\MARK.BIN')).toString(), 'OK');
  assert.equal(r.machine.execStack.length, 0);
  assert.deepEqual(Array.from(r.machine.palette.subarray(21, 24)), [11, 22, 33], 'imported port callbacks target restored Machine');
  assert.equal(r.machine.videoMode, 0x13); assert.equal(r.vm.mem[0xa0000], 7);
  assert.equal(r.progress.currentDirectory, '');
  assert.equal(Buffer.from(r.vm.mem.subarray(psp + 0x81, psp + 0x85)).toString(), ' go\r');
  assert.equal(r.session.dispatchesPerTick, 550000); assert.equal(r.session.tickScale, 1); assert.equal(r.session.irqSchedule, true);
  return { dispatched: r.dispatched, handbacks: r.handbacks, runs: r.progress.runs };
}
function mutate(saved, fn) {
  const e = v8.deserialize(Buffer.from(saved)), r = v8.deserialize(e.body); fn(r);
  e.body = v8.serialize(r); e.sha256 = hash(e.body); return v8.serialize(e);
}
function digest(bytes) {
  const record = v8.deserialize(v8.deserialize(bytes).body);
  record.child = v8.deserialize(v8.deserialize(record.child).body);
  return hash(JSON.stringify(record, (_, x) => typeof x === 'bigint' ? String(x) + 'n' :
    ArrayBuffer.isView(x) ? { bytes: hash(Buffer.from(x.buffer, x.byteOffset, x.byteLength)) } :
    x instanceof Map ? [...x] : x));
}
async function main() {
  const r = await createBatchMachineRunner(options); await r.step();
  const early = r.capture(), earlyRoots = [r.vm, r.machine, r.session, r.session.cache];
  await toRead(r);
  assert(r.machine.isDirectory('empty')); assert(r.machine.isDirectory('data/nest'));
  assert(r.machine.dirEntries('').some(e => e.name === 'EMPTY' && e.attributes === 0x10));
  const roots = [r.vm, r.machine, r.session, r.session.cache];
  const saved = r.capture(); if (process.env.BATCH_ARTIFACT) fs.writeFileSync(process.env.BATCH_ARTIFACT, saved);
  const baseline = await finish(r);
  const terminal = r.capture();
  const terminalFresh = await resumeBatchMachineRunner(terminal);
  assert(terminalFresh.done); assert.deepEqual(await finish(terminalFresh), baseline);
  await r.restore(terminal); assert.deepEqual(await finish(r), baseline);
  await r.restore(saved); assert.deepEqual([r.vm, r.machine, r.session, r.session.cache].map((v,i) => v === roots[i]), [true,true,true,true]); assert(paused(r)); assert.deepEqual(await finish(r), baseline);
  const fresh = await resumeBatchMachineRunner(saved); assert(paused(fresh)); assert.deepEqual(await finish(fresh), baseline);
  await r.restore(saved);
  let negatives = 0;
  for (const fn of [
    x => x.sources[0][1] = 'bad', x => x.recipe.files[0][1][0] ^= 1,
    x => x.state.frames[1].next = 999, x => x.state.dispatched++, x => x.state.files = [],
    x => x.state.activeName = 'bin/grand.com', x => x.state.currentDirectory = 'absent',
    x => x.state.directories.push('foreign'),
    x => x.state.extra = 1, x => delete x.state.childRecipe,
    x => x.state.runs[0].handbacks = -1,
    x => x.child = mutate(x.child, y => y.identity.module = 'bad'),
    x => x.child = require('node:v8').serialize({schema:'wrong',body:new Uint8Array(),sha256:hash(new Uint8Array())}),
    x => { const e = v8.deserialize(x.child), c = v8.deserialize(e.body); c.recipe.image[0] ^= 1;
      e.body = v8.serialize(c); e.sha256 = hash(e.body); x.child = v8.serialize(e); },
  ]) {
    const before = digest(r.capture()); await assert.rejects(r.restore(mutate(saved, fn)));
    assert.equal(digest(r.capture()), before, 'malformed/source/fixture rejection before mutation'); negatives++;
  }
  const broken = Buffer.from(saved); broken[broken.length - 20] ^= 1;
  const before = digest(r.capture()); await assert.rejects(r.restore(broken)); assert.equal(digest(r.capture()), before); negatives++;
  await assert.rejects(createBatchMachineRunner({ ...options, files: [...options.files, ['BIN/../BAD.COM', grand]] }));
  await assert.rejects(createBatchMachineRunner({ ...options, files: [...options.files, ['bin/k.com', grand]] }));
  assert.deepEqual(await finish(r), baseline);
  await r.restore(early);
  assert.deepEqual([r.vm, r.machine, r.session, r.session.cache].map((v,i) => v === earlyRoots[i]), [true,true,true,true], 'rollback across external commands preserves that command roots');
  await toRead(r); assert.deepEqual(await finish(r), baseline);
  const wrong = await createBatchMachineRunner({ ...options, files: options.files.map(([n, b]) => [n, n === 'DATA/NEST/MARK.BIN' ? Buffer.from('NO') : b]) });
  await toRead(wrong);
  await assert.rejects(finish(wrong), /independent nested DOS EXEC exit oracle/);
  console.log(JSON.stringify({ passed: true, realNestedDosExec: true, liveGeneratedCall: true, wrongFileFailsExitOracle: true, negatives, baseline }));
}
(process.env.BATCH_RESTORE ? resumeBatchMachineRunner(fs.readFileSync(process.env.BATCH_RESTORE)).then(async r => {
  assert(paused(r)); console.log(JSON.stringify({ freshProcess: true, baseline: await finish(r) }));
}) : main()).catch(e => { console.error(e.stack); process.exitCode = 1; });
