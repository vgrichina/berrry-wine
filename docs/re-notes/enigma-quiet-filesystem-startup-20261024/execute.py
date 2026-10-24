from work import *
assert (H/'resource-ready.json').exists()
a=measure('launch')
code='import os,json,pathlib,shutil;h=pathlib.Path('+repr(R)+');print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/tmp").free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,materialized=sum(p.stat().st_blocks*512 for p in [h,*h.rglob("*")]),largest=max(p.stat().st_size for p in h.rglob("*") if p.is_file()))))'
j=py(code);save('immediate-admission.json',j);i=json.loads(j['stdout']);assert i['uid']==1000 and i['memAvailable']>=2684354560 and i['free']-a['peak']>=2982150144 and i['largest']<=25165824
assert i['materialized']<=a['charges']['remoteMaterialized']+a['charges']['remoteHelpersEvidence']
save('guest-supervisor-api.json',remote('python3 '+shlex.quote(R+'/supervise.py')+' guest',75));print(json.dumps(json.load(open(H/'guest-supervisor-api.json'))))
