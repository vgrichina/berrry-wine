#!/usr/bin/env node
'use strict';
// External bounded controller; stage only in an owned, fresh remote checkout.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const BASE = '9e9020159';
const PRESERVED = [
 ['/home/user/jedi-knight-checkout/build/wine-assembly.wasm','937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb'],
 ['/home/user/wa-iw-native-validation/build/wine-assembly.wasm','a948a826f71c1935c4d00f7054decdaf4d1e8115314d8779727b7e30069f5b48'],
 ['/home/user/wa-iw-combined-native/build/wine-assembly.wasm','04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17'],
 ['/home/user/wa-outlaws-kernel32-native-attempt4/build/wine-assembly.wasm','0dbf18930da633aa71c860ecaca2615a0f6562c9ff0a62aba6f063a12b2bf8ab'],
 ['/home/user/lords2-getparent-d56/build/wine-assembly.wasm','e26a751567f63a0bb6abbea8a69111842d41e8705158ccf425394d4ac591745d'],
 ['/home/user/wa-ne-arena-native/build/wine-assembly.wasm','ca90c018226b1b002d257dde09e1913fd35c2e22cac43a2128ae88744f80cccd'],
 ['/home/user/wa-ne-context-native/build/wine-assembly.wasm','9b57583c1ca8887f7195a268c94312ca6352eb646f4071c740c5a75aff1eb69e'],
];
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const hash = p => sha(fs.readFileSync(p));
async function runChild(executable, args, options, record, timeoutMs = 120000, graceMs = 3000) {
  const child = cp.spawn(executable, args, { ...options, detached: true });
  const pid = child.pid;
  record({ controllerPid: process.pid, pid: pid ?? null, pgid: pid ?? null });
  let timedOut = false, interrupted = null, forceTimer;
  const signals = [];
  function signalGroup(signal) {
    if (!pid) return;
    try { process.kill(-pid, signal); signals.push({ at: new Date().toISOString(), signal }); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  function stop(reason) {
    if (reason === 'timeout') timedOut = true; else interrupted = reason;
    signalGroup('SIGTERM');
    if (!forceTimer) forceTimer = setTimeout(() => signalGroup('SIGKILL'), graceMs);
  }
  const terminate = () => stop('SIGTERM'), interrupt = () => stop('SIGINT');
  process.on('SIGTERM', terminate); process.on('SIGINT', interrupt);
  const timer = setTimeout(() => stop('timeout'), timeoutMs);
  let terminal;
  try {
    terminal = await new Promise(resolve => {
      child.once('error', error => resolve({ status: null, signal: null, error: error.message }));
      child.once('exit', (status, signal) => resolve({ status, signal, error: null }));
    });
  } finally {
    clearTimeout(timer); clearTimeout(forceTimer);
    // Also reap surviving descendants after a normal parent exit.
    signalGroup('SIGTERM');
    const active = () => !pid ? [] : cp.execFileSync('ps', ['-eo', 'pid,pgid,stat'], {encoding:'utf8', timeout:5000})
      .split('\n').filter(line => {
        const m = /^\s*(\d+)\s+(\d+)\s+(\S+)\s*$/.exec(line);
        return m && Number(m[2]) === pid && !m[3].startsWith('Z');
      });
    let remaining = active(), until = Date.now() + graceMs;
    while (remaining.length && Date.now() < until) {
      await new Promise(resolve => setTimeout(resolve, 50)); remaining = active();
    }
    if (remaining.length) {
      signalGroup('SIGKILL'); until = Date.now() + 2000;
      while (remaining.length && Date.now() < until) {
        await new Promise(resolve => setTimeout(resolve, 50)); remaining = active();
      }
    }
    process.removeListener('SIGTERM', terminate); process.removeListener('SIGINT', interrupt);
    terminal = { ...terminal, pid: pid ?? null, pgid: pid ?? null, timedOut, interrupted,
      signals, remainingGroupProcesses: remaining, at: new Date().toISOString() };
  }
  return terminal;
}
function cleanEnvironment(input = process.env) {
 return Object.fromEntries(Object.entries(input).filter(([key]) => !key.startsWith('WINE_') && !key.startsWith('WA_') && key !== 'NODE_OPTIONS' && key !== 'NODE_PATH'));
}
function immutableSources(root, commit, run) {
 return run('git',['ls-tree','-r','-z',commit]).split('\0').filter(Boolean).map(row => {
  const m=/^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(row);assert(m,'commit tree entry');
  const p=path.join(root,m[3]),symlink=m[1]==='120000';
  const bytes=symlink?Buffer.from(fs.readlinkSync(p)):fs.readFileSync(p);
  const actual=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  assert.equal(actual,m[2],'immutable source differs: '+m[3]);
  return {path:p,sha256:sha(bytes),symlink};
 });
}
function validateConfig(c) {
 for (const key of ['root','out','baseline','dependencyReference']) assert(path.isAbsolute(c[key]), key);
 assert(/^[a-f0-9]{40}$/.test(c.commit), 'immutable commit required');
 assert(/^[a-f0-9]{64}$/.test(c.baselineSha256), 'immutable baseline hash required');
 assert(![...PRESERVED.map(([p]) => path.dirname(path.dirname(p))),c.dependencyReference].includes(c.root), 'own checkout required');
 assert(c.root !== c.out && !c.out.startsWith(c.root + '/'), 'evidence outside checkout');
 assert(Number.isFinite(Date.parse(c.archiveAfter)), 'fresh API TTL required');
 return c;
}
function verify(rows) { for (const r of rows) assert.equal(r.symlink?sha(Buffer.from(fs.readlinkSync(r.path))):hash(r.path), r.sha256, r.path); }
function tree(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => {
 const p=path.join(dir,e.name); return e.isDirectory()?tree(p):e.isFile()?[{path:p,sha256:hash(p)}]:[];
}); }
function routeCommand(name, out) {
 const shot=n=>'shot:'+path.join(out,n+'.png');
 const routes={
  name:['canvasclick:0.535,0.782','type:Arden','wait:1000',shot('name-entered')],
  create:['canvasclick:0.532,0.949','wait:2000',shot('character-created')],
  select:['canvasclick:0.147,0.124','wait:1500',shot('champion-selected')],
  slot:['canvasclick:0.656,0.38','wait:1500',shot('party-slot')],
  accept:['canvasclick:0.53,0.949','wait:10000',shot('party-accepted')],
 };
 assert(routes[name], 'unknown ordinary route command'); return {steps:routes[name]};
}
async function main() {
 const [phase,file] = process.argv.slice(2), c=validateConfig(JSON.parse(fs.readFileSync(file)));
 assert(['build','software','webgl','postflight'].includes(phase));
 const env=cleanEnvironment();
 const run=(bin,args,options={})=>cp.execFileSync(bin,args,{cwd:c.root,env,encoding:'utf8',timeout:30000,maxBuffer:32*1024**2,...options});
 const save=(name,value)=>fs.writeFileSync(path.join(c.out,name),JSON.stringify(value,null,2));
 const read=name=>JSON.parse(fs.readFileSync(path.join(c.out,name)));
 const pins=()=>verify(PRESERVED.map(([path,sha256])=>({path,sha256})));
 function idle() {
  const inventory=run('ps',['-eo','pid,ppid,pgid,stat,comm']);
  const active=inventory.split('\n').filter(l=>{const m=/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s*$/.exec(l);return m&&+m[1]!==process.pid&&!m[4].startsWith('Z')&&/^(node|MainThread|chrome|chromium|firefox|wat2wasm)$/.test(m[5]);});
  assert.equal(active.length,0,active.join('\n'));return {inventory,active};
 }
 function source() {
  assert.equal(run('git',['rev-parse','HEAD']).trim(),c.commit);
  run('git',['merge-base','--is-ancestor',BASE,'HEAD']);
  run('git',['diff','--exit-code',BASE,'HEAD','--','src','lib','host.js','index.html','package.json','package-lock.json','fonts']);
  assert.equal(run('git',['status','--porcelain','--untracked-files=no']).trim(),'');
  return immutableSources(c.root,c.commit,run);
 }
 const fixture=()=>require(path.join(c.root,'tools/darkstone-backend-checkpoint')).fixtureIdentity(c.root);
 function common() {
  assert.equal(hash(c.baseline),c.baselineSha256,'admitted baseline receipt');
  const processes=idle();pins();const disk=fs.statfsSync(c.root);
  assert(disk.bavail*disk.bsize>2*1024**3,'disk');
  return {at:new Date().toISOString(),processes,freeBytes:disk.bavail*disk.bsize};
 }
 function preservation(pre) {
  pins();for(const key of ['source','dependencies','external','browserFiles'])verify(pre[key]);
  assert.equal(fixture().sha256,pre.fixture.sha256);
 }
 if(phase==='build') {
  assert(Date.parse(c.archiveAfter)-Date.now()>1260000,'TTL for bounded build');
  assert(!fs.existsSync(c.out),'new evidence directory required');fs.mkdirSync(c.out);
  const initial=common(), baseline=JSON.parse(fs.readFileSync(c.baseline));
  const external=[...baseline.source,...baseline.donorSource,...baseline.canonicalSource,...baseline.donorDependencies];verify(external);verify(baseline.browserFiles);
  const donorCheckouts=PRESERVED.map(([p])=>path.dirname(path.dirname(p)));
  const donorSources=donorCheckouts.map(dir=>({root:dir,head:run('git',['rev-parse','HEAD'],{cwd:dir}).trim(),status:run('git',['status','--porcelain','--untracked-files=no'],{cwd:dir}),sparseOmissions:[]}));
  for(const donor of donorSources)for(const row of run('git',['ls-files','-t','-z'],{cwd:donor.root}).split('\0').filter(Boolean)){
   const p=path.join(donor.root,row.slice(2));if(row.startsWith('S ')){donor.sparseOmissions.push(p);continue;}external.push({path:p,sha256:hash(p)});
  }
  const dependencies=tree(path.join(c.root,'node_modules'));
  const expected=new Map(baseline.dependencies.map(r=>[path.relative(c.dependencyReference,r.path),r.sha256]));
  assert.equal(dependencies.length,expected.size);
  for(const r of dependencies)assert.equal(r.sha256,expected.get(path.relative(c.root,r.path)),r.path);
  const before={...initial,source:source(),donorSources,dependencies,external,browserFiles:baseline.browserFiles,fixture:fixture(),config:c};
  assert.equal(before.fixture.paths,15);assert.equal(before.fixture.sha256,require(path.join(c.root,'tools/darkstone-backend-checkpoint')).FIXTURE);
  save('preflight.json',before);fs.copyFileSync(__filename,path.join(c.out,'controller.js'));
  const fd=fs.openSync(path.join(c.out,'build.log'),'wx');
  let build;try{build=await runChild('bash',['tools/build.sh'],{cwd:c.root,env,stdio:['ignore',fd,fd]},record=>save('build-processes.json',record),1200000);}finally{fs.closeSync(fd);}
  save('build-terminal.json',build);
  assert.equal(build.status,0,'normal build failed');assert(!build.timedOut&&!build.interrupted&&!build.remainingGroupProcesses.length,'build cleanup');preservation(before);
  const artifacts=['build/wine-assembly.wasm','lib/region-map.generated.js','build/combined.wat'].map(p=>({path:path.join(c.root,p),sha256:hash(path.join(c.root,p))}));
  save('build.json',{at:new Date().toISOString(),commit:c.commit,artifacts});
  console.log(JSON.stringify({phase,passed:true,artifacts}));return;
 }
 const pre=read('preflight.json');
 const built=fs.existsSync(path.join(c.out,'build.json'))?read('build.json'):null;
 const checks={...common(),passed:false};
 preservation(pre);if(built){verify(built.artifacts);assert.equal(built.commit,c.commit);}source();
 checks.passed=true;
 if(phase==='postflight'){checks.passed=true;save('postflight-'+Date.now()+'.json',checks);console.log(JSON.stringify(checks));return;}
 assert(built,'successful build receipt required');
 assert(Date.parse(c.archiveAfter)-Date.now()>660000,'TTL for arm');
 const arm=path.join(c.out,phase);assert(!fs.existsSync(arm));fs.mkdirSync(arm);
 fs.writeFileSync(path.join(arm,'preflight.json'),JSON.stringify(checks,null,2));
 const moduleSha=built.artifacts.find(r=>r.path.endsWith('/wine-assembly.wasm')).sha256;
 const log=fs.openSync(path.join(arm,'server.log'),'wx');
 let serverPid;const serverRun=runChild(process.execPath,['tools/dev-server.js','--host=127.0.0.1','--port=8317','--isolate'],{cwd:c.root,env,stdio:['ignore',log,log]},record=>{serverPid=record.pid;fs.writeFileSync(path.join(arm,'server-processes.json'),JSON.stringify(record));},550000);
 try {
  let ready=false;for(let i=0;i<30;i++){try{if((await fetch('http://127.0.0.1:8317/index.html',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready,'private server');
  const fd=fs.openSync(path.join(arm,'controller.log'),'wx');
  let runResult;try{runResult=await runChild(process.execPath,['tools/darkstone-backend-checkpoint.js','--root='+c.root,'--out='+arm+'/capture','--origin=http://127.0.0.1:8317','--backend='+phase,'--checkpoint=interactive','--module-sha256='+moduleSha],{cwd:c.root,env:{...env,CHROME:'/opt/google/chrome/chrome'},stdio:['ignore',fd,fd]},record=>fs.writeFileSync(path.join(arm,'probe-processes.json'),JSON.stringify(record)),510000);}finally{fs.closeSync(fd);}
  fs.writeFileSync(path.join(arm,'terminal.json'),JSON.stringify(runResult));
  process.exitCode=runResult.status===0&&!runResult.timedOut&&!runResult.interrupted&&!runResult.remainingGroupProcesses.length?0:1;
 } finally {
  if(serverPid)try{process.kill(-serverPid,'SIGTERM');}catch(e){if(e.code!=='ESRCH')throw e;}
  const terminal=await serverRun;fs.writeFileSync(path.join(arm,'server-terminal.json'),JSON.stringify(terminal));fs.closeSync(log);
  if(terminal.remainingGroupProcesses.length)process.exitCode=1;
 }
}
module.exports={validateConfig,routeCommand,PRESERVED,runChild,cleanEnvironment,immutableSources};
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
