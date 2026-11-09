'use strict';
// Execute the sealed generated Nox consumer inside actual ptrace custody.
// Browser boundary is a Node peer; no local Chromium or guest claim.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),generated=path.resolve(process.argv[2]||''),out=path.resolve(process.argv[3]||'');
assert(process.argv[2]&&process.argv[3]&&out.startsWith(root+'/scratch/runs/')&&!fs.existsSync(out));
fs.mkdirSync(out,{recursive:true});
const script=String.raw`
import sys,runpy,os,time,json,importlib.util,unittest
from pathlib import Path
from unittest.mock import patch
root,generated,out=map(Path,sys.argv[1:])
sys.path.insert(0,str(root/'tools'))
adapter=runpy.run_path(str(root/'tools/nox-startup-custody.py'))
source=(root/'tools/native_kernel_custody.py').read_bytes()
with patch.object(Path,'read_bytes',return_value=source+b'\n'):
 try:adapter['load']()
 except ValueError:pass
 else:raise AssertionError('provider drift admitted')
kernel=adapter['load']()
spec=importlib.util.spec_from_file_location('controls',root/'tools/native_kernel_custody_test.py')
controls=importlib.util.module_from_spec(spec);spec.loader.exec_module(controls);controls.kernel=kernel
names=['test_native_executable_cont_always_has_durable_ordered_prefix',
 'test_failed_sync_is_sticky_at_saturation_admission_and_finalization',
 'test_final_sync_failure_cannot_accept_fully_reaped_run']
result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(controls.RetirementService(n) for n in names))
assert result.wasSuccessful()
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
assert timing['observationalOnly'] and timing['writes']>0
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
 writes=timing['writes'],writeNs=timing['writeNs'],reaped=len(drain['reaped']),chromiumStarted=False)))
`;
const child=cp.spawnSync('python3',['-c',script,root,generated,out],{encoding:'utf8',timeout:100000,maxBuffer:1024*1024});
fs.writeFileSync(out+'/stdout',child.stdout||'');fs.writeFileSync(out+'/stderr',child.stderr||'');
assert.equal(child.status,0,child.stderr);console.log(child.stdout.trim());
fs.renameSync(generated+'/production-preflight',out+'/production-preflight');
