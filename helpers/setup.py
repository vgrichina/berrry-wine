import pathlib,json,hashlib,shutil,datetime
N='civ2-win16-map-movement-gameplay-oct26'
B=pathlib.Path('/tmp')/N
R=pathlib.Path('/home/user/wine-assembly/scratch/runs')/N
P=R.parent/'civ2-win16-post-intro-dialog-gameplay-oct26'
def sha(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for c in iter(lambda:f.read(1048576),b''):h.update(c)
 return h.hexdigest()
def put(n,o):(R/n).write_text(json.dumps(o,indent=2)+'\n')
pins=json.load(open('/home/user/wine-assembly/scratch/usage-watch/civ2-win16-pinned-inputs-oct26.json'))
checks=[]
for root,entries in [(pathlib.Path('/tmp/civ2-win16-ordinary-gameplay-oct26/source'),pins['files']),(pathlib.Path(pins['fixture']),pins['fixtureManifestFiles'])]:
 for e in entries:
  f=root/e['path']; a=sha(f); checks.append(dict(path=str(f),bytes=f.stat().st_size,sha256=a,ok=a==e['sha256'] and f.stat().st_size==e['bytes']))
assert all(c['ok'] for c in checks)
put('identity.json',dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),revision=pins['revision'],sourceFiles=len(pins['files']),fixtureFiles=len(pins['fixtureManifestFiles']),checks=checks,allMatched=True))
m=pathlib.Path('/home/user/wine-assembly/scratch/recovery/civ2-win16-retained-canonical-oct26/canonical.wasm')
assert m.stat().st_size==1880280 and sha(m)=='f3f3cd439c50a2bc441de67c5f138e32cc060186d84d37d85de2b200ca806d75'
put('module.json',dict(path=str(m),bytes=m.stat().st_size,sha256=sha(m),compiled=False,readonly=True))
for n in ['configuration-reuse.json','reused-mount-validation.json','reused-mount-check-receipt.json','reused-standing-system-assets.json']:
 shutil.copyfile(P/(n if n=='configuration-reuse.json' else 'prior-'+n),R/('prior-'+n))
config=json.load(open(R.parent/'civ2-win16-retained-intro-gameplay-oct26'/'prior-configuration-reuse.json'))
assert all(sha(e['path'])==e['sha256'] for e in config['pngjsStandingReadonly'])
mount=json.load(open(P/'prior-reused-mount-validation.json'))
manifest=pathlib.Path('/tmp/civ2-win16-ordinary-gameplay-oct26/source')/mount['registryEntry']['localFileManifest']
assert sha(manifest)==mount['manifestSHA256'] and sha(mount['cue'])==mount['cueSHA256']
assert all(pathlib.Path(e['host']).stat().st_size==e['actualBytes'] for e in mount['enumerated']+mount['tracks'])
put('configuration-reuse.json',dict(actualArgv=['test/run.js','--app=civ2_win16','--no-build','--wasm='+str(m)],canonicalParserReceipt='prior-reused-mount-validation.json',manifestSHA256=sha(manifest),cueSHA256=sha(mount['cue']),files=len(mount['enumerated']),commaCases=len(mount['commaBearingNames']),sameReadonlySource=True,sourcePin=pins['revision'],fontsAndDependenciesReceipt='prior-reused-standing-system-assets.json',pngjsUnchanged=True,changedPhysicalRSSCap=805306368,startupMustRun=True,priorIncidentsPreserved=True))
shutil.copyfile('/home/user/wine-assembly/scratch/usage-watch/'+N+'/root-ref-digest.json',R/'initial-root-ref-digest.json')

session=list(pathlib.Path('/home/user/.codex/sessions').rglob('*01a17a26-70c6-73e2-a289-0a54cf0bfc3e.jsonl'));assert len(session)==1
put('accounting-inputs.json',dict(session=str(session[0]),allocation=268435456,walPolicy='charge whole allocated WAL peaks conservatively once plus future'))
print('source239 fixture337 module and unchanged canonical mount identities PASS')
