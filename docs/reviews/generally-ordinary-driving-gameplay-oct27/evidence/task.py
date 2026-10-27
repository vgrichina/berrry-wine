import pathlib,json,hashlib,os,sys,subprocess,shlex,time
H=pathlib.Path(__file__).parent;R=H.parent/'repo';ROOT=pathlib.Path('/home/user/wine-assembly');M=1048576
PIN='4a2bec145ef34b0d084b96b09a682a16e89703fd';BOX='bx_zw79r524';REMOTE='/tmp/generally-driving'
def save(n,x):(H/n).write_text(json.dumps(x,indent=2))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def api(label,command,timeout=30):
 cmd=['/home/user/.ascii/boat','exec',BOX,'--timeout',str(timeout),'--json','--no-update','--','bash','-lc',command]
 assert len(command.encode())<=36000
 with open(H/(label+'.api.stdout'),'wb') as out,open(H/(label+'.api.stderr'),'wb') as err:q=subprocess.run(cmd,stdout=out,stderr=err)
 raw=(H/(label+'.api.stdout')).read_bytes()
 x=json.loads(raw);save(label+'.api.json',dict(commandSHA256=hashlib.sha256(json.dumps(cmd).encode()).hexdigest(),localExit=q.returncode,**x))
 assert q.returncode==0,(label,q.returncode,x)
 assert x.get('exitCode')==0 and not x.get('launcherFailed') and not x.get('oomKilled'),x
 return x['stdout']
if sys.argv[1]=='closure':
 import tarfile
 rows=[]
 for fn in ('source.tar.gz','build-deps.tar.gz'):
  with tarfile.open(H/fn,'r:gz') as t:
   for x in t:
    if not x.isfile():continue
    h=hashlib.sha256();f=t.extractfile(x)
    for b in iter(lambda:f.read(65536),b''):h.update(b)
    rows.append(dict(target='runner/'+x.name,bytes=x.size,sha256=h.hexdigest()))
 save('source-inputs.json',dict(revision=PIN,files=rows))
 print('archive closure',len(rows),'bytes',sum(x['bytes'] for x in rows))
elif sys.argv[1]=='closeout':
 code='''import pathlib,json,hashlib,time,os
r=pathlib.Path('/tmp/generally-driving');h=r/'ops';s=r/'runner'
c=json.loads((s/'tools/callback-ownership-census.json').read_text())
files=['host.js','lib/renderer-input.js']
expected=[x for x in c['entries'] if x.get('file') in files and x.get('name')=='host-file']
build=(s/'tools/build.sh').read_text().splitlines()
out=dict(at=time.time(),box='bx_zw79r524',state='RUNNING verified APIexec',coordinatorOwnsShutdown=True,expiry='2026-10-27T11:37:45.945Z',guestAttempted=False,moduleExists=(s/'build/wine-assembly.wasm').exists(),compileAttempts=1,callbackCensusExpected=expected,actualSHA256={f:hashlib.sha256((s/f).read_bytes()).hexdigest() for f in files},canonicalBuildGate=[dict(line=i+1,text=x) for i,x in enumerate(build) if 'callback-ownership-census' in x],processes={str(p):pathlib.Path('/proc/'+str(p)).exists() for p in [22676,22683,22693,22700,22707]},logicalRemoteBytes=sum(p.stat().st_size for p in r.rglob('*') if p.is_file()),allocatedRemoteBytes=sum(p.stat().st_blocks*512 for p in r.rglob('*') if p.is_file()),remoteSource=str(s),retainedModule=None)
(h/'box-closeout.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))'''
 x=json.loads(api('box-closeout','python3 -c '+shlex.quote(code)));save('box-closeout.json',x);print(json.dumps(x))
elif sys.argv[1]=='collect':
 import base64
 names=['compile-attempt.json','compile-supervision.json','compile.stdout','compile.stderr','startup-prebuild-supervision.json','startup-prebuild.stdout','startup-prebuild.stderr','startup-prebuild-v3-supervision.json','startup-prebuild-v3.stdout','startup-prebuild-v3.stderr','startup-prebuild-v4-supervision.json','startup-prebuild-v4.stdout','startup-prebuild-v4.stderr','plan.json','staged-closure.json']
 code='import pathlib,json,base64; h=pathlib.Path('+repr(REMOTE+'/ops')+'); print(json.dumps({n:base64.b64encode((h/n).read_bytes()).decode() for n in '+repr(names)+' if (h/n).is_file()}))'
 d=json.loads(api('collect-remote-evidence','python3 -c '+shlex.quote(code)))
 dest=H/'retained';dest.mkdir(exist_ok=True)
 for n,b in d.items():(dest/n).write_bytes(base64.b64decode(b))
 print('retained remote receipts',len(d))
