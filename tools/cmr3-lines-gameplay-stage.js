#!/usr/bin/env node
'use strict';
// Run only after the root agent grants sole remote runtime ownership.
const fs = require('node:fs'), path = require('node:path');
const cp = require('node:child_process'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
const donor = '/home/user/cmr3-software-lines';
const target = '/home/user/cmr3-lines-gameplay';
const prior = '/home/user/cmr3-fresh-checkout';
const commit = '78a06540f49dec6a8061354b5b3baf08d27be55b';
const donorCommit = '750bc13fd07a59dfed1e49b19533a561ffea1208';
const run = (cwd, args) => cp.execFileSync('git', args, {cwd, encoding:'utf8', timeout:90000}).trim();
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert(!fs.existsSync(target), 'target must be fresh');
assert.equal(run(donor, ['rev-parse','HEAD']), donorCommit);
assert.equal(run(donor, ['status','--porcelain']), '');
run('/home/user', ['clone','--shared','--no-checkout',donor,target]);
run(target, ['fetch','https://github.com/vgrichina/wine-assembly.git',commit]);
run(target, ['checkout','--detach',commit]);
// Every difference must be a named non-build change. All other tracked files,
// including every compiler/build input, must be identical in both real trees.
const exceptions = new Set(['TODOS.md','ops/STATUS.md',
  'test/test-kkrieger-input-progress.js','tools/cmr3-registered-gameplay.js',
  'tools/kkrieger-gameplay-capture.js','tools/kkrieger-input-progress.js']);
const changed = run(target, ['diff','--name-only',donorCommit,commit]).split('\n').filter(Boolean);
for (const file of changed) assert(file.startsWith('docs/') || exceptions.has(file), file);
const equal = run(target, ['ls-files','-z']).split('\0').filter(Boolean)
  .filter(file => !changed.includes(file));
for (const file of equal) assert.equal(sha(path.join(target,file)),sha(path.join(donor,file)),file);
for (const file of ['package.json','package-lock.json']) {
  assert.equal(sha(path.join(target,file)),sha(path.join(prior,file)),file);
}
const modulePath = donor + '/build/wine-assembly.wasm';
assert(fs.lstatSync(modulePath).isFile());
assert.equal(fs.statSync(modulePath).size,1803537);
assert.equal(sha(modulePath),'937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb');
fs.mkdirSync(target + '/build', {recursive:true});
fs.copyFileSync(modulePath,target + '/build/wine-assembly.wasm',fs.constants.COPYFILE_EXCL);
fs.symlinkSync(prior + '/node_modules',target + '/node_modules','dir');
assert.equal(run(target,['status','--porcelain']), '');
console.log(JSON.stringify({at:new Date().toISOString(), target, commit, donor,
  donorCommit, equalFileCount:equal.length, changed, moduleSha256:sha(modulePath),
  sourceCompilerBuildEquivalent:true, guestStarted:false},null,2));
