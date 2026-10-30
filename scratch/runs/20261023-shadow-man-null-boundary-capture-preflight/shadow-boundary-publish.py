import os,pathlib,subprocess,json,hashlib,shutil
root=pathlib.Path('/home/user/wine-assembly-shadow-man-null-boundary-capture-preflight-oct23')
env={**os.environ,'GIT_NO_LAZY_FETCH':'1','GIT_SSH_COMMAND':'ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -i /home/user/.ssh/wine_github_ed25519'}
base='bb9c496ed13095cc832fdf607f0937fb9c14b7de'
branch='task/shadow-man-null-boundary-capture-preflight-oct23'
def git(*args,data=None):return subprocess.check_output(['git','-C',str(root),*args],input=data,env=env)
files=sorted(p for p in (root/'docs').rglob('*') if p.is_file())
updates={}
seals=[]
for p in files:
    rel=p.relative_to(root).as_posix();b=p.read_bytes()
    blob=git('hash-object','-w','--stdin',data=b).decode().strip()
    updates[rel]=('100644','blob',blob)
    seals.append({'path':rel,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'blob':blob})
def tree_update(tree,changes):
    entries={}
    for item in git('ls-tree','-z',tree).split(b'\0'):
        if not item:continue
        meta,name=item.split(b'\t',1);mode,kind,sha=meta.decode().split()
        entries[name.decode()]=(mode,kind,sha)
    groups={}
    for p,value in changes.items():
        head,sep,tail=p.partition('/')
        if sep:groups.setdefault(head,{})[tail]=value
        else:entries[head]=value
    for name,children in groups.items():
        old=entries.get(name)
        subtree=old[2] if old else git('mktree',data=b'').decode().strip()
        entries[name]=('040000','tree',tree_update(subtree,children))
    content=b''.join(f'{mode} {kind} {sha}\t{name}\0'.encode() for name,(mode,kind,sha) in entries.items())
    # Preserve already-referenced, deliberately unmaterialized parent blobs.
    # All four new blobs were written above; no fetch is permitted or needed.
    return git('mktree','-z','--missing',data=content).decode().strip()
tree=tree_update(base+'^{tree}',updates)
def inventory(ref):
    return {name:meta for item in git('ls-tree','-rz',ref).split(b'\0') if item for meta,name in [item.split(b'\t',1)]}
before=inventory(base);after=inventory(tree)
assert all(after.get(p)==v for p,v in before.items())
assert len(after)-len(before)==len(files)==4
remote=git('ls-remote','origin','refs/heads/main').decode().split()[0]
assert remote==base
commit=git('commit-tree',tree,'-p',base,data=b'docs: record Shadow Man capture preflight admission blocker\n').decode().strip()
git('diff','--check',base,commit)
git('update-ref','refs/heads/'+branch,commit,base)
git('push','origin','refs/heads/'+branch+':refs/heads/'+branch)
refs=dict((line.split()[1],line.split()[0]) for line in git('ls-remote','origin','refs/heads/'+branch,'refs/heads/main').decode().splitlines())
assert refs['refs/heads/'+branch]==commit and refs['refs/heads/main']==base
receipt={'commit':commit,'branch':branch,'actualRemoteRefs':refs,'remoteMatch':True,
 'basePathsUnchanged':len(before),'ownedAdditions':len(files),'diffCheckExit':0,
 'reportCheckExit':0,'helperCaptureFixtures':'NOT RUN','captureReady':False,'seals':seals}
out=root/'scratch/runs/20261023-shadow-man-null-boundary-capture-preflight'
out.mkdir(parents=True)
for src in ['/tmp/shadow-boundary-admission.py','/tmp/shadow-boundary-publish.py']:
    shutil.copyfile(src,out/pathlib.Path(src).name)
def size(p):return sum(x.stat().st_size for x in p.rglob('*') if x.is_file())
admission=json.loads((root/'docs/re-notes/shadow-man-null-boundary-capture-preflight-20261023/admission.json').read_text())
parts=admission['blockerOnlyPublication']['parts'].copy()
parts['ownGitUpper']=size(root)+1048576
receipt['finalConservativeParts']=parts
receipt['finalWholeUpperBytes']=sum(parts.values())
receipt['hostFreeAfter']=os.statvfs(root).f_bavail*os.statvfs(root).f_frsize
assert receipt['finalWholeUpperBytes']<67108864
assert receipt['hostFreeAfter']>2982150144
(out/'publication.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
