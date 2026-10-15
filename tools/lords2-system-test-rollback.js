#!/usr/bin/env node
'use strict';
// Explicit exclusive grant only. Never answers a prompt beyond System Test Yes.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const crypto=require('crypto'),assert=require('assert/strict');
const {verifyPayload,pins}=require('./lords2-setup-system-test');
const OLD='840e361f9e91abfc760e148552999e6a038d52137c419e54e69f2b83f8e196e9';
const NEW='8c34a51954925d41ccd2afab30900feda5810751fb0fc386b6ef20c59b6dfad3';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fileSha=p=>sha(fs.readFileSync(p));
assert.equal(process.argv.length,6,'ROOT PAYLOAD FIXED_RENDERER NEW_OUTPUT');
const [root,payload,candidate,out]=process.argv.slice(2).map(p=>path.resolve(p));
const target=path.join(root,'lib/renderer.js');
const original=fs.readFileSync(target),replacement=fs.readFileSync(candidate);
assert.equal(sha(original),OLD);assert.equal(sha(replacement),NEW);
const controller=path.join(__dirname,'lords2-setup-system-test.js');
const verify=()=>{
  assert.equal(fileSha(path.join(root,'build/wine-assembly.wasm')),pins.moduleSha256);
  for(const f of pins.files)assert.equal(fileSha(path.join(root,f.path)),f.sha256,f.path);
  verifyPayload(payload);
};
verify();
// No compilation or guest launch: load the runtime's actual canvas dependency.
cp.execFileSync(process.execPath,['-e',"require('./lib/canvas-compat');require('./lib/renderer')"],{cwd:root,timeout:15000,maxBuffer:1024*1024});
const baseline=cp.execFileSync('git',['-C',root,'ls-files','-z'],{encoding:'utf8',maxBuffer:32*1024*1024})
  .split('\0').filter(Boolean).map(p=>({path:p,sha256:fileSha(path.join(root,p))}));
assert(!fs.existsSync(out));fs.mkdirSync(out);
const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n');
fs.writeFileSync(path.join(out,'original-renderer.js'),original,{flag:'wx'});
fs.copyFileSync(__filename,path.join(out,'rollback-controller.js'));
save('source-before.json',baseline);
const result={startedAt:new Date().toISOString(),oldRenderer:OLD,fixedRenderer:NEW,
  controllerSha256:fileSha(controller),moduleSha256:pins.moduleSha256,
  inputPolicy:'reviewed Install then reviewed System Test Yes only; no later inputs'};
try{
  fs.writeFileSync(target,replacement);assert.equal(fileSha(target),NEW);
  const runOut=path.join(out,'system-test');
  const observed=cp.spawnSync(process.execPath,[controller,root,payload,runOut],{
    cwd:root,encoding:'utf8',timeout:130000,maxBuffer:8*1024*1024});
  save('controller-terminal.json',observed);
  assert.equal(observed.status,0,observed.stderr||String(observed.error));
  const post=JSON.parse(fs.readFileSync(path.join(runOut,'postflight.json')));
  assert.equal(post.survivors.length,0);
  result.terminal=JSON.parse(fs.readFileSync(path.join(runOut,'terminal.json')));
  for(const n of ['input-event.json','system-test-input.json']){
    assert(fs.existsSync(path.join(runOut,n)),n+' gate did not execute; no retry');
    result[n]=JSON.parse(fs.readFileSync(path.join(runOut,n)));
  }
  result.completed=true;
}catch(e){result.error=e.stack;process.exitCode=1;}
finally{
  // Independent of child success: put exact historical bytes back first.
  fs.writeFileSync(target,original);
  result.originalRendererRestored=fileSha(target)===OLD;
  try{
    assert(result.originalRendererRestored);
    verify();
    result.changedSources=baseline.filter(f=>fileSha(path.join(root,f.path))!==f.sha256);
    assert.equal(result.changedSources.length,0);
    result.originalSourcePayloadModuleVerified=true;
  }catch(e){result.postflightError=e.stack;process.exitCode=1;}
  result.processInventory=cp.execFileSync('ps',['-eo','pid,ppid,pgid,stat,comm'],{encoding:'utf8'});
  result.finishedAt=new Date().toISOString();save('result.json',result);
}
