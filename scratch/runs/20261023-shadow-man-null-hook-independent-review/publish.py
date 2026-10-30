import pathlib,os,subprocess,json,hashlib,shutil
r=pathlib.Path('/home/user/wine-assembly-shadow-man-null-hook-independent-review-oct23');base='6d145e98589caeab2d43c4bb54297d90c248b9de';main='bb9c496ed13095cc832fdf607f0937fb9c14b7de';branch='task/shadow-man-null-hook-independent-review-oct23';out=r/'docs/re-notes/shadow-man-null-hook-independent-review-20261023'
E={**os.environ,'GIT_NO_LAZY_FETCH':'1','GIT_SSH_COMMAND':'ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -i /home/user/.ssh/wine_github_ed25519'}
def git(*a,data=None):return subprocess.check_output(['git','-C',str(r),*a],input=data,env=E)
def size(p):return sum(x.stat().st_size for x in p.rglob('*') if x.is_file())
# Record source-tool origins and all read-only donors, never count standing bytes as copied allocations.
inputs={}
for n,sha in [('mechanism',base),('diagnosis','26dffaa0995cdf19d61ae30117729ca0588108b9'),('preflight','f0341d5d269baad2afed6a801768566e53d159be')]:
 suffix={'mechanism':'null-capture-mechanism','diagnosis':'null-exit-diagnosis','preflight':'null-boundary-capture-preflight'}[n];p=pathlib.Path('/home/user/wine-assembly-shadow-man-'+suffix+'-oct23');inputs[n]={'path':str(p),'bytes':size(p),'revision':sha,'access':'existing read-only donor; no metadata/index writes'}
measurement={'taskTreeIncludingGit':size(r),'reserve':8388608,'futurePublicationGitGrowth':2097152,'temporarySetupPublishInputs':sum(p.stat().st_size for p in [pathlib.Path('/tmp/shadow-null-independent-setup.py'),pathlib.Path('/tmp/shadow-null-independent-admission.json'),pathlib.Path('/tmp/shadow-null-independent-publish.py')]),'readOnlyDonors':inputs,'installedTools':'see admission.json; execute in place','cap':67108864,'floor':2982150144,'hostFree':shutil.disk_usage(r).free}
measurement['wholeUpper']=sum(measurement[k] for k in ['taskTreeIncludingGit','reserve','futurePublicationGitGrowth','temporarySetupPublishInputs']);assert measurement['wholeUpper']<measurement['cap'];assert measurement['hostFree']-measurement['futurePublicationGitGrowth']>measurement['floor'];(out/'measurement.json').write_text(json.dumps(measurement,indent=2)+'\n')
# Record exact input identity for the focused census source tool copied as source input.
assert git('hash-object','--stdin',data=(r/'tools/callback-ownership-census.js').read_bytes()).decode().strip()=='8da32d1573f6e81c8e2715f59b04200ed734cc6a'
files=[r/'test/test-shadow-man-null-independent-review.cjs',r/'docs/re-notes/shadow-man-null-hook-independent-review-20261023.md']+[p for p in out.iterdir() if p.is_file() and p.suffix!='.wasm']
updates={};seals=[]
for p in sorted(files):
 rel=p.relative_to(r).as_posix();b=p.read_bytes();updates[rel]=('100644','blob',git('hash-object','-w','--stdin',data=b).decode().strip());seals.append({'path':rel,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
# Unchanged tree records are reused, including locally absent unrelated blobs.
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
tree=update(base+'^{tree}',updates);before=inventory(base);after=inventory(tree);assert all(after.get(p)==v for p,v in before.items());assert set(after)-set(before)==set(p.encode() for p in updates);assert git('ls-remote','origin','refs/heads/main').decode().split()[0]==main
commit=git('commit-tree',tree,'-p',base,data=b'review: request bounded Shadow Man arming and exact module binding\n').decode().strip();git('diff','--check',base,commit);git('update-ref','refs/heads/'+branch,commit,base);git('push','origin','refs/heads/'+branch+':refs/heads/'+branch)
refs=dict((line.split()[1],line.split()[0]) for line in git('ls-remote','origin','refs/heads/'+branch,'refs/heads/main').decode().splitlines());assert refs['refs/heads/'+branch]==commit;assert refs['refs/heads/main']==main
receipt={'commit':commit,'branch':branch,'verdict':'REQUEST CHANGES','actualRemoteRefs':refs,'remoteMatch':True,'unchangedParentPaths':len(before),'addedReviewFiles':len(updates),'seals':seals,'checks':{'original902BFixture':0,'independentActualPaths':0,'sourcePinsFragmentGate':0,'scopedCensusDelta':0,'diffCheck':0},'nativeFragment':{'bytes':3394,'sha256':'5b874002a970b97d246408739811bd1802a8c31a6dc2357973579ce67c55f8ab','arenaBytes':8388608},'measurement':measurement,'runtime':'NONE','canonicalBuild':'NOT EXECUTED','productionSources':'UNCHANGED from parent candidate'}
pub=r/'scratch/runs/20261023-shadow-man-null-hook-independent-review';pub.mkdir(parents=True,exist_ok=True);(pub/'publication.json').write_text(json.dumps(receipt,indent=2)+'\n');shutil.copyfile('/tmp/shadow-null-independent-publish.py',pub/'publish.py');print(json.dumps({k:v for k,v in receipt.items() if k!='seals'},indent=2))
