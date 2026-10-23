import pathlib,json,hashlib,subprocess,os,shutil
E=pathlib.Path(__file__).resolve().parent;R=E.parents[2];D=pathlib.Path('/home/user/wine-assembly-shadow-man-null-arming-identity-repair-oct23');env={**os.environ,'GIT_NO_LAZY_FETCH':'1'}
A=json.loads((E/'admission.json').read_text())
for v in [*A['standingTools'].values(),*A['standingCompiler']]:
 p=pathlib.Path(v['path']);assert p.stat().st_size==v['bytes'];assert hashlib.sha256(p.read_bytes()).hexdigest()==v['sha256']
unchanged=['test/run.js','tools/shadow-man-null-preload.cjs','tools/callback-ownership-census.json','src/13-exports.wat','src/09c3a-dialog-runtime.wat','src/09b-dispatch.wat']
for f in unchanged:assert (R/f).read_bytes()==(D/f).read_bytes(),f
base=json.loads((R/'tools/callback-ownership-census.json').read_text());delta=json.loads((R/'docs/re-notes/shadow-man-null-arming-identity-repair-20261023/census-reconciliation.json').read_text())
assert len(delta['delta'])==4 and len(base['entries'])==408
assert all(x['ownership']=='pending' for x in base['entries'])
result={'exit':0,'unchanged':unchanged,'census':{'priorReviewedEntries':4,'unrelatedUnchanged':404,'entriesAffectedByThisRepair':0,'reason':'Only cjs diagnostic adapter edited; pinned census scans WAT, root JS and lib JS. No WAT or census change; no ownership upgrade.','fullTransitiveCensus':'PENDING'},'pins':{f:hashlib.sha256((R/f).read_bytes()).hexdigest() for f in unchanged+['tools/shadow-man-null-capture.cjs','test/shadow-man-null-fresh-selection.cjs','test/test-shadow-man-null-capture.js']},'module':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in E.glob('*.wasm')}}
(E/'source-checks.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
