import sys,pathlib,hashlib,json,io,ast,difflib
sys.path.insert(0,'/home/user/wine-assembly-shadow-man-settings-observer-repair-runtime-oct23/scratch/runs/20261023-shadow-man-settings-observer-repair-runtime')
from transport import *
P=pathlib.Path('/home/user/wine-assembly-shadow-man-reviewed-helper-config-runtime-oct23/scratch/runs/20261023-shadow-man-reviewed-helper-config-runtime')
p=E/'settings-observer-fixture.cjs';s=p.read_text().replace('observer-repair-fixtures-v4','observer-repair-fixtures-final').replace("const bad=[","const bad=[bs+bs+'server'+bs+'share'+bs+'test.ini',");p.write_text(s)
# Pin a new session runner filename; only deadline reflects coordinator extension.
p=E/'session_runner.py';s=p.read_text().replace('2026,10,23,2,42,','2026,10,23,3,2,');(E/'session_runner-repaired.py').write_text(s)
p=E/'prepare_runtime.py';s=p.read_text().replace("F/'settings-capture-fixture.json'","F/'settings-capture-repaired-fixture-final.json'").replace("F/'settings-observer.cjs'","F/'settings-observer-repaired.cjs'").replace("F/'session_runner.py'","F/'session_runner-repaired.py'");(E/'prepare_session-repaired.py').write_text(s)
p=E/'operate.py';s=p.read_text().replace("ROOT+'/fixed/session_runner.py'","ROOT+'/fixed/session_runner-repaired.py'");p.write_text(s)
for n in ['settings-observer-repaired.cjs','settings-observer-fixture.cjs','session_runner-repaired.py','historical-executed-fixture.cjs']:
 p=E/n
 with p.open('rb') as f:save(n+'-upload.json',upload_stream(f,p.stat().st_size,ROOT+'/fixed/'+n))
code='''import pathlib,subprocess,json,os
R=pathlib.Path(ROOT_PATH);F=R/'fixed'
env=dict(PATH='/bin:/usr/bin',SHADOW_ROOT=str(R),NODE_PATH=str(R/'immutable/runtime/node_modules'))
oldout=R/'mutable/output/save-gameplay/historical-exact-fixture-replay';oldout.mkdir();env['SHADOW_SESSION_OUTPUT']=str(oldout)
p=subprocess.run(['node',str(F/'historical-executed-fixture.cjs')],env=env,capture_output=True,text=True,timeout=10)
r=dict(exit=p.returncode,stdout=p.stdout,stderr=p.stderr);(F/'historical-exact-fixture-replay.json').write_text(json.dumps(r));assert p.returncode==1 and 'unsafe diagnostic guest path' in p.stderr
p=subprocess.run(['node',str(F/'settings-observer-fixture.cjs')],env=env,capture_output=True,text=True,timeout=10)
r=dict(exit=p.returncode,stdout=p.stdout,stderr=p.stderr);(F/'settings-capture-repaired-fixture-final.json').write_text(json.dumps(r,indent=2));print(json.dumps(dict(repaired=r,historicalFailedGatePreserved=True)));assert p.returncode==0
'''
r=run('ROOT_PATH='+repr(ROOT)+'\n'+code,'settings-fixture-final-api.json',20);print(r['stdout'])
review=dict(scope='diagnostic-only: canonical single separators, containment, exact fixture construction; deadline extension only in runner',historicalSHA256=hashlib.sha256((P/'settings-observer.cjs').read_bytes()).hexdigest(),historicalCanonicalAccepted=True,historicalNestedFixtureCreatesTab=True,historicalGateRemainsFailed=True,productionChanges=False,pins={})
for n in ['settings-observer-repaired.cjs','settings-observer-fixture.cjs','session_runner-repaired.py','prepare_session-repaired.py','operate.py']:
 p=E/n;review['pins'][n]=dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
review['originalObserverBackslashRuns']=[len(x) for x in __import__('re').findall(r'\\+',(P/'settings-observer.cjs').read_text())]
save('explicit-helper-review.json',review)
# Full integrity gate on the existing originals/staged tree/clone, no preparation operations.
s=(P/'collect_handback.py').read_text();code=ast.literal_eval(next(n.value for n in ast.walk(ast.parse(s)) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='code' for t in n.targets)))
# Original handback invariant is valid before first guest; includes old failed fixture unchanged.
r=run('ROOT_PATH='+repr(ROOT)+'\n'+code,'fresh-integrity-before-guest-api.json',30);h=json.loads(r['stdout']);assert h['originalRows']==json.loads((E/'destination-original-hashes.json').read_text());h.pop('originalRows');save('fresh-integrity-before-guest.json',h);print('full originals/stage/clone integrity pass')
