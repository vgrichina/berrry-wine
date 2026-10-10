#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { VirtualFS } = require('../lib/filesystem');
const saveBundle = require('../lib/save-bundle');
const saveSync = require('../lib/save-sync');

const appId = 'upload_test';
const bundle = id => saveBundle.exportBundle({
  appId: id, vfs: new VirtualFS(), patterns: [], store: {},
  createdAt: '2026-10-09T00:00:00.000Z',
});

(async () => {
  const valid = bundle(appId);
  const wrongApp = bundle('another_app');
  // Exercise direct push and both early sync upload paths. None may write
  // invalid input, even when metadata says there is no existing save.
  for (const route of ['push', 'no-metadata', 'missing-record', 'existing-record']) {
    for (const invalid of [wrongApp, Uint8Array.of(1, 2, 3), new Uint8Array(0)]) {
      const writes = [];
      const fetchImpl = async (url, init) => {
        if (init.method === 'POST') {
          writes.push(init.body);
          return { status: 200, ok: true };
        }
        if (url.endsWith('/metadata')) return route === 'no-metadata'
          ? { status: 404, ok: false }
          : { status: 200, ok: true, text: async () => '{"updatedAt":"now"}' };
        return route === 'existing-record'
          ? { status: 200, ok: true, arrayBuffer: async () => valid.slice().buffer }
          : { status: 404, ok: false };
      };
      const options = { appId, bundle: invalid, fetchImpl };
      await assert.rejects(route === 'push' ? saveSync.push(options) : saveSync.sync(options));
      assert.strictEqual(writes.length, 0, `${route}: invalid input never reaches the server`);
    }
  }

  let uploaded;
  await saveSync.push({ appId, bundle: valid, fetchImpl: async (_, init) => {
    uploaded = init.body;
    return { status: 200, ok: true };
  } });
  assert.deepStrictEqual(uploaded, valid, 'a verified bundle is uploaded without modification');

  let requests = 0;
  const result = await saveSync.sync({ appId, fetchImpl: async () => {
    requests++;
    return { status: 404, ok: false };
  } });
  assert.strictEqual(result.action, 'none', 'no local save is still a valid sync request');
  assert.strictEqual(requests, 1);
  console.log('PASS save sync upload validation: wrong-app and corrupt input rejected on every upload path');
})().catch(error => { console.error(error); process.exitCode = 1; });
