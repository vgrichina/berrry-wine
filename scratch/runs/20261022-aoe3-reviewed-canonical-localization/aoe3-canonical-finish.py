import pathlib,json,subprocess,hashlib,os
R=pathlib.Path('/home/user/wine-assembly-aoe3-reviewed-canonical-localization-oct22');E=R/'scratch/runs/20261022-aoe3-reviewed-canonical-localization'
x=json.loads((E/'canonical-build-receipt.json').read_text());assert x['exitCode']==0 and not x['stdoutTruncated'];b=json.loads(x['stdout']);assert b['result']['exit']==1 and b['result']['module'] is None
(E/'build-result.json').write_text(json.dumps(b['result'],indent=2)+'\n');(E/'build.log').write_text(b['log'])
code=r'''
import pathlib,json,hashlib,socket,subprocess,os
r=pathlib.Path('/home/user/aoe3-oleaut-repair-oct22');o=pathlib.Path('/home/user/aoe3-original-oct22')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
paths=[o/'runtime-pins.json',o/'installed-audit/installed-manifest.json',o/'runner/test/run.js',o/'runner/build/wine-assembly.wasm',r/'lib/host-imports.js',r/'tools/callback-ownership-census.json',r/'tools/build.sh']
files=[dict(path=str(p),exists=p.exists(),sha256=sha(p) if p.is_file() else None,bytes=p.stat().st_size if p.is_file() else None) for p in paths]
ports={}
for port in [8123,8124]:
 s=socket.socket();ports[str(port)]=s.connect_ex(('127.0.0.1',port));s.close()
ps=subprocess.check_output(['ps','-eo','pid,comm,args'],text=True);processes=[s for s in ps.splitlines() if len(s.split())>1 and s.split()[1] in ['node','chrome','chromium','google-chrome']]
print(json.dumps(dict(files=files,ports=ports,runtimeProcesses=processes,freeBytes=os.statvfs(r).f_bavail*os.statvfs(r).f_frsize,censusRecord=[x for x in json.loads((r/'tools/callback-ownership-census.json').read_text())['entries'] if x['file']=='lib/host-imports.js'],sourceManifest=json.loads((r/'evidence/canonical-qualification-20261022T1226Z/source-manifest.json').read_text()))))
'''
(E/'collect-remote.py').write_text(code)
p=subprocess.run(['boat','exec','--json','--timeout','30','bx_32262dnp','--','python3','-c',code],capture_output=True,text=True);(E/'handback-receipt.json').write_text(p.stdout);j=json.loads(p.stdout);assert j['exitCode']==0 and not j['stdoutTruncated'];j=json.loads(j['stdout']);(E/'source-manifest.json').write_text(json.dumps(j.pop('sourceManifest'),indent=2)+'\n');(E/'runtime-handback.json').write_text(json.dumps(j,indent=2)+'\n');print(json.dumps(j,indent=2))
p=subprocess.run(['boat','--json','info','bx_32262dnp'],capture_output=True,text=True);assert p.returncode==0;(E/'box-state.json').write_text(p.stdout)
root=pathlib.Path('/home/user/wine-assembly');before=json.loads((E/'root-before.json').read_text());after={p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() for p in before};assert before==after;(E/'root-seals.json').write_text(json.dumps(dict(before=before,after=after,passed=True),indent=2))
(E/'failure-ledger.json').write_text(json.dumps(dict(canonicalBuildAttempts=1,canonicalBuildFailures=1,guestRuns=0,failedGuestStartups=0,localPreparationFailures=[dict(kind='E2BIG shell argument limit',count=2,remoteCommandStarted=False,resolution='batched 400-row manifest comparisons')],optionalMissingInspection='~/.ssh/config absent; dedicated trust/key found in donor git config; no SSH runtime attempt',repairs=0,secondBuildAttempts=0),indent=2))
# Actual remote refs; read-only HTTPS, independent from borrowed local refs.
p=subprocess.run(['git','ls-remote','https://github.com/vgrichina/berrry-wine.git','refs/heads/main','refs/heads/task/aoe3-oleaut-independent-sparse-review-oct22'],capture_output=True,text=True);assert p.returncode==0;(E/'refs-after-build.txt').write_text(p.stdout)
print(p.stdout)
