import os,pathlib,json,datetime,sys
P=pathlib.Path(__file__).parent
old=json.loads((P/'admission.json').read_text())
manifest={str(p.relative_to(P)):p.stat().st_size for p in P.rglob('*') if p.is_file() and not p.is_symlink()}
external={}
paths=list(old['external'])
paths+=list(map(str,pathlib.Path('/home/user/.codex/sessions/2026/10/24').glob('*01a16d79-d783-7753-8df6-489472a79b99*')))
capture=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/madbomber-sdl-consumer-negative-closeout-oct24')
paths+=list(map(str,capture.rglob('*')))
for name in paths:
 p=pathlib.Path(name)
 if p.is_file():external[name]=p.stat().st_size
sqlite={p:max(0,os.path.getsize(p)-v) for p,v in old['sqliteBaseline'].items() if os.path.exists(p)}
own=sum(manifest.values()); charged=own+sum(external.values())+sum(sqlite.values())
allow={'futureOwned':4*1048576,'futureExternal':8*1048576,'futureSQLite':2*1048576,'reserve':8*1048576}
peak=charged+sum(allow.values());free=os.statvfs(P).f_bavail*os.statvfs(P).f_frsize
largest=max(list(manifest.items())+list(external.items()),key=lambda x:x[1])
verdict=peak<=67108864 and largest[1]<=25165824 and free-sum(allow.values())>=2982150144
r={'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'operation':sys.argv[1],'manifest':manifest,'own':own,'external':external,'historicalSQLiteBaseline':'admission.json sqliteBaseline (unchanged)','positiveSQLiteGrowth':sqlite,'allowance':allow,'charged':charged,'projectedPeak':peak,'limit':67108864,'largest':largest,'hostFree':free,'hostAfterIncrement':free-sum(allow.values()),'floor':2982150144,'verdict':'PASS' if verdict else 'DENIED','historicalDenialsPreserved':['resource-prepublication.json','capacity-reject-output.json','capacity-baseline.json'],'standingToolsInputs':old['standingInputs'],'ssh':old['ssh'],'captureBudget':{'initial':1048576,'added':1048576,'reason':'narrow retained source review and new full control/publication receipts; external full history separately charged'},'instructions':65536,'sourceExcerpt':8192}
(P/('closeout-resource-'+sys.argv[1]+'.json')).write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps({k:r[k] for k in ['operation','charged','projectedPeak','hostFree','hostAfterIncrement','largest','verdict']}))
sys.exit(0 if verdict else 1)
