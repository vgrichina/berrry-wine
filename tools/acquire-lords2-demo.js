#!/usr/bin/env node
'use strict';
// Acquisition/static inspection only. No guest executable or setup is run.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const crypto = require('crypto'), assert = require('assert/strict');
const {parseListing, pe} = require('./acquire-army-men-demo');
const url = 'https://archive.org/download/LordsoftheRealmII_1020/lorddemo.zip';
const sha1 = '6c5ef78db77389da8ec4a0d54a576a0eb0526a48';
const hash = (b, algorithm = 'sha256') => crypto.createHash(algorithm).update(b).digest('hex');
function main(dir) {
  assert(path.isAbsolute(dir) && !fs.existsSync(dir), 'new absolute destination required');
  const disk = fs.statfsSync(path.dirname(dir));
  assert(disk.bavail * disk.bsize > 2 ** 30, '1 GiB remote free space required');
  fs.mkdirSync(dir);
  const receipt = {started: new Date().toISOString(), url, expectedSha1: sha1, guestExecution: false, licenceAnswer: false};
  const save = (name, data) => fs.writeFileSync(path.join(dir, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n');
  const run = (exe, args, timeout = 60000) => cp.execFileSync(exe, args, {cwd: dir, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024});
  try {
    run('curl', ['--fail', '--location', '--proto', '=https', '--proto-redir', '=https', '--connect-timeout', '15', '--max-time', '120', '--max-filesize', '8388608', '-o', 'lorddemo.zip', url], 125000);
    const b = fs.readFileSync(path.join(dir, 'lorddemo.zip'));
    assert.equal(b.length, 7522232); assert.equal(hash(b, 'sha1'), sha1);
    receipt.archive = {size: b.length, sha1, sha256: hash(b)};
    const listing = run('7z', ['l', '-slt', 'lorddemo.zip']);
    save('archive-listing.txt', listing);
    const inventory = parseListing(listing); save('archive-inventory.json', inventory);
    save('archive-test.txt', run('7z', ['t', 'lorddemo.zip']));
    save('extract.txt', run('7z', ['x', '-y', '-opayload', 'lorddemo.zip']));
    const files = [];
    function walk(rel = '') {
      for (const name of fs.readdirSync(path.join(dir, 'payload', rel))) {
        const r = path.posix.join(rel, name), p = path.join(dir, 'payload', r), s = fs.lstatSync(p);
        assert(!s.isSymbolicLink());
        if (s.isDirectory()) walk(r);
        else { assert(s.isFile()); const data = fs.readFileSync(p); files.push({path: r, size: data.length, sha256: hash(data), pe: pe(data)}); }
      }
    }
    walk();
    for (const f of files) assert(inventory.members.some(m => m.Path === f.path && +m.Size === f.size));
    assert.equal(files.length, inventory.members.filter(m => m.Folder !== '+').length);
    save('payload-hashes.json', files);
    receipt.status = 'outer recovered; inspect nested archive and original instructions before registration';
  } catch (e) { receipt.status = 'stopped'; receipt.error = e.message; process.exitCode = 1; }
  finally { receipt.finished = new Date().toISOString(); save('receipt.json', receipt); console.log(JSON.stringify(receipt, null, 2)); }
}
if (require.main === module) main(process.argv[2]);
module.exports = {url, sha1, main};
