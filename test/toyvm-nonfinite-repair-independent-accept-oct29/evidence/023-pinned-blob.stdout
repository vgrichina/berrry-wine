"""Focused real CLI subprocess tests; no backend or duplicate evaluate implementation."""
import copy, hashlib, json, pathlib, sys

OWN=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(OWN))
import supervisor as s

CLI=OWN/'test/toyvm-bounded24-caller-wiring-oct28/validate_receipt_offline.py'
CALLER=CLI.with_name('qualify_accounted.py')
REPRO=OWN/'test/toyvm-offline-command-independent-accept-oct29/evidence/unchanged-reproducer.json'
BASE=json.loads(REPRO.read_bytes());BASE.pop('metadata')
LIMITS=dict(live_limit=32768,write_limit=65536,file_limit=16384,rss_limit=134217728,cpu_limit=1.25,wall_limit=2.5,output_limit=4096)
FIX=s.EV/'input.json'
records=[]

def one(name,raw,expected,*,target=CLI,limits=None,mutation=False):
    s.admission('fixture-'+name)
    FIX.write_bytes(raw)
    argv=[sys.executable,'-B',str(target),'--result-json',str(FIX)]
    for key,value in dict(LIMITS,**(limits or {})).items():argv+=['--'+key.replace('_','-'),str(value)]
    rc,out,err=s.run(argv,cwd=OWN,label=name)
    report=json.loads(out)
    passes=rc==expected and report['accepted'] is (expected==0)
    assert report['offlineValidationOnly'] is True and report['runtimeQualified'] is False
    assert len(out)<=4096 and not err and 'backendReceipt' not in report
    records.append(dict(name=name,expectedExit=expected,actualExit=rc,PASS=passes,inputSHA256=hashlib.sha256(raw).hexdigest(),sourceSHA256=hashlib.sha256(target.read_bytes()).hexdigest(),decision=report,mutation=mutation))
    FIX.unlink()
    s.save('focused-results.json',dict(records=records,passed=sum(r['PASS'] for r in records),offlineValidationOnly=True,runtimeQualified=False,originalLiveCLIGap='OPEN'))
    if not mutation:assert passes,(name,rc,report)
    return passes

def payload(value):
    return json.dumps(dict(BASE,metadata='TOKEN')).replace('"TOKEN"',value).encode()

# CWD rejection must occur before creating this sentinel, including omitted cwd.
sentinel=OWN/'outside-cwd-sentinel'
argv=[sys.executable,'-c','import pathlib; pathlib.Path('+repr(str(sentinel))+').write_text("BAD")']
controls=[]
for name,cwd in [('omitted',None),('root',s.ROOT),('donor',pathlib.Path('/tmp/toyvm-offline-receipt-validation-cli-oct29/repo')),('outside',pathlib.Path('/tmp'))]:
    try:
        if cwd is None:s.run(argv,label='must-not-spawn')
        else:s.run(argv,cwd=cwd,label='must-not-spawn')
    except (TypeError,ValueError):controls.append(name)
    else:raise AssertionError('cwd guard did not reject '+name)
try:s.run(['git','status'],cwd=OWN,label='must-not-spawn-git',git=True)
except ValueError:controls.append('git-explicit-C')
else:raise AssertionError('git guard failed')
assert not sentinel.exists() and len(controls)==5
s.save('cwd-controls.json',dict(PASS=True,rejected=controls,sentinel=str(sentinel),sentinelAbsent=True,keywordOnlyCwdNoDefault=True))

# Exact retained failing fixture is first behavioral test on the repaired command.
one('repaired-unchanged-reproducer',REPRO.read_bytes(),2)
bad=copy.deepcopy(BASE);bad['filesystemCleanup']['unmountExit']=False
one('original-boolean-cleanup-rejection',json.dumps(bad).encode(),1)
one('legitimate-control',json.dumps(BASE).encode(),0)
for token in ['1e999','-1e999','1E309','-1E309','1.7976931348623159e308','-1.7976931348623159e308']:
    for depth,template in [('root','TOKEN'),('nested','{"null":[null,{"string":"1e999","data":[TOKEN]}]}')]:
        one('overflow-'+depth+'-'+str(len(records)),payload(template.replace('TOKEN',token)),2)
for token in ['NaN','Infinity','-Infinity']:
    one('nonfinite-literal-'+str(len(records)),payload('{"data":['+token+']}'),2)
for token in ['0','-0','1','-123','1.25','1e308','-1e308','1.7976931348623157e308','-1.7976931348623157e308','5e-324','-5e-324','1e-999','-1e-999','0e999','null','"1e999"','{"null":null,"1e999":"-1e999","data":[null,1e308,"Infinity"]}']:
    one('finite-and-data-'+str(len(records)),payload(token),0)
for field in ['cpuSeconds','wallSeconds','peakRSS']:
    for token in ['1e999','-1e999']:
        raw=json.dumps(BASE).encode()
        current=json.dumps(BASE[field]).encode()
        raw=raw.replace(('"'+field+'": ').encode()+current,('"'+field+'": '+token).encode())
        one('resource-overflow-'+field+'-'+str(len(records)),raw,2)
# Recheck affected JSON boundary groups; reuse unrelated pinned prior results.
for raw in [b'{',b'[]',b'null',b'true',b'1',b'"text"',b'{"x":1,"x":2}',b'{"x":NaN}',b'{"x":"\xff"}',b'['*1500+b'0'+b']'*1500]:
    one('malformed-boundary-'+str(len(records)),raw,2)
for template in ['"exit": 0, "exit": 0','"exit": 0, "ex\\u0069t": 0']:
    one('duplicate-boundary-'+str(len(records)),json.dumps(BASE).replace('"exit": 0',template).encode(),2)
data=json.dumps(BASE).encode()
one('exact-input-bound',data+b' '*(1048576-len(data)),0)
one('over-input-bound',data+b' '*(1048577-len(data)),2)
for name in ['cpu_limit','wall_limit']:
    one('explicit-finite-limit-'+name,json.dumps(BASE).encode(),0,limits={name:'1e0'})
    one('nonfinite-limit-'+name,json.dumps(BASE).encode(),2,limits={name:'1e999'})
# Restore exactly the old parsing expression. The original reproducer must kill it.
variant=OWN/'mutation-fixture';s.admission('mutation-fixture');variant.mkdir()
original=CLI.read_text();mutated=original.replace(', parse_float=finite_float','')
assert mutated!=original
(variant/CLI.name).write_text(mutated);(variant/CALLER.name).write_bytes(CALLER.read_bytes())
assert not one('restored-parser-mutation',REPRO.read_bytes(),2,target=variant/CLI.name,mutation=True)
assert records[-1]['actualExit']==0 and records[-1]['decision']['accepted'] is True
s.save('mutation-verdict.json',dict(PASS=True,originalReproducerRejectsRestoredParser=True,mutantSHA256=hashlib.sha256(mutated.encode()).hexdigest(),expectedExit=2,mutantExit=0))
for p in variant.iterdir():p.unlink()
variant.rmdir()
s.save('regression-summary.json',dict(PASS=True,checks=len(records),expectedPasses=len(records)-1,rejectingMutations=1,offlineValidationOnly=True,runtimeQualified=False,originalLiveCLIGap='OPEN'))
print(json.dumps(dict(PASS=True,checks=len(records),rejectingMutations=1)))
