"""Append only this evidence subtree to current HEAD in a focused object store."""
import pathlib,subprocess,os
E=pathlib.Path(__file__).resolve().parent;W=E.parents[2]
env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
def git(*args,data=None):return subprocess.check_output(['git','-C',str(W),*args],input=data,env=env)
def tree(rows):return git('mktree','--missing','-z',data=b''.join(rows)).decode().strip()
def directory(p):
 rows=[]
 for f in sorted(p.iterdir()):
  if f.name=='__pycache__':continue
  if f.is_dir():mode='040000';kind='tree';oid=directory(f)
  else:mode='100644';kind='blob';oid=git('hash-object','-w','--',str(f)).decode().strip()
  rows.append(f'{mode} {kind} {oid}\t{f.name}'.encode()+b'\0')
 return tree(rows)
base=git('rev-parse','HEAD').decode().strip();new=directory(E)
relative=E.relative_to(W).parts
for n in range(len(relative)-1,-1,-1):
 parent='/'.join(relative[:n]);spec=base+(':'+parent if parent else '')
 rows=[r+b'\0' for r in git('ls-tree','-z',spec).split(b'\0') if r and r.split(b'\t',1)[1]!=relative[n].encode()]
 rows.append(f'040000 tree {new}\t{relative[n]}'.encode()+b'\0');new=tree(rows)
changed=git('diff-tree','--no-commit-id','--name-only','-r',base,new).decode().splitlines()
assert changed and all(p.startswith(str(E.relative_to(W))+'/') for p in changed),changed
commit=git('commit-tree',new,'-p',base,data=b'Record original Shadow Man installation and quota-blocked game launch\n').decode().strip()
git('update-ref','refs/heads/task/shadow-man-original-install-continue-oct22',commit,base)
print(commit)
