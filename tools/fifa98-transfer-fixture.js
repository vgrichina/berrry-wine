#!/usr/bin/env node
'use strict';

// Default is a local read-only plan. --upload requires a separate lane grant.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { inspect } = require('./fifa98-preflight');
const expected = require('../docs/fixtures/fifa98-demo-inventory.json');
const { FIXTURE } = require('./fifa98-remote-startup');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function remote(code) {
  const r = JSON.parse(cp.execFileSync('/home/user/.ascii/boat',
    ['exec', 'bx_9ef2wdsw', '--timeout', '60', '--', 'node', '-e', code],
    { encoding: 'utf8', timeout: 70000, maxBuffer: 1024 * 1024 }));
  assert.equal(r.exitCode, 0, r.stderr);
  assert(!r.stdoutTruncated && !r.stderrTruncated);
  return JSON.parse(r.stdout);
}
function main() {
  const [root, mode] = process.argv.slice(2);
  assert(root && process.argv.length <= 4 && (!mode || mode === '--upload'));
  assert.deepEqual(inspect(root), expected);
  const rows = [{ path: '.wine-assembly-browser.json', sha256: expected.manifestSha256 }, ...expected.files];
  if (!mode) { console.log(JSON.stringify({ box: 'bx_9ef2wdsw', destination: FIXTURE,
    files: rows.length, payloadBytes: expected.totalBytes, action: 'plan-only' })); return; }
  // No fixture overwrite: verified existing files are reused, mismatches stop.
  for (const row of rows) {
    const bytes = fs.readFileSync(path.join(root, row.path)); assert.equal(sha(bytes), row.sha256);
    const dest = FIXTURE + '/' + row.path;
    const before = remote(`const fs=require('fs'),c=require('crypto'),p=${JSON.stringify(dest)};
      if(fs.existsSync(p)){const s=fs.lstatSync(p);if(!s.isFile()||s.isSymbolicLink())throw Error('not regular');
      const b=fs.readFileSync(p);console.log(JSON.stringify({exists:true,size:b.length,sha256:c.createHash('sha256').update(b).digest('hex')}));}
      else console.log(JSON.stringify({exists:false}));`);
    if (before.exists) { assert.equal(before.sha256, row.sha256); assert.equal(before.size, bytes.length); continue; }
    for (let offset = 0; offset < bytes.length; offset += 48000) {
      const b64 = bytes.subarray(offset, offset + 48000).toString('base64');
      remote(`const fs=require('fs'),path=require('path'),p=${JSON.stringify(dest)},offset=${offset};
        fs.mkdirSync(path.dirname(p),{recursive:true});
        const fd=fs.openSync(p,offset===0?'wx':'r+');
        try {if(fs.fstatSync(fd).size!==offset)throw Error('unexpected partial size');
        const b=Buffer.from(${JSON.stringify(b64)},'base64');let written=0;
        while(written<b.length){const n=fs.writeSync(fd,b,written,b.length-written,offset+written);if(!n)throw Error('short write');written+=n;}}
        finally{fs.closeSync(fd);}console.log(JSON.stringify({written:true}));`);
    }
    if (bytes.length === 0) remote(`const fs=require('fs'),p=${JSON.stringify(dest)};
      fs.mkdirSync(require('path').dirname(p),{recursive:true});
      fs.writeFileSync(p,Buffer.alloc(0),{flag:'wx'});console.log('{}');`);
    const after = remote(`const fs=require('fs'),c=require('crypto'),b=fs.readFileSync(${JSON.stringify(dest)});
      console.log(JSON.stringify({size:b.length,sha256:c.createHash('sha256').update(b).digest('hex')}));`);
    assert.equal(after.size, bytes.length); assert.equal(after.sha256, row.sha256);
    console.log(JSON.stringify({ path: row.path, ...after }));
  }
}
if (require.main === module) main();