elif sys.argv[1]=='stage-repair':
 import base64
 for name,target in [('remote.py','remote-v4.py'),('remote-startup.cjs','remote-startup-v3.cjs')]:
  p=H/name;code='import base64,pathlib; pathlib.Path('+repr(REMOTE+'/ops/'+target)+').write_bytes(base64.b64decode('+repr(base64.b64encode(p.read_bytes()).decode())+'))'
  api('stage-'+target,'python3 -c '+shlex.quote(code));print(target,'sha256',sha(p))
elif sys.argv[1]=='detach':
 label=sys.argv[2];command=sys.argv[3]
 cmd=['/home/user/.ascii/boat','exec',BOX,'--json','--no-update','--detach','--','bash','-lc',command]
 with open(H/(label+'.api.stdout'),'wb') as out,open(H/(label+'.api.stderr'),'wb') as err:q=subprocess.run(cmd,stdout=out,stderr=err)
 assert q.returncode==0
 x=json.loads((H/(label+'.api.stdout')).read_text());save(label+'.api.json',dict(localCommand=cmd,**x));print(json.dumps(x))
elif sys.argv[1]=='remote':
 print(api(sys.argv[2],sys.argv[3],int(sys.argv[4]) if len(sys.argv)>4 else 30)[:4000])
elif sys.argv[1]=='extras':
 import tarfile,io
 rows=json.loads((ROOT/'scratch/usage-watch/generally-driving-input-readiness-oct27.json').read_text())['files']
 extra=ROOT/'test/binaries/candidates/generally/.wine-assembly-browser.json';rows.append(dict(path=str(extra),bytes=extra.stat().st_size,sha256=sha(extra)))
 mapped=[]
 for x in rows:
  p=pathlib.Path(x['path']);target='runner/test/binaries/candidates/generally/'+str(p.relative_to(ROOT/'test/binaries/candidates/generally'));mapped.append(dict(source=str(p),target=target,bytes=p.stat().st_size,sha256=sha(p)))
 codec=ROOT/'scratch/usage-watch/shadow-man-codec-recovery-oct22/node_modules/pngjs'
 for p in codec.rglob('*'):
  if p.is_file():mapped.append(dict(source=str(p),target='runner/node_modules/pngjs/'+str(p.relative_to(codec)),bytes=p.stat().st_size,sha256=sha(p)))
 sup=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py');mapped.append(dict(source=str(sup),target='ops/supervisor-original.py',bytes=sup.stat().st_size,sha256=sha(sup)))
 for p in [*H.glob('remote*'),H/'source-closure.json']:
  if p.is_file() and p.suffix in ('.py','.cjs','.json'):mapped.append(dict(source=str(p),target='ops/'+p.name,bytes=p.stat().st_size,sha256=sha(p)))
 save('extras-map.json',mapped)
 with tarfile.open(H/'extras.tar.gz','w:gz') as t:
  for x in mapped:t.add(x['source'],arcname=x['target'])
  t.add(H/'extras-map.json',arcname='ops/extras-map.json')
 print('extras',len(mapped),'bytes',sum(x['bytes'] for x in mapped))
elif sys.argv[1]=='upload':
 import base64
 fn=sys.argv[2];start=int(sys.argv[3]);count=int(sys.argv[4]);p=H/fn;chunk=24000
 if start==0:api('upload-init-'+fn,'mkdir -p '+REMOTE+'/ops '+REMOTE+'/runner; test ! -e '+REMOTE+'/'+fn+'; touch '+REMOTE+'/'+fn)
 with p.open('rb') as f:
  f.seek(start*chunk)
  for i in range(start,start+count):
   b=f.read(chunk)
   if not b:break
   code='import os,base64; p='+repr(REMOTE+'/'+fn)+'; assert os.path.getsize(p)=='+str(i*chunk)+'; open(p,"ab").write(base64.b64decode('+repr(base64.b64encode(b).decode())+'))'
   api('upload-'+fn+'-'+str(i),'python3 -c '+shlex.quote(code))
 print('uploaded',fn,'through chunk',i)
elif sys.argv[1]=='extract':
 fn=sys.argv[2];p=H/fn
 dest=REMOTE+'/runner' if fn in ('source.tar.gz','build-deps.tar.gz') else REMOTE
 command='test "$(sha256sum '+REMOTE+'/'+fn+' | cut -d " " -f 1)" = '+sha(p)+' && tar -xzf '+REMOTE+'/'+fn+' -C '+dest
 print(api('extract-'+fn,command))
