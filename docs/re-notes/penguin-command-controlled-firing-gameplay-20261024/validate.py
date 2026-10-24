from pathlib import Path
import json,hashlib,subprocess,sys
H=Path(__file__).parent;E=H/'repo/docs/re-notes/penguin-command-controlled-firing-gameplay-20261024'
def j(n):return json.loads((E/n).read_text())
for mode in ['control','firing','metadata']:
 for x in j(mode+'-collection-seals.json'):
  b=(E/x['path']).read_bytes();assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'],x['path']
m=j('manifest.json');assert len(m)==287 and sum(x['bytes'] for x in m)==15719953
assert sum('/gfx/' in x['target'] for x in m)==83
assert sum('node_modules/pngjs/' in x['target'] for x in m)==23
assert sum(x['target'].startswith('runner/fonts/subset/') for x in m)==20
assert sum(x['target'].startswith('runtime/fonts/subset/') for x in m)==20
cmds={k:j(k+'/command.json')['argv'] for k in ['control','firing']}
def norm(a,mode):return [x.replace('/'+mode+'/', '/RUN/') for x in a if not x.startswith('--input=')]
assert norm(cmds['control'],'control')==norm(cmds['firing'],'firing')
def events(mode):return next(x[8:] for x in cmds[mode] if x.startswith('--input=')).replace('/'+mode+'/', '/RUN/').split(',')
c=events('control');f=events('firing');assert [x for x in f if x not in c]==['34800:keydown:65','34900:keyup:65'];assert [x for x in f if x in c]==c
assert j('negative-watchdog.json')['passNegative'] and j('preflight.json')['passPreGuest'];assert j('local-hash-gate.json')['passHash']
assert j('matched-analysis.json')['validatedPNGs']==28
for k in ['control','firing']:
 t=j(k+'/terminal.json');assert t['returncode']==0 and not t['remainingGroup'];assert j(k+'/command.json')['memAvailable']>=2684354560
assert max(x['requestBytes'] for x in j('transfer-receipts.json'))<=36000
for p in H.glob('*.py'):compile(p.read_bytes(),str(p),'exec')
seals=[]
for p in sorted(E.rglob('*')):
 if p.is_file() and p.name!='evidence-seals.json':seals.append(dict(path=str(p.relative_to(E)),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
(E/'evidence-seals.json').write_text(json.dumps(seals,indent=2)+'\n')
r=dict(passValidation=True,collectionSeals=True,exactManifest=True,matchedArgvExceptBalancedA=True,validatedPNGs=28,files=len(seals),transferRequests=len(j('transfer-receipts.json')),maxTransferCommandBytes=max(x['requestBytes'] for x in j('transfer-receipts.json')),runnerSubsetFonts=sum(x['target'].startswith('runner/fonts/subset/') for x in m),pythonRecipesCompile=True)
(H/'validation.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
