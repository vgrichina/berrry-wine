from common import *
p=H/'runner/test/run.js';s=p.read_text();old='live:{eip:e.get_eip()>>>0,eax:e.get_eax()>>>0,esp:e.get_esp()>>>0}';assert s.count(old)==1
s=s.replace(old,'live:Object.fromEntries(["eip","eax","ebx","ecx","edx","esi","edi","esp","ebp"].map(k=>[k,e["get_"+k]()>>>0]))');p.write_text(s)
rows=json.load(open(H/'manifest.json'));r=next(r for r in rows if r['target']=='runner/test/run.js');r.update(bytes=p.stat().st_size,sha256=sha(p.read_bytes()));save('../manifest.json',rows)
save('final-runner-transfer.json',dict(diagnosticOnly=True,runnerSHA256=r['sha256'],transfers=[put(p,p),put(H/'manifest.json',H/'manifest.json')]))
j=remote('cd '+shlex.quote(str(H))+' && node --max-old-space-size=512 validate-tree.cjs');save('mount-actual-final-api.json',j)
print(json.dumps(dict(ready=True,runnerSHA256=r['sha256'])))