elif sys.argv[1]=='archive-plan':
 roots=[]
 for line in (H/'root-inventory.stdout').read_text().splitlines():
  meta,p=line.split('\t')
  if meta.split()[1]=='blob':roots.append(p)
 rows=json.loads((H/'source-tree.json').read_text());paths=[x['path'] for x in rows if not x['path'].startswith('test/binaries/')]
 paths=sorted(set(paths+roots));save('archive-paths.json',paths)
 # Exact paths avoid broad report trees and preserve all canonical build tests.
 save('archive-command.json',['git','-C',str(R),'archive','--format=tar.gz','--output='+str(H/'source.tar.gz'),PIN,'--',*paths])
 print('paths',len(paths),'uncompressed bytes',sum(x['bytes'] for x in rows if x['path'] in paths))
elif sys.argv[1]=='archive-exec':
 # This operation itself must be invoked through Git mode (Git child DATA only).
 cmd=json.loads((H/'archive-command.json').read_text());os.execvp(cmd[0],cmd)
elif sys.argv[1]=='inventory':
 rows=[]
 for line in (H/'source-inventory.stdout').read_text().splitlines():
  meta,p=line.split('\t');mode,typ,oid,size=meta.split();rows.append(dict(path=p,bytes=int(size),oid=oid))
 save('source-tree.json',rows)
 totals={}
 for x in rows:totals[x['path'].split('/')[0]]=totals.get(x['path'].split('/')[0],0)+x['bytes']
 print(json.dumps(dict(files=len(rows),totals=totals,largest=sorted(rows,key=lambda x:x['bytes'],reverse=True)[:8])))
elif sys.argv[1]=='flatten':
 seen=set();todo=[pathlib.Path('/tmp/penguin-accepted-explicit-budget-main-integrate-oct27/repo/.git/objects'),ROOT/'.git/objects']
 while todo:
  p=todo.pop().resolve()
  if p in seen:continue
  seen.add(p);f=p/'info/alternates'
  if f.exists():
   for line in f.read_text().splitlines():
    q=pathlib.Path(line);todo.append(q if q.is_absolute() else p/q)
 proxies=H/'readonly-object-proxies';proxies.mkdir(exist_ok=True);alts=[]
 for i,p in enumerate(sorted(seen)):
  d=proxies/str(i);d.mkdir(exist_ok=True)
  for q in p.iterdir():
   if q.name=='pack' or (len(q.name)==2 and all(c in '0123456789abcdef' for c in q.name)):
    (d/q.name).symlink_to(q,target_is_directory=True)
  alts.append(str(d))
 (R/'.git/objects/info/alternates').write_text('\n'.join(alts)+'\n')
 save('immutable-object-donors.json',[str(p) for p in sorted(seen)]);print('read-only immutable object stores',len(seen))
elif sys.argv[1]=='parser':
 source=(ROOT/'test/run.js').read_text();a=source.index('const getArgs = name => {');b=source.index('const hasFlag =',a)
 rows=json.loads((ROOT/'scratch/usage-watch/generally-driving-input-readiness-oct27.json').read_text())['files']
 for x in rows:assert sha(x['path'])==x['sha256'] and pathlib.Path(x['path']).stat().st_size==x['bytes']
 files=[str(pathlib.Path(x['path']).relative_to(ROOT/'test/binaries/candidates/generally')) for x in rows]
 code='const assert=require("assert"),args='+json.dumps(['--vfs-tree='+REMOTE+'/game','--exe='+REMOTE+'/game/GeneRally.exe'])+';'+source[a:b]+';assert.deepStrictEqual(getArgs("vfs-tree"),['+json.dumps(REMOTE+'/game')+']); console.log(JSON.stringify({parserSHA256:'+json.dumps(hashlib.sha256(source[a:b].encode()).hexdigest())+',argv:args,files:'+json.dumps(files)+',commas:'+json.dumps([f for f in files if ',' in f])+',pass:true}));'
 save('mount-parser-check.json',json.loads(api('mount-parser','node -e '+shlex.quote(code))))
 peers=[]
 for p in pathlib.Path('/proc').iterdir():
  try:
   cmd=(p/'cmdline').read_bytes().split(b'\0')
   if cmd and pathlib.Path(os.fsdecode(cmd[0])).name=='codex' and b'exec' in cmd:peers.append({'pid':int(p.name),'rss':int((p/'statm').read_text().split()[1])*4096})
  except (OSError,ValueError):pass
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 needed=sum(max(0,320*M-p['rss']) for p in peers)+256*M+805306368
 import shutil
 free=shutil.disk_usage(H).free
 save('fresh-admission.json',dict(at=time.time(),peers=peers,memAvailable=mem,remainingRequired=needed,diskFree=free,localAllocation=128*M,localReserve=8*M,remoteAllocation=1024*M,remoteReserve=64*M,passAll=mem>=needed and free-128*M>=2982150144))
 assert mem>=needed and free-128*M>=2982150144
 print('mount parser / fixture pins / fresh aggregate admission PASS')
