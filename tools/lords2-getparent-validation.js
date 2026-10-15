#!/usr/bin/env node
'use strict';
// Source-prepared controller; remote execution requires the exclusive root grant.
// No original application launch, browser, setup input or canonical mutation.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const crypto=require('crypto'),assert=require('assert/strict');
const postflight=process.argv[5]==='--postflight';
assert.equal(process.argv.length,postflight?6:5,'DEDICATED_ROOT EXPECTED_COMMIT NEW_OUTPUT [--postflight]');
const root=fs.realpathSync(process.argv[2]),commit=process.argv[3],out=path.resolve(process.argv[4]);
assert(/^\/home\/user\/lords2-getparent-[a-zA-Z0-9_-]+$/.test(root),'dedicated remote checkout required');
assert(/^[0-9a-f]{40}$/.test(commit));
assert(!out.startsWith(root+'/'));assert.equal(fs.existsSync(out),postflight);
const canonical='/home/user/jedi-knight-checkout';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fileSha=p=>sha(fs.readFileSync(p));
const exec=(bin,args,cwd=root)=>cp.execFileSync(bin,args,{cwd,encoding:'utf8',timeout:30000,maxBuffer:32*1024*1024});
const tracked=dir=>exec('git',['ls-files','-z'],dir).split('\0').filter(Boolean)
  .map(p=>({path:p,sha256:fileSha(path.join(dir,p))}));
const verify=(dir,files)=>{for(const f of files)assert.equal(fileSha(path.join(dir,f.path)),f.sha256,f.path);};
const preserved=[
  ['/home/user/jedi-knight-checkout/build/wine-assembly.wasm','937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb'],
  ['/home/user/wa-iw-native-validation/build/wine-assembly.wasm','a948a826f71c1935c4d00f7054decdaf4d1e8115314d8779727b7e30069f5b48'],
  ['/home/user/wa-iw-combined-native/build/wine-assembly.wasm','04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17'],
  ['/home/user/wa-outlaws-kernel32-native-attempt4/build/wine-assembly.wasm','0dbf18930da633aa71c860ecaca2615a0f6562c9ff0a62aba6f063a12b2bf8ab'],
];
const verifyPreserved=()=>{for(const [p,h] of preserved)assert.equal(fileSha(p),h,p);};
function idle(){
  const inventory=exec('ps',['-eo','pid,ppid,pgid,stat,comm']);
  const active=inventory.split('\n').filter(l=>{
    const m=/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s*$/.exec(l);
    return m && Number(m[1])!==process.pid && !m[4].startsWith('Z') &&
      /^(node|MainThread|chrome|chromium|firefox|wat2wasm)$/.test(m[5]);
  });
  assert.equal(active.length,0,'runtime must be independently released: '+active.join('\n'));
  return {inventory,active};
}
assert.equal(exec('git',['rev-parse','HEAD']).trim(),commit);
if(postflight){
  const r={at:new Date().toISOString(),commit,passed:false};
  try{
    r.processes=idle();verifyPreserved();
    verify(root,JSON.parse(fs.readFileSync(path.join(out,'source-before.json'))));
    verify(canonical,JSON.parse(fs.readFileSync(path.join(out,'canonical-before.json'))));
    const prior=JSON.parse(fs.readFileSync(path.join(out,'result.json')));
    if(prior.moduleSha256)assert.equal(fileSha(path.join(root,'build/wine-assembly.wasm')),prior.moduleSha256);
    r.passed=true;
  }catch(e){r.error=e.stack;process.exitCode=1;}
  fs.writeFileSync(path.join(out,'independent-postflight.json'),JSON.stringify(r,null,2)+'\n');
  process.exit(process.exitCode||0);
}
assert.equal(exec('git',['status','--porcelain','--untracked-files=no']).trim(),'');
// Prove physical tracked bytes, not just a clean Git stat-cache result.
for(const line of exec('git',['ls-files','--stage','-z']).split('\0').filter(Boolean)){
  const m=/^(\d+) ([a-f0-9]{40}) 0\t(.+)$/.exec(line);assert(m,'unmerged entry');
  const p=path.join(root,m[3]);
  const b=m[1]==='120000'?Buffer.from(fs.readlinkSync(p)):fs.readFileSync(p);
  assert.equal(crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex'),m[2],m[3]);
}
const preflightProcesses=idle();verifyPreserved();
const disk=fs.statfsSync(root);assert(Number(disk.bavail)*Number(disk.bsize)>2*1024**3,'2 GiB floor');
exec(process.execPath,['-e',"require('./lib/canvas-compat');require('./tools/watx');require('./test/render-helper')"]);
const donor=path.join(canonical,'build/wine-assembly.wasm');
const donorSha='937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb';
assert.equal(fileSha(donor),donorSha);
const baseline=tracked(root),donorSources=tracked(canonical);
fs.mkdirSync(out);
const save=(name,v)=>fs.writeFileSync(path.join(out,name),JSON.stringify(v,null,2)+'\n');
save('source-before.json',baseline);save('canonical-before.json',donorSources);
fs.copyFileSync(__filename,path.join(out,'validation-controller.js'));
const result={startedAt:new Date().toISOString(),commit,root,donorSha,preserved,preflightProcesses,
  steps:[],originalDemoExecuted:false,independentPostflightRequired:true,completed:false};
function run(name,bin,args,seconds){
  const fd=fs.openSync(path.join(out,name+'.log'),'wx');
  let r;
  try{r=cp.spawnSync('timeout',['--signal=TERM','--kill-after=5s',seconds+'s',bin,...args],
    {cwd:root,stdio:['ignore',fd,fd],timeout:(seconds+15)*1000});}
  finally{fs.closeSync(fd);}
  const s={name,status:r.status,signal:r.signal,error:r.error&&r.error.message};
  result.steps.push(s);save('progress.json',result);
  assert.equal(r.status,0,name+' failed; no retry');
}
try{
  run('normal-build','bash',['tools/build.sh'],600);
  result.moduleSha256=fileSha(path.join(root,'build/wine-assembly.wasm'));
  fs.copyFileSync(path.join(root,'build/wine-assembly.wasm'),path.join(out,'canonical.wasm'));
  for(const name of ['test-win16-getparent-invalid-tiny','test-win16-getparent-invalid-handle',
    'test-win16-window-handle-map','test-getparent-owner','test-win16-task-args-mmsystem']){
    // Harness extraWat compiles a different module. Record that identity rather
    // than attributing its assertions to the normal-build binary.
    const bootstrap="const c=require('./test/compile-src'),crypto=require('crypto');"+
      "const orig=c.compileSrcWasm;c.compileSrcWasm=function(...args){const b=orig(...args);"+
      "console.log('HARNESS_MODULE_SHA256 '+crypto.createHash('sha256').update(b).digest('hex'));return b;};"+
      "require('./test/"+name+".js');";
    run(name,process.execPath,['-e',bootstrap],180);
  }
  result.testsPassed=true;
}catch(e){result.error=e.stack;process.exitCode=1;}
finally{
  try{verify(root,baseline);verify(canonical,donorSources);verifyPreserved();
    result.processes=idle();
    result.originalSourceAndDonorUnchanged=true;
    result.completed=result.testsPassed===true;
  }catch(e){result.postflightError=e.stack;process.exitCode=1;}
  result.finishedAt=new Date().toISOString();save('result.json',result);
}
