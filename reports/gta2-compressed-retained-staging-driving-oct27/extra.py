PIN='1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba';paths=['index.html','docs/dos-corpus/live/toyvm-bundle.js','docs/dos-corpus/live/toyvm-jit-bundle.js'];buf=io.BytesIO();pins=[]
def lim():resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
with open('/tmp/wine-ops-production-git.lock','a') as lk:
 fcntl.flock(lk,fcntl.LOCK_EX)
 with (O/'extra-git.stderr').open('xb') as err:
  p=subprocess.Popen(['git','-C',str(H/'repo'),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err,preexec_fn=lim,env=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0'))
  with tarfile.open(fileobj=buf,mode='w:gz',compresslevel=6) as t:
   for name in paths:
    p.stdin.write((PIN+':'+name+'\n').encode());p.stdin.flush();h=p.stdout.readline().decode().split();assert h[1]=='blob',h;b=p.stdout.read(int(h[2]));assert p.stdout.read(1)==b'\n';i=tarfile.TarInfo(name);i.size=len(b);t.addfile(i,io.BytesIO(b));pins.append(dict(path=name,bytes=len(b),oid=h[0],sha256=sha(b)))
  p.stdin.close();assert p.wait(timeout=5)==0
put(str(O/'extra.tar.gz'),buf.getvalue(),'extra')
py('import pathlib,tarfile;p=pathlib.Path('+repr(str(O/'extra.tar.gz'))+');t=tarfile.open(p);assert all(x.isfile() and not x.name.startswith("/") and ".." not in pathlib.Path(x.name).parts for x in t);t.extractall('+repr(str(H/'repo'))+',filter="data");t.close();p.unlink();print("extra exact closure")');save('extra-pins.json',pins)
assert sha(TRUST.read_bytes())=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85';remote=TRUST.read_text().replace('lower_limit(resource.RLIMIT_CPU, 90)','lower_limit(resource.RLIMIT_CPU, 180)');put(str(O/'remote-supervisor.py'),remote.encode(),'remote-supervisor');save('remote-supervisor-derivation.json',dict(originalSHA256=sha(TRUST.read_bytes()),remoteSHA256=sha(remote.encode()),change='remote child CPU180; local unchanged'))
put(str(O/'remote-job.py'),(O/'remote-job.py').read_bytes(),'remote-job')
P=pathlib.Path('/tmp/enigma-remote-host-validated-startgame-oct27/repo/runner/node_modules/pngjs');assert P.is_dir();buf=io.BytesIO();pins=[]
with tarfile.open(fileobj=buf,mode='w:gz') as t:
 for p in sorted(P.rglob('*')):
  if p.is_file():
   b=p.read_bytes();name='node_modules/pngjs/'+str(p.relative_to(P));i=tarfile.TarInfo(name);i.size=len(b);t.addfile(i,io.BytesIO(b));pins.append(dict(path=name,bytes=len(b),sha256=sha(b)))
assert len(pins)<=40;put(str(O/'pngjs.tar.gz'),buf.getvalue(),'pngjs');py('import pathlib,tarfile;p=pathlib.Path('+repr(str(O/'pngjs.tar.gz'))+');t=tarfile.open(p);t.extractall('+repr(str(H/'repo'))+',filter="data");t.close();p.unlink();print("pngjs exact staged")');save('pngjs-pins.json',pins);print('extra canonical closure and helpers staged')
