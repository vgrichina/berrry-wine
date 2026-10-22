import pathlib,subprocess,json,hashlib,os
E=pathlib.Path(__file__).resolve().parent
code=r'''
import pathlib,json,hashlib,socket,subprocess,os
root=pathlib.Path('/home/user/aoe3-independent-review-oct22');r=root/'candidate';o=pathlib.Path('/home/user/aoe3-original-oct22');src=pathlib.Path('/home/user/aoe3-oleaut-repair-oct22')
def identity(r):
 paths=[p for d in ['src','lib','tools'] for p in (r/d).rglob('*') if p.is_file()]+[r/'test/test-oleaut32-ordinals.js']
 rows=sorted([dict(path=str(p.relative_to(r)),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size) for p in paths],key=lambda x:x['path'])
 return dict(files=len(rows),sha256=hashlib.sha256(''.join(x['path']+'\0'+x['sha256']+'\n' for x in rows).encode()).hexdigest())
ident={k:identity(v) for k,v in [('candidate',r),('retainedCandidate',src)]}
assert all(x['files']==1078 and x['sha256']=='ce23f23ed7fcd525e2e4b4b1afa4d8eeacdb344fc7ca25903e3f78b45eaa9305' for x in ident.values()),ident
pins=[]
for base,entries in [(o/'runtime',json.loads((o/'runtime-pins.json').read_text())),(o/'installed',json.loads((o/'installed-audit/installed-manifest.json').read_text())['files'])]:
 for x in entries:
  p=base/x['path'];ok=p.stat().st_size==x['size'] and hashlib.sha256(p.read_bytes()).hexdigest()==x['sha256'];assert ok; pins.append(dict(path=str(p),ok=ok))
ports={}
for port in [8123,8124]:
 s=socket.socket();ports[str(port)]=s.connect_ex(('127.0.0.1',port));s.close()
ps=subprocess.check_output(['ps','-eo','pid,comm,args'],text=True)
# Only executable command names; exclude this inspection's embedded script text.
processes=[s for s in ps.splitlines() if len(s.split())>1 and s.split()[1] in ['node','chrome','chromium','google-chrome']]
out=dict(identity=ident,pins=pins,ports=ports,taskRuntimeProcesses=processes,freeBytes=os.statvfs(r).f_bavail*os.statvfs(r).f_frsize,fixtureSHA256=hashlib.sha256((r/'test/test-getprocaddress-sparse-name.js').read_bytes()).hexdigest(),evidence={p.name:p.read_text() for p in (root/'evidence').iterdir() if p.is_file()})
print(json.dumps(out))
'''
p=subprocess.run(['boat','exec','--json','--timeout','30','bx_32262dnp','--','python3','-c',code],capture_output=True,text=True);(E/'collection-receipt.json').write_text(p.stdout);receipt=json.loads(p.stdout);assert p.returncode==0 and receipt['exitCode']==0,receipt
out=json.loads(receipt['stdout']);(E/'remote-validation.json').write_text(json.dumps({k:v for k,v in out.items() if k!='evidence'},indent=2)+'\n')
raw=E/'raw';raw.mkdir(exist_ok=True)
for name,data in out['evidence'].items():(raw/name).write_text(data)
assert out['fixtureSHA256']==hashlib.sha256((E.parents[2]/'test/test-getprocaddress-sparse-name.js').read_bytes()).hexdigest()
p=subprocess.run(['boat','--json','info','bx_32262dnp'],capture_output=True,text=True);(E/'box-state.json').write_text(p.stdout);assert p.returncode==0
print(json.dumps({k:v for k,v in out.items() if k not in ['pins','evidence']},indent=2))
