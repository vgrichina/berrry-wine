import pathlib,subprocess,json,time,hashlib
r=pathlib.Path('/home/user/aoe3-oleaut-repair-oct22'); e=r/'evidence'; original=pathlib.Path('/home/user/aoe3-original-oct22')
def pins(label):
 rows=[]
 for root,entries in [(original/'runtime',json.loads((original/'runtime-pins.json').read_text())),(original/'installed',json.loads((original/'installed-audit/installed-manifest.json').read_text())['files'])]:
  for x in entries:
   p=root/x['path']; ok=p.stat().st_size==x['size'] and hashlib.file_digest(p.open('rb'),'sha256').hexdigest()==x['sha256'];rows.append(dict(path=str(p),ok=ok));assert ok,p
 (e/(label+'.json')).write_text(json.dumps(rows,indent=2)); print(label,len(rows),'PASS',flush=True)
def run(label,cmd,timeout=240):
 start=time.time();p=subprocess.run(cmd,cwd=r,capture_output=True,text=True,timeout=timeout);(e/(label+'.log')).write_text(p.stdout+'\n'+p.stderr);item=dict(label=label,cmd=cmd,exit=p.returncode,seconds=time.time()-start);print(json.dumps(item),p.stdout[-1700:],p.stderr[-1000:],flush=True);return item
pins('original-pins-before')
results=[]
# Matching final test/harness on both source revisions.
files=['lib/host-imports.js','src/01-header.wat']; candidate={p:(r/p).read_bytes() for p in files}
try:
 for p in files:(r/p).write_bytes((r/'baseline-inputs'/p).read_bytes())
 results.append(run('baseline-final',['node','test/test-oleaut32-ordinals.js','--expect-baseline']))
finally:
 for p in files:(r/p).write_bytes(candidate[p])
assert results[-1]['exit']==0
for name in ['test-oleaut32-ordinals','test-directx-ordinals','test-directsound-ordinals','test-bstr-byte-length','test-bstr-reallocation','test-getprocaddress-sparse-name','test-dynamic-module-filename','test-loadlibrary-system-path','test-kernel32-image']:
 results.append(run(name,['node','test/'+name+'.js']))
 if results[-1]['exit']!=0:break
(e/'validation-results.json').write_text(json.dumps(results,indent=2))
if all(x['exit']==0 for x in results):
 # This is the only canonical build attempt; build.sh owns every gate.
 result=run('canonical-build',['bash','tools/build.sh'],timeout=420)
 (e/'build-result.json').write_text(json.dumps(result,indent=2))
 artifacts=[]
 for p in (r/'build').glob('*'):
  if p.is_file():artifacts.append(dict(path=str(p),bytes=p.stat().st_size,sha256=hashlib.file_digest(p.open('rb'),'sha256').hexdigest()))
 (e/'build-artifacts.json').write_text(json.dumps(artifacts,indent=2))
pins('original-pins-after')
