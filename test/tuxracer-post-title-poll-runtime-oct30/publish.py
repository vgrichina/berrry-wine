import control as c,pathlib,resource,os,subprocess,json,time,signal
O=c.O;G=O/'publication.git';B='dbabdfc2a3e0386580d9feb3d7cd3b8eb5155262';REF='refs/heads/test/tuxracer-post-title-poll-runtime-oct30'
c.admission()
env=dict(os.environ,GIT_SSH_COMMAND=c.SSH,GIT_NO_LAZY_FETCH='1')
def git(*args,input=None,allowed=(0,)):
 def limits():
  s,h=c.ORIG[resource.RLIMIT_DATA];resource.setrlimit(resource.RLIMIT_DATA,(min(256*c.M,h) if h!=-1 else 256*c.M,h))
  for k,n in [(resource.RLIMIT_CPU,90),(resource.RLIMIT_FSIZE,12*c.M)]:c.cap(k,n)
 a=O/'git-live.stdout';b=O/'git-live.stderr';start=time.monotonic()
 with a.open('wb') as x,b.open('wb') as y:
  p=subprocess.Popen(['git','--git-dir='+str(G),*args],stdin=subprocess.PIPE,stdout=x,stderr=y,env=env,preexec_fn=limits,start_new_session=True)
  if input:p.stdin.write(input)
  p.stdin.close()
  while p.poll() is None:
   rss=0
   for f in pathlib.Path('/proc').glob('[0-9]*/stat'):
    try:
     row=f.read_text().rsplit(')',1)[1].split()
     if int(row[2])==p.pid:rss+=int(row[21])*4096
    except (OSError,ValueError):pass
   assert rss<=512*c.M and time.monotonic()-start<=90 and a.stat().st_size+b.stat().st_size<=524288,'publication process limit'
   time.sleep(.04)
  p.wait()
 out=a.read_bytes();err=b.read_bytes();a.unlink();b.unlink()
 assert p.returncode in allowed,(args,p.returncode,err.decode(errors='replace')[-2000:])
 assert len(out)+len(err)<=524288
 return out
assert not G.exists()
git('init','--bare','--template=',str(G))
(G/'objects/info/alternates').write_text(str(O.parent/'input-consumption/publication.git/objects')+'\n'+str(c.REPO/'.git/objects')+'\n/home/user/wine-assembly/.git/objects\n')
git('config','remote.origin.url','git@github.com:vgrichina/wine-assembly.git')
assert not git('ls-remote','--exit-code','origin',REF,allowed=(2,))
assert git('ls-tree',B,'--','test/main-scheduler-observer.js').decode().split()[2]=='93fac2a4a2ecea2bf8891f01f9a814a589e36b80'
prefix='test/tuxracer-post-title-poll-runtime-oct30/'
paths={prefix+n:n for n in ['preflight-blocker.json','lifecycle.json','control.py','inspect.py','finish.py','publish.py']}
paths['docs/re-notes/tuxracer-post-title-poll-runtime-oct30.md']='README.md'
changes={p:git('hash-object','-w','--',str(O/n)).decode().strip() for p,n in paths.items()}
def tree(oid,delta):
 entries={}
 if oid:
  raw=git('cat-file','tree',oid);at=0
  while at<len(raw):
   z=raw.index(b'\0',at);mode,name=raw[at:z].split(b' ',1);entries[name.decode()]=(mode,raw[z+1:z+21].hex());at=z+21
 for name,d in delta.items():
  if isinstance(d,str):entries[name]=(b'100644',d)
  else:
   old=entries.get(name);assert old is None or old[0]==b'40000'
   entries[name]=(b'40000',tree(old[1] if old else None,d))
 raw=b''.join(mode+b' '+name.encode()+b'\0'+bytes.fromhex(oid) for name,(mode,oid) in sorted(entries.items(),key=lambda x:x[0]+('/' if x[1][0]==b'40000' else '')))
 return git('hash-object','-w','-t','tree','--stdin',input=raw).decode().strip()
delta={}
for p,oid in changes.items():
 at=delta;parts=p.split('/')
 for n in parts[:-1]:at=at.setdefault(n,{})
 at[parts[-1]]=oid
T=tree(git('rev-parse',B+'^{tree}').decode().strip(),delta)
C=git('-c','user.name=Wine Ops','-c','user.email=wine-ops@users.noreply.github.com','commit-tree',T,'-p',B,input=b'docs: preserve exact-module allocation blocker before Tux Racer runtime\n').decode().strip()
git('diff-tree','--check',B,C)
assert sorted(git('diff-tree','--no-commit-id','--name-only','-r',B,C).decode().splitlines())==sorted(paths)
git('update-ref',REF,C,'0'*40)
c.save('publication-local.json',dict(commit=C,ref=REF,parent=B,tree=T,paths=changes,indexUsed=False))
c.admission()
git('push','origin',REF+':'+REF)
remote=git('ls-remote','--exit-code','origin',REF).decode();assert remote.split()==[C,REF]
c.save('publication.json',dict(commit=C,ref=REF,parent=B,tree=T,paths=changes,exactRemoteSHA=C,remote=remote,ssh=c.SSH,indexUsed=False,sourceChanges=False,remoteURL='git@github.com:vgrichina/wine-assembly.git'))
print(json.dumps(dict(commit=C,ref=REF,verifiedRemote=remote.strip())))
