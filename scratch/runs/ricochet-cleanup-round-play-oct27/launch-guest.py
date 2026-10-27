import pathlib,json,subprocess,time,shutil,resource
h=pathlib.Path('/tmp/ricochet-cleanup-round-play-oct27');s=json.loads((h/'startup/supervision.json').read_text());assert s['exit']==0 and not s['stopReason'] and s['cleanupComplete'];assert not (h/'guest').exists()
v=dict(at=time.time(),mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024,free=shutil.disk_usage(h).free,allocated=sum(p.stat().st_blocks*512 for p in h.rglob('*') if p.is_file()),limits={str(k):resource.getrlimit(k) for k in [resource.RLIMIT_AS,resource.RLIMIT_DATA,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE]})
(h/'before-guest.json').write_text(json.dumps(v));assert v['mem']>=4563402752 and v['free']-max(0,268435456-v['allocated'])>=2982150144 and v['allocated']<=268435456 and time.time()+130<1793092500
# This API command waits only to confirm startup; detached owned supervisor keeps lifetime.
p=subprocess.Popen(['python3','-S',str(h/'remote-supervisor.py'),'guest'],stdout=open(h/'guest-supervisor.stdout','wb'),stderr=open(h/'guest-supervisor.stderr','wb'),start_new_session=True)
print(json.dumps(dict(supervisorPID=p.pid,start=time.time(),state='STARTING',noReplay=True)))
