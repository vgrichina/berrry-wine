from work import *
root=pathlib.Path('/home/user/.codex')
def bytesof(p):return sum(x.stat().st_size for x in p.rglob('*') if x.is_file())
def account(label):
 baseline=json.load(open(H/'sqlite-baseline.json'))
 sessions=list(root.glob('sessions/2026/10/24/*01a16c65*'));assert len(sessions)==1
 launcher=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/penguin-immediate-shot-state-oct24')
 sqlite=sum(max(0,p.stat().st_size-baseline.get(str(p),0)) for p in root.glob('*.sqlite*') if p.is_file())
 j=py('import pathlib,os,json;h=pathlib.Path('+repr(R)+');print(json.dumps(dict(ownedBytes=sum(p.stat().st_size for p in h.rglob("*") if p.is_file()),maxFile=max(p.stat().st_size for p in h.rglob("*") if p.is_file()),free=os.statvfs("/tmp").f_bavail*os.statvfs("/tmp").f_frsize)))');save('resource-'+label+'-api.json',j);r=json.loads(j['stdout'])
 staged=json.load(open(H/'transfer-receipts.json'))
 api=[json.loads(x) for x in (H/'api-history.jsonl').read_text().splitlines()] if (H/'api-history.jsonl').exists() else []
 # Staging began before this supplemental ledger: count every transfer request,
 # all later API history (some conservatively double counted), plus1MiB for
 # earlier responses/probes/manifest transport not individually logged.
 transport=sum(x['requestBytes'] for x in staged)+sum(x['requestBytes']+x['responseBytes'] for x in api)+1048576
 charges=dict(localOwned=bytesof(H),remoteOwned=r['ownedBytes'],session=sessions[0].stat().st_size,externalLauncher=bytesof(launcher),positiveSQLite=sqlite,externalCLIHistory=transport,futureGitTransportSessionEvidence=12000000,reserve=8388608)
 peak=sum(charges.values());free=shutil.disk_usage('/tmp').free
 a=dict(at=time.time(),charges=charges,peak=peak,cap=67108864,localFree=free,localAfter=free-peak,remoteAfter=r['free']-peak,remote=r,historyRetained=True,internalCumulativeConservative=900000,captureCap=1048576,maxLocalFile=max(p.stat().st_size for p in H.rglob('*') if p.is_file()),passAdmission=peak<=67108864 and min(free-peak,r['free']-peak)>=2982150144)
 save('resource-'+label+'.json',a);assert a['passAdmission'] and max(a['maxLocalFile'],r['maxFile'])<=25165824
 print(json.dumps(dict(peak=peak,charges=charges,passAdmission=True)))
if __name__=='__main__':account(os.sys.argv[1])
