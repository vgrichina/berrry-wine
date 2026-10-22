import pathlib,subprocess,json,time
r=pathlib.Path('/home/user/aoe3-oleaut-repair-oct22'); e=r/'evidence'; e.mkdir(exist_ok=True)
files=['lib/host-imports.js','src/01-header.wat']; candidate={p:(r/p).read_bytes() for p in files}
results=[]
def run(label,args):
 start=time.time(); p=subprocess.run(args,cwd=r,capture_output=True,text=True,timeout=240); out=e/(label+'.log')
 if out.exists():out.rename(e/(label+'-prior.log'))
 out.write_text(p.stdout+'\n'+p.stderr); results.append(dict(label=label,exit=p.returncode,seconds=time.time()-start)); print(label,p.returncode,p.stdout[-2200:],p.stderr[-1500:],flush=True); return p.returncode
try:
 for p in files:(r/p).write_bytes((r/'baseline-inputs'/p).read_bytes())
 rc=run('baseline',['node','test/test-oleaut32-ordinals.js','--expect-baseline'])
finally:
 for p in files:(r/p).write_bytes(candidate[p])
if rc==0:rc=run('candidate',['node','test/test-oleaut32-ordinals.js'])
(e/'test-results.json').write_text(json.dumps(results,indent=2))
raise SystemExit(rc)
