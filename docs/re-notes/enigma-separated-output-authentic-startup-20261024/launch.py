from work import *
assert not (H/'guest-attempt.json').exists(),'one guest only'
assert time.time()<1792854960,'latest guest start15:16UTC'
j=py('import os,json,pathlib,shutil;h=pathlib.Path('+repr(R)+');print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/tmp").free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,materialized=sum(p.lstat().st_blocks*512 for p in [h,*h.rglob("*")]),largest=max(p.stat().st_size for p in h.rglob("*") if p.is_file()))))')
save('resource-immediate-api.json',j);save('remote-admission.json',j);info=json.loads(j['stdout'])
a=measure('immediate-before-guest')
assert info['uid']==1000 and info['free']-a['peak']>=2982150144 and info['memAvailable']>=2684354560 and info['largest']<=25165824
assert info['materialized']<=a['charges']['remoteMaterialized']+a['charges']['remoteHelpersEvidence']
env=json.load(open(H/'next-env.json'));assert env['ENIGMA_LOSSLESS_CAPTURE']=='1'
cmd='env '+' '.join(shlex.quote(k+'='+v) for k,v in env.items())+' python3 '+shlex.quote(R+'/supervise.py')+' guest && python3 -c '+shlex.quote('import pathlib;pathlib.Path('+repr(R+'/guest/dependent-after-supervisor')+').write_text("supervisor exited zero")')
save('guest-attempt.json',dict(at=time.time(),guestAttempts=1,command=cmd,box=BOX,acceptedSuitesReused=6,configuration='FTQ then unchanged original capture',limits='unchanged original schedule max10000000/55s firstPNG30000 screen640x480'))
save('guest-supervisor-api.json',remote(cmd,75,allow_exit=True))
print('ONE GUEST FINISHED; raw remote supervisor response retained')
