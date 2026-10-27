import hashlib,json,pathlib,shutil,os
H=pathlib.Path(__file__).parent; R=H.parent/'repo'
D=pathlib.Path('/tmp/enigma-accepted-progressive-menu-main-integrate-oct27/repo')
pins={'tools/enigma-frozen-gameplay-controller.py':'2c8d064d21e3d4c86b099591f076115b622450eb76371844324ee8be645f6beb','tools/enigma-supervised-gameplay.py':'05326027c821b39960e3417c86786d06a8c824b7fcd731d7c3586b59a5ce40a4'}
for p,h in pins.items():assert hashlib.sha256((D/p).read_bytes()).hexdigest()==h,p
paths=list(pins)+['test/run.js']+[str(p.relative_to(D)) for p in (D/'test/fixtures/enigma-controller').glob('*') if p.is_file()]
for p in paths:
 q=R/p;q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(D/p,q)
pins={p:hashlib.sha256((R/p).read_bytes()).hexdigest() for p in paths}
(H/'input-pins.json').write_text(json.dumps(dict(donor=str(D),pins=pins,sourceRevision='0a61c1bc254e3e455607e01d2e29d7f97c2806ef',mount='N/A: no runtime/mount argv authorized',ssh=os.environ['GIT_SSH_COMMAND']),indent=2)+'\n')
print('PASS',len(pins),'exact input files; no runtime mount, checkout, object fetch or donor mutation')
