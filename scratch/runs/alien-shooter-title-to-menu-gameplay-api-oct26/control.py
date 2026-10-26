exec(open('/tmp/alien-shooter-title-to-menu-gameplay-api-oct26/ops/setup.py').read().split('clients=[]')[0])
import base64,zlib
if sys.argv[1]=='measure':
 j=w.py('''import pathlib,json,hashlib,shutil
roots=list(pathlib.Path('/tmp').glob('alien-shooter-*-oct26'));print(json.dumps(dict(roots={str(h):sum(p.lstat().st_blocks*512 for p in [h,*h.rglob('*')]) for h in roots if h.is_dir()},memAvailable=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024,free=shutil.disk_usage('/tmp').free)))''');w.save('fresh-remote-accounting.json',j)
 roots=[pathlib.Path('/tmp/alien-shooter-pinned-startup-gameplay-api-oct26'),pathlib.Path('/tmp/alien-shooter-required-exe-gameplay-api-oct26'),w.H]
 sess=list(pathlib.Path('/home/user/.codex/sessions').rglob('*'+os.environ['CODEX_THREAD_ID']+'*'))
 ledger=dict(remote=sum(json.loads(j['stdout'])['roots'].values()),local=sum(w.allocated(x) for x in roots),evidence=sum(w.allocated(w.ROOT/'scratch/runs'/x.name) for x in roots),launcher=w.allocated(w.ROOT/'scratch/usage-watch'/w.H.name),session=sum(w.allocated(x) for x in sess),positiveWALOnce=sum(max(0,w.allocated(pathlib.Path(p))-n) for p,n in json.loads(pathlib.Path('/tmp/alien-shooter-pinned-startup-gameplay-api-oct26/ops/sqlite-baseline.json').read_text()).items()),futureGitPublicationSessionEvents=40*2**20,reserve=8*2**20)
 total=sum(ledger.values());w.save('fresh-full-accounting.json',dict(charges=ledger,total=total,allocation=256*2**20,projectedHostFree=shutil.disk_usage('/tmp').free-48*2**20));print(ledger,total);assert total<256*2**20 and shutil.disk_usage('/tmp').free-48*2**20>=2982150144
elif sys.argv[1]=='launch':
 assert time.time()+90<1793051400
 w.save('guest-detach.json',w.remote('python3 '+w.R+'/supervisor.py guest',detach=True));print('LAUNCHED')
elif sys.argv[1]=='advance':
 target=int(sys.argv[2]);name=sys.argv[3]
 code='''import urllib.request,json,pathlib,time
h=pathlib.Path('''+repr(w.R)+''');log=h/'control.jsonl'
def ctl(c):
 b=json.dumps(c).encode();at=time.time()
 with log.open('a') as f:f.write(json.dumps(dict(at=at,request=c))+'\\n')
 r=urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:18129/ctl',data=b,headers={'Content-Type':'application/json'}),timeout=25);v=json.loads(r.read(8192));assert v['ok'],v
 with log.open('a') as f:f.write(json.dumps(dict(at=time.time(),response=v))+'\\n')
 return v['value']
s=ctl({'action':'snapshot'});assert s['frozen']['credits']==0
while s['batch']<'''+str(target)+''':
 n=min(256,'''+str(target)+'''-s['batch']);v=ctl({'action':'step','n':n});s=ctl({'action':'snapshot'});assert s['frozen']['credits']==0
ctl({'action':'png','path':str(h/'''+repr(name)+''')});print(json.dumps(s))
'''
 w.save('advance-'+str(target)+'.json',w.py(code,timeout=55))
 j=w.py('import pathlib,json,hashlib;p=pathlib.Path('+repr(w.R+'/'+name)+');print(json.dumps(dict(bytes=p.stat().st_size,sha256=hashlib.file_digest(p.open("rb"),"sha256").hexdigest())))');m=json.loads(j['stdout']);assert m['bytes']<=2097152
 p=O/name
 with p.open('wb') as f:
  for off in range(0,m['bytes'],5000):
   j=w.py('import pathlib,base64;f=pathlib.Path('+repr(w.R+'/'+name)+').open("rb");f.seek('+str(off)+');print(base64.b64encode(f.read(5000)).decode())');f.write(base64.b64decode(j['stdout']))
 assert w.sha(p.read_bytes())==m['sha256'];print(str(p),flush=True)
elif sys.argv[1]=='input':
 c=json.loads(sys.argv[2]);w.save('input-'+str(time.time())+'.json',w.py('import urllib.request,json; b='+repr(json.dumps(c).encode())+';r=urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:18129/ctl",data=b,headers={"Content-Type":"application/json"}),timeout=15);print(r.read(8192).decode())'))
