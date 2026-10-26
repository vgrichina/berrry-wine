from work import *
assert json.loads((O/'remote-assets-verified.json').read_text())['exitCode']==0
remoteInfo=py('import pathlib,json,shutil;h=pathlib.Path('+repr(R)+');print(json.dumps(dict(allocated=sum(p.lstat().st_blocks*512 for p in [h,*h.rglob("*")]),memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,diskFree=shutil.disk_usage(h).free)))');save('remote-preguest.json',remoteInfo);ri=json.loads(remoteInfo['stdout'])
base=json.loads((O/'sqlite-baseline.json').read_text());wal=sum(max(0,allocated(pathlib.Path(p))-v) for p,v in base.items());L=ROOT/'scratch/usage-watch/alien-shooter-current-gameplay-api-oct26';session=next(pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+os.environ['CODEX_THREAD_ID']+'.jsonl'))
charges=dict(localOwned=allocated(H),remoteOwned=ri['allocated'],remoteGuestLogs=1310720,remoteCaptures=1048576,localEvidence=1048576,publicationGit=1048576,launcher=allocated(L)+sum(allocated(p) for p in L.parent.glob(L.name+'.*')),session=allocated(session),positiveWAL=wal,futureSessionEventsWAL=2097152,reserve=8388608)
total=sum(charges.values());free=shutil.disk_usage(H).free
gate=dict(at=time.time(),charges=charges,total=total,cap=67108864,projectedHostFree=free-4194304,hostFloor=2982150144,remote=ri,helperRSSCap=67108864,workerClientReserve=268435456,passGate=total<=67108864 and free-4194304>=2982150144 and ri['memAvailable']>=3758096384)
save('admission-preguest.json',gate);print(json.dumps(gate),flush=True);assert gate['passGate'],'FULL RESOURCE GATE before guest'
save('guest-detach.json',remote('python3 '+shlex.quote(R+'/supervisor.py')+' guest',detach=True));save('guest-started.json',dict(at=time.time()));print('GUEST STARTED',flush=True)
