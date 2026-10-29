from boat_control import *
l=json.loads((E/'lifecycle.json').read_text());box=l['box'];d=json.loads(DP.read_text())
files={n:base64.b64encode((REPO/n).read_bytes()).decode() for n in d['sourcePins']}
pin=d['originalCancellationReceiptPin'];b=pathlib.Path(d['originalCancellationReceipt']).read_bytes();assert hashlib.sha256(b).hexdigest()==pin['sha256']
files[str((E/'cancellation-receipt.json').relative_to(REPO))]=base64.b64encode(b).decode()
files[str((E/'remote_test.py').relative_to(REPO))]=base64.b64encode((E/'remote_test.py').read_bytes()).decode()
code='import pathlib,base64,json,os,hashlib; root=pathlib.Path('+repr(str(REPO))+'); root.mkdir(parents=True); files='+repr(files)+'; [( (root/n).parent.mkdir(parents=True,exist_ok=True),(root/n).write_bytes(base64.b64decode(b))) for n,b in files.items()]; print(json.dumps({n:dict(bytes=(root/n).stat().st_size,sha256=hashlib.sha256((root/n).read_bytes()).hexdigest()) for n in files}))'
raw=api('boat-stage',code,box=box,cwd='/home/user');response=json.loads(raw);assert response['exitCode']==0;remotePins=json.loads(response['stdout'])
for n,p in d['sourcePins'].items():assert remotePins[n]==p
save('remote-source-pins.json',remotePins)
cmd=shlex.join(['/usr/bin/python3','-B',str(E/'remote_test.py')])
raw=run('boat-real-cli',[BOAT,'exec',box,'--cwd',str(REPO),'--timeout','30','--json','--',cmd],cwd=REPO)
r=json.loads(raw);save('api-runtime-result.json',r);print(json.dumps(r)[:6000])
# Fetch only known evidence regardless of a genuine correctness rejection.
names=['remote-admission.json','invocation.json','fixture.py','cli.stdout','cli.stderr','live-observations.json','process-cleanup.json','qualification.json']
code='import pathlib,json,base64; root=pathlib.Path('+repr(str(E))+'); names='+repr(names)+'; print(json.dumps({n:base64.b64encode((root/n).read_bytes()).decode() for n in names if (root/n).exists()}))'
raw=api('boat-evidence',code,box=box,cwd=REPO);rr=json.loads(raw);assert rr['exitCode']==0
for n,b in json.loads(rr['stdout']).items(): (E/n).write_bytes(base64.b64decode(b))
print('evidence retained')
