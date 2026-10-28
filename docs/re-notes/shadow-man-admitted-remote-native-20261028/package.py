import pathlib,gzip,json,subprocess,resource,os,tarfile,io,hashlib,time
H=pathlib.Path(__file__).resolve().parents[1];R=H/'repo';P=pathlib.Path('/home/user/wine-assembly-shadow-man-zero-transfer-canonical-native-oct23/docs/re-notes/shadow-man-zero-transfer-canonical-native-20261023');x=json.loads(gzip.decompress((P/'candidate-inputs.json.gz').read_bytes()))
def limits():
 resource.setrlimit(resource.RLIMIT_DATA,(268435456,268435456));resource.setrlimit(resource.RLIMIT_RSS,(268435456,268435456));resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
p=subprocess.Popen(['git','-C',str(R),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=open(H/'evidence/package-git.stderr','wb'),preexec_fn=limits,env=dict(os.environ,GIT_NO_LAZY_FETCH='1'))
a=H/'inputs.tar.gz';sources={};n=0
with tarfile.open(a,'w:gz') as t:
 for r in x['files']:
  p.stdin.write((r['blob']+'\n').encode());p.stdin.flush();header=p.stdout.readline().decode().split()
  if header[-1]=='missing':
   b=None
   for d in ['/home/user/wine-assembly','/home/user/wine-assembly-shadow-man-fresh-selection-repair-oct23']:
    f=pathlib.Path(d)/r['path']
    if f.is_file():
     bb=f.read_bytes()
     if hashlib.sha256(bb).hexdigest()==r['sha256']:b=bb;break
   assert b is not None,r
  else:
   assert header[1]=='blob';b=p.stdout.read(int(header[2]));assert p.stdout.read(1)==b'\n'
  assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'],r['path']
  ti=tarfile.TarInfo(r['path']);ti.size=len(b);ti.mode=0o644;t.addfile(ti,io.BytesIO(b));n+=len(b)
 for name,b in [('task-inputs.json',json.dumps(x).encode())]:
  ti=tarfile.TarInfo(name);ti.size=len(b);t.addfile(ti,io.BytesIO(b))
p.stdin.close();assert p.wait()==0
rec={'files':len(x['files']),'sourceBytes':n,'archiveBytes':a.stat().st_size,'archiveSHA256':hashlib.sha256(a.read_bytes()).hexdigest(),'manifestSHA256':hashlib.sha256((P/'candidate-inputs.json.gz').read_bytes()).hexdigest(),'candidate':x['candidate'],'gitExit':p.returncode,'noHistory':True};assert a.stat().st_size<25165824;(H/'evidence/package.json').write_text(json.dumps(rec,indent=2));print(json.dumps(rec))
