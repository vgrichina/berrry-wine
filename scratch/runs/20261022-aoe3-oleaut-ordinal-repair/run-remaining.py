import pathlib,subprocess,json,time,os,hashlib
r=pathlib.Path('/home/user/aoe3-oleaut-repair-oct22');e=r/'evidence';env=dict(os.environ,NODE_PATH='/home/user/aoe3-original-oct22/runner/node_modules')
assert pathlib.Path(env['NODE_PATH']+'/pngjs/package.json').is_file()
results=[]
def run(label,cmd,timeout=240):
 start=time.time();p=subprocess.run(cmd,cwd=r,env=env,capture_output=True,text=True,timeout=timeout);(e/(label+'.log')).write_text(p.stdout+'\n'+p.stderr);item=dict(label=label,cmd=cmd,exit=p.returncode,seconds=time.time()-start);print(json.dumps(item),p.stdout[-1800:],p.stderr[-1300:],flush=True);return item
for name in ['test-bstr-byte-length','test-bstr-reallocation','test-getprocaddress-sparse-name','test-dynamic-module-filename','test-loadlibrary-system-path','test-kernel32-image']:
 results.append(run(name,['node','test/'+name+'.js']))
 if results[-1]['exit']!=0:break
(e/'remaining-results.json').write_text(json.dumps(results,indent=2))
if all(x['exit']==0 for x in results):
 result=run('canonical-build',['bash','tools/build.sh'],timeout=420);(e/'build-result.json').write_text(json.dumps(result,indent=2))
 artifacts=[]
 for p in (r/'build').glob('*'):
  if p.is_file():artifacts.append(dict(path=str(p),bytes=p.stat().st_size,sha256=hashlib.file_digest(p.open('rb'),'sha256').hexdigest()))
 (e/'build-artifacts.json').write_text(json.dumps(artifacts,indent=2))
