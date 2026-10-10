#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { VirtualFS } = require('../lib/filesystem');
const { attach } = require('../lib/vfs-persistence');

const prefix = 'wine-assembly:vfs:restore_test:';
const savedPath = 'c:\\games\\example\\save\\slot.sav';
const valid = JSON.stringify({ version: 1, attrs: 0x80, data: 'AQID' });
function memoryStorage(entries) {
  const values = new Map(entries);
  return {
    get length() { return values.size; },
    key: i => [...values.keys()][i],
    getItem: key => values.get(key),
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

const logs = [];
const vfs = new VirtualFS();
const persistence = attach(vfs, {
  appId: 'restore_test', patterns: ['c:\\games\\*'], log: message => logs.push(message),
  storage: memoryStorage([
    [prefix + '%not-a-path', valid],
    [prefix + encodeURIComponent('c:\\games\\bad-json.sav'), '{'],
    [prefix + encodeURIComponent('c:\\games\\bad-base64.sav'), JSON.stringify({ version: 1, data: '!' })],
    [prefix + encodeURIComponent(savedPath), valid],
  ]),
});
assert.strictEqual(persistence.restored, 1, 'one damaged entry must not prevent later saves from restoring');
assert.strictEqual(logs.length, 3, 'each damaged entry is reported');
assert.deepStrictEqual([...vfs.files.get(savedPath).data], [1, 2, 3]);
for (const dir of ['c:\\games', 'c:\\games\\example', 'c:\\games\\example\\save']) {
  assert(vfs.dirs.has(dir), `restored file must recreate ancestor ${dir}`);
}

for (const failAt of ['length', 'key']) {
  const storage = memoryStorage([]);
  if (failAt === 'length') Object.defineProperty(storage, 'length', {
    get() { throw new Error('storage access denied'); },
  });
  else {
    storage.setItem(prefix + encodeURIComponent(savedPath), valid);
    storage.key = () => { throw new Error('storage access denied'); };
  }
  const messages = [];
  const result = attach(new VirtualFS(), {
    appId: 'restore_test', patterns: ['c:\\games\\*'], storage,
    log: message => messages.push(message),
  });
  assert.strictEqual(result.restored, 0, 'unavailable storage must not abort application startup');
  assert(messages.some(message => message.includes('storage access denied')));
}
console.log('PASS VFS restore: corrupt entries isolated, inaccessible storage reported, ancestor directories rebuilt');
