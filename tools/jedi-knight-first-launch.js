#!/usr/bin/env node
'use strict';
const fs = require('node:fs'), cp = require('node:child_process');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const root = '/home/user/jedi-knight-checkout';
const fixture = '/home/user/jedi-knight-demo-preflight-20261015/original';
const out = '/home/user/jedi-knight-demo-preflight-20261015/setup-run';
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const git = args => cp.execFileSync('git', ['-C', root, ...args], { encoding:'utf8' }).trim();
const wasm = root + '/build/wine-assembly.wasm';
const expected = require(root + '/docs/re-notes/jedi-knight-demo-inventory.json');
function verify() {
  assert.equal(git(['write-tree']), '42c76ec08136d55337151f7c8156a18fb3f6a618');
  assert.equal(git(['diff-files', '--name-only']), '');
  assert.equal(sha(wasm), '937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb');
  for (const f of expected.files) assert.equal(sha(fixture + '/' + f.name), f.sha256, f.name);
}
verify();
fs.mkdirSync(out);
const save = (n, d) => fs.writeFileSync(out + '/' + n, JSON.stringify(d, null, 2) + '\n');
const sources = git(['ls-files', '-z']).split('\0').filter(Boolean).map(path => ({path, sha256:sha(root + '/' + path)}));
save('source-before.json', sources);
save('identity.json', { sourceCommit:'cca0eb4067b454576a6282677cabd4db8b169610', sourceTree:git(['write-tree']), checkoutHead:git(['rev-parse','HEAD']), note:'Exact candidate tree reconstructed via git apply --index on shallow donor; no source edits during run', moduleSha256:sha(wasm), fixture:expected });
const canvas = require(root + '/lib/canvas-compat').createCanvas(32,32);
canvas.getContext('2d').fillRect(0,0,16,16);
const png = canvas.toBuffer('image/png');
assert.equal(require(root + '/node_modules/pngjs').PNG.sync.read(png).width,32);
assert.equal(typeof require(root + '/lib/renderer').Win98Renderer,'function');
fs.writeFileSync(out + '/renderer-preflight.png',png);
const args = ['test/run.js','--exe=' + fixture + '/setup.exe','--vfs-tree=' + fixture,'--no-build','--wasm=' + wasm,'--quiet-api','--no-close','--no-threads','--batch-size=200000','--max-batches=10000000','--max-seconds=300','--control=8129','--png=' + out + '/final.png'];
save('launch.json',{args,cwd:root,startedAt:new Date().toISOString(),outerMs:360000});
fs.copyFileSync(__filename,out + '/controller.js');
const fd = fs.openSync(out + '/output.log','wx');
const child = cp.spawn(process.execPath,args,{cwd:root,stdio:['ignore',fd,fd]});
save('child.json',{pid:child.pid});
const timer = setTimeout(()=>child.kill('SIGKILL'),360000);
let settled=false;
function finish(code,signal,error) {
  if(settled)return; settled=true; clearTimeout(timer); fs.closeSync(fd);
  save('terminal.json',{code,signal,error:error?.stack||null,finishedAt:new Date().toISOString()});
  try { verify(); for(const f of sources)assert.equal(sha(root+'/'+f.path),f.sha256,f.path); save('postflight.json',{identitiesUnchanged:true,at:new Date().toISOString()}); }
  catch(e){save('postflight-failure.json',{error:e.stack});process.exitCode=1;}
}
child.once('error',e=>finish(null,null,e));
child.once('exit',(c,s)=>finish(c,s,null));
