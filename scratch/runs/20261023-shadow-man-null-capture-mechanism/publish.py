import pathlib,os,subprocess,json,hashlib,shutil
r=pathlib.Path('/home/user/wine-assembly-shadow-man-null-capture-mechanism-oct23'); d=pathlib.Path('/home/user/wine-assembly-shadow-man-null-exit-diagnosis-oct23');base='bb9c496ed13095cc832fdf607f0937fb9c14b7de'; runtime='58e90870a40a541a4083cae5e987ca8de31889e6';branch='task/shadow-man-null-capture-mechanism-oct23'
env={**os.environ,'GIT_NO_LAZY_FETCH':'1','GIT_SSH_COMMAND':'ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -i /home/user/.ssh/wine_github_ed25519'}
def git(*args,data=None):return subprocess.check_output(['git','-C',str(r),*args],input=data,env=env)
out=r/'docs/re-notes/shadow-man-null-capture-mechanism-20261023'
checks={'syntaxExit':0,'nativeTestsExit':0,'fullModule':'NOT BUILT / NOT RUN','sourcePins':{},'sourceHookSites':'NOT EXECUTED in full handlers'}
a=json.loads((out/'admission.json').read_text())
for p,pin in a['sourcePins'].items():
 assert git('rev-parse',runtime+':'+p).decode().strip()==pin
 b=(d/p).read_bytes();assert git('hash-object','--stdin',data=b).decode().strip()==pin
 checks['sourcePins'][p]=pin
for p in ['src/13-exports.wat','src/09c3a-dialog-runtime.wat','src/09b-dispatch.wat']:
 assert git('rev-parse',base+':'+p)==git('rev-parse',runtime+':'+p)
 # Balanced source forms, ignoring line comments/strings (no parens in string literals in these fragments).
 text=(r/p).read_text();depth=0
 import re
 text=re.sub(r'"(?:[^"\\]|\\.)*"','""', '\n'.join(line.split(';;')[0] for line in text.splitlines()))
 for c in text:
  if c=='(':depth+=1
  elif c==')':depth-=1
  assert depth>=0,p
 assert depth==0,p
checks['balancedEditedFragments']=3
checks['moduleHistorical']={'sha256':'ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553','bytes':1879387,'executed':False}
(out/'checks.json').write_text(json.dumps(checks,indent=2)+'\n')
files=[r/x for x in ['src/13-exports.wat','src/09c3a-dialog-runtime.wat','src/09b-dispatch.wat','tools/shadow-man-null-capture.cjs','tools/shadow-man-null-preload.cjs','test/test-shadow-man-null-capture.cjs','docs/re-notes/shadow-man-null-capture-mechanism-20261023.md']]
files+= [p for p in out.iterdir() if p.is_file() and p.name not in ['fixture.wasm','preload-driver.cjs']]
updates={};seals=[]
for p in sorted(files):
 rel=p.relative_to(r).as_posix();b=p.read_bytes();blob=git('hash-object','-w','--stdin',data=b).decode().strip();updates[rel]=('100644','blob',blob);seals.append({'path':rel,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
def update(tree,changes):
 entries={}
 for item in git('ls-tree','-z',tree).split(b'\0'):
  if item:
   meta,name=item.split(b'\t',1);entries[name.decode()]=tuple(meta.decode().split())
 groups={}
 for p,v in changes.items():
  head,sep,tail=p.partition('/')
  if sep:groups.setdefault(head,{})[tail]=v
  else:entries[head]=v
 for name,c in groups.items():entries[name]=('040000','tree',update(entries[name][2] if name in entries else git('mktree',data=b'').decode().strip(),c))
 return git('mktree','-z','--missing',data=b''.join(f'{m} {k} {s}\t{n}\0'.encode() for n,(m,k,s) in entries.items())).decode().strip()
def inventory(ref):return {name:meta for item in git('ls-tree','-rz',ref).split(b'\0') if item for meta,name in [item.split(b'\t',1)]}
tree=update(base+'^{tree}',updates);before=inventory(base);after=inventory(tree)
assert all(after.get(p)==v for p,v in before.items() if p.decode() not in updates)
assert set(after)-set(before)=={p.encode() for p in updates if p.encode() not in before}
assert git('ls-remote','origin','refs/heads/main').decode().split()[0]==base
commit=git('commit-tree',tree,'-p',base,data=b'diagnostic: retain Shadow Man NULL boundary snapshots synchronously\n').decode().strip()
git('diff','--check',base,commit)
def size(p):return sum(x.stat().st_size for x in p.rglob('*') if x.is_file())
whole=size(r)+8388608+2097152+pathlib.Path('/tmp/shadow-null-setup.py').stat().st_size+pathlib.Path('/tmp/shadow-null-edit.py').stat().st_size+pathlib.Path('/tmp/shadow-null-admission.json').stat().st_size+pathlib.Path('/tmp/shadow-null-publish.py').stat().st_size
free=shutil.disk_usage(r).free;assert whole<67108864 and free-2097152>2982150144
git('update-ref','refs/heads/'+branch,commit,base);git('push','origin','refs/heads/'+branch+':refs/heads/'+branch)
refs=dict((line.split()[1],line.split()[0]) for line in git('ls-remote','origin','refs/heads/'+branch,'refs/heads/main').decode().splitlines());assert refs['refs/heads/'+branch]==commit and refs['refs/heads/main']==base
receipt={'commit':commit,'branch':branch,'actualRemoteRefs':refs,'remoteMatch':True,'changedExistingPaths':3,'preservedBasePaths':len(before)-3,'ownedFiles':len(files),'seals':seals,'testsExit':0,'diffCheckExit':0,'wholeTaskUpperBytes':whole,'wholeParts':{'actualTaskCheckoutIncludingGit':size(r),'reserve':8388608,'futureGitEvidenceGrowth':2097152,'temporaryScripts':'included by measured byte length'},'hostAvailableBytes':free,'hostFloor':2982150144,'standingToolsAndReadOnlyDonors':'separate admission.json identities, not newly allocated','sourceFullHandlers':'NOT EXECUTED','nativeFragment':'902 bytes / 8MiB arena','runtime':'NONE'}
pub=r/'scratch/runs/20261023-shadow-man-null-capture-mechanism';pub.mkdir(parents=True,exist_ok=True);(pub/'publication.json').write_text(json.dumps(receipt,indent=2)+'\n');shutil.copyfile('/tmp/shadow-null-publish.py',pub/'publish.py');print(json.dumps(receipt,indent=2))
