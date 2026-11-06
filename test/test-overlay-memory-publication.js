#!/usr/bin/env node
'use strict';

// No guest or browser: prove that a failed overlay batch cannot publish an
// overwrite, addition or whiteout. The optional source path permits the same
// behavioral oracle to run against a pinned historical implementation.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const overlay = require(process.argv[2] || '../lib/overlay-store');
const file = (name, text, attrs = 0x80) => ({
  path: name, kind: 'file', data: Buffer.from(text), attrs,
  lastWriteTime: { lo: 123, hi: 456 },
});

async function state(store) {
  const records = await store.list();
  return Promise.all(records.map(async record => ({
    ...record,
    data: record.kind === 'file' ? [...await store.read(record.path)] : null,
  })));
}

for (const backend of ['memory', 'node-dir']) {
  async function seeded(t) {
    let store;
    if (backend === 'memory') store = overlay.memoryStore();
    else {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-publication-'));
      t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
      store = overlay.nodeDirStore(dir);
    }
    await store.writeBatch([file('save', 'accepted'), file('keep', 'untouched')]);
    return store;
  }

  test(`${backend}: invalid tail rolls back overwritten bytes and metadata`, async t => {
    const store = await seeded(t), before = await state(store);
    await assert.rejects(Promise.resolve().then(() => store.writeBatch([
      file('save', 'replacement', 0x21), file('added', 'new'),
      { path: 'bad', kind: 'invalid' },
    ])), /kind/);
    assert.deepEqual(await state(store), before);
    assert.equal(await store.read('added'), null);
  });

  test(`${backend}: failed whiteout and directory replacement preserve old saves`, async t => {
    const store = await seeded(t), before = await state(store);
    await assert.rejects(Promise.resolve().then(() => store.writeBatch([
      { path: 'save', kind: 'whiteout' },
      { path: 'keep', kind: 'dir' },
      { path: 'bad', kind: 'file', size: -1 },
    ])), /size/);
    assert.deepEqual(await state(store), before);
  });

  test(`${backend}: payload conversion failure cannot publish even its metadata`, async t => {
    const store = await seeded(t), before = await state(store);
    const data = { length: 1, get 0() { throw new Error('payload fault'); } };
    await assert.rejects(Promise.resolve().then(() => store.writeBatch([
      file('added', 'new'), { path: 'save', kind: 'file', data, attrs: 0x21 },
    ])), /payload fault/);
    assert.deepEqual(await state(store), before);
  });

  test(`${backend}: interrupted input iteration rolls back, then a retry commits`, async t => {
    const store = await seeded(t), before = await state(store);
    function* interrupted() {
      yield file('save', 'uncommitted');
      yield file('added', 'uncommitted');
      throw new Error('input interrupted');
    }
    await assert.rejects(Promise.resolve().then(() => store.writeBatch(interrupted())), /input interrupted/);
    assert.deepEqual(await state(store), before);
    assert.deepEqual(await store.writeBatch([file('save', 'retry'), file('added', 'retry')]),
      { written: 2, removed: 0 });
    assert.equal(Buffer.from(await store.read('save')).toString(), 'retry');
    assert.equal(Buffer.from(await store.read('added')).toString(), 'retry');
  });

  test(`${backend}: successful duplicate paths, whiteouts and empty batches retain semantics`, async t => {
    const store = await seeded(t);
    const input = file('save', 'final');
    assert.deepEqual(await store.writeBatch([
      file('save', 'first'), { path: 'save', kind: 'whiteout' }, input,
      { path: 'keep', kind: 'whiteout' }, { path: 'folder', kind: 'dir' },
    ]), { written: 5, removed: 0 });
    input.data.fill(0);
    const data = await store.read('save');
    assert.equal(Buffer.from(data).toString(), 'final');
    data.fill(0);
    assert.equal(Buffer.from(await store.read('save')).toString(), 'final');
    assert.equal(await store.read('keep'), null);
    const kinds = Object.fromEntries((await store.list()).map(r => [r.path, r.kind]));
    assert.deepEqual(kinds, { save: 'file', keep: 'whiteout', folder: 'dir' });
    const before = await state(store);
    assert.deepEqual(await store.writeBatch([]), { written: 0, removed: 0 });
    assert.deepEqual(await state(store), before);
    await store.remove('save');
    assert.equal(await store.read('save'), null);
    assert.deepEqual([...(await store.list())].map(r => r.path), ['keep', 'folder']);
  });
}

for (const backend of ['memory', 'node-dir']) {
  test(`${backend}: invalid sparse payload cannot publish an earlier batch member`, async t => {
    const dir = backend === 'node-dir' ? fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-sparse-invalid-')) : null;
    if (dir) t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const store = dir ? overlay.nodeDirStore(dir) : overlay.memoryStore();
    await store.writeBatch([file('save', 'accepted')]);
    const before = await state(store);
    for (const ranges of [[{ offset: 9, length: 2 }], [{ offset: 2, length: 1 }, { offset: 1, length: 1 }], [{ offset: 1, length: 3 }]]) {
      await assert.rejects(store.writeBatch([
        file('save', 'must roll back'),
        { path: 'bad', kind: 'file', size: 10, data: Uint8Array.of(1, 2),
          sparse: { basePath: 'base', originalSize: 10, baseSize: 10, ranges } },
      ]), /sparse/);
      assert.deepStrictEqual(await state(store), before);
    }
  });
}
