import sys,pathlib,json,shutil,hashlib,os,time,resource
sys.dont_write_bytecode=True
sys.path.insert(0,str(pathlib.Path(__file__).parent));import admin as a
a.gate('before-package');D=a.R/'docs/reviews'/a.H.name
# Retain the same-task exact empty-mount canonical-parser receipt. This task
# invokes no filename-bearing mount argv or Node command.
donor=pathlib.Path('/tmp/alien-dispatch-boundary-independent-publication-oct27/ops')
config=json.loads((a.O/'configuration.json').read_text());old=json.loads((donor/'configuration.json').read_text());receipt=json.loads((donor/'empty-mount-parser-output.log').read_text())
assert old['ssh']==a.SSH and old['mountArgv']==[] and old['intendedFiles']==[]
assert receipt==dict(argv=[],intendedFiles=[],mounts=[],offline=True)
config.update(canonicalEmptyMountReceiptReused=str(donor/'empty-mount-parser-output.log'),canonicalEmptyMountReceipt=receipt,canonicalParser=old['parser'],canonicalParserSHA256=a.sha(pathlib.Path(old['parser'])),canonicalReceiptSHA256=a.sha(donor/'empty-mount-parser-output.log'),validation='same-task actual offline mount argv empty, unchanged receipt verified; no runtime or Node executed')
a.save('configuration.json',config)
# These source pins are unchanged accepted controller code, not a replacement.
assert a.sha(a.R/'test/alien-gameplay-sequence.py')=='4ae9e957ffdb03c99be55242e796b58e9c482c0b102bebdd571be3ade9e7a17f'
assert a.sha(a.R/'test/helpers/alien-control-sequence.py')=='db75a7f3316be2c919b55423c0275c5e4fe544f5c4b50eed60372d3a98167d39'
check=json.loads((a.O/'checkpoint.json').read_text())
for p,h in check['testedPins'].items():assert a.sha(a.R/p)==h,(p,h)
# Bound all copying below; no media, executables, Git objects or session logs.
for name in ['configuration.json','incidents.json','checkpoint.json','affected-inputs.json','admin.py','affected.py','package.py','wal-baseline.json']:
 shutil.copyfile(a.O/name,D/name)
for p in a.O.glob('*-execution.json'):shutil.copyfile(p,D/p.name)
for p in a.O.glob('admission-*.json'):shutil.copyfile(p,D/p.name)
for p in a.O.glob('*-output.log'):shutil.copyfile(p,D/p.name)
shutil.copyfile(a.O/'git.jsonl',D/'initial-git.jsonl')
shutil.copyfile(a.O/'before-exact-newgame/before.json',D/'before.json')
for p in (a.O/'before-exact-newgame/historical-owner/control').rglob('*.json'):
 dest=D/'historical-phase-receipts'/p.relative_to(a.O/'before-exact-newgame/historical-owner/control');dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
shutil.copytree(a.O/'http-cli',D/'http-cli-initial')
shutil.copytree(a.O/'http-process-cli',D/'http-cli')
registry=pathlib.Path('/tmp/wine-ops-alien-menu-owners-'+str(os.getuid()))
for p in registry.glob('*.json'):
 if str(a.H) in p.read_text():
  dest=D/'process-ownership'/p.name;dest.parent.mkdir(exist_ok=True);shutil.copyfile(p,dest)
# Include failed fixture setup and the first successful historical run as incidents.
shutil.copyfile(a.O/'before-corrected/before.json',D/'first-passing-before.json')
commands=[]
for name in ['historical-before-corrected','historical-exact-newgame','orchestration-cli-admitted','process-owned-orchestration-cli','accepted-transport-unit']:
 j=json.loads((a.O/(name+'-execution.json')).read_text());assert j['exit']==0 and j['reason']=='natural'
 commands.append(dict(group=name,pool=['python3',str(a.ROOT/'scratch/usage-watch/light-execution-pool-oct26.py'),'--slots','1','--','python3',str(a.O/'admin.py'),'test',name,*j['argv'][1:]],supervisedArgv=j['argv'],receipt=name+'-execution.json'))
(D/'commands.json').write_text(json.dumps(commands,indent=2)+'\n')
manifest={str(p.relative_to(a.R)):dict(bytes=p.stat().st_size,sha256=a.sha(p)) for p in [a.R/'tools/alien-menu-gameplay-controller.py',a.R/'test/alien-gameplay-sequence.py',a.R/'test/helpers/alien-control-sequence.py',*sorted((a.R/'test/fixtures/alien-menu-controller').rglob('*'))] if p.is_file()}
(D/'source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');a.save('source-manifest.json',manifest)
clients=[]
for p in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  if p.joinpath('comm').read_text().strip()=='codex':clients.append(dict(pid=int(p.name),rss=int(p.joinpath('status').read_text().split('VmRSS:')[1].split()[0])*1024))
 except (OSError,IndexError):pass
own=[x for x in clients if x['pid']==3443794];assert len(own)==1 and own[0]['rss']<=335544320,own
installed={}
for p in [pathlib.Path('/usr/bin/python3').resolve(),pathlib.Path('/usr/bin/git'),pathlib.Path('/usr/bin/ssh'),pathlib.Path('/tmp/enigma-retained-canonical-native-msg-qualification-oct26/ops/common.py')]:installed[str(p)]=dict(bytes=p.stat().st_size,allocated=a.alloc(p),sha256=a.sha(p),standingInput=True,copied=False)
standing=dict(installed=installed,donorGitPath=str(a.DONOR/'.git'),donorGitAllocated=a.alloc(a.DONOR/'.git'),donorObjectAlternate=str(a.DONOR/'.git/objects'),donorObjectsCopied=False,clients=clients,aggregateClientRSS=sum(x['rss'] for x in clients),ownClient=own[0],ownClientAllowance=335544320)
a.save('standing-inputs.json',standing);shutil.copyfile(a.O/'standing-inputs.json',D/'standing-inputs.json')
a.gate('after-package');shutil.copyfile(a.O/'admission-after-package.json',D/'accounting.json')
# Every copied review payload is sealed; the manifest excludes itself only.
rows={str(p.relative_to(D)):dict(bytes=p.stat().st_size,sha256=a.sha(p)) for p in sorted(D.rglob('*')) if p.is_file() and p.name!='manifest.json'}
(D/'manifest.json').write_text(json.dumps(rows,indent=2)+'\n')
a.save('review-manifest.json',dict(path=str(D/'manifest.json'),sha256=a.sha(D/'manifest.json'),payloads=len(rows),totalBytes=sum(v['bytes'] for v in rows.values())))
check.update(completed=check['completed']+['source review','evidence package and manifests'],remaining=['task branch commit/push/remote verification'],sourceManifestSHA256=a.sha(D/'source-manifest.json'),reviewManifestSHA256=a.sha(D/'manifest.json'))
a.save('checkpoint.json',check)
print(json.dumps(dict(payloads=len(rows),totalBytes=sum(v['bytes'] for v in rows.values()),standing=standing,accounting=json.loads((a.O/'admission-after-package.json').read_text()))))
