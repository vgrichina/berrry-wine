import pathlib, os, subprocess, json, shutil, hashlib
E=pathlib.Path(__file__).resolve().parent
R=E.parents[2]
D=R/'docs/re-notes/shadow-man-null-arming-identity-repair-20261023'
env={**os.environ,'GIT_NO_LAZY_FETCH':'1','SHADOW_NULL_TEST_OUTPUT':str(E),'SHADOW_NULL_TEST_COMPILER':'/home/user/wine-assembly-shadow-man-null-hook-independent-review-oct23/tools/watx.js'}
results=[]
def run(argv,expected=0,extra=None):
 e={**env,**(extra or {})}; p=subprocess.run(argv,cwd=R,env=e,capture_output=True,text=True,timeout=75)
 n=len(results);(E/f'check-{n}.stdout').write_text(p.stdout);(E/f'check-{n}.stderr').write_text(p.stderr)
 results.append({'argv':argv,'cwd':str(R),'extraEnv':extra,'exit':p.returncode,'expected':expected,'timeoutSeconds':75,'stdout':f'check-{n}.stdout','stderr':f'check-{n}.stderr'})
 (E/'checks.json').write_text(json.dumps({'env':{k:env[k] for k in ['GIT_NO_LAZY_FETCH','SHADOW_NULL_TEST_COMPILER','SHADOW_NULL_TEST_OUTPUT']},'commands':results},indent=2)+'\n')
 assert p.returncode==expected,(argv,p.stderr)
for f in ['test/run.js','tools/shadow-man-null-capture.cjs','tools/shadow-man-null-preload.cjs']:
 run(['node','--check',f])
run(['node','test/test-shadow-man-null-capture.js'])
for f in ['old-controls.cjs','check-scoped.cjs','census-reconciliation.json']:
 shutil.copyfile(D/f,E/f)
run(['node',str(E/'old-controls.cjs')])
run(['node',str(E/'check-scoped.cjs')])
run(['node','test/shadow-man-null-repair.cjs'],1,{'SHADOW_NULL_TEST_LATE_ARM':'1'})
run(['node',str(E/'fresh-selection.cjs')])
run(['python3',str(E/'check-source.py')])
oracle="const r=require(process.argv[1]);for(const c of r.results)require('node:assert/strict').equal(c.exit,86,'fresh selected send must acquire and accept current HWND/batch via actual runner interface: '+c.mode);"
run(['node','-e',oracle,str(E/'fresh-selection-results.json')],1)
print(json.dumps({'exit':0,'checks':len(results),'modules':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in E.glob('*.wasm')}}))
