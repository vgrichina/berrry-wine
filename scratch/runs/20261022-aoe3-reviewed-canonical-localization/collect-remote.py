
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
