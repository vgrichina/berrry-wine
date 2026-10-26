#!/usr/bin/env node
'use strict';
// Offline only. No Puppeteer/browser/compiler imports or execution.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');
const controls = require('./helpers/palette-browser-launch');
const dir = fs.mkdtempSync(path.join(os.tmpdir(),'palette-launch-controls-'));
const fixture = path.join(__dirname,'test-d3dim-palette-gpu-web.js');
function boundary(chrome) {
  return spawnSync(process.execPath,[...process.execArgv,fixture,'--launch-config-check'],
    {env:{...process.env,CHROME:chrome},encoding:'utf8',timeout:10000,maxBuffer:8192});
}
try {
  // Exact production fixture boundary first; sentinel must never be invoked.
  const sentinel = path.join(dir,'invoked');
  const wrapper = path.join(dir,'network,wrapper');
  fs.writeFileSync(wrapper,`#!/bin/sh\ntouch '${sentinel}'\ncurl https://invalid.example/\n`,{mode:0o700});
  const link = path.join(dir,'chrome'); fs.symlinkSync(wrapper,link);
  let result = boundary(link);
  assert.strictEqual(result.status,1); assert.match(result.stderr,/wrapper rejected before invocation/);
  assert(!fs.existsSync(sentinel));
  result = boundary('/usr/bin/true'); // inspect ELF only, never execute it
  assert.strictEqual(result.status,0,result.stderr);
  const config = JSON.parse(result.stdout);
  assert.strictEqual(config.options.detached,false);
  assert.strictEqual(config.options.executablePath,fs.realpathSync('/usr/bin/true'));
  assert.deepStrictEqual(config.options.args,['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);
  assert.match(config.checked.executableSha256,/^[a-f0-9]{64}$/);
  console.log('PASS exact fixture boundary: script/symlink rejected without sentinel; explicit ELF checked without invocation');

  // Real prlimit, synthetic Git executable: prove the limit at exec, not just
  // that a mock received a proposed argument. Node keeps its original DATA.
  const limitsBefore = fs.readFileSync('/proc/self/limits','utf8');
  const log = path.join(dir,'git-limits');
  fs.writeFileSync(path.join(dir,'git'),`#!/usr/bin/python3\nimport resource,sys,json\nwith open(${JSON.stringify(log)},'a') as f:f.write(json.dumps(resource.getrlimit(resource.RLIMIT_DATA))+'\\n')\nprint('synthetic-head' if 'rev-parse' in sys.argv else '')\n`,{mode:0o700});
  const oldPath=process.env.PATH;
  try {
    process.env.PATH=dir+path.delimiter+oldPath;
    assert.deepStrictEqual(controls.gitIdentity(dir),{head:'synthetic-head',diff:''});
  } finally { process.env.PATH=oldPath; }
  const limits=fs.readFileSync(log,'utf8').trim().split('\n').map(JSON.parse);
  assert.deepStrictEqual(limits,[[536870912,536870912],[536870912,536870912]]);
  assert.strictEqual(fs.readFileSync('/proc/self/limits','utf8'),limitsBefore);
  console.log('PASS Git identity subprocess DATA=512MiB both calls; Node limits unchanged');
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
