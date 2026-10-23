import pathlib, subprocess, os, json, hashlib, re
E=pathlib.Path(__file__).resolve().parent;R=E.parents[2]
C='aac3cf5db81fc2946f9bfc2f09a11a9c7be021ec';B='6d145e98589caeab2d43c4bb54297d90c248b9de'
env={**os.environ,'GIT_NO_LAZY_FETCH':'1'}
def git(*a):return subprocess.check_output(['git','-C',str(R),*a],env=env)
paths=['test/run.js','tools/shadow-man-null-preload.cjs','tools/shadow-man-null-capture.cjs','tools/callback-ownership-census.json','tools/test-timeouts.json','test/test-shadow-man-null-capture.js','test/shadow-man-null-repair.cjs','test/shadow-man-null-actual-paths.cjs','src/13-exports.wat','src/09c3a-dialog-runtime.wat','src/09b-dispatch.wat']
pins={}
for p in paths:
 b=(R/p).read_bytes();expected=git('ls-tree',C,'--',p).decode().split()[2]
 oid=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest();assert oid==expected,p
 pins[p]={'blob':oid,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)}
for p in paths[-3:]:assert git('ls-tree',C,'--',p).split()[2]==git('ls-tree',B,'--',p).split()[2]
before=json.loads(git('show',B+':tools/callback-ownership-census.json'));after=json.loads((R/'tools/callback-ownership-census.json').read_text())
key=lambda x:x['file']+':'+x['name']
old={key(e):e for e in before['entries']};new={key(e):e for e in after['entries']}
changed=[k for k in new if new[k]!=old.get(k)];assert not set(old)-set(new)
assert set(changed)=={'src/13-exports.wat:export:null_diag_token','src/13-exports.wat:$run','src/09c3a-dialog-runtime.wat:$wnd_send_message_inner','src/09b-dispatch.wat:$win32_dispatch_inner'}
assert [key(e) for e in after['entries'][:-1]]==[key(e) for e in before['entries']]
for k in changed:
 assert new[k]['ownership']=='pending'
 if k in old:
  assert new[k]['reason'].startswith(old[k]['reason']+' ')
  assert {f for f in new[k] if new[k][f]!=old[k][f]}=={'sha256','reason'}
assert len(old)-3==404
review=pathlib.Path('/home/user/wine-assembly-shadow-man-null-hook-independent-review-oct23/docs/re-notes/shadow-man-null-hook-independent-review-20261023')
checker=review/'pinned-check-wat-fragments.js';recipe=review/'pinned-build.sh'
standing={}
for p in [checker,recipe]:
 source='tools/'+p.name.removeprefix('pinned-')
 expected=git('ls-tree',C,'--',source).decode().split()[2];b=p.read_bytes()
 assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==expected
 standing[str(p)]={'bytes':len(b),'blob':expected,'sha256':hashlib.sha256(b).hexdigest()}
argv=['node',str(checker),'--verbose',*paths[-3:]]
p=subprocess.run(argv,cwd=R,env=env,capture_output=True,text=True,timeout=10);assert p.returncode==0,p.stderr
s=(R/'src/13-exports.wat').read_text();names=re.findall(r'\(export "([^\"]+)"',s);assert len(names)==len(set(names))
# Standing compiler and scoped gate dependencies execute in place. Verify their
# recorded identities; they are not staging copies or canonical provenance.
admission=json.loads((R/'docs/re-notes/shadow-man-null-arming-identity-repair-20261023/admission.json').read_text())
for f in admission['standingCompiler']['files']+admission['additionalStandingReadOnlyTools']:
 pth=pathlib.Path(f['path']);assert pth.stat().st_size==f['bytes'];assert hashlib.sha256(pth.read_bytes()).hexdigest()==f['sha256'];standing[str(pth)]=f
result={'exit':0,'candidate':C,'sourcePins':pins,'WATUnchangedFrom':B,'exactLedgerChanges':changed,'unchangedLedgerEntries':404,'allChangedOwnership':'pending','fragmentGate':{'argv':argv,'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr},'exportsSourceDeclarationsOnly':len(names),'standingReadOnlyToolsAndRecipe':standing,'fullCensus':'PENDING transitive closure; scoped30 is not full PASS','pinnedBuild':'READ ONLY, NOT EXECUTED'}
(E/'source-checks.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'exit':0,'ledgerChanges':changed,'sourceDeclarationCount':len(names),'fragmentExit':p.returncode}))
