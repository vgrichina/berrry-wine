'use strict';
// Real emitted Nox consumer and adapter; controlled readiness/durability gates.
// The browser boundary is a Node peer; no Chrome, compositor or guest claim.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),current=require('./nox-current-driver.cjs');
const root=current.ROOT,out=path.resolve(process.argv[3]||'');
assert(process.argv[2]&&process.argv[3]&&out.startsWith(root+'/scratch/runs/')&&!fs.existsSync(out));
fs.mkdirSync(out,{recursive:true});
const generated=out+'/generated';current.generate(path.resolve(process.argv[2]),generated);
// Exercise the emitted CLI entry point, not just its imported load() function.
const small=out+'/emitted-small',due=Date.now()/1000+15;
const emitted=cp.spawnSync('python3',['-B',generated+'/custody-run.py',small,String(due),String(due+5),
 'python3','-c','import os,sys;print("SMALL_STDOUT",flush=True);print("SMALL_STDERR",file=sys.stderr,flush=True);p=os.fork();os.execl("/bin/true","true") if p==0 else os.waitpid(p,0)'],
 {cwd:root,encoding:'utf8',timeout:25000});
fs.writeFileSync(out+'/emitted-small.stdout',emitted.stdout||'');fs.writeFileSync(out+'/emitted-small.stderr',emitted.stderr||'');
assert.equal(emitted.status,0,emitted.stderr);
const smallDrain=JSON.parse(fs.readFileSync(small+'/kernel-drain.json'));
assert(smallDrain.complete&&!smallDrain.remaining.length&&!smallDrain.unreaped.length);
assert.equal(smallDrain.owned.length,2);assert.equal(smallDrain.reaped.length,2);
assert(smallDrain.commandLog.closed&&smallDrain.commandLog.eof);
const smallLog=require('node:zlib').gunzipSync(fs.readFileSync(small+'/kernel-command.log.gz')).toString();
assert(smallLog.includes('SMALL_STDOUT')&&smallLog.includes('SMALL_STDERR'));
// Recover BOTH executable historical inputs from their publication. Never pair
// the old adapter with today's provider or bypass either adapter's hash check.
const baselineCommit='bce2b316f18923d3f781034dc6e5b2d6fd9b73cb';
const historical=name=>cp.execFileSync('git',['show',baselineCommit+':tools/'+name],{cwd:root});
const baselineProvider=historical('native_kernel_custody.py'),baselineAdapter=historical('nox-startup-custody.py');
assert.equal(current.sha(baselineProvider),'3448afd4c5ec4ea691c584a6cfde3a61b72f5c9143458189c1035f374c4c6240');
assert.equal(current.sha(baselineAdapter),'57b0b81a7c5fe46d46e37d9f7254b8f7e0c25cedd364e81442204e043530d9ed');
for(const name of ['tools/q3-startup-custody.py','tools/native_kernel_custody.py']){
 const check=String.raw`import runpy,sys
from pathlib import Path
read=Path.read_bytes
def corrupt(p):
 b=read(p)
 return b+b'WRONG' if str(p).endswith(sys.argv[2]) else b
Path.read_bytes=corrupt
try:runpy.run_path(sys.argv[1])
except AssertionError as error:assert str(error)==sys.argv[2]
else:raise AssertionError('changed service admitted')
`;
 const r=cp.spawnSync('python3',['-B','-c',check,generated+'/custody-run.py',name],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
}
const script=String.raw`
import os,sys,time,runpy,json,gzip,types
from pathlib import Path
root,out,generated=map(Path,sys.argv[1:4]);before=sys.argv[4]=='before'
if before:
 fixture=json.load(sys.stdin);adapter={}
 exec(compile(fixture['adapter'],'historical-nox-adapter','exec'),adapter)
 source=fixture['provider'].encode()
 try:adapter['candidate'](source+b'WRONG')
 except ValueError:pass
 else:raise AssertionError('historical provider drift admitted')
 kernel=types.ModuleType('historical_nox_provider')
 kernel.__file__=str(root/'tools/native_kernel_custody.py')
 exec(compile(adapter['candidate'](source),kernel.__file__,'exec'),kernel.__dict__)
else: kernel=runpy.run_path(str(generated/'custody-run.py'))['adapter']['load']()
sync=kernel.os.fsync;calls=[]
def slow(fd):
 calls.append(time.monotonic_ns());time.sleep(.08);return sync(fd)
kernel.os.fsync=slow
start=time.time();deadline=start+60
try:
 kernel.supervise(out/'custody',['node',str(root/'tools/nox-current-driver.test.cjs')],deadline=deadline,cleanup_deadline=deadline+10,journal_compression='gzip',command_compression='gzip')
except AssertionError as error:
 assert error.args==(1,),error
finally:kernel.os.fsync=sync
drain=json.loads((out/'custody/kernel-drain.json').read_text())
assert drain['complete'] and not drain['unreaped'] and not drain['remaining'],drain
assert drain['deadline']==deadline and drain['cleanupDeadline']==deadline+10
assert drain['commandLog']['closed'] and drain['commandLog']['eof']
rows=[json.loads(s) for s in gzip.open(out/'custody/custody.ndjson.gz','rt')]
assert rows and [r['sequence'] for r in rows]==list(range(1,len(rows)+1))
(out/'service.json').write_text(json.dumps(dict(seconds=time.time()-start,fsyncCalls=len(calls),owned=len(drain['owned']),reaped=len(drain['reaped']),complete=True,immutableDeadline=deadline)))
`;
const results=[];
for(const [label,mode] of [['before','delayed-port'],['after','barrier-port'],['skip-polls','barrier-port'],['missing','missing-port'],['refusal','malformed-port']]){
 const dir=out+'/'+label;fs.mkdirSync(dir);
 const r=cp.spawnSync('python3',['-B','-c',script,root,dir,generated,label],{cwd:root,
  env:{...process.env,NOX_TEST_CHILD:'1',NOX_TEST_MODE:mode,NOX_TEST_DIR:dir,NOX_TEST_GENERATED:generated,NOX_TEST_STARTUP_MUTANT:label==='skip-polls'?'skip-polls':''},
  input:label==='before'?JSON.stringify({adapter:baselineAdapter.toString(),provider:baselineProvider.toString()}):undefined,
  encoding:'utf8',timeout:75000,maxBuffer:1024*1024});
 fs.writeFileSync(dir+'/stdout',r.stdout||'');fs.writeFileSync(dir+'/stderr',r.stderr||'');
 assert.equal(r.status,0,r.stderr+'\n'+r.stdout);
 const runtime=generated+'/'+(['delayed-port','barrier-port'].includes(mode)?'production-preflight':'original');
 fs.renameSync(runtime,dir+'/runtime');
 const peer=JSON.parse(fs.readFileSync(dir+'/peer.json')),wait=JSON.parse(fs.readFileSync(dir+'/child-wait.json'));
 const timing=JSON.parse(fs.readFileSync(dir+'/runtime/native-startup-timing.json'));
 assert(peer.compiled&&!peer.chromeStarted);assert(wait.stdoutEOF&&wait.stderrEOF);
 const service=JSON.parse(fs.readFileSync(dir+'/service.json'));
 // Historical elapsed time/readiness is an observation, never a required
 // failure. The controlled current arm, not scheduler luck, seals readiness.
 const success=label==='after'||(label==='before'&&peer.code===0);
 if(success){
  assert.equal(peer.code,0);assert.equal(wait.code,0);assert(timing.portRead&&timing.polls<=100);
  if(label==='after'){
   assert(timing.polls<100);
   assert(timing.polls>=4,'four endpoint checks precede publication by the real child');
   assert(peer.barrierChecks>=4);assert(fs.existsSync(dir+'/publish-port'));
  }
  assert(!fs.existsSync(dir+'/runtime/native-startup-failure.json'));
 }else{
  assert.equal(peer.code,1);assert.equal(peer.protocol.length,0,'first readiness failure admits no CDP');
  const failure=JSON.parse(fs.readFileSync(dir+'/runtime/native-startup-failure.json'));
  assert.equal(failure.pollLimit,100);assert.equal(failure.pollIntervalMs,100);
  if(label==='skip-polls'){
   assert.equal(failure.polls,0);assert.equal(failure.error.code,'ENOENT');
   assert(!fs.existsSync(dir+'/publish-port'),'broken loop cannot release the publication barrier');
   assert.equal(peer.startupMutant,'skip-polls');
  }else if(label!=='refusal'){assert.equal(failure.polls,100);assert.equal(failure.error.code,'ENOENT');}
  else {assert(failure.portFile.readCompleted);assert.equal(failure.error.name,'TypeError');}
  assert.equal(wait.signal,'SIGTERM');assert.equal(peer.protocol.length,peer.failurePublishedIndex);
 }
 assert(!fs.existsSync(dir+'/runtime/chrome-profile'));
 results.push({label,mode,outcome:success?'ready':'refused',observationalOnly:label==='before',polls:timing.polls,portRead:timing.portRead,...service});
 console.log('PASS '+label+' '+JSON.stringify(results.at(-1)));
}
// No elapsed-time or fsync-count ratio promises across unlike traffic. Seal the
// actual release mechanism below with identical small fork/exec children.
const mechanism=String.raw`
import sys,runpy,time,json,os,gzip,zlib
from pathlib import Path
from unittest.mock import patch
generated,out=map(Path,sys.argv[1:])
import importlib.util,unittest
spec=importlib.util.spec_from_file_location('controls',Path.cwd()/'tools/native_kernel_custody_test.py')
controls=importlib.util.module_from_spec(spec);spec.loader.exec_module(controls)
controls.kernel=runpy.run_path(str(generated/'custody-run.py'))['adapter']['load']()
names=['test_failed_sync_is_sticky_at_saturation_admission_and_finalization',
 'test_final_sync_failure_cannot_accept_fully_reaped_run',
 'test_bounded_ordered_batches_and_oversize_record_preserve_all_bytes',
 'test_gzip_footer_requires_its_own_successful_final_sync',
 'test_failed_admission_service_contains_owned_tasks_before_cont']
assert unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(controls.RetirementService(n) for n in names)).wasSuccessful()
results=[]
for broken in (False,True):
 kernel=runpy.run_path(str(generated/'custody-run.py'))['adapter']['load']()
 # Defined broken implementation: all calls remain, but the release barrier
 # ceases to service mandatory admission records. No timing dependence.
 if broken:kernel.Journal.release_barrier=lambda self:None
 run=out/('broken-release' if broken else 'current-release');run.mkdir()
 rows=[];durable=[];violations=[];conts=[]
 append,trace,sync=kernel.Journal.append,kernel.ptrace,os.fsync
 def appended(journal,value,**options):
  result=append(journal,value,**options)
  if journal.path.name=='custody.ndjson.gz':rows.append(dict(value))
  return result
 def synced(fd):
  result=sync(fd)
  if os.readlink('/proc/self/fd/'+str(fd))==str(run/'custody.ndjson.gz'):
   durable[:]=[json.loads(s) for s in zlib.decompressobj(31).decompress((run/'custody.ndjson.gz').read_bytes()).splitlines()]
  return result
 outcomes={'ptrace-cont-returned','parked-child-release','parked-child-release-pending'}
 def resumed(request,pid,addr=0,data=0):
  if request==kernel.CONT:
   # Observe at the actual irreversible kernel boundary, after successful
   # fsync, not a page-cache read or a simulated wait. Only certified release
   # outcomes may trail the durable frontier of this adapter's cohort.
   assert rows[:len(durable)]==durable
   missing=[r for r in rows[len(durable):] if r['kind'] not in outcomes]
   if missing:violations.append(dict(pid=pid,missing=missing))
   conts.append(pid)
  return trace(request,pid,addr,data)
 with patch.object(kernel.Journal,'append',appended),patch.object(kernel.os,'fsync',synced),patch.object(kernel,'ptrace',resumed):
  due=time.time()+10
  kernel.supervise(run,[sys.executable,'-c','import os;p=os.fork();os.execl("/bin/true","true") if p==0 else os.waitpid(p,0)'],deadline=due,cleanup_deadline=due+5,journal_compression='gzip')
 drain=json.loads((run/'kernel-drain.json').read_text())
 assert drain['complete'] and not drain['remaining'] and not drain['unreaped']
 assert len(drain['owned'])==len(drain['reaped'])==2 and conts
 assert [json.loads(s) for s in gzip.open(run/'custody.ndjson.gz','rt')]==rows
 assert bool(violations)==broken,violations
 if broken:assert any(r['kind']=='custody' for r in violations[0]['missing'])
 results.append(dict(broken=broken,conts=len(conts),violations=violations,owned=2,reaped=2))
(out/'mechanism.json').write_text(json.dumps(results,indent=2))
print('PASS current durable admissions; broken release detected at actual CONT')
`;
const control=cp.spawnSync('python3',['-B','-c',mechanism,generated,out],{cwd:root,encoding:'utf8',timeout:45000});
fs.writeFileSync(out+'/mechanism.stdout',control.stdout||'');fs.writeFileSync(out+'/mechanism.stderr',control.stderr||'');
assert.equal(control.status,0,control.stderr);console.log(control.stdout.trim());
fs.writeFileSync(out+'/results.json',JSON.stringify({passed:true,actualGeneratedConsumer:true,realPtrace:true,noLocalChrome:true,deadlinesUnchanged:true,baseline:{commit:baselineCommit,providerSha256:current.sha(baselineProvider),adapterSha256:current.sha(baselineAdapter)},results},null,2));
