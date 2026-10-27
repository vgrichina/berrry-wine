#!/usr/bin/env python3
"""Independent full-entry output escape repro. No browser, guest or compilation.

Reuse the pinned production parameterization, not an extracted runner function.
The Node bridge below replaces its fake Python child with lightweight real Node;
the oracle workload remains synthetic, with ZERO claimed runtime observations.
"""
import hashlib, importlib.util, json, os, pathlib, resource, sys, tempfile
from unittest import mock
P=pathlib.Path
ROOT=P(__file__).resolve().parent.parent
NODE='/usr/local/bin/node'
FLAGS=['--max-old-space-size=512']
RUNNER_SHA='a520830a87b04086cd1994b9513e43314df91942b18295c4d8227bde69eba6ab'
spec=importlib.util.spec_from_file_location('parameterization',ROOT/'test/test-gl-runner-output-namespace.py')
t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
source=t.RUNNER.read_text()
assert hashlib.sha256(source.encode()).hexdigest()==RUNNER_SHA
assert hashlib.sha256(t.OLD.read_bytes()).hexdigest()==t.OLD_SHA
real_spec=importlib.util.spec_from_file_location
real_replace=os.replace
receipts=[]
startup='const fs=require("fs"),v8=require("v8");console.log(JSON.stringify({execPath:process.execPath,version:process.version,execArgv:process.execArgv,limits:fs.readFileSync("/proc/self/limits","utf8"),heapLimit:v8.getHeapStatistics().heap_size_limit,environment:process.env,controlledStartup:true}));'
workload='const fs=require("fs");fs.writeFileSync(process.env.PALETTE_GPU_EVIDENCE,JSON.stringify({wasmSha256:"module-pin",stage:"controlled-routing-only",results:[]}));console.log("controlled real Node child; no runtime observations");'
def bridge_spec(name,path,*a,**kw):
 s=real_spec(name,path,*a,**kw)
 if P(path).name=='palette-browser-supervisor.py':
  load=s.loader.exec_module
  def loading(mod):
   load(mod);supervise=mod.supervise
   def node_child(argv,**kwargs):
    # The existing parameterization has already identified startup vs test.
    is_startup='localFake' in argv[-1]
    command=[NODE,*FLAGS,'-e',startup if is_startup else workload]
    r=supervise(command,**kwargs)
    if is_startup and r['exit']==0:
     j=json.loads(r['output']);assert 'unlimited' in j['limits']
     receipts.append(dict(command=command,result=j,exit=r['exit'],stopReason=r['stopReason'],cleanupComplete=r['cleanupComplete']))
    return r
   mod.supervise=node_child
  s.loader.exec_module=loading
 return s

def main():
 assert resource.getrlimit(resource.RLIMIT_DATA)==(-1,-1)
 assert resource.getrlimit(resource.RLIMIT_AS)==(-1,-1)
 with tempfile.TemporaryDirectory(prefix='gl-independent-',dir=ROOT.parent/'ops') as tmp:
  target=P(tmp)/'outside-runner-accounting.log';target.write_bytes(b'')
  escapes=[]
  def injection(a,b):
   real_replace(a,b)
   if P(b).name=='remote-admission.json':
    output=P(b).parent
    (output/'node-startup.log').symlink_to(target)
    escapes.append(dict(link=str(output/'node-startup.log'),target=str(target),outsideAccountingRoot=True))
  with mock.patch.object(importlib.util,'spec_from_file_location',bridge_spec),mock.patch.object(os,'replace',injection):
   result=t.exercise(source)
  payload=target.read_bytes()
  collection=result['collected']['files']['node-startup.log']
  assert result['error'] is None,result['error']
  assert result['children']==['startup','test']
  assert receipts and receipts[0]['cleanupComplete'] and receipts[0]['stopReason'] is None
  assert all(s['bytes']==s['actual'] for s in result['samples'])
  assert payload and collection['bytes']==len(payload)
  assert collection['sha256']==hashlib.sha256(payload).hexdigest()
  final=result['artifacts']['remote-final-accounting.json']
  assert final['accountingComplete'] and final['completeBytes']==result['actualBytes']
  report=dict(candidate='c9f8f28cf8d5760db9330bbf86a8923a78df569b',runnerSHA256=RUNNER_SHA,productionEntryCompleted=True,children=result['children'],nodeStartup=receipts,escape=escapes,collectedEscapedFile=collection,externalAllocatedBytes=target.stat().st_blocks*512,finalAccounting=final,allInRootSamplesEqual=True,collectorCleanup=result['collected']['cleanupComplete'],testInvoked=result['collected']['testInvoked'],runtimeObservations=0,browserExecuted=False,defect='A mutable output symlink is followed by runner log write and collector, while the ledger charges only its symlink blocks.')
  path=ROOT.parent/'ops/independent-boundary-report.json';path.write_text(json.dumps(report,indent=2))
  print(json.dumps(dict(productionEntryCompleted=True,actualNodeStartup=True,externalAllocatedBytes=report['externalAllocatedBytes'],collectorBytes=collection['bytes'],accountingComplete=final['accountingComplete'],defectReproduced=True)))
  # Acceptance condition: collected output bytes must not escape the ledger.
  assert not payload,'REJECT: complete production entry wrote and collected unaccounted external output through a mutable symlink'

if __name__=='__main__':main()
