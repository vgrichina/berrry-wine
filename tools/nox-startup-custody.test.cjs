'use strict';
// Execute the sealed generated Nox consumer inside actual ptrace custody.
// Browser boundary is a Node peer; no local Chromium or guest claim.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),generated=path.resolve(process.argv[2]||''),out=path.resolve(process.argv[3]||'');
assert(process.argv[2]&&process.argv[3]&&out.startsWith(root+'/scratch/runs/')&&!fs.existsSync(out));
fs.mkdirSync(out,{recursive:true});
const script=String.raw`
import sys,runpy,os,time,json,importlib.util,unittest,zlib,gzip,subprocess
from pathlib import Path
from unittest.mock import patch
root,generated,out=map(Path,sys.argv[1:])
sys.path.insert(0,str(root/'tools'))
adapter=runpy.run_path(str(root/'tools/nox-startup-custody.py'))
source=(root/'tools/native_kernel_custody.py').read_bytes()
# Validate every adapter transformation against both exact provider versions.
# The entire transformed-source delta must equal the provider's queue-only
# delta. This includes the output-pump replacement, common CONT barrier,
# release cohorts and wait-priority changes; no unchecked remainder is allowed.
revision='bce2b316f18923d3f781034dc6e5b2d6fd9b73cb'
def git_source(rev,name):
 return subprocess.check_output(['git','show',rev+':tools/'+name],cwd=root)
old=git_source(revision,'native_kernel_custody.py')
queue_before="                              'creation-peek-message', 'ptrace-cont-returned')\n"
queue_after="""                              'creation-peek-message', 'ptrace-cont-returned',
                              'fork-parent-release', 'parked-child-release-queued',
                              'parked-child-release')
        # Queue bookkeeping cannot execute a task. Avoid an extra synchronous
        # write for each enqueue/release while other tasks await queue service.
        # Custody and before-consume remain durable; the full ordered prefix,
        # including these records, still flushes before every executable CONT.
"""
assert old.decode().count(queue_before)==1
assert old.decode().replace(queue_before,queue_after)==source.decode()
for name,rev in [('q3-startup-custody.py','17b39151e8aab8926e1ff8b69b017b5839ba4c0b'),
                 ('nox-startup-custody.py',revision)]:
 previous={};exec(compile(git_source(rev,name),name,'exec'),previous)
 current=runpy.run_path(str(root/'tools'/name))
 is_q3=name.startswith('q3')
 transformed=current['candidate'](source.decode() if is_q3 else source)
 prior=previous['candidate'](old.decode() if is_q3 else old)
 assert prior.count(queue_before)==1
 assert prior.replace(queue_before,queue_after)==transformed,name
 compile(transformed,name,'exec')
 try:current['candidate']((source+b'\n').decode() if is_q3 else source+b'\n')
 except ValueError:pass
 else:raise AssertionError('provider drift admitted: '+name)
print('PASS every current adapter transformation preserves exact queue-only source delta')
with patch.object(Path,'read_bytes',return_value=source+b'\n'):
 try:adapter['load']()
 except ValueError:pass
 else:raise AssertionError('provider drift admitted')
kernel=adapter['load']()
changed=adapter['candidate'](source)
begin=changed.index('    def creation_wait():\n');end=changed.index('    def priority_wait():\n',begin)
changed=changed[:begin]+changed[end:]
begin=changed.index('                # Durable service may have blocked');end=changed.index('                released = trace_task(CONT, task, deliver)',begin)
changed=changed[:begin]+changed[end:]
assert changed.replace('defer=True)','defer=retirement or diagnostic)').replace(
 '        if request == CONT: journal.flush_pending()\n','')==source.decode()
spec=importlib.util.spec_from_file_location('controls',root/'tools/native_kernel_custody_test.py')
controls=importlib.util.module_from_spec(spec);spec.loader.exec_module(controls);controls.kernel=kernel
names=['test_failed_sync_is_sticky_at_saturation_admission_and_finalization',
 'test_final_sync_failure_cannot_accept_fully_reaped_run',
 'test_bounded_ordered_batches_and_oversize_record_preserve_all_bytes',
 'test_gzip_footer_requires_its_own_successful_final_sync',
 'test_failed_admission_service_contains_owned_tasks_before_cont']
result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(controls.RetirementService(n) for n in names))
assert result.wasSuccessful()
# Observe the successful fsync, not just cache-readable bytes, before EVERY
# actual kernel CONT (including irreversible EXIT). No simulated wait statuses.
run=out/'every-cont';run.mkdir();rows=[];durable=[];conts=[];exits=[];last={}
append=kernel.Journal.append;trace=kernel.ptrace;sync=os.fsync;waitpid=os.waitpid
def observed_append(journal,value,**options):
 result=append(journal,value,**options)
 if journal.path.name=='custody.ndjson.gz':rows.append(dict(value))
 return result
def observed_sync(fd):
 result=sync(fd)
 if os.readlink('/proc/self/fd/'+str(fd))==str(run/'custody.ndjson.gz'):
  durable[:]=[json.loads(s) for s in zlib.decompressobj(31).decompress((run/'custody.ndjson.gz').read_bytes()).splitlines()]
 return result
def consume(pid,flags):
 result=waitpid(pid,flags)
 if result[0]:last[result[0]]=result[1]
 return result
def resume(request,pid,addr=0,data=0):
 if request==kernel.CONT:
  assert durable==rows,(pid,len(durable),len(rows))
  assert rows and [r['sequence'] for r in rows]==list(range(1,len(rows)+1))
  conts.append(pid)
  if last[pid]>>16==6:exits.append(pid)
 return trace(request,pid,addr,data)
with patch.object(kernel.Journal,'append',observed_append),patch.object(kernel.os,'fsync',observed_sync),patch.object(kernel.os,'waitpid',consume),patch.object(kernel,'ptrace',resume):
 kernel.supervise(run,[sys.executable,'-c',"import os;p=os.fork();os.execl('/bin/true','true') if p==0 else os.waitpid(p,0)"],deadline=time.time()+10,cleanup_deadline=time.time()+15,journal_compression='gzip')
assert conts and len(exits)==2
assert [json.loads(s) for s in gzip.decompress((run/'custody.ndjson.gz').read_bytes()).splitlines()]==rows
# A real child's EXIT can precede its delayed fork registration. Exercise that
# separate CONT path and require bytes from successful fsync, not page cache.
run=out/'first-unlinked-exit';run.mkdir();durable_bytes=b'';unlinked_conts=[]
def unlinked_sync(fd):
 global durable_bytes
 result=sync(fd)
 if os.readlink('/proc/self/fd/'+str(fd))==str(run/'custody.ndjson'):
  durable_bytes=(run/'custody.ndjson').read_bytes()
 return result
def unlinked_resume(request,pid,addr=0,data=0):
 if request==kernel.CONT:
  assert durable_bytes==(run/'custody.ndjson').read_bytes()
  unlinked_conts.append(pid)
 return trace(request,pid,addr,data)
with patch.object(kernel.os,'fsync',unlinked_sync),patch.object(kernel,'ptrace',unlinked_resume):
 controls.unseen_exit_fixture(run)
drain=json.loads((run/'kernel-drain.json').read_text())
assert unlinked_conts and drain['complete'] and not drain['remaining'] and not drain['unreaped']
# Controlled storage comparison, identical real fork/exec/reap traffic.
published=runpy.run_path(str(root/'tools/native_kernel_custody.py'))
pressure=[]
for name,supervise in [('published',published['supervise']),('nox-batched',adapter['supervise'])]:
 run=out/name;run.mkdir();calls=[]
 def slow_sync(fd):
  calls.append(time.monotonic_ns());time.sleep(.012);return sync(fd)
 begin=time.monotonic()
 with patch.object(os,'fsync',slow_sync):
  supervise(run,[sys.executable,'-c',
   'import os;ps=[]\nfor i in range(12):\n p=os.fork()\n if p==0:os.execl("/bin/true","true")\n ps.append(p)\nfor p in ps:os.waitpid(p,0)'],
   deadline=time.time()+20,cleanup_deadline=time.time()+25,journal_compression='gzip')
 elapsed=time.monotonic()-begin;drain=json.loads((run/'kernel-drain.json').read_text())
 assert drain['complete'] and len(drain['owned'])==len(drain['reaped'])==13
 pressure.append(dict(mode=name,fsyncs=len(calls),elapsed=elapsed,owned=13,reaped=13))
assert pressure[1]['fsyncs']<pressure[0]['fsyncs']*.7,pressure
assert pressure[1]['elapsed']<pressure[0]['elapsed']*.8,pressure
(out/'pressure.json').write_text(json.dumps(pressure,indent=2))
peer=out/'peer';peer.mkdir()
os.environ.update(NOX_TEST_CHILD='1',NOX_TEST_MODE='ordinary',NOX_TEST_DIR=str(peer),NOX_TEST_GENERATED=str(generated))
run=out/'custody';run.mkdir()
# A real slow journal service tests measured blocking, not a mocked clock.
original=adapter['load']
kernel=original();write=kernel.Journal.write
def slow(journal,data):
 time.sleep(.003)
 return write(journal,data)
kernel.Journal.write=slow
adapter['supervise'].__globals__['load']=lambda:kernel
adapter['supervise'](run,['node',str(root/'tools/nox-current-driver.test.cjs')],
 deadline=time.time()+60,cleanup_deadline=time.time()+70,journal_compression='gzip')
timing=json.loads((run/'nox-custody-timing.json').read_text())
assert timing['durableBeforeEveryCont'] and timing['adapterVersion']==adapter['VERSION'] and timing['writes']>0
assert timing['writeNs']>=timing['writes']*3000000
assert timing['writes']==len(timing['writeSamples']) and timing['droppedWrites']==timing['droppedPtrace']==0
assert timing['fsyncCalls']==len(timing['fsyncSamples']) and timing['fsyncCalls']>0 and timing['fsyncNs']>0
assert timing['droppedFsync']==0 and all(not s['failed'] for s in timing['fsyncSamples'])
assert all(s['endNs']>=s['beginNs'] for s in timing['ptraceSamples'])
assert any(s['request']==kernel.CONT for s in timing['ptraceSamples'])
drain=json.loads((run/'kernel-drain.json').read_text());assert drain['complete'] and drain['exit']==0
assert len(drain['owned'])==len(drain['reaped'])
peer=json.loads((peer/'peer.json').read_text());assert peer['compiled'] and not peer['chromeStarted']
assert sum(q['method']=='Browser.close' for q in peer['protocol'])==1
startup=json.loads((generated/'production-preflight/native-startup-timing.json').read_text())
assert startup['portRead'] and any(s.get('process',{}).get('tracerPid')==os.getpid() for s in startup['samples'])
assert not (generated/'production-preflight/native-startup-failure.json').exists()
assert json.loads((generated/'production-preflight/final-app-selection-boundary.json').read_text())['originalLaunches']==0
print(json.dumps(dict(passed=True,actualGeneratedConsumer=True,actualKernelCustody=True,
 writes=timing['writes'],writeNs=timing['writeNs'],reaped=len(drain['reaped']),everyCont=len(conts),exitConts=len(exits),pressure=pressure,chromiumStarted=False)))
`;
const child=cp.spawnSync('python3',['-c',script,root,generated,out],{encoding:'utf8',timeout:100000,maxBuffer:1024*1024});
fs.writeFileSync(out+'/stdout',child.stdout||'');fs.writeFileSync(out+'/stderr',child.stderr||'');
assert.equal(child.status,0,child.stderr);console.log(child.stdout.trim());
fs.renameSync(generated+'/production-preflight',out+'/production-preflight');
