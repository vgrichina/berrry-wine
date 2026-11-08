'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {createRetainer, createProofRecorder} = require('./native-source-retention.cjs');
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
