import pathlib,hashlib,json,os,subprocess,shutil
R=pathlib.Path('/home/user/shadow-man-tools-ready-oct22')
Q=pathlib.Path('/home/user/shadow-man-bounded-runtime')
O=Q/'shadow-man-worker-preload-retest-oct22'
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def seals():
 out=[]
 for base,manifest in [(R,'staged-runtime-manifest.json'),(R/'recovery/source/Demos/Shadowman','original-seals.json'),(R/'support','support-manifest.json')]:
  for r in json.loads((R/manifest).read_text()):
   p=base/r['path']; assert p.stat().st_size==r['size'] and sha(p)==r['sha256'],str(p)
   out.append(dict(path=str(p),size=r['size'],sha256=r['sha256']))
 return out
if __name__=='__main__':
 mount=json.loads(subprocess.check_output(['findmnt','-J','-T',str(Q)]))['filesystems'][0]
 assert mount['target']==str(Q) and mount['fstype']=='tmpfs'
 sv=os.statvfs(Q);assert sv.f_blocks*sv.f_frsize==150994944
 assert not O.exists(); O.mkdir();(O/'tmp').mkdir()
 rows=seals()
 fixed=[]
 for base in [R/'recovery/source/Demos/Shadowman',R/'runtime',R/'runner',R/'support']:
  for p in [base,*base.rglob('*')]:
   assert not p.is_symlink(),str(p)
   st=p.stat();fixed.append(dict(path=str(p),bytes=st.st_size,allocated=st.st_blocks*512))
 logical=sum(x['bytes'] for x in fixed);allocated=sum(x['allocated'] for x in fixed)
 assert max(logical,allocated)<=100663296,(logical,allocated)
 assert shutil.disk_usage(R).free>2982150144
 src=(R/'runtime/test/run.js').read_text();tm=(R/'runtime/lib/thread-manager.js').read_text()
 assert "return { ...process.env, WINE_NAMED_EVENT_ENDPOINT:" in tm
 assert "fs.mkdtempSync(path.join(os.tmpdir(), 'wa-child-'))" in src
 assert 'env: ThreadManager.namedEventEnvironment()' in src
 fixture=O/'fork-fixture.cjs'
 fixture.write_text('''const fs=require('fs'),os=require('os'),path=require('path');
if(process.argv.includes('--child')){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fixture-child-'));fs.writeFileSync(path.join(dir,'write'),'ordinary full write');process.send({pid:process.pid,tmpdir:os.tmpdir(),TMP:process.env.TMP,TEMP:process.env.TEMP,directory:dir,endpoint:JSON.parse(process.env.WINE_NAMED_EVENT_ENDPOINT).path});}
else{const {ThreadManager}=require('/home/user/shadow-man-tools-ready-oct22/runtime/lib/thread-manager');const child=require('child_process').fork(__filename,['--child'],{env:ThreadManager.namedEventEnvironment(),stdio:['ignore','inherit','inherit','ipc']});child.on('message',r=>{const q='/home/user/shadow-man-bounded-runtime/shadow-man-worker-preload-retest-oct22/tmp';for(const k of ['tmpdir','TMP','TEMP'])if(r[k]!==q)throw Error(k);if(!r.directory.startsWith(q+'/')||!r.endpoint.startsWith(q+'/'))throw Error('escape');console.log(JSON.stringify(r));});child.on('exit',code=>process.exit(code));}
''')
 env=dict(os.environ,TMPDIR=str(O/'tmp'),TMP=str(O/'tmp'),TEMP=str(O/'tmp'),NODE_PATH=str(R/'runner/node_modules'))
 p=subprocess.run(['node',str(fixture)],env=env,cwd=O,capture_output=True,text=True,timeout=10)
 assert p.returncode==0,(p.stdout,p.stderr)
 result=dict(passAll=True,mount=mount,quotaBytes=150994944,fixedLogicalBytes=logical,fixedAllocatedBytes=allocated,fixedLimitBytes=100663296,reserveBytes=16777216,totalCapBytes=268435456,seals=rows,fixed=fixed,fixture=dict(exitCode=p.returncode,stdout=p.stdout,stderr=p.stderr),freeBytes=shutil.disk_usage(R).free)
 (O/'preflight.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
