import os,pathlib,subprocess,json,hashlib,shutil,time
R=pathlib.Path(__file__).resolve().parents[3];O=pathlib.Path(__file__).resolve().parent
E={**os.environ,'GIT_NO_LAZY_FETCH':'1','SHADOW_NULL_TEST_COMPILER':'/home/user/wine-assembly-shadow-man-null-hook-independent-review-oct23/tools/watx.js','SHADOW_NULL_TEST_OUTPUT':str(O)}
commands=[['node','--check','test/run.js'],['node','--check','tools/shadow-man-null-capture.cjs'],['node','--check','tools/shadow-man-null-preload.cjs'],['node','test/test-shadow-man-null-capture.js'],['node',str(O/'old-controls.cjs')],['node',str(O/'check-scoped.cjs')]]
results=[]
for i,argv in enumerate(commands):
 r=subprocess.run(argv,cwd=R,env=E,capture_output=True,text=True,timeout=75);(O/f'check-{i}.stdout').write_text(r.stdout);(O/f'check-{i}.stderr').write_text(r.stderr);results.append({'argv':argv,'cwd':str(R),'exit':r.returncode,'stdout':f'check-{i}.stdout','stderr':f'check-{i}.stderr','externalTimeoutSeconds':75});assert r.returncode==0,(argv,r.stderr)
argv=['node','test/shadow-man-null-repair.cjs'];r=subprocess.run(argv,cwd=R,env={**E,'SHADOW_NULL_TEST_LATE_ARM':'1'},capture_output=True,text=True,timeout=20);assert r.returncode==1;assert 'AssertionError' in r.stderr;(O/'late-arm.stderr').write_text(r.stderr);results.append({'argv':argv,'envExtra':{'SHADOW_NULL_TEST_LATE_ARM':'1'},'exit':r.returncode,'expected':1,'reason':'deliberate late adapter arms after actual selected send; ordering oracle rejects','stderr':'late-arm.stderr','externalTimeoutSeconds':20})
(O/'checks.json').write_text(json.dumps({'exit':0,'env':{k:E[k] for k in ['GIT_NO_LAZY_FETCH','SHADOW_NULL_TEST_COMPILER','SHADOW_NULL_TEST_OUTPUT']},'commands':results},indent=2)+'\n')
print(json.dumps({'exit':0,'checks':len(results),'moduleHashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [O/'fixture.wasm',O/'actual-paths.wasm']}}))
