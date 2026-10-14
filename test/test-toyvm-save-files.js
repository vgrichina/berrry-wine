'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { saveFiles } = require('../tools/toyvm/save-files');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'toyvm-export-'));
const rec = text => ({ data: Buffer.from(text), len: text.length });
try {
  const out = path.join(root, 'out'), original = path.join(root, 'original');
  fs.mkdirSync(original); fs.writeFileSync(path.join(original, 'keep'), 'original');
  const records = new Map([['data/data.fil', rec('data')], ['sfx/data.fil', rec('sfx')], ['flat.dat', rec('flat')]]);
  const saved = saveFiles(out, records);
  assert.equal(saved.length, 3);
  for (const [name, record] of records) assert.equal(fs.readFileSync(path.join(out, name), 'utf8'), record.data.toString());
  for (const name of ['../original/keep', '/escape', 'C:/escape', 'data\\escape', 'data/../escape', 'data//escape']) {
    assert.throws(() => saveFiles(out, new Map([[name, rec('bad')]])), /Invalid export path/);
  }
  fs.symlinkSync(original, path.join(out, 'link'));
  assert.throws(() => saveFiles(out, new Map([['link/keep', rec('bad')]])), /Symlink/);
  fs.symlinkSync(path.join(original, 'keep'), path.join(out, 'filelink'));
  assert.throws(() => saveFiles(out, new Map([['filelink', rec('bad')]])), /Symlink/);
  assert.equal(fs.readFileSync(path.join(original, 'keep'), 'utf8'), 'original');
  console.log('PASS overlay exports preserve nested names; traversal and symlink destinations refused');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
