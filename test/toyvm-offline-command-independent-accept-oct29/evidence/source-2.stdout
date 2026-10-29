"""Real CLI subprocess acceptance only. No backend, monkeypatch or live runner."""
import copy
import hashlib
import importlib.util
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import supervisor as s

CLI = ROOT/'test/toyvm-bounded24-caller-wiring-oct28/validate_receipt_offline.py'
TARGET = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv)>1 else CLI
assert TARGET.is_relative_to(ROOT)
spec=importlib.util.spec_from_file_location('offline_cli_for_comparison',CLI)
offline=importlib.util.module_from_spec(spec);spec.loader.exec_module(offline)
caller=offline.load_caller()
LIMITS=dict(live_limit=32768,write_limit=65536,file_limit=16384,rss_limit=128*1024**2,cpu_limit=1.25,wall_limit=2.5,output_limit=4096)
BASE=dict(exit=0,stopReason=None,cpuSeconds=.01,wallSeconds=.1,peakRSS=10000000,output={'encoding':'base64','data':'b2sK'},cleanupComplete=True,filesystem=dict(live=12288,peak=12288,written=5,failure=None,openHandles=0),filesystemCleanup=dict(unmountExit=0,remainingMounts=[],serverExit=-15))
FIELDS=['accepted','childSucceeded','accountingAccepted','cleanupComplete','failures']
records=[]
fixture=ROOT/'test/toyvm-offline-receipt-validation-cli-oct29/input.json'


def one(name,result,accepted=False,*,raw=None,malformed=False,omit=None,limit_override=None):
    s.admit('fixture-'+name)
    fixture.write_text(json.dumps(result) if raw is None else raw)
    args=['/usr/bin/python3','-B',str(TARGET),'--result-json',str(fixture)]
    limits=dict(LIMITS,**(limit_override or {}))
    for k,v in limits.items():
        if k!=omit:args+=['--'+k.replace('_','-'),str(v)]
    code=2 if malformed or omit else (0 if accepted else 1)
    payload=s.run(args,cwd=ROOT,name=('mutant-' if TARGET!=CLI else 'cli-')+name,expect=code)
    assert len(payload)<=4096
    report=json.loads(payload)
    assert report['offlineValidationOnly'] is True and report['runtimeQualified'] is False
    assert 'offline validation only' in report['validationScope']
    assert report['accepted'] is accepted,(name,report)
    assert 'backendReceipt' not in report
    if not malformed and not omit:
        original=offline.read_result(fixture)
        expected=caller.evaluate(original,limits)
        assert {key:report[key] for key in FIELDS}=={key:expected[key] for key in FIELDS},name
    records.append(dict(name=name,expectedExit=code,accepted=accepted,decision=report,inputSHA256=hashlib.sha256(fixture.read_bytes()).hexdigest(),realPythonChild=True))

# First behavioral checkpoint: unchanged False unmount counterexample via actual argv.
r=copy.deepcopy(BASE);r['filesystemCleanup']['unmountExit']=False
one('unchanged-bool-unmount-counterexample',r)
one('legitimate-cleanup-control',BASE,True)
r=copy.deepcopy(BASE);r['filesystemCleanup'].update(unmountExit=None,serverExit=0)
one('legitimate-null-unmount-control',r,True)
for name,field,value in [
    ('bool-server','serverExit',False),('string-unmount','unmountExit','0'),
    ('float-unmount','unmountExit',0.0),('float-server','serverExit',0.0),
    ('null-server','serverExit',None),('mounts-object','remainingMounts',{}),
    ('mount-remains','remainingMounts',['/not-clean']),
    ('unmount-failure','unmountExit',1),('server-failure','serverExit',9)]:
    r=copy.deepcopy(BASE);r['filesystemCleanup'][field]=value;one(name,r)
for field in ['unmountExit','serverExit','remainingMounts']:
    r=copy.deepcopy(BASE);del r['filesystemCleanup'][field];one('missing-'+field,r)
for index,value in enumerate([False,None,[],{'cleanup':True}]):
    r=copy.deepcopy(BASE);r['filesystemCleanup']=value;one('cleanup-shape-'+str(index),r)
for index,value in enumerate([False,1,'true',None]):
    r=copy.deepcopy(BASE);r['cleanupComplete']=value;one('complete-shape-'+str(index),r)
r=copy.deepcopy(BASE);r['filesystem']['live']=False;one('bool-filesystem-live',r)
r=copy.deepcopy(BASE);r['exit']=False;one('bool-child-exit',r)
r=copy.deepcopy(BASE);r['output']['data']='eA=='*1400;one('output-over-limit',r,malformed=True)
# Valid base64 output over the explicit limit must be an evaluator rejection.
import base64
r=copy.deepcopy(BASE);r['output']['data']=base64.b64encode(b'x'*4097).decode();one('output-resource-rejection',r)
for index,raw in enumerate(['{','[]','null','true','1','"text"','{"x":1,"x":2}','{"x":NaN}']):
    one('malformed-json-'+str(index),None,raw=raw,malformed=True)
for index,value in enumerate([None,False,'ok',{'encoding':'text','data':'ok'},{'encoding':'base64','data':'!bad'},{'encoding':'base64','data':False}]):
    r=copy.deepcopy(BASE);r['output']=value;one('malformed-output-'+str(index),r,malformed=True)
for name in LIMITS:one('missing-limit-'+name,BASE,omit=name)
for name,value in [('cpu_limit','nan'),('wall_limit','inf'),('rss_limit',0),('file_limit',40000)]:
    one('invalid-limit-'+name,BASE,malformed=True,limit_override={name:value})
fixture.unlink()
s.write('cli-test-results',dict(PASS=True,count=len(records),sourceSHA256=hashlib.sha256(CLI.read_bytes()).hexdigest(),callerSHA256=offline.CALLER_SHA256,records=records,scope='offline validation only',runtimeQualified=False))
print(json.dumps(dict(PASS=True,count=len(records),realSubprocesses=len(records),runtimeQualified=False)))
