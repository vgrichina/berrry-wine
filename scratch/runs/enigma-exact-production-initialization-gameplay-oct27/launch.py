from work import *
import datetime
assert (O/'remote-integrity.json').exists()
# Fresh local gate charges remaining allocation, avoiding charging already allocated task bytes twice.
used=allocated(H);free=shutil.disk_usage(H).free;mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
save('preguest-admission.json',dict(at=time.time(),free=free,measuredTask=used,remainingAllocation=62914560-used,peerFuture=50331648,projected=free-(62914560-used)-50331648,mem=mem,memRequired=1610612736))
assert free-(62914560-used)-50331648>=2982150144 and mem>=1610612736
transfer([('ops/operate.py',O/'operate.py')])
j=py('import pathlib,json,shutil,resource,socket; s=socket.socket(); s.bind(("127.0.0.1",18127));s.close();print(json.dumps(dict(mem=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,free=shutil.disk_usage("/tmp").free,limits={k:resource.getrlimit(getattr(resource,k)) for k in ["RLIMIT_DATA","RLIMIT_AS","RLIMIT_FSIZE","RLIMIT_CPU"]})))');save('remote-preguest-admission.json',j);v=json.loads(j['stdout']);assert v['mem']>=3758096384 and v['free']-268435456>=2982150144 and v['limits']['RLIMIT_DATA']==[-1,-1] and v['limits']['RLIMIT_AS']==[-1,-1]
save('launch-configuration.json',dict(at=time.time(),pid=3416360,argv=pathlib.Path('/proc/3416360/cmdline').read_bytes().decode().split('\0'),runtime=json.loads((ROOT/'scratch/usage-watch/enigma-exact-production-initialization-gameplay-oct27.task.runtime.json').read_text()),rootRefReceipt=str(ROOT/'scratch/usage-watch/enigma-exact-production-initialization-gameplay-oct27/root-ref-digest.json'),source='425755ee5ee9be0734c7aca187521100f5487674',module='af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b',guestInvocations=1))
print(remote('python3 '+R+'/ops/operate.py',detach=True),flush=True)
