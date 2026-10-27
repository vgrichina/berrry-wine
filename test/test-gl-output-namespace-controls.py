#!/usr/bin/env python3
"""Independent normal collector audit and production filename-routing omission."""
import hashlib,importlib.util,json,pathlib
from unittest import mock
P=pathlib.Path;ROOT=P(__file__).resolve().parent.parent
s=importlib.util.spec_from_file_location('independent',P(__file__).with_name('test-gl-output-namespace-independent.py'))
i=importlib.util.module_from_spec(s);s.loader.exec_module(i)
audits=[]
def spec(name,path,*a,**kw):
 s=i.bridge_spec(name,path,*a,**kw)
 if P(path).name=='collect-evidence.py':
  load=s.loader.exec_module
  def loading(mod):
   load(mod);collect=mod.collect
   def audit(root):
    j=collect(root);out=P(root)/'ops/output'
    files={p.name:dict(bytes=len(p.read_bytes()),sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in out.iterdir() if p.is_file()}
    assert files==j['files']
    receipts=[json.loads((out/n).read_text()) for n in files if n.endswith('-receipt.json')]
    assert len(receipts)==j['receiptCount']==2
    assert j['cleanupComplete']==all(r['cleanupComplete'] for r in receipts)
    assert j['owned']==[v for r in receipts for v in r['owned']]
    assert not any(n.endswith('.new') for n in files)
    audits.append(dict(files=files,receiptCount=j['receiptCount'],cleanupComplete=j['cleanupComplete'],testInvoked=j['testInvoked']))
    return j
   mod.collect=audit
  s.loader.exec_module=loading
 return s
def challenge(source):
 with mock.patch.object(importlib.util,'spec_from_file_location',spec):r=i.t.exercise(source)
 assert r['error'] is None,r['error']
 assert r['children']==['startup','test']
 assert r['artifacts']['remote-final-accounting.json']['completeBytes']==r['actualBytes']
 assert all(s['bytes']==s['actual'] for s in r['samples'])
 assert all(w['temp'].startswith('ops/output/') and w['output'].startswith('ops/output/') for w in r['writes'])
 assert r['collected']['testInvoked'],'production invocation-start filename no longer reaches the collector'
 return r
challenge(i.source)
needle="save('invocation-start.json',"
assert i.source.count(needle)==1
mutant=i.source.replace(needle,"save('invocation-start-misrouted.json',")
try:challenge(mutant)
except AssertionError as e:
 assert str(e)=='production invocation-start filename no longer reaches the collector',str(e)
else:raise AssertionError('filename omission escaped independent full-entry challenge')
report=dict(normalCollectorAudit='PASS',misroutedInvocationGuardRejected=True,mutation=dict(old=needle,new="save('invocation-start-misrouted.json',"),audits=audits,nodeStartup=i.receipts,runtimeObservations=0)
(ROOT.parent/'ops/independent-controls-report.json').write_text(json.dumps(report,indent=2))
print('PASS full production routing, exact collector names/lengths/hashes/ownership/cleanup/atomic temp and final byte contracts; NEW misrouted invocation-start guard rejected')
