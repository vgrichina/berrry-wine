import ast, hashlib, json, shutil, difflib, time, struct
from pathlib import Path
root=Path('/tmp/penguin-explicit-capture-budget-repair-oct27'); repo=root/'repo'
donor=Path('/tmp/penguin-accepted-causal-main-integration-oct27')
docs=repo/'docs/reviews/penguin-explicit-capture-budget-repair-oct27';docs.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def parts(p):
    text=p.read_text()
    return {n.name:ast.get_source_segment(text,n) for n in ast.parse(text).body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}
old=parts(donor/'repo/tools/penguin_capture_contract.py');new=parts(repo/'tools/penguin_capture_contract.py')
names=['validate_profile','check_files','limits_now','group_rss','kill_group','reap_group','supervise']
for name in names:assert old[name]==new[name],name
assert parts(donor/'repo/test/test_penguin_capture_contract.py')['LaunchTests']==parts(repo/'test/test_penguin_capture_contract.py')['LaunchTests']
reused={str(p):sha(p) for p in (donor/'ops/result.json',donor/'ops/reuse-report.json')}
reuse=dict(unchangedLaunchFunctions={n:hashlib.sha256(new[n].encode()).hexdigest() for n in names},
           launchTestsUnchanged=True,priorReceipts=reused,behaviorRerun=False,
           qualification='Unchanged launch/supervision acceptance only; live Node/mount/gameplay gates remain open')
(root/'ops/reuse-launch.json').write_text(json.dumps(reuse,indent=2))
pins={p:sha(repo/p) for p in ('tools/penguin_capture_contract.py','test/test_penguin_capture_contract.py','test/fixtures/penguin-wire-envelope.json')}
pair=json.loads((root/'ops/evidence/explicit-retained-pair.json').read_text())
images=[]
for image in pair['images']:
    p=Path('/tmp/penguin-visible-projectile-gameplay-oct27/repo/docs/re-notes/penguin-visible-projectile-gameplay-20261027/decision')/image['name']
    images.append(dict(image,width=struct.unpack('>II',p.read_bytes()[16:24])[0],height=struct.unpack('>II',p.read_bytes()[16:24])[1]))
summary=dict(status='PASS_SOURCE_ONLY_CAPTURE_BUDGET_REPAIR',sourceRevision='f78bca4820c5de96afe46d81e5583d71e39d1882',
             pins=pins,defaultBudget=1<<20,explicitBudget=8<<20,plannedTotal=pair['plannedTotal'],
             actualCharge=pair['result']['charged'],previousResponses=pair['used'],
             rawCaptureBytes=sum(pair['frameBytes']),frameCount=pair['frameCount'],
             terminalTail=pair['terminalBytes'],images=images,at=time.time(),
             remaining=['independent acceptance/scoped integration by coordinator','live Node exact-configuration startup','canonical filename-bearing mount validation','live startup/input/projectile/gameplay/ordinary Quit'],
             boxes=[],lifecycleOwner='coordinator; no assigned/touched boxes',
             incidents=['Initial read-only output exceeded display bound; no hidden compliance claim',
                        'Donor alternate nesting warnings retained; exact three objects resolved without fetch/repack',
                        'unittest module name collided with installed test package; direct exact test file succeeded',
                        'First pin-omission control revealed invalid provider-plan argument to legacy restorer; test now checks pin directly and canonical restoration; original failure retained'])
(root/'ops/checkpoint.json').write_text(json.dumps(summary,indent=2))
patch=''
for p in ('tools/penguin_capture_contract.py','test/test_penguin_capture_contract.py'):
    patch+=''.join(difflib.unified_diff((donor/'repo'/p).read_text().splitlines(True),(repo/p).read_text().splitlines(True),fromfile='a/'+p,tofile='b/'+p,n=0))
(docs/'candidate.patch').write_text(patch)
for name in ('baseline.py','omission-controls.py','run.py','child.py','prepare-report.py'):
    shutil.copy2(root/'ops'/name,docs/name)
for p in (root/'ops').iterdir():
    if p.is_file() and (p.suffix in ('.json','.stdout','.stderr','.txt') or p.name.endswith('.limits.json')):
        if p.suffix in ('.stdout','.stderr'):
            (docs/(p.name+'.json')).write_text(json.dumps({'rawUTF8':p.read_text()},indent=2))
            if (docs/p.name).exists(): (docs/p.name).unlink()
        else:
            shutil.copy2(p,docs/p.name)
shutil.copytree(root/'ops/evidence',docs/'evidence',dirs_exist_ok=True)
payload={str(p.relative_to(docs)):sha(p) for p in docs.rglob('*') if p.is_file() and p.name!='manifest.json'}
(docs/'manifest.json').write_text(json.dumps(payload,indent=2,sort_keys=True))
print(json.dumps({k:summary[k] for k in ('pins','plannedTotal','actualCharge','previousResponses','rawCaptureBytes','frameCount','terminalTail','images')}))
