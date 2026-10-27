import hashlib, importlib.util, json
from pathlib import Path
root=Path('/tmp/penguin-explicit-capture-budget-repair-oct27')
repo=root/'repo'
pins={'tools/penguin_capture_contract.py':'9ec154496d10053252701d786f26e821fc226db3bdcb0e948f45e68ab0045cb0','test/test_penguin_capture_contract.py':'ae9827feb0a5da2a8657b14fa0d2b1c9300aebf6340f504f5c9e23b692b032f5'}
for p,h in pins.items():assert hashlib.sha256((repo/p).read_bytes()).hexdigest()==h
spec=importlib.util.spec_from_file_location('c',repo/'tools/penguin_capture_contract.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
admission=json.loads(Path('/home/user/wine-assembly/scratch/usage-watch/penguin-explicit-capture-budget-repair-oct27-admission.json').read_text())
images=[Path(p) for p in admission['pins']]
for p in images:assert c.sha(p.read_bytes())==admission['pins'][str(p)]['sha256']
results=[]
for planner in (c.plan_images,c.plan_provider_images):
    try:planner(images,used=0,tail_reserve=1<<20)
    except c.ContractError as e:
        assert 'UNSUPPORTED_PLAN' in str(e)
        results.append({'planner':planner.__name__,'error':str(e)})
    else:raise AssertionError('historical blocker disappeared')
(root/'ops/baseline-pins.json').write_text(json.dumps(dict(pins=pins,images=admission['pins'],results=results),indent=2))
print(json.dumps(results))
