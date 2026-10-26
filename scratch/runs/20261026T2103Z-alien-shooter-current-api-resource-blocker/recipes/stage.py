from work import *
s=json.loads((ROOT/'scratch/usage-watch/civ2-win16-pinned-inputs-oct26.json').read_text());f=json.loads((ROOT/'scratch/usage-watch/alien-shooter-current-gameplay-api-oct26-inputs.json').read_text());S=pathlib.Path(s['source'])
runtime=json.loads((O/'runtime-source.json').read_text());extras=json.loads((O/'extras.json').read_text())+['test/binaries/tlbs/stdole2.tlb']
fixture=[(x['path'],ROOT/x['path']) for x in f['files']]+[('test/binaries/candidates/reflexive-alien-shooter/.wine-assembly-browser.json',ROOT/'test/binaries/candidates/reflexive-alien-shooter/.wine-assembly-browser.json')]
np=pathlib.Path('/tmp/wa-local-runtime-deps/node_modules/pngjs');deps=[('node_modules/pngjs/'+str(p.relative_to(np)),p) for p in np.rglob('*') if p.is_file()]
extra=[(p,ROOT/p) for p in extras]
payload=[(x['path'],S/x['path']) for x in runtime]+fixture+extra+deps
save('runtime-manifest.json',[dict(path=t,bytes=p.stat().st_size,sha256=hashlib.file_digest(p.open('rb'),'sha256').hexdigest(),mode=p.stat().st_mode&0o777) for t,p in payload])
def roundup(n):return ((n+4095)//4096)*4096
remoteRuntime=sum(roundup(p.stat().st_size) for t,p in payload)+1884160+262144+2097152
remoteCompile=s['sourceAllocated']+1884160+262144
session=next(pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+os.environ['CODEX_THREAD_ID']+'.jsonl'))
L=ROOT/'scratch/usage-watch/alien-shooter-current-gameplay-api-oct26'
base=json.loads((O/'sqlite-baseline.json').read_text());wal=sum(max(0,allocated(pathlib.Path(p))-v) for p,v in base.items())
charges=dict(remotePeak=max(remoteCompile,remoteRuntime),localOwned=allocated(H),session=allocated(session),launcher=allocated(L)+sum(allocated(p) for p in L.parent.glob(L.name+'.*')),positiveWAL=wal,publicationGit=1048576,futureSessionEventsWAL=2097152,reserve=8388608)
free=shutil.disk_usage(H).free;total=sum(charges.values());localgrowth=charges['publicationGit']+charges['futureSessionEventsWAL']+1048576
j=dict(at=time.time(),charges=charges,total=total,cap=67108864,localFree=free,projectedLocalFree=free-localgrowth,localFloor=2982150144,remoteCompile=remoteCompile,remoteRuntime=remoteRuntime,passGate=total<=67108864 and free-localgrowth>=2982150144)
save('admission-prestage-capture2MiB.json',j);print(json.dumps(j),flush=True)
assert j['passGate'],'FULL RESOURCE ADMISSION FAILED before staging/compile/guest'
save('trusted-ssh-config.json',dict(command=SSH,rootRefReceipt=json.loads((L/'root-ref-digest.json').read_text())))
j=py('import pathlib,json,shutil,os;print(json.dumps(dict(uid=os.getuid(),memory=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,disk=shutil.disk_usage("/tmp").free)))');save('remote-admission.json',j);r=json.loads(j['stdout']);assert r['memory']>=3758096384 and r['disk']-remoteRuntime>=2982150144
remote('test ! -e '+shlex.quote(R)+' && mkdir '+shlex.quote(R))
transfer([('runner/'+x['path'],S/x['path']) for x in s['files']]);print('SOURCE STAGED',flush=True)
save('compile-staged.json',py('import pathlib,json,hashlib;h=pathlib.Path('+repr(R+'/runner')+');print(json.dumps(dict(files=sum(p.is_file() for p in h.rglob("*")),allocated=sum(p.stat().st_blocks*512 for p in h.rglob("*") if p.is_file()))))'))
