import os,sys,json,time,resource,importlib.util
from pathlib import Path
P=Path('/home/user/madbomber-restart-oct27');sys.dont_write_bytecode=True
s=importlib.util.spec_from_file_location('sup',P/'supervisor.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
os.environ.clear();os.environ.update(json.loads((P/'environment.json').read_text()))
def check():
 used=sum(p.stat().st_blocks*512 for p in [P,*P.rglob('*')] if p.exists())
 png=list((P/'out').glob('*.png'));logs=list((P/'out').glob('*.log'))+list((P/'out').glob('*.jsonl'))
 if used>100663296-8388608:return '96MiB disk allocation reserve'
 if len(png)>8 or sum(p.stat().st_size for p in png)>16777216:return 'capture cap'
 if sum(p.stat().st_size for p in logs)>2097152:return 'text log cap'
 if int(Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024<2684354560:return 'physical headroom'
 return None
mode=sys.argv[1]
node='/home/user/.nvm/versions/node/v24.22.1/bin/node';flags=['--max-old-space-size=512']
startup="const f=require('fs');console.log(JSON.stringify({execPath:process.execPath,flags:process.execArgv.slice(0,1),limits:f.readFileSync('/proc/self/limits','utf8'),node:process.version,env:process.env}));"
argv=[node,*flags,'-e',startup] if mode=='startup' else [node,*flags,str(P/'controller.js')]
assert check() is None
r=m.supervise(argv,rss_limit=2147483648,cpu_limit=150,wall_limit=150,output_limit=2097152,check=check);b=r.pop('output');(P/(mode+'-supervision.json')).write_text(json.dumps(r,indent=2));(P/(mode+'-supervision.log')).write_bytes(b)
print(json.dumps(r));print(b.decode()[:8192]);assert not r['stopReason'] and r['exit']==0
