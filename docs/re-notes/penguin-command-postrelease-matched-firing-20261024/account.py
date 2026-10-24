from work import *
root=pathlib.Path('/home/user/.codex')
baseline=json.load(open(H/'sqlite-baseline.json'))
def bytesof(p):return sum(x.stat().st_size for x in p.rglob('*') if x.is_file())
def account(label):
 local=bytesof(H);session=next(root.glob('sessions/2026/10/24/*01a16c4f*')).stat().st_size
 launcher=bytesof(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/penguin-postrelease-matched-firing-oct24'))
 sqlite=sum(max(0,p.stat().st_size-baseline.get(str(p),0)) for p in root.glob('*.sqlite*') if p.is_file())
 j=py('import pathlib,os,json;h=pathlib.Path('+repr(R)+');s=pathlib.Path('+repr(S)+');print(json.dumps(dict(ownedBytes=sum(p.stat().st_size for p in h.rglob("*") if p.is_file()),standingBytes=sum(p.stat().st_size for p in s.rglob("*") if p.is_file()),free=os.statvfs("/tmp").f_bavail*os.statvfs("/tmp").f_frsize,maxFile=max(p.stat().st_size for p in h.rglob("*") if p.is_file()))))');save('resource-'+label+'-api.json',j);r=json.loads(j['stdout'])
 charges=dict(localOwned=local,remoteOwned=r['ownedBytes'],session=session,externalLauncher=launcher,positiveSQLite=sqlite,futureTransportSessionGit=12000000,reserve=8388608)
 peak=sum(charges.values());free=shutil.disk_usage('/tmp').free
 a=dict(at=time.time(),charges=charges,peak=peak,cap=67108864,localFree=free,localAfter=free-peak,remoteAfter=r['free']-peak,remote=r,priorAllocation=json.load(open(OLD/'resource-final.json')),sharedPeakIncludingPriorHistoricalAllocation=peak+59518101,historyRetained=True,captureTextConservative=900000,captureTextCap=1048576,maxLocalFile=max(p.stat().st_size for p in H.rglob('*') if p.is_file()),passAdmission=peak<=67108864 and min(free-peak,r['free']-peak)>=2982150144)
 save('resource-'+label+'.json',a);assert a['passAdmission'];assert a['maxLocalFile']<=25165824 and r['maxFile']<=25165824
 print(json.dumps(dict(peak=peak,charges=charges,localAfter=a['localAfter'],standingBytes=r['standingBytes'],passAdmission=a['passAdmission'])))
if __name__=='__main__':account(os.sys.argv[1])
