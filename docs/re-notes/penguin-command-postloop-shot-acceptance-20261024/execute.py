from work import *
assert time.time()<1792822800
state=json.loads(subprocess.check_output([B,'--no-update','--json','info',BOX]));save('box-before.json',state);assert state['sandbox']['state']=='idle' and state['sandbox']['health']=='ok'
# Reuse accepted exact source/blob/excerpt/ABI evidence; no repeated audit.
checkpoint=PRE/'static-checkpoint.json'
save('reused-checkpoint.json',dict(predecessor='164e406b3481e62c5713eed12821e312421ee082',path=str(checkpoint),sha256=sha(checkpoint.read_bytes()),artifactSealsPath=str(PRE/'repo/docs/re-notes/penguin-command-cannon-block-decision-20261024/artifact-seals.json'),coordinatorVerifiedArtifacts=42,rangeChange='406d80-406f50 -> 406ec4-406f50; exclude 4000-iteration406eb0'))
pre=(OLD/'preflight.py').read_text().replace(str(OLD),str(H))
j=py(pre);save('preflight-api.json',j)
code='''import pathlib,json,hashlib,os,re,shutil
H=pathlib.Path(ROOT)
pids=[]
for p in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  a=(p/'cmdline').read_bytes().decode(errors='replace').split('\\0')
  if a and pathlib.Path(a[0]).name=='node' and str(H/'runner/test/run.js') in a:pids.append(int(p.name))
 except (FileNotFoundError,ProcessLookupError,PermissionError):pass
assert not pids,pids
ident={n:hashlib.sha256((H/n).read_bytes()).hexdigest() for n in ['runner/test/run.js','runtime/build/wine-assembly.wasm','game/penguin-command.exe']}
assert list(ident.values())==['3c59fd034391e069f24a6047cf96cd8dac84a791d7d7591d55e5f7cb6e161a5e','8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686','14d6e430c26c44c94ef5c176eca2f66edd82dd66fd155d29a5596e3d6e170fc1']
print(json.dumps(dict(identities=ident,noOwnedProcess=True,memAvailable=int(re.search(r'MemAvailable:\\s+(\\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024,free=shutil.disk_usage('/tmp').free,node=shutil.which('node'))))
'''.replace('ROOT',repr(str(H)))
save('fresh-identity-process-api.json',py(code))
args=[x.replace(str(OLD),str(H)) for x in json.load(open(PRE/'decision-args.json'))]
args=[x.replace('--trace-eip-range=0x406d80-0x406f50','--trace-eip-range=0x406ec4-0x406f50') for x in args]
args=[x.replace('40000:keydown:65',f'39999:png:{H}/decision/b39999.png,40000:keydown:65,40100:png:{H}/decision/b40100.png') if x.startswith('--input=') else x for x in args]
save('decision-args.json',args)
s=(PRE/'supervise.py').read_text().replace(str(OLD),str(H)).replace('1792821330','1792822860').replace('latest start05:55:30UTC','latest start06:21UTC').replace('bx_rcsfy9bm',BOX).replace('shutdown06:00UTC','shutdown06:25UTC').replace('2026-10-24T06:12:03.889Z','2026-10-24T06:31:46.666Z')
(H/'supervise.py').write_text(s)
save('bounded-command-calculation.json',dict(traceRange='0x406ec4-0x406f50',excludedLoop='0x406eb0:4000 iterations',oneKeydown=True,expectedObservedBlocks=['406ec4','406ed8','406ee4','406efb','406f00'],conservativeEntryLines=32,maxDetailedLineBytes=1024,traceAllowance=32768,normalLogAllowance=131072,totalProjectedOutput=163840,cap=524288,otherGuards=dict(cpu=90,wall=90,maxSeconds=60,maxBatches=43000,oldspaceMiB=512,arenaMiB=512),pngs=2,pngDimensions=[840,660],noRepeat=True))
payloads={n:(H/n).read_text() for n in ['supervise.py','decision-args.json']}
save('helper-stage-api.json',py('import pathlib,json;h=pathlib.Path('+repr(str(H))+');d=json.loads('+repr(json.dumps(payloads))+');[(h/n).write_text(s) for n,s in d.items()];print("supervisor/args staged")'))
account('preguest')
assert not (H/'guest-launch-api.json').exists()
j=remote('python3 '+shlex.quote(str(H/'supervise.py'))+' decision',100);save('guest-launch-api.json',j);print(j['stdout'],flush=True)
for name in ['output.log','command.json','terminal.json','b39999.png','b40100.png']:
 j=py('import pathlib,base64,json,hashlib,zlib;b=pathlib.Path('+repr(str(H/'decision'/name))+').read_bytes();print(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),data=base64.b64encode(zlib.compress(b)).decode())))')
 o=json.loads(j['stdout']);b=zlib.decompress(base64.b64decode(o.pop('data')));assert len(b)==o['bytes'] and sha(b)==o['sha256'];(E/name).write_bytes(b);save('seal-'+name+'.json',o)
print((E/'output.log').read_text()[-18000:])
