import owner133_ops as g,json,subprocess,hashlib,os
g.setup();r=g.ops.REPO;e=g.ops.E;env=dict(os.environ,GIT_SSH_COMMAND=g.ops.SSH)
def git(args,data=None):
 q=subprocess.run(['git','-C',str(r)]+args,input=data,cwd=r,env=env,preexec_fn=lambda:g.ops.child_limits(True),capture_output=True,timeout=60)
 assert q.returncode==0,(args,q.stderr[:512]);assert len(q.stderr)<8192;return q.stdout
head=git(['rev-parse','HEAD']).decode().strip();index=git(['ls-files','--stage','-z']);tree=git(['ls-tree','-r','-t','-z','HEAD']);ids=set()
for row in index.split(b'\0'):
 if row:ids.add(row.split(b'\t',1)[0].split()[1])
for row in tree.split(b'\0'):
 if row:ids.add(row.split(b'\t',1)[0].split()[2])
ids.add(head.encode());ids.add(git(['rev-parse','HEAD^{tree}']).strip())
check=git(['cat-file','--batch-check=%(objectname) %(objecttype)'],b'\n'.join(sorted(ids))+b'\n');missing=[x.decode() for x in check.splitlines() if x.endswith(b' missing')];assert not missing,missing[:20]
rec=dict(PASS=True,HEAD=head,indexEntries=len(index.split(b'\0'))-1,treeEntries=len(tree.split(b'\0'))-1,objectsChecked=len(ids),missing=missing,indexSHA256=hashlib.sha256(index).hexdigest(),treeSHA256=hashlib.sha256(tree).hexdigest(),scope='exact index/HEAD tree closure, no ancestry traversal, no new alternate stores',admission=g.admission());(e/'publication-closure.json').write_text(json.dumps(rec,indent=2));print(json.dumps(rec))
