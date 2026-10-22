import pathlib,io,tarfile,json
from remote import *
S=pathlib.Path('/home/user/wine-assembly-shadow-man-original-source-oct22/scratch/runs/20261022-shadow-man-original-source')
buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w:gz') as t:
 for n in ['recover-source.sh','verify.py','probe.py','closure.json','listing-Demos-Shadowman.json']:
  t.add(S/n,arcname=n)
 for p in (S/'ranges').glob('*'):
  if p.is_file():t.add(p,arcname=p.relative_to(S))
transfer(buf.getvalue(),'receipts.tar.gz')
run('import tarfile;tarfile.open(%r).extractall(%r,filter="data")'%(REMOTE+'/receipts.tar.gz',REMOTE+'/receipt'),'receipt-stage-api.json')
code='import subprocess,pathlib,json;R=pathlib.Path(%r);p=subprocess.run(["bash",str(R/"receipt/recover-source.sh"),"--coordinator-assigned-remote",str(R/"recovery")],stdout=(R/"recovery.log").open("w"),stderr=subprocess.STDOUT);(R/"recovery-exit.json").write_text(json.dumps(dict(exitCode=p.returncode)));print(p.returncode);raise SystemExit(p.returncode)'%REMOTE
# API command may take minutes; independent CLI outer process yields to caller.
r=run(code,'recovery-api.json',600)
print(r)
