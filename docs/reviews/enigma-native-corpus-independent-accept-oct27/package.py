import sys
sys.dont_write_bytecode=True
from pathlib import Path
import json,hashlib,base64,shutil,os
H=Path('/tmp/enigma-native-corpus-independent-accept-oct27');O=H/'ops';R=H/'repo';D=R/'docs/reviews'/H.name
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(p,j):
 t=p.with_suffix(p.suffix+'.new');t.write_text(json.dumps(j,indent=2)+'\n');t.replace(p)
source={str(p.relative_to(R)):dict(bytes=len(p.read_bytes()),sha256=sha(p.read_bytes())) for p in sorted((R/'test').glob('*')) if p.is_file()}
audit=json.loads((O/'provenance-audit.json').read_text());checked=json.loads((O/'final-tests/checker-result.json').read_text());helper=json.loads((O/'helper-replay.json').read_text())
assert checked['rejected']==checked['adversarialControls']==86 and checked['checkerGuardMutantsKilled']==4
assert helper['records']==136 and helper['omissions']==2 and len(helper['groups'])==8
pins=json.loads((O/'corpus-pins.json').read_text())
checkpoint=dict(verdict=checked['baseline']['verdict'],candidate=audit['candidate'],candidateTree=audit['candidateTree'],donor=audit['donor'],
 donorTree=audit['donorTree'],productionRunnerSHA=audit['productionRunnerSHA'],harnessVersions=audit['versions'],modules=audit['modules'],
 corpusSHA=sha(json.dumps(pins,sort_keys=True,separators=(',',':')).encode()),corpusHashRecipe='sha256 JSON(corpus-pins.json parsed, sort_keys=True,separators=(comma,colon))',
 source=source,completed=['production boundary identity/source-only timing reuse','actual executed versions and consumed provenance',
 'independent raw corpus semantics','86 adversarial controls','four checker guard mutants','offline production owner/trace replay'],
 results=checked,helperReplay=dict(records=136,omissions=2,mode='OFFLINE_HOST_REPLAY_ONLY'),
 remaining=audit['limitations'],blockers=[],nativeExecutionsNew=0,nativeGroupsReused=8,mainIntegrated=False,productionSourceEdited=False)
save(O/'checkpoint.json',checkpoint)
incidents=[
 dict(group='compact-inspect',cause='nonexistent raw log glob; inspect.py shadowed stdlib during exception handling',resolution='renamed boundary-inspection.py; later targeted raw envelopes verified'),
 dict(group='corpus',cause='owned oracle used entry ESP as Peek continuation context',resolution='unchanged WAT callback frame is stack-20; corrected own oracle only'),
 dict(group='challenges',cause='guard-mutant test wrong edge initially changed only outer identity',resolution='coordinated outer/OFF/ON identity challenge; final 86 controls and four mutants pass'),
 dict(group='node-startup',cause='whole executable Buffer hashing exceeded physical cap',resolution='streaming64KiB hash; unchanged limits; passing node-startup-streaming receipt'),
 dict(group='helper-replay',cause='command incorrectly attempted despite failed startup, then helper path ENOENT before replay',resolution='no passing acceptance claimed; corrected ops path and executed only after successful unchanged-environment startup'),
 dict(group='provenance-audit',cause='assumed await in synchronous stageAndLoadPe statement',resolution='inspected exact source; targeted statement is synchronous; final audit passes'),
]
for incident in incidents:
 label=incident['group'];p=O/(label+'-execution.json')
 if p.exists():incident['receipt']=json.loads(p.read_text())
 p=O/(label+'-output.log')
 if p.exists():
  b=p.read_bytes();envelope=dict(originalFilename=p.name,bytes=len(b),sha256=sha(b),base64=base64.b64encode(b).decode())
  save(D/(p.name+'.raw.json'),envelope);incident['encodedLog']=p.name+'.raw.json'
save(O/'incidents.json',incidents)
selected=['boundary.json','setup-result.json','provenance-audit.json','consumed-inputs.json','corpus-pins.json','checkpoint.json','incidents.json','node-startup.json','helper-replay.json']
selected += [p.name for p in O.glob('*-execution.json')]
selected += ['admission-initial.json','admission-peer-update.json','admission-checker-final.json','admission-remote-before.json']
for n in selected:
 p=O/n
 if p.exists():shutil.copyfile(p,D/n)
for p in (O/'final-tests').glob('*.json'):
 if p.name!='checker-checkpoint.json':shutil.copyfile(p,D/p.name)
for n in ['control.py','audit.py','package.py','setup.py','node-startup.js']:
 shutil.copyfile(O/n,D/n)
for name in ['README.md']:
 assert (D/name).is_file()
# Durable publication inventory includes ONLY own new paths. No donor payload copy.
manifest={str(p.relative_to(R)):dict(bytes=len(p.read_bytes()),sha256=sha(p.read_bytes())) for p in sorted(D.rglob('*')) if p.is_file() and p.name!='evidence-manifest.json'}
manifest.update(source);save(D/'evidence-manifest.json',manifest)
save(O/'tested-inputs.json',dict(checkerSources=source,corpusPins=pins,semanticExecution='checker-final-execution.json',helperExecution='helper-replay-v2-execution.json'))
print(json.dumps(dict(payloads=len(manifest),checkpoint=checkpoint['verdict'],adversarialControls=86,guardMutants=4)))
