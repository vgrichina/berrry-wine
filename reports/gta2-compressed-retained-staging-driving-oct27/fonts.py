PIN='1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba';listing=(O/'font-tree.child.stdout').read_text();rows=[]
for line in listing.splitlines():
 meta,name=line.split('\t');mode,kind,oid,size=meta.split();assert kind=='blob';rows.append(dict(path=name,oid=oid,bytes=int(size)))
rows=[r for r in rows if r["path"].endswith(".fon") or r["path"]=="fonts/substitutions.json" or r["path"].startswith("fonts/subset/")]
assert len(rows)<=40 and sum(r['bytes'] for r in rows)<8388608
buf=io.BytesIO();pins=[]
def lim():resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
with open('/tmp/wine-ops-production-git.lock','a') as lk:
 fcntl.flock(lk,fcntl.LOCK_EX)
 with (O/'fonts-cat.stderr').open('xb') as err:
  p=subprocess.Popen(['git','-C',str(H/'repo'),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err,preexec_fn=lim,env=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0'))
  with tarfile.open(fileobj=buf,mode='w:gz') as t:
   for r in rows:
    p.stdin.write((r['oid']+'\n').encode());p.stdin.flush();assert p.stdout.readline().decode().split()==[r['oid'],'blob',str(r['bytes'])];b=p.stdout.read(r['bytes']);assert p.stdout.read(1)==b'\n';r['sha256']=sha(b);i=tarfile.TarInfo(r['path']);i.size=len(b);t.addfile(i,io.BytesIO(b))
  p.stdin.close();assert p.wait(timeout=5)==0
put(str(O/'fonts.tar.gz'),buf.getvalue(),'fonts');py('import pathlib,tarfile;p=pathlib.Path('+repr(str(O/'fonts.tar.gz'))+');t=tarfile.open(p);t.extractall('+repr(str(H/'repo'))+',filter="data");t.close();p.unlink();print("fonts staged")');save('fonts-pins.json',rows);print('fonts recovered',len(rows),sum(r['bytes'] for r in rows))
