import pathlib,os,subprocess,json,hashlib,shutil
E=pathlib.Path(__file__).resolve().parent;R=E.parents[2]
env={**os.environ,'GIT_NO_LAZY_FETCH':'1','SHADOW_NULL_TEST_OUTPUT':str(E),'SHADOW_NULL_TEST_COMPILER':'/home/user/wine-assembly-shadow-man-null-hook-independent-review-oct23/tools/watx.js'}
checks=[]
def run(argv,expected=0,extra=None):
 p=subprocess.run(argv,cwd=R,env={**env,**(extra or {})},capture_output=True,text=True,timeout=75);n=len(checks)
 (E/f'check-{n}.stdout').write_text(p.stdout);(E/f'check-{n}.stderr').write_text(p.stderr)
 checks.append({'argv':argv,'cwd':str(R),'extraEnv':extra,'exit':p.returncode,'expected':expected,'externalTimeoutSeconds':75,'stdout':f'check-{n}.stdout','stderr':f'check-{n}.stderr'})
 (E/'checks.json').write_text(json.dumps({'env':{k:env[k] for k in ['GIT_NO_LAZY_FETCH','SHADOW_NULL_TEST_OUTPUT','SHADOW_NULL_TEST_COMPILER']},'commands':checks},indent=2)+'\n');assert p.returncode==expected,(argv,p.stderr)
for p in ['tools/shadow-man-null-capture.cjs','tools/shadow-man-null-preload.cjs','test/shadow-man-null-fresh-selection.cjs','test/test-shadow-man-null-capture.js']:
 run(['node','--check',p])
run(['node','test/test-shadow-man-null-capture.js'])
# Same desired fresh acceptance assertion against exact previous producer, runner
# and preload. Isolated output preserves the accepted candidate's positive run.
old=E/'old-intent-oracle';old.mkdir(exist_ok=True);shutil.copyfile(E/'actual-paths.wat',old/'actual-paths.wat')
run(['node','test/shadow-man-null-fresh-selection.cjs'],1,{'SHADOW_NULL_TEST_SOURCE_ROOT':'/home/user/wine-assembly-shadow-man-null-arming-identity-repair-oct23','SHADOW_NULL_TEST_OUTPUT':str(old)})
assert 'invalid final Beenden selector' in (E/'check-5.stderr').read_text()
old_original=E/'old-candidate';shutil.copyfile(E/'actual-paths.wat',old_original/'actual-paths.wat')
run(['node',str(E/'reproduce-old.cjs')],0,{'SHADOW_NULL_TEST_SOURCE_ROOT':'/home/user/wine-assembly-shadow-man-null-arming-identity-repair-oct23','SHADOW_NULL_TEST_OUTPUT':str(old_original)})
old_results=E/'old-candidate/fresh-selection-results.json'
oracle="const r=require(process.argv[1]);for(const c of r.results)require('node:assert/strict').equal(c.exit,86,'fresh current HWND/batch acceptance: '+c.mode);"
run(['node','-e',oracle,str(old_results)],1)
run(['node',str(R/'docs/re-notes/shadow-man-null-arming-identity-repair-20261023/check-scoped.cjs')])
run(['python3',str(E/'check-source.py')])
print(json.dumps({'exit':0,'checks':len(checks)}))
