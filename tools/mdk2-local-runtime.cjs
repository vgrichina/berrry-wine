'use strict';

// Explicit local contract for the immutable accepted MDK2 entry. No box identity.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const BASE = path.join(ROOT, 'scratch/runs');
// Explicit installed-original assignment; pre-Chrome tests consume no game launch.
const HARD_CLOSE = Date.parse('2026-11-04T23:50:00Z');
const HARD_RECOVER = Date.parse('2026-11-04T23:53:00Z');
const ASSIGNMENT = '20261104-mdk2-installed-original-gameplay';
const BROWSER_MS = 720000;
const RESERVE_MS = 180000;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function candidate() {
  return {git:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),
    driverSHA256:hash(fs.readFileSync(path.join(ROOT,'tools/mdk2-construction-driver-integration.cjs'))),
    localSHA256:hash(fs.readFileSync(__filename))};
}
function identity(pid = process.pid) {
  const stat = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
  return {hostname:os.hostname(), bootId:fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim(),
    pid, startTicks:stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19], root:fs.realpathSync(ROOT)};
}
function validate(release, run, now = Date.now(), actual = identity()) {
  assert.equal(fs.realpathSync(run), run, 'canonical fresh run required');
  assert.equal(path.dirname(run), BASE, 'direct run required');
  assert.equal(release.runDirectory, run, 'exact fresh run binding');
  assert.equal(release.authorization, 'RUNTIME RELEASE MDK2 TARGET ONWARD');
  assert.equal(release.localAuthorization, 'EXPLICIT LOCAL FINITE ORIGINAL ATTEMPT');
  assert.equal(release.assignment, ASSIGNMENT);
  assert.equal(release.shutdownOwner, 'coordinator');
  assert.equal(release.runtimeKind, 'local-process-v1');
  assert.equal(release.boxId, null, 'no fabricated box identity');
  assert.equal(release.expiry, null, 'local process has no allocation expiry');
  assert.deepEqual(release.localIdentity, actual, 'real host/process identity required');
  assert.match(release.nonce, /^[a-f0-9]{64}$/, 'fresh local nonce required');
  assert.match(release.candidate?.git || '', /^[a-f0-9]{40}$/, 'recorded candidate Git required');
  const current = candidate();
  for (const key of ['driverSHA256','localSHA256']) assert.equal(release.candidate[key], current[key], 'changed local candidate ' + key);
  const issued = Date.parse(release.issuedAt), close = Date.parse(release.closeBy), recover = Date.parse(release.recoverBy);
  assert([now,issued,close,recover].every(Number.isFinite), 'finite local deadlines');
  assert(issued <= now && now - issued < BROWSER_MS, 'fresh local release');
  assert(close <= issued + BROWSER_MS && close <= HARD_CLOSE, '720 second absolute browser cap');
  assert(close > now + 180000, 'original three-minute useful/recovery window required');
  assert(recover >= close + 180000 && recover <= HARD_RECOVER, 'original cleanup reserve required');
  return close;
}
function createRelease(run, now = Date.now()) {
  assert(now + BROWSER_MS + RESERVE_MS < HARD_CLOSE, 'launch requires 720+180 seconds before Chrome cutoff');
  assert(!fs.existsSync(path.join(run,'browser')), 'one original launch only');
  return {authorization:'RUNTIME RELEASE MDK2 TARGET ONWARD', localAuthorization:'EXPLICIT LOCAL FINITE ORIGINAL ATTEMPT',
    assignment:ASSIGNMENT, shutdownOwner:'coordinator', runtimeKind:'local-process-v1', boxId:null, expiry:null,
    runDirectory:run, localIdentity:identity(), candidate:candidate(), nonce:crypto.randomBytes(32).toString('hex'), issuedAt:new Date(now).toISOString(),
    closeBy:new Date(now + BROWSER_MS).toISOString(), recoverBy:new Date(now + BROWSER_MS + RESERVE_MS).toISOString()};
}
function once(source, from, to) {
  assert.equal(source.split(from).length, 2, 'local contract anchor changed: ' + from);
  return source.replace(from, to);
}
function translate(source) {
  // Only the obsolete box-TTL guard changes. All review/input/deadline code stays.
  const guard = "if(release.authorization!=='RUNTIME RELEASE MDK2 TARGET ONWARD'||release.shutdownOwner!=='coordinator'||!release.boxId||Date.parse(release.expiry)<Date.now()+600000)throw Error('fresh authorized finite TTL required');";
  source = once(source, guard, `require(${JSON.stringify(__filename)}).validate(release,RUN);`);
  source = once(source, "executablePath:'/usr/bin/google-chrome'", "executablePath:'/opt/google/chrome/chrome'");
  source = once(source, 'protocolTimeout:60000,timeout:30000', 'protocolTimeout:40000,timeout:30000');
  source = once(source, 'await command(c,i);', `await require(${JSON.stringify(__filename)}).within(()=>command(c,i),40000,()=>{halted=true;void close('local 40 second command deadline');});`);
  source = once(source, '  browser=await puppeteer.launch(', `  await require(${JSON.stringify(__filename)}).within(async()=>{\n  browser=await puppeteer.launch(`);
  source = once(source, 'browser=await puppeteer.launch(', `browser=await require(${JSON.stringify(__filename)}).launchOwned(puppeteer,require(${JSON.stringify(__filename)}).lifecycleForRun(RUN),`);
  // Late launch completion still hands its browser to normal closure, and
  // cannot issue the registered Launch input after a bootstrap deadline.
  source = once(source, '  page=await browser.newPage();', "  if(closing){await browser.close();throw Error('local bootstrap closed');}\n  page=await browser.newPage();");
  source = once(source, '  await page.click(\'button[onclick="launchApp()"]\');', '  if(closing)throw Error(\'local bootstrap closed\');\n  await page.click(\'button[onclick="launchApp()"]\');');
  return once(source, "  save('ready.json',await state());console.log('MDK2 ordinary browser launch ready');",
    "  save('ready.json',await state());console.log('MDK2 ordinary browser launch ready');\n  },60000,()=>{halted=true;void close('local 60 second bootstrap deadline');});");
}
async function within(action, ms, onTimeout = () => {}) {
  assert(Number.isFinite(ms) && ms > 0, 'local bootstrap deadline');
  let timer;
  try { return await Promise.race([Promise.resolve().then(action), new Promise((resolve,reject) => {
    timer=setTimeout(()=>{onTimeout();reject(Error('local operation deadline'));},ms);
  })]); } finally {clearTimeout(timer);}
}
// Capture caller provenance before launching the owned browser. Observes only;
// never sends a signal, closes a browser, or changes a launch argument.
const lifecycleTaps=new Map();
function traceOwnedLifecycle(run, executablePath = '/opt/google/chrome/chrome') {
  assert.equal(fs.realpathSync(run),run,'canonical lifecycle run required');
  assert.equal(path.dirname(run),BASE,'direct lifecycle run required');
  const file=path.join(run,'chrome-lifecycle.jsonl'),children=new Map(),removers=[],browsers=new WeakSet(),pages=new WeakSet();
  fs.writeFileSync(file,'',{flag:'wx'});
  const record=(kind,data={})=>fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),monotonicNs:process.hrtime.bigint().toString(),kind,...data})+'\n');
  record('observer-installed',{owner:identity(),executablePath,profile:path.join(run,'chrome-profile')});
  const spawn=cp.spawn,kill=process.kill;
  function listen(emitter,event,fn){emitter.on(event,fn);removers.push(()=>emitter.off(event,fn));}
  function spawnObserved(command,args,...rest){
    const child=Reflect.apply(spawn,this,[command,args,...rest]);
    if(command!==executablePath||!Array.isArray(args)||!args.includes('--user-data-dir='+path.join(run,'chrome-profile')))return child;
    if(!child.pid){record('spawn-without-pid');return child;}
    const childKill=child.kill;
    let childIdentity;
    try{childIdentity=identity(child.pid);}catch(error){childIdentity={unavailable:String(error)};}
    const observed={child,childKill,identity:childIdentity,command,args:[...args],stderr:''};children.set(child.pid,observed);
    record('spawn',{pid:child.pid,identity:childIdentity,command,args:[...args]});
    child.kill=function(signal){record('child.kill',{pid:child.pid,signal:signal??'SIGTERM',stack:new Error('owned kill caller').stack});return Reflect.apply(childKill,this,arguments);};
    listen(child,'exit',(code,signal)=>record('exit',{pid:child.pid,code,signal}));
    listen(child,'close',(code,signal)=>record('close',{pid:child.pid,code,signal}));
    listen(child,'error',error=>record('child-error',{pid:child.pid,error:String(error)}));
    let remaining=131072;
    if(child.stderr)listen(child.stderr,'data',chunk=>{if(remaining<=0)return;const b=Buffer.from(chunk).subarray(0,remaining);remaining-=b.length;observed.stderr+=b.toString();record('stderr',{pid:child.pid,text:b.toString(),truncated:remaining===0});});
    return child;
  }
  function killObserved(pid,signal){
    if(children.has(Math.abs(pid)))record('process.kill',{pid,signal:signal??'SIGTERM',stack:new Error('owned kill caller').stack});
    return Reflect.apply(kill,this,arguments);
  }
  cp.spawn=spawnObserved;process.kill=killObserved;
  listen(process,'exit',code=>record('driver-exit',{code}));
  const tap={file,record,
    ownedLaunch(){assert.equal(children.size,1,'exactly one observed owned launch required');return [...children.values()][0];},
    watchBrowser(browser){
      const child=browser.process();
      assert(child&&children.get(child.pid)?.child===child,'lifecycle browser must be an observed owned child');
      if(browsers.has(browser))return;browsers.add(browser);
      const close=browser.close;
      browser.close=async function(...args){record('browser.close-called',{stack:new Error('close caller').stack});try{const result=await Reflect.apply(close,this,args);record('browser.close-resolved');return result;}catch(error){record('browser.close-rejected',{error:String(error)});throw error;}};
      removers.push(()=>{browser.close=close;});
      // Composed historical callers have their retained filename, so a
      // run-directory require proxy alone cannot observe their new pages.
      const newPage=browser.newPage;
      if(typeof newPage==='function'){
        browser.newPage=async function(...args){const page=await Reflect.apply(newPage,this,args);tap.watchPage(page);return page;};
        removers.push(()=>{browser.newPage=newPage;});
      }
      listen(browser,'disconnected',()=>record('browser-disconnected'));
    },
    watchPage(page){
      if(pages.has(page))return;pages.add(page);
      listen(page,'close',()=>record('page-close'));
      listen(page,'error',error=>record('page-error',{error:String(error)}));
      listen(page,'framedetached',()=>record('frame-detached'));
    },
    restore(){if(cp.spawn===spawnObserved)cp.spawn=spawn;if(process.kill===killObserved)process.kill=kill;
      for(const {child,childKill}of children.values())child.kill=childKill;
      for(const remove of removers)remove();lifecycleTaps.delete(run);record('observer-restored');}
  };
  lifecycleTaps.set(run,tap);return tap;
}
function lifecycleForRun(run){const tap=lifecycleTaps.get(run);assert(tap,'owned lifecycle recorder not installed');return tap;}
// Active cleanup belongs to the caller, separate from the passive recorder.
// launch() can reject before returning a Browser while its child is still live.
// Only that recorded child and its own loopback endpoint may be closed here.
const recoveredLaunches=new WeakSet();
async function closeUnreturnedLaunch(tap,{deadline,connect}) {
  assert(Number.isFinite(deadline)&&deadline>Date.now()&&deadline<=Date.now()+60000,'finite 60 second cleanup deadline required');
  assert.equal(typeof connect,'function');
  assert(!recoveredLaunches.has(tap),'one launch-failure cleanup only');recoveredLaunches.add(tap);
  const owned=tap.ownedLaunch(),child=owned.child;
  const checkIdentity=()=>assert.deepEqual(identity(child.pid),owned.identity,'recorded child gone or replaced');
  const wait=()=>new Promise(resolve=>setTimeout(resolve,10));
  const remaining=()=>{const ms=deadline-Date.now();assert(ms>0,'launch-failure cleanup deadline');return ms;};
  tap.record('launch-failure-cleanup-begin',{pid:child.pid,identity:owned.identity});
  try {
    let endpoint;
    while(!endpoint){
      assert(child.exitCode===null&&child.signalCode===null,'owned launch already exited; preserve actual outcome');
      checkIdentity();remaining();
      const endpoints=owned.stderr.split(/\r?\n/).slice(0,-1).map(line=>/^DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[a-f0-9-]+)$/.exec(line)?.[1]).filter(Boolean);
      assert(endpoints.length<=1,'ambiguous owned DevTools endpoint');endpoint=endpoints[0];
      if(!endpoint)await wait();
    }
    checkIdentity();tap.record('launch-failure-connect',{pid:child.pid,endpoint});
    const browser=await within(()=>connect({browserWSEndpoint:endpoint,protocolTimeout:Math.min(5000,remaining())}),remaining());
    let disconnected=false;
    browser.on('disconnected',()=>{disconnected=true;tap.record('recovery-browser-disconnected');});
    try {
      for(const page of await within(()=>browser.pages(),remaining()))tap.watchPage(page);
      checkIdentity();tap.record('recovery-browser.close-called',{stack:new Error('launch-failure close caller').stack});
      await within(()=>browser.close(),remaining());tap.record('recovery-browser.close-resolved');
      while(child.exitCode===null&&child.signalCode===null){remaining();await wait();}
      assert.equal(child.exitCode,0,'launch-failure child exit must be normal');
      assert.equal(child.signalCode,null,'abnormal signal is never normal cleanup');
      assert(disconnected,'recovery root disconnect required');
      tap.record('launch-failure-cleanup-normal',{pid:child.pid,code:child.exitCode,signal:child.signalCode});
      return {pid:child.pid,code:child.exitCode,signal:child.signalCode};
    }finally{browser.disconnect();}
  }catch(error){tap.record('launch-failure-cleanup-rejected',{error:String(error)});throw error;}
}
// The actual caller must recover immediately: the installed launcher's catch
// starts a five-second fallback before its launch promise rejects. Preserve the
// original rejection even when normal cleanup succeeds; never retry launch.
async function launchOwned(puppeteer,tap,options) {
  let browser;
  try { browser=await puppeteer.launch(options); }
  catch(error) {
    try { await closeUnreturnedLaunch(tap,{deadline:Date.now()+60000,connect:options=>puppeteer.connect(options)}); }
    catch(cleanupError) { tap.record('caller-cleanup-failure',{error:String(cleanupError),launchError:String(error)}); }
    throw error;
  }
  // Bind directly at the actual caller, regardless of its Module filename.
  // Duplicate observation by the immutable diagnostic preload is idempotent.
  tap.watchBrowser(browser);
  return browser;
}
let installed = false;
const transportSource = String.raw`# Local transport only; imported as runtime_io by the original operator chain.
from pathlib import Path
import json,subprocess,hashlib,os,socket,time
E=Path(__file__).resolve().parent
ROOT='/home/user/wine-assembly'
def allocation():
 v=json.loads((E/'runtime-release.json').read_text())
 assert v['authorization']=='RUNTIME RELEASE MDK2 TARGET ONWARD'
 assert v['localAuthorization']=='EXPLICIT LOCAL FINITE ORIGINAL ATTEMPT'
 assert v['runtimeKind']=='local-process-v1' and v['boxId'] is None and v['expiry'] is None
 assert v['assignment']=='${ASSIGNMENT}' and v['runDirectory']==str(E)
 assert v['shutdownOwner']=='coordinator'
 assert len(v['nonce'])==64 and all(c in '0123456789abcdef' for c in v['nonce'])
 for field,name in [('driverSHA256','mdk2-construction-driver-integration.cjs'),('localSHA256','mdk2-local-runtime.cjs')]:
  assert hashlib.sha256((Path(ROOT)/'tools'/name).read_bytes()).hexdigest()==v['candidate'][field],'changed local candidate'
 i=v['localIdentity'];assert i['root']==str(Path(ROOT).resolve()) and i['hostname']==socket.gethostname()
 assert i['bootId']==Path('/proc/sys/kernel/random/boot_id').read_text().strip()
 stat=Path('/proc/'+str(i['pid'])+'/stat').read_text()
 assert stat[stat.rindex(')')+2:].split()[19]==i['startTicks'],'original local process gone/replaced'
 return i
def local(file):
 p=Path(file);assert p.is_absolute() and p.resolve()==p and p.is_relative_to(E),'owned run path required'
 return p
def remote(code,timeout=60,detach=False):
 allocation();assert not detach and 0<timeout<=90,'bounded synchronous local control only'
 assert not any(x in code for x in ('boat ','ssh ','curl ','wget ')),'local transport only'
 p=subprocess.run(code,shell=True,cwd=ROOT,capture_output=True,text=True,timeout=min(timeout,40),executable='/bin/bash')
 r=dict(stdout=p.stdout,stderr=p.stderr,exitCode=p.returncode,stdoutTruncated=False,stderrTruncated=False)
 with (E/'local-commands.jsonl').open('a') as f:f.write(json.dumps(dict(code=code,result=r))+'\n')
 assert p.returncode==0,r
 return r
def upload(data,dest):
 allocation();p=local(dest);assert p.parent==E and p.name.startswith('review-') and p.suffix=='.json'
 assert len(data)<65536;p.write_bytes(data)
def download(src,dest):
 allocation();p=local(src);q=local(dest)
 assert p.parent==E/'browser' and q.parent==E/'recovered/browser' and p.name==q.name
 assert p.is_file() and p.stat().st_size<16777216
 b=p.read_bytes();q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(b)
 return dict(path=str(p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
`;
const controlSource = String.raw`# Preserve author -> operator -> next -> control; replace only box transport.
import sys
# The generated original operator.py must never shadow Python's stdlib operator.
sys.path.pop(0)
import importlib.util,runpy
from pathlib import Path
E=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('runtime_io',E/'local-transport.py')
io=importlib.util.module_from_spec(s);s.loader.exec_module(io);sys.modules['runtime_io']=io
io.allocation()
# Child Python processes inherit this bootstrap through the run-local .pth-free
# sitecustomize hook; no shared Python module is replaced.
import os
os.environ['PYTHONPATH']=str(E/'python-hooks')+os.pathsep+os.environ.get('PYTHONPATH','')
target=sys.argv.pop(1);assert target in ('operator.py','next.py','control.py','author.py')
sys.argv[0]=str(E/target);runpy.run_path(str(E/target),run_name='__main__')
`;
const siteSource = String.raw`import importlib.util,sys
from pathlib import Path
E=Path(__file__).resolve().parent.parent
s=importlib.util.spec_from_file_location('runtime_io',E/'local-transport.py')
io=importlib.util.module_from_spec(s);s.loader.exec_module(io);sys.modules['runtime_io']=io
`;
function prepareTransport(run) {
  for(const [name,source] of Object.entries({'local-transport.py':transportSource,'local-control.py':controlSource}))
    fs.writeFileSync(path.join(run,name),source,{flag:'wx'});
  fs.mkdirSync(path.join(run,'python-hooks'));
  fs.writeFileSync(path.join(run,'python-hooks/sitecustomize.py'),siteSource,{flag:'wx'});
}
function heavyRelease(board) {
  const rows=board.split('\n').filter(line=>/^2026-11-04T\S+ (?:gltron-repaired-live(?:-backends-nov04)? LOCAL HEAVY RELEASE(?:\s|$)|coordinator LOCAL HEAVY RELEASE gltron-repaired-live-backends-nov04:)/.test(line));
  assert(rows.length,'explicit gltron-repaired-live-backends-nov04 LOCAL HEAVY RELEASE required');
  const line=rows.at(-1),at=Date.parse(line.split(' ')[0]);
  assert(Number.isFinite(at)&&at>=Date.parse('2026-11-04T21:00:23Z')&&at<=Date.now(),'current predecessor release required');
  return line;
}
function install(run) {
  assert(!installed, 'dedicated one-use local contract');
  const fd = Number(process.env.WINE_LOCAL_RUNTIME_LOCK_FD);
  assert(Number.isInteger(fd) && fd >= 3, 'inherited local runtime lock required');
  const held = fs.fstatSync(fd), lock = fs.statSync('/tmp/wine-local-runtime.lock');
  assert(held.dev === lock.dev && held.ino === lock.ino, 'wrong runtime lock descriptor');
  assert.equal(cp.spawnSync('flock',['-n','/tmp/wine-local-runtime.lock','true']).status,1,'exclusive runtime lock must be held');
  heavyRelease(fs.readFileSync(path.join(ROOT,'messageboard.txt'),'utf8'));
  const release = createRelease(run);
  validate(release, run);
  const finite = require(path.join(BASE,'20261104-mdk2-fresh-pending-scene/finite-deadline.cjs'));
  const originalDeadline = finite.browserDeadline;
  finite.browserDeadline = (r,now) => {
    if (r.runtimeKind !== 'local-process-v1') return originalDeadline(r,now);
    assert.equal(r.nonce,release.nonce,'changed release nonce');
    assert.deepEqual(r.candidate,release.candidate,'changed release candidate');
    return validate(r,run,now);
  };
  const main = require(path.join(BASE,'20261104-mdk2-post-lua-native-boundary/main-state.cjs'));
  const originalSource = main.sourceForRun;
  main.sourceForRun = directory => translate(originalSource(directory));
  fs.writeFileSync(path.join(run,'runtime-release.json'),JSON.stringify(release,null,2)+'\n',{flag:'wx'});
  prepareTransport(run);
  // The composed caller always requires this tap before launchOwned. Make that
  // prerequisite part of installation, rather than an optional outer-wrapper
  // call which can pass every offline byte gate and still fail at bootstrap.
  const existingTap=lifecycleTaps.get(run);
  const lifecycle=existingTap||traceOwnedLifecycle(run);
  installed = true;
  return {release,lifecycle, restore() {finite.browserDeadline=originalDeadline;main.sourceForRun=originalSource;if(!existingTap)lifecycle.restore();}};
}
// Keep directory creation, the exact resolver, installation and the actual
// composed caller in one entry. Tests replace only Puppeteer's launch boundary.
async function start(run) {
  fs.mkdirSync(run,{recursive:true});
  const integration=require('./mdk2-construction-driver-integration.cjs');
  const releaseLine=heavyRelease(fs.readFileSync(path.join(ROOT,'messageboard.txt'),'utf8'));
  const {adapter,provenance}=integration.candidateResolver(hash(fs.readFileSync(path.join(ROOT,'tools/mdk2-construction-driver-integration.cjs'))));
  const resolver=adapter.createResolver(),runtime=await adapter.installAdapter(resolver);
  fs.writeFileSync(path.join(run,'original-adapter-proof.json'),JSON.stringify({provenance,releaseLine,
    filesystem:runtime.filesystem,http:runtime.http,inspection:runtime.inspection},null,2)+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(run,'runtime-pins.json'),resolver.manifest(),{flag:'wx'});
  install(run);
  integration.run(run);
}
module.exports = {ROOT,BASE,HARD_CLOSE,HARD_RECOVER,ASSIGNMENT,identity,candidate,validate,createRelease,translate,within,traceOwnedLifecycle,lifecycleForRun,closeUnreturnedLaunch,launchOwned,install,start,prepareTransport,transportSource,controlSource,siteSource,heavyRelease};
