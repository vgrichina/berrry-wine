import pathlib,sys,runpy,json,hashlib
O=pathlib.Path(__file__).resolve().parent
sys.argv=[str(O/'accept.py'),'process']
runpy.run_path(sys.argv[0],run_name='__main__')
j=json.loads((O/'checkpoint.json').read_text())
cases=[x for x in j['completed'] if x['mode'] in ('held-pipe','detached-child')]
assert len(cases)==2
assert all(x['rejectedCandidate'] is False for x in cases), cases
assert all(not pathlib.Path('/proc',str(x['childPID'])).exists() for x in cases),cases
result=dict(candidate='4ffa995ba8a8bda59399960182ace17e8c4e3c01',
            helperSHA256=hashlib.sha256((O.parent/'repo/tools/boat-capture-readback.py').read_bytes()).hexdigest(),
            completed=['production default executor unchanged rejection reproducer'],
            observations=cases,reused=['original byte-integrity/envelope groups'],
            remaining=['independent ownership and omission challenges','standalone four requests','branch publication'])
t=O/'acceptance-checkpoint.new';t.write_text(json.dumps(result,indent=2));t.replace(O/'acceptance-checkpoint.json')
print('PASS both rejectedCandidate fields false; both child identities absent, including zombies')
