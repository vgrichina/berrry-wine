from work import *
from ledger import measure
E=pathlib.Path('/tmp/enigma-register-load-cause-oct24/repo/docs/re-notes/enigma-register-load-cause-evidence-20261024.json')
bindings=json.load(open('/tmp/enigma-authentic-static-unpack-oct24/module-bindings.json'));checked=[]
for b in bindings:
 for kind,p,expected,n in [('output',pathlib.Path(b['unpack']['argv'][3]),b['output_sha256'],b['output_bytes']),('input',pathlib.Path(b['test']['argv'][-1]),b['original']['sha256'],b['original']['size'])]:
  data=p.read_bytes();assert sha(data)==expected and len(data)==n;checked.append(dict(kind=kind,path=str(p),bytes=n,sha256=expected))
assert len(checked)==20 and sum(x['bytes'] for x in checked if x['kind']=='output')==7828992
assert sha(pathlib.Path('/tmp/enigma-authentic-static-unpack-oct24/outputs/enigma.exe').read_bytes())=='5885e29ac9c1bdfe7f36e0d7fba76a56b74bc99558e1e6debf8425febe35fa45'
save('twenty-pins.json',checked)
a=measure('launch')
j=py('import os,json,pathlib,shutil;h=pathlib.Path('+repr(str(H))+');print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/tmp").free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,materialized=sum(p.stat().st_blocks*512 for p in [h,*h.rglob("*")]),largest=max(p.stat().st_size for p in h.rglob("*") if p.is_file()))))');save('resource-immediate-api.json',j);info=json.loads(j['stdout']);assert info['uid']==1000 and info['free']-a['peak']>=2982150144 and info['memAvailable']>=2684354560 and info['largest']<=25165824
assert info['materialized']<=a['charges']['remoteMaterialized']+a['charges']['remoteHelpersEvidence']
save('guest-supervisor-api.json',remote('python3 '+shlex.quote(str(H/'supervise.py'))+' guest',75))
print(json.dumps(json.load(open(H/'guest-supervisor-api.json'))),flush=True)
