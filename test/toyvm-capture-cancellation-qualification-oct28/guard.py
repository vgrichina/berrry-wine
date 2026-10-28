import pathlib,sys,os,importlib.util,json,datetime
B=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('trusted',str(B/'supervisor.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
name=sys.argv[1]
browser=name=='browser'
ledger=B/'runtime-ledger.json'
used=json.loads(ledger.read_text()) if ledger.exists() else {'cpu':0,'wall':0,'invocations':0}
if browser:
 assert used['invocations']==0,'one bounded browser differential only'
 used['invocations']+=1;ledger.write_text(json.dumps(used))
def check():
 if datetime.datetime.now(datetime.timezone.utc)>=datetime.datetime.fromisoformat('2026-10-28T21:22:00+00:00'):return 'cutoff'
 files=[p for p in B.rglob('*') if p.is_file()]
 if sum(p.stat().st_size for p in files)>128*1024**2:return 'remote128MiB'
 caps=[p for p in files if p.suffix=='.png']
 if len(caps)>1 or any(p.stat().st_size>1048576 for p in caps):return 'one remaining capture'
 if sum(p.stat().st_size for p in files if p.suffix in ('.stdout','.stderr'))>2*1024**2:return 'output2MiB'
 if any(p.stat().st_size>24*1024**2 for p in files):return 'perfile24MiB'
assert check() is None
r=m.supervise(['/usr/bin/python3',str(B/'stdio.py'),name],rss_limit=(1536 if browser else 512)*1024**2,cpu_limit=40.332009-used['cpu'] if browser else 90,wall_limit=103.079910343-used['wall'] if browser else 120,output_limit=2*1024**2,check=check)
data=r.pop('output');(B/(name+'-supervisor.stdout')).write_bytes(data)
if browser:used['cpu']+=r['cpuSeconds'];used['wall']+=r['wallSeconds'];ledger.write_text(json.dumps(used))
(B/(name+'-guard.json')).write_text(json.dumps(r,indent=2));print(json.dumps(r));sys.exit(1 if r['stopReason'] else r['exit'] or 0)
