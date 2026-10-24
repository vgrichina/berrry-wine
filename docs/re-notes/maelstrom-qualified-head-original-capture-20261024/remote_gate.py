from transport import *
import shlex
code='''
import pathlib,json,os,re,shutil,time,hashlib
h=pathlib.Path(ROOT);m=json.loads((h/'manifest.json').read_text())
bad=[x['target'] for x in m if (h/x['target']).stat().st_size!=x['bytes'] or hashlib.sha256((h/x['target']).read_bytes()).hexdigest()!=x['sha256']]
files=[p for p in h.rglob('*') if p.is_file()]
owned=sum(max(p.stat().st_size,p.stat().st_blocks*512) for p in files)
free=shutil.disk_usage('/tmp').free;mem=int(re.search(r'MemAvailable:\\s+(\\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
result=dict(at=time.time(),uid=os.getuid(),free=free,afterProjected=free-67108864,memAvailable=mem,ownedBytes=owned,maxFile=max(p.stat().st_size for p in files),manifestFiles=len(m),bad=bad)
result['pass']=not bad and result['uid']==1000 and free-67108864>=2982150144 and mem>=2684354560 and result['maxFile']<=25165824 and owned<=19000000
(h/'fresh-admission.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));assert result['pass']
'''.replace('ROOT',repr(str(H)))
save('fresh-remote-admission-api.json',remote('python3 -c '+shlex.quote(code)))
