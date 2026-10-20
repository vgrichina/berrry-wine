'use strict';
const fs=require('fs'), cp=require('child_process'), path=require('path'), crypto=require('crypto'), assert=require('assert/strict');
const root='/tmp/wine-screensaver-input-boundary-fix', out=__dirname;
const candidate='95d2f43d868d60d84d945b20f393863176622d64', main='c918629780ca97b871886e417fc46a800ab3203b';
const git=(a)=>cp.execFileSync('git',a,{cwd:root,maxBuffer:8*1048576});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(git(['rev-parse','HEAD']).toString().trim(),candidate);
assert.equal(git(['status','--porcelain']).toString(),'');
const s=fs.statfsSync(out); assert(s.bavail*s.bsize>=2210398208+44*1048576);
const paths=git(['ls-tree','-r','--name-only',candidate,'src','tools/watx-src']).toString().trim().split('\n')
  .concat(['host.js','lib/apps.js','lib/browser-shell.js','lib/wat-manifest.js','tools/check-apps-registry.js','lib/renderer-input.js','lib/host-window.js','lib/region-map.generated.js','tools/watx.js','test/test-screensaver-input.js','test/test-screensaver-applet.js','test/test-screensaver-wiring.js']);
const identities={candidate,main,node:process.version,files:{}};
for(const p of paths){
  const b=git(['show',candidate+':'+p]);
  if(fs.existsSync(path.join(root,p)))assert.equal(hash(fs.readFileSync(path.join(root,p))),hash(b),p);
  identities.files[p]={sha256:hash(b),gitBlob:git(['rev-parse',candidate+':'+p]).toString().trim()};
}
fs.writeFileSync(out+'/tested-identities.json',JSON.stringify(identities,null,2));
const checks=[];
for(const args of [
  ['test/test-screensaver-input.js'],
  ['test/test-screensaver-applet.js'],
  ['-r','/home/user/wine-assembly/scratch/runs/20261020-screensaver-input-boundary-fix/sparse-source-view.js','test/test-screensaver-wiring.js'],
  [out+'/supplement.js'],
]){
  const r=cp.spawnSync('node',args,{cwd:root,encoding:'utf8',timeout:45000,maxBuffer:2*1048576});
  checks.push({args,status:r.status,stdout:r.stdout,stderr:r.stderr});
  fs.writeFileSync(out+'/checks.json',JSON.stringify(checks,null,2));
  assert.equal(r.status,0,r.stdout+'\n'+r.stderr);
}
const base=git(['merge-base',candidate,main]).toString().trim();
const changed=ref=>git(['diff','--name-only',base,ref]).toString().trim().split('\n');
const ours=changed(candidate),theirs=changed(main),overlap=ours.filter(p=>theirs.includes(p));
assert.deepEqual(overlap,['host.js']);
const input=s=>s.slice(s.indexOf('    h.check_input = () => {'),s.indexOf('    // Wire thread/event imports'));
assert.equal(input(git(['show',main+':host.js']).toString()),input(git(['show',candidate+':host.js']).toString()));
fs.writeFileSync(out+'/main-reconciliation.json',JSON.stringify({base,candidate,main,candidatePaths:ours,mainPaths:theirs,overlap,hostOwnedInputIdentical:true,
  mainHostDiff:git(['diff',base,main,'--','host.js']).toString(),
  candidateHostDiff:git(['diff',base,candidate,'--','host.js']).toString(),
  qualification:'Path and source review only; no integrated module built or executed.'},null,2));
assert.equal(git(['status','--porcelain']).toString(),'');
console.log('PASS candidate input regression, baseline and four mutations; original applet/wiring; independent supplemental cases; main reconciliation; exact source identities');
