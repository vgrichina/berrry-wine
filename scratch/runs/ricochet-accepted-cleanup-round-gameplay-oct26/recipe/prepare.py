import pathlib,json,sys,os,time,shutil,hashlib,importlib.util
H=pathlib.Path('/tmp/ricochet-accepted-cleanup-round-gameplay-oct26');O=H/'ops'
ROOT=pathlib.Path('/home/user/wine-assembly')
# Copy the reviewed transport definitions only; no import of historical box state.
src=pathlib.Path('/tmp/alien-shooter-current-gameplay-api-oct26/ops/work.py').read_text()
src=src[:src.index('def glimits')].replace('/tmp/alien-shooter-current-gameplay-api-oct26',str(H)).replace('bx_a9dwsx2x','bx_9jybcw7h')
(O/'transport.py').write_text(src)
exec(compile(src,str(O/'transport.py'),'exec'))
def gate(label):
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 free=shutil.disk_usage(H).free
 logs=ROOT/'scratch/usage-watch'/H.name
 sessions=list(pathlib.Path('/home/user/.codex/sessions').rglob('*'+os.environ['CODEX_SESSION_ID']+'.jsonl'))
 b=O/'wal-baseline.json'
 if not b.exists():save(b.name,{str(p):allocated(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')})
 wal=sum(max(0,allocated(pathlib.Path(p))-v) for p,v in json.loads(b.read_text()).items())
 charges=dict(own=allocated(H),logs=allocated(logs),sessions=sum(allocated(p) for p in sessions),sidecars=sum(allocated(p) for p in logs.parent.glob(logs.name+'*') if p.is_file()),walPositive=wal,future=16777216,reserve=8388608)
 # Conservative full remaining peer allocations from assigned dispatch, own remaining once.
 peers=0;measure=[]
 for proc in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   args=(proc/'cmdline').read_bytes().split(b'\0')
   if not args[0].endswith(b'/codex') or b'exec' not in args:continue
   args=[a.decode() for a in args if a];peerlog=pathlib.Path(args[args.index('--output-last-message')+1]).parent;name=peerlog.name
   if name==H.name:continue
   cap=96;used=allocated(pathlib.Path('/tmp')/name)+allocated(peerlog)+sum(allocated(p) for p in peerlog.parent.glob(name+'*') if p.is_file())
   event=peerlog/'events.jsonl';sid=None
   if event.exists():
    with event.open() as f:
     for line in f:
      try:row=json.loads(line)
      except ValueError:continue
      if row.get('type')=='thread.started':sid=row['thread_id'];break
   if sid:used+=sum(allocated(p) for p in pathlib.Path('/home/user/.codex/sessions').rglob('*'+sid+'.jsonl'))
   remaining=max(0,cap*1048576-used);peers+=remaining;measure.append(dict(task=name,pid=int(proc.name),allocation=cap*1048576,used=used,remaining=remaining))
  except (OSError,ValueError,IndexError):continue
 projected=free-peers-max(0,41943040-sum(charges.values())+charges['future']+charges['reserve'])
 j=dict(at=time.time(),charges=charges,total=sum(charges.values()),allocation=41943040,mem=mem,required=1744830464,free=free,projected=projected,floor=2982150144,peers=measure)
 j['pass']=j['total']<=41943040 and mem>=1744830464 and projected>=2982150144;save('admission-'+label+'.json',j);assert j['pass'],j
 return j
if __name__=='__main__':
 gate('prepare')
 manifest=json.loads((ROOT/'scratch/usage-watch'/ (H.name+'-inputs.json')).read_text())
 bad=[]
 for x in manifest['files']:
  p=pathlib.Path(x['source'])
  if p.stat().st_size!=x['bytes'] or sha(p.read_bytes())!=x['sha256'] or p.stat().st_mode&511!=x['mode']:bad.append(x['target'])
 assert not bad,bad
 save('inputs.json',manifest)
 fixture=pathlib.Path('/tmp/ricochet-accepted-cleanup-merged-integration-oct26/repo/test/fixtures/ricochet-serial-controller')
 helper=fixture.parents[2]/'tools/boat-capture-readback.py'
 assert sha(helper.read_bytes())=='b4fe820ca51edab45ace65371a4561442f5ee6ecf165920b426ce5206d155336'
 work=(fixture/'work.py').read_text().replace('/tmp/ricochet-serial-progress-gameplay-api-oct26',str(H)).replace('bx_ex22dvm8','bx_9jybcw7h')
 work=work.replace("pathlib.Path(__file__).resolve().parents[3] / 'tools/boat-capture-readback.py'",repr(str(helper)))
 (O/'work.py').write_text(work);(O/'read.py').write_bytes((fixture/'read.py').read_bytes())
 # Exact canonical argument helpers, loaded without running the production module.
 source=next(pathlib.Path(x['source']) for x in manifest['files'] if x['target']=='runner/test/run.js').read_text()
 part=source[source.index('const getArg ='):source.index('// Was `--name=...`')]
 prior=json.loads(pathlib.Path('/tmp/ricochet-retained-module-gameplay-api-oct26/ops/canonical-parser.json').read_text())
 assert sha(part.encode())==prior['parserSHA256']
 argv=['/home/user/.nvm/versions/node/v24.22.1/bin/node','--max-old-space-size=2048',R+'/runner/test/run.js','--app=ricochet_xtreme','--no-build','--wasm='+R+'/current.wasm','--dll-seed=IFC22.dll','--d3d9-renderer=software','--no-close','--stuck-after=0','--quiet-api','--quiet-blocks','--batch-size=200000','--max-batches=10000000','--max-seconds=118','--control=8128','--frozen']
 save('guest-args.json',argv)
 save('configuration.json',dict(argv=argv,parserSHA256=sha(part.encode()),unchangedParser=True,canonicalReceipt=str('/tmp/ricochet-retained-module-gameplay-api-oct26/ops/canonical-parser.json'),enumerated=[x['target'] for x in manifest['files'] if '/game/' in x['target']],commaFiles=[x['target'] for x in manifest['files'] if ',' in x['target']],explicitMountArgs=[],trustedSSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'))
 rm=py('import pathlib,json,shutil;print(json.dumps(dict(mem=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,free=shutil.disk_usage("/tmp").free)))')
 v=json.loads(rm['stdout']);assert v['mem']>=3758096384 and v['free']-268435456>=2982150144;save('remote-admission.json',v)
 # Separately bounded multi-chunk random transfer and accepted production readback.
 probe=O/'transfer-probe.bin';probe.write_bytes(os.urandom(65537));transfer([('probe.bin',probe)])
 sys.path.insert(0,str(O));from read import readfile
 receipt=readfile('probe.bin',O/'probe-return.bin',deadline=time.monotonic()+40,concurrency=2)
 assert receipt['sha256']==sha(probe.read_bytes());save('transfer-probe.json',receipt)
 print('probe verified; transferring exact 537 inputs',flush=True)
 transfer([(x['target'],pathlib.Path(x['source'])) for x in manifest['files']])
 transfer([('inputs.json',O/'inputs.json')])
 j=py('import pathlib,json,hashlib;h=pathlib.Path('+repr(R)+');j=json.loads((h/"inputs.json").read_text());bad=[]\nfor x in j["files"]:\n p=h/x["target"];s=p.stat();ok=s.st_size==x["bytes"] and s.st_mode&511==x["mode"] and hashlib.file_digest(p.open("rb"),"sha256").hexdigest()==x["sha256"];\n if not ok:bad.append(x["target"])\nprint(json.dumps(dict(verified=len(j["files"]),bad=bad)));assert not bad')
 save('remote-input-verification.json',j);save('checkpoint.json',dict(phase='537 verified staged inputs; no guest yet',at=time.time()))
 print('STAGING VERIFIED',flush=True)
