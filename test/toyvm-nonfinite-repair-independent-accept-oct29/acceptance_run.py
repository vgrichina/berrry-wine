"""Single-task acceptance/publication driver; run with python3 -B."""
import copy, json, os, pathlib, resource, sys
import acceptance_supervisor as s

CANDIDATE='ebc6b453612ccab0dc9492341b014585d036b0b7'
CLI=s.OWN/'test/toyvm-bounded24-caller-wiring-oct28/validate_receipt_offline.py'
CALLER=CLI.with_name('qualify_accounted.py')
BRANCH='task/'+s.NAME
LIMITS=dict(live_limit=32768,write_limit=65536,file_limit=16384,rss_limit=134217728,cpu_limit=1.25,wall_limit=2.5,output_limit=4096)

def prepare():
    if not (s.EV/'baseline.json').exists():s.baseline()
    assert s.sha(s.DISPATCH.read_bytes())=='a1adda547b6401fcf1d78455d9b9fa26e24b3ffce25b9671ee7a70f10d465afc'
    assert s.sha(s.ADMISSION.read_bytes())=='185ce18aa5371243e3bf24e90ad255440ebd63ad3a6e66a561f0800eee7a8b18'
    d=json.loads(s.DISPATCH.read_text()); assert d['candidate']==CANDIDATE
    for path,pin in d['sourcePins'].items():
        b=(s.OWN/path).read_bytes(); assert len(b)==pin['bytes'] and s.sha(b)==pin['sha256']
    # Negative controls are before any process creation.
    sentinel=s.OWN/'must-not-exist'
    argv=[sys.executable,'-B','-c','import pathlib;pathlib.Path('+repr(str(sentinel))+').write_text("BAD")']
    rejected=[]
    for label,cwd in [('omitted',None),('root',s.ROOT),('donor',pathlib.Path('/tmp/toyvm-offline-nonfinite-json-repair-oct29/repo')),('outside',pathlib.Path('/tmp'))]:
        try:
            if cwd is None:s.run(argv,label='invalid')
            else:s.run(argv,cwd=cwd,label='invalid')
        except (TypeError,ValueError):rejected.append(label)
        else:raise AssertionError(label)
    try:s.run(['git','status'],cwd=s.OWN,label='invalid',git=True)
    except ValueError:rejected.append('git-no-C')
    else:raise AssertionError('git-no-C')
    assert len(rejected)==5 and not sentinel.exists()
    rc,out,err=s.run([sys.executable,'-B','-c','import os,resource,json;print(json.dumps(dict(cwd=os.getcwd(),DATA=resource.getrlimit(resource.RLIMIT_DATA),CPU=resource.getrlimit(resource.RLIMIT_CPU),FSIZE=resource.getrlimit(resource.RLIMIT_FSIZE))))'],cwd=s.OWN,label='owned-positive-sentinel')
    assert rc==0 and json.loads(out)['cwd']==str(s.OWN) and not err
    s.save('controls.json',dict(rejected=rejected,sentinelAbsent=True,positive=json.loads(out),PASS=True))
    s.git(['init'],label='init-owned',init=True)
    s.git(['config','user.name','Wine Ops acceptance'],label='config-name',mutate=True)
    s.git(['config','user.email','wine-ops@localhost'],label='config-email',mutate=True)
    # No broad checkout: attach exact parent with an empty index, then read only
    # the pinned paths into the sparse index. Materialized source is unchanged.
    s.git(['config','core.sparseCheckout','true'],label='sparse-config',mutate=True)
    s.admit('sparse-pattern-write')
    (s.OWN/'.git/info/sparse-checkout').write_text(''.join('/'+p+'\n' for p in d['sourcePins']))
    s.git(['symbolic-ref','HEAD','refs/heads/'+BRANCH],label='task-head',mutate=True)
    s.git(['update-ref','refs/heads/'+BRANCH,CANDIDATE],label='task-parent',mutate=True)
    s.git(['read-tree','-m',CANDIDATE],label='sparse-index',mutate=True)
    pins={}
    for path,pin in d['sourcePins'].items():
        blob=s.git(['show',CANDIDATE+':'+path],label='pinned-blob')
        assert s.sha(blob)==pin['sha256'] and blob==(s.OWN/path).read_bytes(); pins[path]=pin
    repro=pathlib.Path(d['unchangedReproducer']).read_bytes()
    assert s.sha(repro)=='0a1537b8c35ac1379d7e4b028b47a1ba0656e692163ccf7b909d1ed08fffa11e'
    s.admit('retained-small-reproducer');(s.AREA/'unchanged-reproducer.json').write_bytes(repro)
    prior=pathlib.Path(d['canonicalPartialReceipt']); retained=json.loads(prior.read_bytes())
    focused=pathlib.Path(d['reused53Checks']); assert s.sha(focused.read_bytes())==retained['pins']['test/toyvm-offline-nonfinite-json-repair-oct29/evidence/focused-results.json']['sha256']
    checks=json.loads(focused.read_bytes()); assert checks['passed']==53
    old=s.ROOT/'scratch/usage-watch/toyvm-offline-command-independent-accept-oct29/retained-evidence/test/toyvm-offline-command-independent-accept-oct29/evidence/canonical-receipt.json'
    oldbytes=old.read_bytes(); assert s.sha(oldbytes)=='8ebbf951c324cea0eb89c8339a92dc79072470005f46b179c92e41ec7bb44a4a'
    s.save('source-and-reuse.json',dict(candidate=CANDIDATE,sourcePins=pins,dispatchSHA256=s.sha(s.DISPATCH.read_bytes()),partialReceipt=dict(path=str(prior),sha256=s.sha(prior.read_bytes())),prior53=dict(path=str(focused),sha256=s.sha(focused.read_bytes()),passed=53),prior72and52=dict(path=str(old),sha256=s.sha(oldbytes),reused=True),historicalIncident=retained['controlCompliance'],rootRefsInitial=json.loads((s.ROOT/'scratch/usage-watch'/s.NAME/'root-ref-digest.json').read_text())))

