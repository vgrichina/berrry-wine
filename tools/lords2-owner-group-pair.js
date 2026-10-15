#!/usr/bin/env node
'use strict';
// Explicit exclusive runtime grant only. Restores the historical renderer in finally.
const fs=require('fs'),path=require('path'),cp=require('child_process'),cr=require('crypto'),assert=require('assert/strict');
const OLD='840e361f9e91abfc760e148552999e6a038d52137c419e54e69f2b83f8e196e9';
const NEW='8c34a51954925d41ccd2afab30900feda5810751fb0fc386b6ef20c59b6dfad3';
const sha=b=>cr.createHash('sha256').update(b).digest('hex');
assert.equal(process.argv.length,7,'ROOT PAYLOAD CANDIDATE_RENDERER REGRESSION NEW_OUTPUT');
const [root,payload,candidate,test,out]=process.argv.slice(2).map(p=>path.resolve(p));
const target=path.join(root,'lib/renderer.js'),original=fs.readFileSync(target),replacement=fs.readFileSync(candidate);
assert.equal(sha(original),OLD);assert.equal(sha(replacement),NEW);assert(!fs.existsSync(out));fs.mkdirSync(out);
const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n');
const controller=path.join(__dirname,'lords2-setup-system-observe.js');
const script=fs.readFileSync(test,'utf8');
const baseline=cp.execFileSync('git',['-C',root,'ls-files','-z'],{encoding:'utf8',maxBuffer:32*1024*1024}).split('\0').filter(Boolean).map(p=>({path:p,sha256:sha(fs.readFileSync(path.join(root,p)))}));
save('source-before.json',baseline);
const result={startedAt:new Date().toISOString(),oldRenderer:OLD,newRenderer:NEW,regressionSha256:sha(script),controllerSha256:sha(fs.readFileSync(controller)),phases:[],inputs:'one reviewed Install per phase; no System Test Yes/No answers'};
function run(exe,args,timeout){return cp.spawnSync(exe,args,{cwd:root,encoding:'utf8',timeout,maxBuffer:8*1024*1024});}
try {
  for(const phase of ['candidate','control','restored']){
    const isControl=phase==='control';fs.writeFileSync(target,isControl?original:replacement);
    const frame={phase,rendererSha256:sha(fs.readFileSync(target))};result.phases.push(frame);
    const check=`const Module=require('module'),fs=require('fs');const f=${JSON.stringify(path.join(root,'test/test-renderer-hidden-owner-group.js'))};const m=new Module(f,module);m.filename=f;m.paths=Module._nodeModulePaths(require('path').dirname(f));m._compile(fs.readFileSync(${JSON.stringify(test)},'utf8'),f);`;
    const focused=run(process.execPath,['-e',check],15000);save(phase+'-focused.json',focused);
    if(isControl){assert.equal(focused.status,1);assert((focused.stderr||'').includes('visible dialog must stay above owner'));}
    else assert.equal(focused.status,0,focused.stderr);
    const shell=run(process.execPath,['test/test-shell-desktop-zorder.js'],15000);save(phase+'-shell.json',shell);assert.equal(shell.status,0,shell.stderr);
    const phaseOut=path.join(out,phase);frame.output=phaseOut;
    const observed=run(process.execPath,[controller,root,payload,phaseOut],130000);save(phase+'-controller.json',observed);
    assert.equal(observed.status,0,observed.stderr);
    const post=JSON.parse(fs.readFileSync(path.join(phaseOut,'postflight.json')));assert.equal(post.survivors.length,0);
    assert(fs.existsSync(path.join(phaseOut,'input-event.json')),'reviewed menu input gate did not execute; stop, no retry');
    frame.input=JSON.parse(fs.readFileSync(path.join(phaseOut,'input-event.json')));
    frame.terminal=JSON.parse(fs.readFileSync(path.join(phaseOut,'terminal.json')));
    frame.afterSha256=sha(fs.readFileSync(path.join(phaseOut,'after-install-20000.png')));
    save('progress.json',result);
  }
  result.completed=true;
} catch(e){result.error=e.stack;process.exitCode=1;}
finally {
  fs.writeFileSync(target,original);assert.equal(sha(fs.readFileSync(target)),OLD);
  result.originalRendererRestored=true;
  result.changedSources=baseline.filter(f=>sha(fs.readFileSync(path.join(root,f.path)))!==f.sha256);
  if(result.changedSources.length)process.exitCode=1;
  result.finishedAt=new Date().toISOString();save('result.json',result);
}
