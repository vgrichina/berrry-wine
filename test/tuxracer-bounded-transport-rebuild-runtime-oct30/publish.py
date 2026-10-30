"""Index-free report-only publication based on verified current main."""
import control as c,json,hashlib,pathlib
O=c.O;B=json.loads((O/'report-parent.json').read_text())['parent'];REF='refs/heads/test/tuxracer-bounded-transport-rebuild-runtime-oct30'
assert json.loads((O/'report-validation.json').read_text())['PASS']
assert json.loads((O/'snapshot-stop-proof.json').read_text())['PASS']
c.admission(publication=True)
assert c.git('remote','get-url','origin').decode().strip()=='git@github.com:vgrichina/wine-assembly.git'
assert c.git('ls-remote','--exit-code','origin','refs/heads/main').decode().split()==[B,'refs/heads/main']
assert not c.git('ls-remote','--exit-code','origin',REF,allowed=(2,))
names=json.loads((O/'report-validation.json').read_text())['publishFiles']
prefix='test/tuxracer-bounded-transport-rebuild-runtime-oct30/'
paths={prefix+n:n for n in names}
paths['docs/re-notes/tuxracer-bounded-transport-rebuild-runtime-oct30.md']='README.md'
assert sum((O/n).stat().st_size for n in paths.values())<262144
changes={p:c.git('hash-object','-w','--',str(O/n),mutation=True).decode().strip() for p,n in paths.items()}
def tree(oid,delta):
 entries={}
 if oid:
  raw=c.git('cat-file','tree',oid);at=0
  while at<len(raw):
   z=raw.index(b'\0',at);mode,name=raw[at:z].split(b' ',1);entries[name.decode()]=(mode,raw[z+1:z+21].hex());at=z+21
 for name,d in delta.items():
  if isinstance(d,str):entries[name]=(b'100644',d)
  else:
   old=entries.get(name);assert old is None or old[0]==b'40000'
   entries[name]=(b'40000',tree(old[1] if old else None,d))
 raw=b''.join(mode+b' '+name.encode()+b'\0'+bytes.fromhex(oid) for name,(mode,oid) in sorted(entries.items(),key=lambda x:x[0]+('/' if x[1][0]==b'40000' else '')))
 return c.git('hash-object','-w','-t','tree','--stdin',input=raw,mutation=True).decode().strip()
delta={}
for p,oid in changes.items():
 at=delta;parts=p.split('/')
 for n in parts[:-1]:at=at.setdefault(n,{})
 at[parts[-1]]=oid
T=tree(c.git('rev-parse',B+'^{tree}').decode().strip(),delta)
C=c.git('-c','user.name=Wine Ops','-c','user.email=wine-ops@users.noreply.github.com','commit-tree',T,'-p',B,input=b'docs: record bounded Tux Racer remote rebuild and original runtime observation\n',mutation=True).decode().strip()
c.git('diff-tree','--check',B,C)
assert sorted(c.git('diff-tree','--no-commit-id','--name-only','-r',B,C).decode().splitlines())==sorted(paths)
c.git('update-ref',REF,C,'0'*40,mutation=True)
c.save('publication-local.json',dict(commit=C,parent=B,ref=REF,tree=T,paths=changes,indexUsed=False,reportBytes=sum((O/n).stat().st_size for n in paths.values())))
c.git('push','origin',REF+':'+REF,mutation=True)
remote=c.git('ls-remote','--exit-code','origin',REF).decode();assert remote.split()==[C,REF]
c.save('publication.json',dict(commit=C,parent=B,ref=REF,tree=T,paths=changes,exactRemoteSHA=C,remote=remote,ssh=c.SSH,indexUsed=False,sourceChanges=False,remoteURL='git@github.com:vgrichina/wine-assembly.git'))
print(json.dumps(dict(commit=C,ref=REF,exactRemote=remote.strip())))
