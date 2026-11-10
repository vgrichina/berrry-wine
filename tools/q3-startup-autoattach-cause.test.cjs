'use strict';
// Whole sealed generated native caller, real ptrace custody and Node peer.
// No local Chrome. The peer exercises production request6 and real hooks.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),zlib=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),current=require('./q3-current-module.cjs');
const route=require('./q3-current-foreign-closure-v1.cjs');
const out=path.resolve(process.argv[2]||'');
assert(process.argv[2]&&out.startsWith(root+'/scratch/runs/')&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
cp.execFileSync('python3',['-B',root+'/tools/q3-native-phase-inputs.py',out]);
const inputs=[];
for(const name of ['control.py','physical_gate.py','cancellation_gate.py','phase-input.py']){
 const dest=out+'/'+name;
 inputs.push(path.relative(root,dest));
}
const seal=current.prepare(out+'/prepared',{foreignClosureVersion:route.version,
 checkpointObserverVersion:current.checkpointObserverVersion,nativeLifecycleVersion:'q3-native-lifecycle-foreign-v1',
 inputs,caller:path.relative(root,out+'/phase-input.py')});
const pins=JSON.parse(zlib.gunzipSync(fs.readFileSync(out+'/prepared/runtime-pins.json.gz')));
assert(pins.files.some(p=>p.path==='tools/q3-startup-custody.py'));
for(const phase of ['cancellation','original']){
 const source=fs.readFileSync(out+'/'+phase+'/runtime.py','utf8');
 assert(source.includes("runpy.run_path(str(root/'tools/q3-startup-custody.py'))['supervise']"));
 assert(!source.includes('from native_kernel_custody import supervise'));
}
const script=String.raw`
import sys,runpy,importlib.util,time,json,gzip,os,zlib,unittest
from pathlib import Path
from unittest.mock import patch
root=Path(sys.argv[1]);out=Path(sys.argv[2]);sys.path.insert(0,str(root/'tools'))
adapter=runpy.run_path(str(root/'tools/q3-startup-custody.py'))
import native_kernel_custody as original
source=Path(original.__file__).read_text()
try:adapter['candidate'](source+'\n')
except ValueError:pass
else:raise AssertionError('provider drift accepted')
kernel=adapter['load']()
assert adapter['candidate'](source).count('journal.release_barrier() # ordered durable prefix before executable userspace')==1
# Reuse real durable-prefix-before-executable-CONT and sticky service failure
# controls against the adapter, including irreversible retirement exceptions.
spec=importlib.util.spec_from_file_location('controls',root/'tools/native_kernel_custody_test.py')
controls=importlib.util.module_from_spec(spec);spec.loader.exec_module(controls);controls.kernel=kernel
names=['test_failed_sync_is_sticky_at_saturation_admission_and_finalization',
 'test_final_sync_failure_cannot_accept_fully_reaped_run',
 'test_bounded_ordered_batches_and_oversize_record_preserve_all_bytes']
suite=unittest.TestSuite(controls.RetirementService(n) for n in names)
result=unittest.TextTestRunner(verbosity=2).run(suite);assert result.wasSuccessful()
# Real fork/exec traffic and deliberately slow durable service. Ownership,
# consumed waits, durable prefixes and real reaps remain fully checked.
pressure=[]
for name,module in [('published',original),('batched',kernel)]:
 run=out/name;run.mkdir();sync=os.fsync;calls=[]
 def slow(fd):
  calls.append(time.monotonic_ns());time.sleep(.012);return sync(fd)
 begin=time.monotonic()
 with patch.object(module.os,'fsync',side_effect=slow):
  module.supervise(run,[sys.executable,'-c',
   'import os;ps=[os.fork() for _ in []];\nfor i in range(12):\n p=os.fork()\n if p==0:os.execl("/bin/true","true")\n ps.append(p)\nfor p in ps:os.waitpid(p,0)'],
   deadline=time.time()+20,cleanup_deadline=time.time()+25,journal_compression='gzip')
 elapsed=time.monotonic()-begin;drain=json.loads((run/'kernel-drain.json').read_text());assert drain['complete']
 assert len(drain['owned'])==len(drain['reaped'])==13
 pressure.append(dict(mode=name,fsyncs=len(calls),elapsed=elapsed,owned=len(drain['owned']),reaped=len(drain['reaped'])))
assert pressure[1]['fsyncs']<pressure[0]['fsyncs']*.65,pressure
(out/'pressure.json').write_text(json.dumps(pressure,indent=2))
# The real composed Node consumer with its native input/cause hooks. The peer
# returns success for request6, then a deliberate error before navigation.
env=dict(os.environ,Q3_PAGE_PEER_CHILD='1',Q3_PAGE_PEER_DIR=str(out),Q3_PAGE_PEER_MODE='single',
 Q3_NATIVE_PHASE='cancellation',Q3_NATIVE_INPUT_CAUSE='1',Q3_INPUT_WIRE='1',
 Q3_EXECUTION_BOUNDARY_OUT=str(out/'boundary.jsonl.gz'),BROWSER_DEADLINE=str(int((time.time()+90)*1000)))
os.environ.clear();os.environ.update(env)
custody=out/'whole-caller-custody';custody.mkdir()
(out/'cancellation/prepared').mkdir()
try:
 adapter['supervise'](custody,['node','--require',str(root/'tools/q3-page-session-startup.test.cjs'),
  str(out/'prepared/q3-runtime-caller.cjs')],deadline=time.time()+45,cleanup_deadline=time.time()+50,journal_compression='gzip')
except AssertionError as error:
 assert error.args==(1,),error
else:raise AssertionError('deliberate peer refusal lost')
drain=json.loads((custody/'kernel-drain.json').read_text());assert drain['complete'];assert drain['exit']==1
peer=json.loads(gzip.decompress((out/'peer.json.gz').read_bytes()))
assert [q['method'] for q in peer['protocol']]==['Browser.getVersion','Target.setDiscoverTargets','Target.setAutoAttach',
 'Target.getTargets','Target.attachToTarget','Target.setAutoAttach','Page.enable','Runtime.enable','Page.addScriptToEvaluateOnNewDocument']
assert 'OFFLINE_STOP_BEFORE_NAVIGATION' in peer['firstFailure']['error']
assert json.loads(gzip.decompress((out/'installed-consumer.json.gz').read_bytes()))['inputWire']
wait=json.loads(gzip.decompress((out/'browser-wait.json.gz').read_bytes()))
assert wait['code'] is None and wait['signal']=='SIGTERM' and wait['stdoutEOF'] and wait['stderrEOF']
assert not any(q['method']=='Browser.close' for q in peer['protocol'])
print(json.dumps(dict(passed=True,generatedNativeCaller=True,pressure=pressure,unchangedDeadlineMs=20000,
 inputWire=True,causeHook=True,allOwnedReaped=len(drain['owned'])==len(drain['reaped']))))
`;
const result=cp.spawnSync('python3',['-B','-c',script,root,out],{cwd:root,encoding:'utf8',timeout:90000,maxBuffer:1024*1024});
fs.writeFileSync(out+'/test-wait.json',JSON.stringify({status:result.status,signal:result.signal,
 stdout:result.stdout,stderr:result.stderr,actualWait:true,stdoutEOF:true,stderrEOF:true,manifestSHA256:seal.manifestSHA256},null,2));
assert.equal(result.status,0,result.stderr+'\n'+result.stdout);
for(const p of pins.files){const bytes=fs.readFileSync(root+'/'+p.path);assert.equal(hash(bytes),p.sha256);assert.equal(bytes.length,p.size);}
console.log(result.stdout);