def accept():
    repro=(s.AREA/'unchanged-reproducer.json').read_bytes()
    base=json.loads(repro);base.pop('metadata')
    results=[]
    def one(name,raw,expected,*,limits=None,target=CLI,mutant=False):
        s.admit('fixture-'+name)
        fixture=s.FIX/'input.json';fixture.write_bytes(raw)
        argv=[sys.executable,'-B',str(target),'--result-json',str(fixture)]
        for k,v in dict(LIMITS,**(limits or {})).items():argv+=['--'+k.replace('_','-'),str(v)]
        code,out,err=s.run(argv,cwd=s.OWN,label=name)
        decision=json.loads(out)
        passed=code==expected and decision['accepted'] is (expected==0) and not err and len(out)<=4096 and decision['runtimeQualified'] is False and decision['offlineValidationOnly'] is True and 'backendReceipt' not in decision
        record=dict(name=name,expectedExit=expected,actualExit=code,PASS=passed,inputBytes=len(raw),inputSHA256=s.sha(raw),sourceSHA256=s.sha(target.read_bytes()),decision=decision,mutant=mutant)
        results.append(record);s.save('delta-results.json',dict(candidate=CANDIDATE,records=results))
        if not passed:
            s.save('FIRST-DEFECT.json',record)
            raise AssertionError(name)
        fixture.unlink()
    # First behavioral operation: exact repaired CLI and unchanged counterexample.
    one('unchanged-overflow-reproducer',repro,2)
    one('legitimate-control',json.dumps(base).encode(),0)
    boolean=copy.deepcopy(base);boolean['filesystemCleanup']['unmountExit']=False
    one('original-boolean-cleanup',json.dumps(boolean).encode(),1)
    data=json.dumps(base).encode()
    one('exact-input-size',data+b' '*(1048576-len(data)),0)
    one('over-input-size',data+b' '*(1048577-len(data)),2)
    for field in ('cpu_limit','wall_limit'):
        one('finite-limit-'+field,data,0,limits={field:'1e0'})
        one('nonfinite-limit-'+field,data,2,limits={field:'1e999'})
    # Independent lexical edges in ignored nested metadata: arrays and keys must
    # not hide numeric overflow, while quoted numeric syntax remains data.
    for name,token,code in [
        ('nested-uppercase-plus','{"level":[{"n":+TOKEN}]}'.replace('+TOKEN','1E+9999'),2),
        ('nested-negative-rounded-overflow','[{"n":-1.7976931348623159e308}]',2),
        ('nested-negative-zero-extreme-exponent','{"n":[-0e+9999,"1E+9999"]}',0),
        ('nested-finite-subnormal','[{"n":2.2250738585072014e-308,"tiny":4.9406564584124654e-324}]',0)]:
        raw=json.dumps(dict(base,metadata='TOKEN')).replace('"TOKEN"',token).encode();one(name,raw,code)
    s.admit('mutant-materialization');variant=s.FIX/'old-parser';variant.mkdir()
    source=CLI.read_bytes();mutated=source.replace(b', parse_float=finite_float',b'')
    assert mutated!=source and source.count(b', parse_float=finite_float')==1
    (variant/CLI.name).write_bytes(mutated);(variant/CALLER.name).write_bytes(CALLER.read_bytes())
    # Actual old-parser CLI must accept the unchanged overflow. The acceptance
    # oracle requires exit2; observing exit0 proves this mutant is killed.
    one('restored-old-parser',repro,0,target=variant/CLI.name,mutant=True)
    assert results[0]['actualExit']==2 and results[-1]['actualExit']==0
    s.save('mutation-verdict.json',dict(PASS=True,expectedAcceptanceExit=2,mutantExit=0,oracleRejectsMutant=True,sourceSHA256=s.sha(source),mutantSHA256=s.sha(mutated),reproducerSHA256=s.sha(repro),transformation='Remove exactly , parse_float=finite_float once',mutantResult=results[-1]))
    for p in variant.iterdir():p.unlink()
    variant.rmdir()
    for path,pin in json.loads(s.DISPATCH.read_text())['sourcePins'].items():assert s.sha((s.OWN/path).read_bytes())==pin['sha256']
    s.save('acceptance-checkpoint.json',dict(PASS=True,candidate=CANDIDATE,newRealCLIChecks=len(results),mutationKilled=True,unchanged53and72and52Reused=True,remainingChecks=[],runtimeQualified=False,liveCLIFUSEBrowserGap='OPEN',sourceUnchanged=True,fixturesClean=not list(s.FIX.iterdir()),admission=s.admit('acceptance-complete')))
    print(json.dumps(dict(PASS=True,newChecks=len(results),mutationKilled=True)))

if __name__=='__main__':
    # Keep the inherited DATA hard ceiling; the effective Python soft ceiling
    # is 128MiB. Only Git children receive the prescribed 256MiB DATA ceiling.
    resource.setrlimit(resource.RLIMIT_DATA,(128*1024**2,resource.getrlimit(resource.RLIMIT_DATA)[1]))
    for key,value in [(resource.RLIMIT_CPU,90),(resource.RLIMIT_FSIZE,12*1024**2),(resource.RLIMIT_CORE,0)]:resource.setrlimit(key,(value,value))
    if sys.argv[1]=='prepare':prepare();accept()
