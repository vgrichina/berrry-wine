import sys,os,json,tarfile,io,base64,subprocess,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent));import manage as m
BOX='bx_auvzp2av'; REM='/home/user/madbomber-restart-oct27'
def api(code,timeout=30):
 r=subprocess.run(['/home/user/.ascii/boat','exec','--json','--timeout',str(timeout),BOX,'python3','-c',code],capture_output=True,timeout=timeout+20)
 assert r.returncode==0,(r.stdout[:8192],r.stderr[:8192]);j=json.loads(r.stdout);assert j.get('success') and not j.get('stdoutTruncated'),j
 return j['stdout']
def put(name,b):
 for i in range(0,len(b),49152):
  api('import pathlib,base64; p=pathlib.Path('+repr(REM+'/'+name)+');p.parent.mkdir(parents=True,exist_ok=True);f=p.open('+repr('wb' if i==0 else 'ab')+');f.write(base64.b64decode('+repr(base64.b64encode(b[i:i+49152]).decode())+'));f.close();print(p.stat().st_size)')
 return api('import pathlib,hashlib; p=pathlib.Path('+repr(REM+'/'+name)+');assert hashlib.sha256(p.read_bytes()).hexdigest()=='+repr(m.sha(b))+';print(p.stat().st_size)')
if __name__=='__main__':
 m.gate('stage');mp=m.ROOT/'scratch/usage-watch/madbomber-restart-runtime-manifest-oct27.json';raw=mp.read_bytes();assert m.sha(raw)=='13008013c325f602b4a9aa25f4d3ddfb5f2737d3e738a4e1c36e318612d118a1';rows=json.loads(raw)
 git=tarfile.open(m.O/'git-inputs.tar.gz'); assets=tarfile.open(m.ROOT/'scratch/runs/20261020-madbomber-native-qualification/original-assets.tar.gz')
 buf=io.BytesIO()
 with tarfile.open(fileobj=buf,mode='w:gz',compresslevel=6) as tar:
  for row in rows:
   b=git.extractfile(row['path']).read() if row['kind']=='git' else assets.extractfile(row['member']).read() if row['kind']=='archive-member' else Path(row['source']).read_bytes()
   assert len(b)==row['bytes'] and m.sha(b)==row['sha256'],row
   name=row.get('target',row.get('dest'));assert name and '..' not in Path(name).parts
   ti=tarfile.TarInfo(name);ti.size=len(b);tar.addfile(ti,io.BytesIO(b))
 data=buf.getvalue();m.save('staging-plan.json',dict(closureBytes=sum(r['bytes'] for r in rows),files=len(rows),compressedBytes=len(data),sha256=m.sha(data),remoteAllocation=100663296,remoteReserve=8388608,captures=16777216,logs=2097152,remoteProjectedPeak=sum(r['bytes'] for r in rows)+len(data)+16777216+2097152+8388608+8388608))
 print('transfer bytes',len(data),flush=True)
 api('from pathlib import Path; p=Path('+repr(REM)+');p.mkdir(exist_ok=False); print("created")')
 for i in range(0,len(data),49152):
  piece=data[i:i+49152]
  api('import pathlib,base64,shutil; p=pathlib.Path('+repr(REM+'/closure.tar.gz')+');b=base64.b64decode('+repr(base64.b64encode(piece).decode())+');f=p.open("ab");f.write(b);f.close();assert p.stat().st_size=='+str(i+len(piece))+';assert shutil.disk_usage(p.parent).free>100663296;print(p.stat().st_size)')
  if i%(49152*20)==0: print('transferred',i+len(piece),flush=True)
 put('manifest.json',raw)
 code='''import pathlib,tarfile,hashlib,json,os
p=pathlib.Path(ROOT);a=p/'closure.tar.gz'
assert hashlib.sha256(a.read_bytes()).hexdigest()==SHA
with tarfile.open(a) as t:t.extractall(p,filter='data')
rows=json.loads((p/'manifest.json').read_text());bad=[]
for r in rows:
 f=p/r.get('target',r.get('dest'));b=f.read_bytes()
 if len(b)!=r['bytes'] or hashlib.sha256(b).hexdigest()!=r['sha256']:bad.append(str(f))
assert not bad,bad
a.unlink();used=sum(x.stat().st_blocks*512 for x in p.rglob('*'))
j=dict(files=len(rows),bytes=sum(r['bytes'] for r in rows),bad=bad,allocated=used,passAll=True)
(p/'transfer-receipt.json').write_text(json.dumps(j,indent=2));print(json.dumps(j))
'''.replace('ROOT',repr(REM)).replace('SHA',repr(m.sha(data)))
 m.save('transfer-receipt.json',json.loads(api(code)));(m.O/'git-inputs.tar.gz').unlink();m.gate('post-stage');print('verified all378',flush=True)
