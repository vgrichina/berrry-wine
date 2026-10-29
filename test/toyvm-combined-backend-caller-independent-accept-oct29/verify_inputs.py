"""Identity-only preflight; executes no prior oracle or production entry point."""
import ast, hashlib, json, sys
from pathlib import Path
TASK='toyvm-combined-backend-caller-independent-accept-oct29'
OWN=Path('/tmp')/TASK
REPO=OWN/'repo'
OUT=REPO/'test'/TASK
DISPATCH=Path('/home/user/wine-assembly/scratch/usage-watch')/(TASK+'-dispatch.json')
def pin(data): return dict(bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
def verify():
    assert Path.cwd().resolve()==REPO and sys.executable=='/usr/bin/python3'
    d=json.loads(DISPATCH.read_text()); pins=d['sourcePins']
    raw={p:(REPO/p).read_bytes() for p in pins}
    assert {p:pin(v) for p,v in raw.items()}==pins
    for path,key in [(OWN/'ops.py','taskSupervisorPin'),(OWN/'limit_contract.py','limitModulePin'),(Path('/usr/bin/python3'),'pythonExecutablePin')]:
        assert pin(path.read_bytes())==d[key],key
    receipt=Path(d['canonicalReceipt']); assert pin(receipt.read_bytes())==d['canonicalReceiptPin']
    r=json.loads(receipt.read_text()); assert r['commit']==d['candidate']
    assert r['afterSourcePins']==pins
    verified={str(receipt):pin(receipt.read_bytes())}
    for name,expected in r['artifacts'].items():
        p=OWN/'inputs/migration-tests'/Path(name).name
        assert pin(p.read_bytes())==expected,str(p)
        verified[str(p.relative_to(OWN))]=expected
    prov=json.loads((OWN/'inputs/migration-tests/provenance.json').read_text())
    delta=prov['soleDonorChange']; caller=next(p for p in pins if p.endswith('qualify_accounted.py'))
    text=raw[caller].decode(); assert text.count(delta['new'])==1 and delta['old'] not in text
    donor=text.replace(delta['new'],delta['old']).encode()
    assert pin(donor)==prov['donor'] and prov['afterCaller']==pins[caller]
    assert prov['loaderASTIdentical'] and prov['otherFourUnchanged']
    loader=lambda t:ast.dump(next(n for n in ast.parse(t).body if isinstance(n,ast.FunctionDef) and n.name=='load_backend'))
    assert loader(text)==loader(donor.decode())
    for p in pins:
        if p!=caller: assert pins[p]==prov['beforeSourcePins'][p]
    retained=prov['retainedCoverage']; assert retained['callerChecks']==41 and retained['backendOperations']==52 and not retained['replayed']
    for name,key in [('retained-caller-acceptance.json','callerReceipt'),('retained-backend-acceptance.json','backendReceipt')]:
        assert pin((OWN/'inputs/migration-tests'/name).read_bytes())==retained[key]
    caller_receipt=json.loads((OWN/'inputs/migration-tests/retained-caller-acceptance.json').read_text())
    backend_receipt=json.loads((OWN/'inputs/migration-tests/retained-backend-acceptance.json').read_text())
    assert caller_receipt['afterSourcePins'][caller]==pin(donor)
    assert caller_receipt['behavior']['passed']==41
    for p in pins:
        if p!=caller:
            assert backend_receipt['afterSourcePins'][p]==pins[p]
            if not p.endswith('/fuse_backend.py'): assert caller_receipt['afterSourcePins'][p]==pins[p]
    assert backend_receipt['behavior']['operations']==52
    cp=OWN/'inputs/genuine-control-recipe'
    for name,expected in json.loads((cp/'provenance.json').read_text()).items():
        assert pin((cp/name).read_bytes())=={k:expected[k] for k in ['bytes','sha256']},name
        verified[str((cp/name).relative_to(OWN))]=pin((cp/name).read_bytes())
    # All supplied copies inventoried; only the hash-verified records above are acceptance evidence.
    inventory={str(p.relative_to(OWN)):pin(p.read_bytes()) for p in (OWN/'inputs').rglob('*') if p.is_file()}
    result=dict(candidate=d['candidate'],sourcePins=pins,canonicalReceipt=d['canonicalReceiptPin'],verifiedArtifacts=verified,suppliedInventory=inventory,donor=pin(donor),soleDonorSubstitution=delta,loaderASTIdentical=True,otherFourUnchanged=True,retainedCoverage=retained,priorOraclesExecuted=False)
    OUT.joinpath('input-verification.json').write_text(json.dumps(result,indent=2)+'\n')
    return d,raw
if __name__=='__main__':
    d,raw=verify(); print(json.dumps(dict(status='PASS',candidate=d['candidate'],sourceFiles=len(raw),callerChecksReused=41,backendChecksReused=52,donorOnlySubstitution=True)))
