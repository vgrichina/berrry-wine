"""Independent real offline CLI acceptance. Never execute a backend or donor wrapper."""
from supervisor import *
import copy, importlib.util, base64
CLI=OWN/'test/toyvm-bounded24-caller-wiring-oct28/validate_receipt_offline.py'
CALLER=CLI.with_name('qualify_accounted.py')
spec=importlib.util.spec_from_file_location('pinned_production_evaluate',CALLER)
caller=importlib.util.module_from_spec(spec); spec.loader.exec_module(caller)
LIMITS=dict(live_limit=32768,write_limit=65536,file_limit=16384,rss_limit=128*1024**2,cpu_limit=1.25,wall_limit=2.5,output_limit=4096)
BASE=dict(exit=0,stopReason=None,cpuSeconds=.01,wallSeconds=.1,peakRSS=10000000,output={'encoding':'base64','data':'b2sK'},cleanupComplete=True,filesystem=dict(live=12288,peak=12288,written=5,failure=None,openHandles=0),filesystemCleanup=dict(unmountExit=0,remainingMounts=[],serverExit=-15))
FIELDS=['accepted','childSucceeded','accountingAccepted','cleanupComplete','failures']
records=[]
FIX=OWN/'fixture.json'
def checkpoint(): save('acceptance-checkpoint.json',dict(base='354c5651f6f11bbd430424c3163d7e87e125fc9a',records=records,offlineValidationOnly=True,runtimeQualified=False,originalLiveCLIGap='OPEN'))
def one(name, value=None, *, raw=None, expected=2, options=None, target=CLI, compare=False, extra=None):
    admission('fixture-'+name)
    payload=(json.dumps(BASE if value is None else value,allow_nan=False).encode() if raw is None else raw)
    FIX.write_bytes(payload)
    limits=dict(LIMITS,**(options or {})); args=[sys.executable,'-B',str(target),'--result-json',str(FIX)]
    for key,val in limits.items():
        if val is not None: args += ['--'+key.replace('_','-'),str(val)]
    args+=extra or []
    rc,out,err=run(args,cwd=OWN,label=name)
    report=json.loads(out)
    ok=rc==expected and report.get('accepted') is (expected==0) and report.get('offlineValidationOnly') is True and report.get('runtimeQualified') is False and len(out)<=4096 and 'backendReceipt' not in report
    if compare:
        result=copy.deepcopy(BASE if value is None else value); result['output']=base64.b64decode(result['output']['data'])
        decision=caller.evaluate(result,limits)
        ok=ok and all(report.get(k)==decision[k] for k in FIELDS)
    records.append(dict(name=name,expectedExit=expected,actualExit=rc,PASS=ok,decision=report,inputBytes=len(payload),inputSHA256=hashlib.sha256(payload).hexdigest(),productionEvaluateCompared=compare,offlineValidationOnly=True,runtimeQualified=False))
    checkpoint()
    if not ok:
        (EV/'unchanged-reproducer.json').write_bytes(payload)
        save('first-defect.json',dict(case=name,expectedExit=expected,actualExit=rc,report=report,argv=args,source=hashlib.sha256(CLI.read_bytes()).hexdigest(),inputSHA256=hashlib.sha256(payload).hexdigest(),offlineValidationOnly=True,runtimeQualified=False,originalLiveCLIGap='OPEN'))
        FIX.unlink(); raise SystemExit(1)
    FIX.unlink()

# Production boundary first, exact unchanged fixture from the pinned 52-case recipe.
r=copy.deepcopy(BASE); r['filesystemCleanup']['unmountExit']=False
one('first-unchanged-unmount-False',r,expected=1,compare=True)
one('legitimate-cleanup',BASE,expected=0,compare=True)

# Reuse the existing 52 results by immutable source and retained evidence hashes.
prior=ROOT/'scratch/usage-watch/toyvm-offline-receipt-validation-cli-oct29/retained-evidence'
resultpath=prior/'test/toyvm-offline-receipt-validation-cli-oct29/evidence/cli-test-results.json'
priorResults=json.loads(resultpath.read_text()); assert priorResults['PASS'] is True and priorResults['count']==52
save('prior52-reuse.json',dict(candidate='354c5651f6f11bbd430424c3163d7e87e125fc9a',pins={str(p):dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in [prior/'canonical-receipt.json',resultpath,OWN/'test/toyvm-offline-receipt-validation-cli-oct29/test_offline_cli.py',OWN/'test/toyvm-offline-receipt-validation-cli-oct29/REPORT.md']},count=52,rerun=False,offlineValidationOnly=True,runtimeQualified=False))

