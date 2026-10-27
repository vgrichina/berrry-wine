import pathlib,json,os,shutil,time
O=pathlib.Path(__file__).parent;H=O.parent;ROOT=pathlib.Path('/home/user/wine-assembly');ep=ROOT/'scratch/usage-watch'/H.name
def alloc(p):
 if not p.exists():return 0
 return sum(q.lstat().st_blocks*512 for q in ([p,*p.rglob('*')] if p.is_dir() else [p]) if not q.is_symlink())
b=json.loads(pathlib.Path('/tmp/gta2-retained-directdraw-causal-trace-oct27/ops/baseline.json').read_text())
wal=sum(max(0,alloc(pathlib.Path(p))-n) for p,n in b['wal'].items())
with (ep/'events.jsonl').open() as f:tid=json.loads(next(f))['thread_id']
sessions=sum(alloc(p) for p in pathlib.Path('/home/user/.codex/sessions/2026/10/27').glob('*'+tid+'*'))
used=alloc(H)+alloc(ep)+sessions+wal
v=dict(at=time.time(),tree=alloc(H),eventsAndLauncher=alloc(ep),sessions=sessions,conservativePositiveWALOnce=wal,baseline='predecessor baseline; conservatively includes intervening positive growth',actual=used,allocation=335544320,reserve=33554432,publicationAndFutureGrowth=67108864,standingSourceModulesNewCopiedBytes=0,localSourceTreeCopies=0,remoteAllocation=1073741824,remoteProjection=440297036,remoteReserve=67108864,remoteCaptureReserve=4*4194304,fullPNGTransfersPlanned=0,traceTextTransferEnvelope=2097152,rawAllowance=8388608,terminalReserve=1048576,free=shutil.disk_usage(H).free,projectedFree=shutil.disk_usage(H).free-1006632960,diskFloor=2982150144)
v['pass']=used+v['reserve']+v['publicationAndFutureGrowth']<=v['allocation'] and v['projectedFree']>=v['diskFloor']
(O/('allocation-'+str(time.time_ns())+'.json')).write_text(json.dumps(v,indent=2));print(json.dumps(v));assert v['pass']
