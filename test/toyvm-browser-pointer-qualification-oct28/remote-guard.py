import pathlib,sys,os,importlib.util,json,resource,datetime
B=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('trusted',str(B/'supervisor.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
name,*argv=sys.argv[1:]
def check():
 if datetime.datetime.now(datetime.timezone.utc)>=datetime.datetime.fromisoformat('2026-10-28T21:10:00+00:00'): return 'authoritative guest cutoff'
 files=list(B.rglob('*'))
 if sum(p.stat().st_size for p in files if p.is_file())>24*1024**2:return 'artifact cap'
 caps=list(B.glob('*.png'))
 if len(caps)>8 or any(p.stat().st_size>1048576 for p in caps) or sum(p.stat().st_size for p in caps)>8388608:return 'capture cap'
 return None
assert check() is None
result=m.supervise(argv,rss_limit=1536*1024**2,cpu_limit=90,wall_limit=120,output_limit=2*1024**2,check=check)
data=result.pop('output');(B/(name+'.stdout')).write_bytes(data);(B/(name+'.json')).write_text(json.dumps(result,indent=2));print(json.dumps(result));print(data[:5000].decode(errors='replace'));sys.exit(1 if result['stopReason'] else result['exit'] or 0)