for name,raw in [
 ('duplicate-valid-key',json.dumps(BASE).replace('"exit": 0','"exit": 0, "exit": 0').encode()),
 ('escaped-duplicate-key',json.dumps(BASE).replace('"exit": 0','"exit": 0, "ex\\u0069t": 0').encode()),
 ('nested-duplicate',json.dumps(BASE).replace('"live": 12288','"live": 12288, "live": 12288').encode()),
 ('trailing-object',json.dumps(BASE).encode()+b'{}'),
 ('invalid-utf8',b'{"x":"\xff"}'),
 ('deep-json',b'['*1500+b'0'+b']'*1500)]: one(name,raw=raw)
data=json.dumps(BASE).encode()
one('exact-input-bound',raw=data+b' '*(1048576-len(data)),expected=0,compare=True)
one('one-over-input-bound',raw=data+b' '*(1048577-len(data)))
one('bounded-argument-decision',extra=['--unrecognized-'+('x'*10000)])

variant=OWN/'identity-fixture'; variant.mkdir(exist_ok=True)
(variant/CLI.name).write_bytes(CLI.read_bytes())
(variant/CALLER.name).write_bytes(CALLER.read_bytes()+b'\n# identity mismatch\n')
one('changed-caller-identity',target=variant/CLI.name)
for p in variant.iterdir():p.unlink()
variant.rmdir()

for key in LIMITS:
    for label,val in [('missing',None),('zero',0),('negative',-1),('above-maximum',caller.MAX_LIMITS[key]+1),('nonnumeric','false')]:
        one('limit-'+key+'-'+label,options={key:val})
for key in ['cpu_limit','wall_limit']:
    for v in ['nan','inf','-inf','1e999']:
        one('limit-'+key+'-'+v,options={key:v})
for key,value in [('filesystem',[]),('filesystemCleanup',[]),('cleanupComplete',{}),('exit','0'),('stopReason',False),('cpuSeconds',True),('peakRSS',-1)]:
    r=copy.deepcopy(BASE);r[key]=value;one('schema-'+key,r,expected=1,compare=True)
for output in [{'encoding':'base64','data':'','extra':0},{'encoding':'base64','data':['b2sK']},{'encoding':'base64','data':'b2sK\n'}]:
    r=copy.deepcopy(BASE);r['output']=output;one('output-schema-'+str(len(records)),r)

# A changed offline command must be rejected by the same unchanged first oracle.
variant=OWN/'mutation-fixture';variant.mkdir(exist_ok=True)
mutant=CLI.read_text().replace("decision = caller.evaluate(result, options)","decision = caller.evaluate(result, options)\n        decision['accepted'] = True")
(variant/CLI.name).write_text(mutant);(variant/CALLER.name).write_bytes(CALLER.read_bytes())
(EV/'rejecting-mutant.txt').write_text(mutant)
r=copy.deepcopy(BASE);r['filesystemCleanup']['unmountExit']=False
FIX.write_text(json.dumps(r));argv=[sys.executable,'-B',str(variant/CLI.name),'--result-json',str(FIX)]
for key,val in LIMITS.items():argv+=['--'+key.replace('_','-'),str(val)]
rc,out,_=run(argv,cwd=OWN,label='rejecting-mutation'); report=json.loads(out)
assert rc==0 and report['accepted'] is True
save('mutation-verdict.json',dict(PASS=True,unchangedOracleRejected=True,expectedExit=1,mutantExit=rc,decision=report,offlineValidationOnly=True,runtimeQualified=False))
FIX.unlink()
for p in variant.iterdir():p.unlink()
variant.rmdir()

# Nonfinite literals and floating-point overflow must fail at the JSON boundary.
for value in ['NaN','Infinity','-Infinity','1e999','-1e999']:
    one('nonfinite-resource-'+value,raw=json.dumps(BASE).replace('"cpuSeconds": 0.01','"cpuSeconds": '+value).encode(),expected=2 if value in ['NaN','Infinity','-Infinity'] else 1,compare=False)
for value in ['NaN','Infinity','1e999']:
    raw=json.dumps(dict(BASE,metadata='REPLACE')).replace('"REPLACE"',value).encode()
    one('nonfinite-metadata-'+value,raw=raw)
print(json.dumps(dict(PASS=True,count=len(records),offlineValidationOnly=True,runtimeQualified=False)))
