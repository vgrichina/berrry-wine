from work import *
assert (H/'resource-ready.json').exists()
assert time.time()<1792844820,'no guest after latest12:27UTC'
a=measure('launch')
code='import os,json,pathlib,shutil;h=pathlib.Path('+repr(R)+');print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/tmp").free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,materialized=sum(p.stat().st_blocks*512 for p in [h,*h.rglob("*")]),largest=max(p.stat().st_size for p in h.rglob("*") if p.is_file()))))'
j=py(code);save('immediate-admission.json',j);i=json.loads(j['stdout']);assert i['uid']==1000 and i['memAvailable']>=2684354560 and i['free']-a['peak']>=2982150144 and i['largest']<=25165824
assert i['materialized']<=a['charges']['remoteMaterialized']+a['charges']['remoteHelpersEvidence']
env=json.load(open(H/'next-env.json'))
command='env '+' '.join(shlex.quote(k+'='+v) for k,v in env.items())+' python3 '+shlex.quote(R+'/supervise.py')+' guest && python3 -c '+shlex.quote('import pathlib;pathlib.Path('+repr(R+'/dependent-ran')+').write_text("ran")')
save('launch-command.json',dict(command=command,argv=json.load(open(H/'guest-args.json')),environment=env,box=BOX,expiry='2026-10-24T12:38:43Z',lifecycle='coordinator owns shutdown12:33UTC; leave RUNNING',limits=dict(arenaMiB=512,nodeHeapMiB=512,cpu=90,wall=60,runnerSeconds=55,output=131072)))
j=remote(command,75,allow_exit=True);save('guest-supervisor-api.json',j)
assert j['exitCode'] in [0,1], 'precise nonstandard guest exit retained'
print(json.dumps(dict(exitCode=j['exitCode'],stdout=j.get('stdout'),stderr=j.get('stderr'))))
