from ops import *
import shlex,base64
box=json.loads((E/'lifecycle.json').read_text())['box']
code="import pathlib,json,base64; r=pathlib.Path('/tmp/tvdr'); names=['prelaunch.json','result.json','cli.stdout','cli.stderr']; assert sum((r/n).stat().st_size for n in names)<1048576; print(json.dumps({n:base64.b64encode((r/n).read_bytes()).decode() for n in names}))"
rc,out,err=run(['/home/user/.ascii/boat','exec',box,'--cwd','/tmp/tvdr/repo','--timeout','30','--json','--',shlex.join(['/usr/bin/python3','-B','-c',code])],cwd=REPO,name='preserve',timeout=60)
assert rc==0
api=json.loads(out);assert api['exitCode']==0 and not api['stdoutTruncated']
raw=json.loads(api['stdout'])
for name,b64 in raw.items():(E/('remote-'+name)).write_bytes(base64.b64decode(b64))
r=json.loads((E/'remote-result.json').read_text());assert r['gatePASS'] and r['productionInvocations']==1
api0=json.loads((E/'runtime.stdout').read_text());assert json.loads(api0['stdout'])==r
pre=json.loads((E/'remote-prelaunch.json').read_text());assert pre['socketBytes']==23
record('retention',dict(PASS=True,box=box,files={n:dict(bytes=len(base64.b64decode(v)),sha256=hashlib.sha256(base64.b64decode(v)).hexdigest()) for n,v in raw.items()}))
rc,out,err=run(['/home/user/.ascii/boat','stop','--help'],cwd=OWN,name='stop-help',timeout=20)
print(out[:5000]);assert rc==0
