#!/usr/bin/env node
'use strict';
// External controller: stage, validate, or replay only in an explicitly granted slot.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),Module=require('node:module');
const target='/home/user/cmr3-free-list-validation';
const donor='/home/user/cmr3-software-lines', prior='/home/user/cmr3-lines-gameplay';
const expected='937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb';
const commit=process.env.CMR3_VALIDATION_COMMIT;
assert.equal(process.env.CMR3_RUNTIME_GRANTED,'yes','explicit root runtime grant required');
assert.match(commit||'',/^[0-9a-f]{40}$/);
const mode=process.argv[2], sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const git=(cwd,args)=>cp.execFileSync('git',args,{cwd,encoding:'utf8',timeout:90000}).trim();
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const wasm=target+'/build/wine-assembly.wasm';
function canonical(){assert(fs.lstatSync(wasm).isFile());assert.equal(sha(wasm),expected);}
if(mode==='stage'){
  assert(!fs.existsSync(target),'fresh target required');
  assert.equal(git(donor,['rev-parse','HEAD']),'750bc13fd07a59dfed1e49b19533a561ffea1208');
  assert.equal(git(donor,['status','--porcelain']),'');
  fs.mkdirSync(target);git(target,['init']);
  git(target,['fetch','--depth=1','https://github.com/vgrichina/wine-assembly.git',commit]);
  git(target,['checkout','--detach',commit]);
  const files=cwd=>git(cwd,['ls-files','-z']).split('\0').filter(Boolean);
  const changed=[],equal=[];
  for(const file of new Set([...files(target),...files(donor)])){
    const a=path.join(target,file),b=path.join(donor,file);
    if(fs.existsSync(a)&&fs.existsSync(b)&&sha(a)===sha(b)){equal.push(file);continue;}
    changed.push(file);
    assert(file.startsWith('docs/')||file.startsWith('test/')||file.startsWith('tools/cmr3-')||
      file.startsWith('tools/kkrieger-')||['TODOS.md','ops/STATUS.md','lib/d3d9-software-backend.js'].includes(file),file);
  }
  for(const file of ['package.json','package-lock.json'])assert.equal(sha(target+'/'+file),sha(prior+'/'+file));
  assert.equal(sha(donor+'/build/wine-assembly.wasm'),expected);
  assert(fs.lstatSync(donor+'/build/wine-assembly.wasm').isFile());
  fs.mkdirSync(target+'/build',{recursive:true});
  fs.copyFileSync(donor+'/build/wine-assembly.wasm',wasm,fs.constants.COPYFILE_EXCL);
  fs.cpSync(prior+'/node_modules',target+'/node_modules',{recursive:true});
  canonical();assert.equal(git(target,['status','--porcelain']),'');
  save(target+'/build/cmr3-validation-stage.json',{at:new Date().toISOString(),commit,donor,equal,changed,moduleSha256:expected});
}else if(mode==='validate'){
  canonical();assert.equal(git(target,['rev-parse','HEAD']),commit);
  const out=target+'/scratch/runs/20261015-cmr3-free-list-native';fs.mkdirSync(out,{recursive:true});
  const tests=['test/test-d3d-render-lifetime.js','test/test-d3d9-software-backend.js'];
  const receipts=[];
  function run(name,args,negative=false){
    const fd=fs.openSync(out+'/'+name+'.log','wx');
    const result=cp.spawnSync(process.execPath,args,{cwd:target,stdio:['ignore',fd,fd],timeout:240000});
    fs.closeSync(fd);canonical();
    receipts.push({name,status:result.status,signal:result.signal,error:result.error?.message,negative});
    save(out+'/receipts.json',receipts);
    assert(!result.error&&!result.signal,name+' terminated unexpectedly');
    assert(negative?result.status!==0:result.status===0,name+' unexpected status');
  }
  for(const test of tests)run(path.basename(test,'.js'),[test]);
  // Change only the diagnostic reason in memory; no production source/module write.
  const hook=`const Module=require('module'),original=Module.prototype._compile;
Module.prototype._compile=function(source,file){if(file.endsWith('/lib/d3d9-software-backend.js')){
if(!source.includes('record[names[field]]=read(field)>>>0'))throw Error('mutant anchor absent');
source=source.replace('record[names[field]]=read(field)>>>0','record[names[field]]=(field===0?0:read(field))>>>0');}
return original.call(this,source,file);};require(${JSON.stringify(target+'/'+tests[0])});`;
  run('negative-reason-zero',['-e',hook],true);
  const negativeLog=fs.readFileSync(out+'/negative-reason-zero.log','utf8');
  const reasonLine=fs.readFileSync(target+'/'+tests[0],'utf8').split('\n')
    .findIndex(line=>line.includes('assert.strictEqual(recorded.reason,5)'))+1;
  assert(reasonLine>0,'native reason assertion required');
  assert.match(negativeLog,/AssertionError/);assert.match(negativeLog,/0 !== 5/);
  assert(negativeLog.includes('test-d3d-render-lifetime.js:'+reasonLine+':'),'mutant must fail at reason assertion');
  run('restored-lifetime',[tests[0]]);
  assert.equal(git(target,['status','--porcelain']),'');
}else if(mode==='replay'){
  canonical();assert.equal(git(target,['rev-parse','HEAD']),commit);
  let source=fs.readFileSync(target+'/tools/cmr3-lines-gameplay.js','utf8');
  function replaceOnce(anchor,replacement){
    assert.equal(source.split(anchor).length-1,1,'unique replay anchor: '+anchor);
    source=source.replace(anchor,replacement);
  }
  replaceOnce('/home/user/cmr3-lines-gameplay',target);
  replaceOnce('20261015-cmr3-lines-gameplay','20261015-cmr3-free-list-replay');
  replaceOnce("const commit = '78a06540f49dec6a8061354b5b3baf08d27be55b';",`const commit = '${commit}';`);
  assert(source.includes(`const commit = '${commit}';`));
  replaceOnce("const timer = setTimeout",`let firstFailure=false;
const monitor=setInterval(()=>{
  if(firstFailure)return;
  let log;
  try{log=fs.readFileSync(output+'/output.log','utf8');}catch(error){
    if(error.code!=='ENOENT'){save('monitor-failure.json',{at:new Date().toISOString(),error:error.stack});
      clearInterval(monitor);process.exitCode=1;}return;
  }
  const line=log.split('\\n').find(line=>line.includes('invalid native free list'));
  if(!line)return;
  firstFailure=true;
  save('first-failure.json',{at:new Date().toISOString(),line,atomic:false});
  fs.writeFileSync(output+'/first-failure.log',log);
  const ctl=args=>new Promise(resolve=>cp.execFile(process.execPath,['tools/ctl.js','-s',':8137',...args],
    {cwd:checkout,timeout:3000},(error,stdout,stderr)=>resolve({error:error?.message,stdout,stderr})));
  (async()=>{save('first-failure-png.json',await ctl(['png',output+'/first-failure.png']));
    save('first-failure-quit.json',await ctl(['quit']));})();
  setTimeout(()=>{if(!settled)child.kill('SIGTERM');},7000).unref();
},100);
const timer = setTimeout`);
  replaceOnce('clearTimeout(timer); fs.closeSync(fd);','clearInterval(monitor); clearTimeout(timer); fs.closeSync(fd);');
  const mod=new Module(__filename,module);mod.filename=__filename;mod.paths=module.paths;mod._compile(source,__filename);
}else throw Error('mode must be stage, validate, or replay');
