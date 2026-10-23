import pathlib,subprocess,os,json,hashlib,shutil
E=pathlib.Path(__file__).resolve().parent;R=E.parents[2];D=pathlib.Path('/home/user/wine-assembly-shadow-man-fresh-selection-repair-oct23');C='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a';OLD='aac3cf5db81fc2946f9bfc2f09a11a9c7be021ec'
env={**os.environ,'GIT_NO_LAZY_FETCH':'1','SHADOW_NULL_TEST_OUTPUT':str(E),'SHADOW_NULL_TEST_COMPILER':'/home/user/wine-assembly-shadow-man-null-hook-independent-review-oct23/tools/watx.js'}
commands=[]
def run(argv,expected=0):
 p=subprocess.run(argv,cwd=R,env=env,capture_output=True,text=True,timeout=60);n=len(commands)
 (E/f'check-{n}.stdout').write_text(p.stdout);(E/f'check-{n}.stderr').write_text(p.stderr)
 commands.append({'argv':argv,'cwd':str(R),'exit':p.returncode,'expected':expected,'timeoutSeconds':60,'stdout':f'check-{n}.stdout','stderr':f'check-{n}.stderr'})
 (E/'checks.json').write_text(json.dumps({'env':{k:env[k] for k in ['GIT_NO_LAZY_FETCH','SHADOW_NULL_TEST_OUTPUT','SHADOW_NULL_TEST_COMPILER']},'commands':commands},indent=2)+'\n');assert p.returncode==expected,(argv,p.stderr)
def git(*a):return subprocess.check_output(['git','-C',str(D),*a],env=env)
pins={};unchanged=['test/run.js','tools/shadow-man-null-preload.cjs','src/09c3a-dialog-runtime.wat','src/09b-dispatch.wat','src/13-exports.wat','tools/callback-ownership-census.json','tools/callback-ownership-census.js','tools/test-tiers.js','tools/test-timeouts.json']
for f in unchanged:
 a=git('rev-parse',C+':'+f).decode().strip();b=git('rev-parse',OLD+':'+f).decode().strip();assert a==b
 data=(R/f).read_bytes();assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==a;pins[f]={'gitBlob':a,'sha256':hashlib.sha256(data).hexdigest(),'unchanged':True}
changed=git('diff','--name-only',OLD,C,'--','test','tools').decode().splitlines();assert set(changed)=={'tools/shadow-man-null-capture.cjs','test/test-shadow-man-null-capture.js','test/shadow-man-null-fresh-selection.cjs'}
assert git('show',OLD+':tools/shadow-man-null-capture.cjs').split(b'const SEND_HOOK=')[0]==(R/'tools/shadow-man-null-capture.cjs').read_bytes().split(b'const SEND_HOOK=')[0]
for f in changed:
 data=(R/f).read_bytes();assert data==git('show',C+':'+f);pins[f]={'gitBlob':git('rev-parse',C+':'+f).decode().strip(),'sha256':hashlib.sha256(data).hexdigest()}
fixture=D/'docs/re-notes/shadow-man-fresh-selection-repair-20261023/actual-paths.wat';data=fixture.read_bytes();assert hashlib.sha256(data).hexdigest()=='d93b3b7834d270f25b7e68f0e4115f3cdb53d486131d29e873382ba30f3001b4'
# Verify retained native sender as an exact full form inside the existing fixture.
def form(s,start):
 depth=0;comment=False
 for i in range(start,len(s)):
  if s[i]=='\n':comment=False
  if s[i:i+2]==';;':comment=True
  if comment:continue
  if s[i]=='(':depth+=1
  if s[i]==')':
   depth-=1
   if depth==0:return s[start:i+1]
 raise AssertionError('unbalanced')
sender=(R/'src/09c3a-dialog-runtime.wat').read_text();sender=form(sender,sender.index('(func $wnd_send_message_inner'));assert sender in data.decode()
(E/'actual-paths.wat').write_bytes(data)
(E/'source-checks.json').write_text(json.dumps({'candidate':C,'old':OLD,'rejectingReview':'ff5156adfe3b8708bf15f5689cd02ce928a5fc62','pins':pins,'changedCodePaths':changed,'standingFixture':{'path':str(fixture),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'exactFullSender':True},'priorSeals':'104 candidate publication seals coordinator-verified, reused unchanged; not rerun','census':'all408 entries byte-identical, prior4/404 preserved, cjs outside current scanner; all pending, no full transitive coverage claim','reused':'unchanged Module-binding/OFF/sourcequota/terminal/WAT/census/discovery controls'},indent=2)+'\n')
for f in ['tools/shadow-man-null-capture.cjs','test/test-shadow-man-null-capture.js','test/shadow-man-null-fresh-selection.cjs',str(E/'accept.cjs'),str(E/'unit.cjs')]:run(['node','--check',f])
run(['node','test/shadow-man-null-fresh-selection.cjs'])
run(['node',str(E/'unit.cjs')])
run(['node',str(E/'accept.cjs')])
oracle="const a=require(process.argv[1]).results.find(x=>x.id===process.argv[2]);require('node:assert/strict').equal(a.exit,86,'desired fresh selected-send acceptance: '+a.id)"
run(['node','-e',oracle,str(E/'independent-results.json'),'modal'])
run(['node','-e',oracle,str(E/'independent-results.json'),'old-desired-fresh'],1)
print(json.dumps({'exit':0,'checks':len(commands)}))
