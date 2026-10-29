from boat_control import *
l=json.loads((E/'lifecycle.json').read_text());box=l['box']
names=['remote-admission.json','invocation.json','fixture.py','cli.stdout','cli.stderr','live-observations.json','process-cleanup.json','qualification.json']
code='import pathlib,json,base64; root=pathlib.Path('+repr(str(E))+'); names='+repr(names)+'; print(json.dumps({n:base64.b64encode((root/n).read_bytes()).decode() for n in names if (root/n).exists()}))'
raw=api('boat-retain-failure-evidence',code,box=box,cwd=REPO);r=json.loads(raw);assert r['exitCode']==0
for n,b in json.loads(r['stdout']).items():(E/n).write_bytes(base64.b64decode(b))
print((E/'cli.stdout').read_text()[:5000]);print((E/'process-cleanup.json').read_text()[:3000])
# Explicitly delegated snapshot-stop, after evidence preservation.
raw=run('boat-snapshot-stop',[BOAT,'stop',box,'--json','--no-update'],cwd=REPO)
print(raw[:2200])
raw=run('boat-final-info',[BOAT,'info',box,'--json','--no-update'],cwd=REPO)
print(raw[:3500])
