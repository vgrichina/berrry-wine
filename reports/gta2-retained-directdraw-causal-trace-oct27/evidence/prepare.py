from control import *
import tarfile,io,gzip
OLD=pathlib.Path('/tmp/gta2-compressed-retained-staging-driving-oct27/ops')
rc=json.loads((OLD/'source-readiness.json').read_text())
rows=[dict(r,kind='source',target=r['path']) for r in rc['sourceFiles']]
rows += [dict(r,kind='game',target=str(pathlib.Path(r['path']).relative_to(ROOT))) for r in json.loads((ROOT/'scratch/usage-watch/gta2-driving-input-readiness-oct27.json').read_text())['files']]
fonts=json.loads((OLD/'fonts-pins.json').read_text());rows += [dict(r,kind='source',target=r['path']) for r in fonts]
for name,expected in [('wine-assembly.wasm','bf707aa41e2883e1407c71810a15fd5f1816961938c1103c8d1d5bd40cb701d9'),('wine-assembly.compat.wasm','ff495de2b12c308013fa489b9fb291ca836171929655ca20df03440946c54dbc')]:
 p=OLD/'retrieved'/name;assert sha(p.read_bytes())==expected;rows.append(dict(kind='file',path=str(p),target='build/'+name,bytes=p.stat().st_size,sha256=expected))
a=OLD/'retrieved/preserved-diagnostics.tar.gz';assert sha(a.read_bytes())=='5c062c14c128c409d0e01eaf5a021840a1578e52f1c0555f5e8bd35f69ed3edc'
with tarfile.open(a) as t:save('archive-inventory.json',[dict(name=m.name,bytes=m.size,type=str(m.type)) for m in t])
def lim():resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
groups=[]
with open('/tmp/wine-ops-production-git.lock','a') as lk:
 fcntl.flock(lk,fcntl.LOCK_EX)
 with (O/'estimate-git.stderr').open('xb') as err:
  p=subprocess.Popen(['/usr/bin/git','-C',str(R),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err,preexec_fn=lim)
  for start in range(0,len(rows),40):
   batch=rows[start:start+40];buf=io.BytesIO();pins=[]
   with tarfile.open(fileobj=buf,mode='w:gz',compresslevel=6) as t:
    for r in batch:
     if r['kind']=='source':
      p.stdin.write((r['oid']+'\n').encode());p.stdin.flush();assert p.stdout.readline().decode().split()==[r['oid'],'blob',str(r['bytes'])];b=p.stdout.read(r['bytes']);assert p.stdout.read(1)==b'\n';assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==r['oid']
     else:b=pathlib.Path(r['path']).read_bytes();assert sha(b)==r['sha256']
     assert len(b)==r['bytes'];i=tarfile.TarInfo(r['target']);i.size=len(b);t.addfile(i,io.BytesIO(b));pins.append(dict(r,sha256=sha(b)))
   z=buf.getvalue();groups.append(dict(count=len(batch),bytes=sum(x['bytes'] for x in pins),gzipBytes=len(z),requests=(len(z)*4//3+30000)//30000,pins=pins))
  p.stdin.close();assert p.wait(timeout=5)==0
save('transfer-plan.json',dict(groups=groups,count=len(rows),bytes=sum(r['bytes'] for r in rows),requests=sum(g['requests'] for g in groups),remoteProjection=440297036,remoteAllocation=1073741824,localAllocation=335544320,remoteReserve=67108864,localReserve=33554432,rawAllowance=8388608,rawTerminalReserve=1048576,remotePNGs=4,remotePNGMax=4194304,transferredPNGsMax=2,guestCutoff='14:08Z'))
print('groups',len(groups),'files',len(rows),'bytes',sum(r['bytes'] for r in rows),'requests',sum(g['requests'] for g in groups))
