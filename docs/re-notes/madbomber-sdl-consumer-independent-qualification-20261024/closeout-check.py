import pathlib,json,hashlib,subprocess,difflib,datetime
P=pathlib.Path(__file__).parent
R=P/'runtime'; repo=P/'repo'
E=repo/'docs/re-notes/madbomber-sdl-consumer-independent-qualification-20261024'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
prior=json.loads((P/'review.json').read_text())
for name in ['test-madbomber-sdl-error-consumer-candidate.js','system-thunk-identity.js']:
 assert (R/name).read_bytes()==(repo/'test'/name).read_bytes()
assert sha(R/'test-madbomber-sdl-error-consumer-candidate.js')==prior['fixtureSHA256']
assert sha(R/'supervise.py')==prior['supervisorSHA256']
assert (R/'supervise.py').read_bytes()==(E/'supervise.py').read_bytes()
code=(P/'review.py').read_text().replace("(P/'review.json').write_text", "(P/'closeout-independent-review.json').write_text")
exec(compile(code,str(P/'review.py'),'exec'),{'__file__':str(P/'review.py')})
baseline=json.loads((R/'consumer-repaired.json').read_text())
assert baseline['exit']==0 and baseline['reason'] is None and baseline['reaped'] and not baseline['remainingGroup']
for suffix in ['json','stdout','stderr']:
 assert (R/('consumer-repaired.'+suffix)).read_bytes()==(E/('consumer-repaired.'+suffix)).read_bytes()
out=json.loads((R/'consumer-repaired.stdout').read_text())
assert out['module']==prior['normalModule'] and out['sdl']==prior['originalSDL']
assert out['source']==prior['source'] and out['terminalEIP']==0 and out['yield']==0
assert [x['winmmCapacity'] for x in out['results']]==[241,232]
seals=json.loads((E/'seals.json').read_text())
assert isinstance(seals,dict)
for row in seals['files']:
 p=E/row['path'];assert p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],row['path']
receipt={'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'verdict':'PASS','baselineReplayed':False,'baselineReceiptSHA256':sha(R/'consumer-repaired.json'),'baselineOutputSHA256':sha(R/'consumer-repaired.stdout'),'fixtureSHA256':sha(R/'test-madbomber-sdl-error-consumer-candidate.js'),'helperSHA256':sha(R/'system-thunk-identity.js'),'supervisorSHA256':sha(R/'supervise.py'),'inputMap':json.loads((E/'producer-input-map.json').read_text()),'mountArgv':[],'canonicalParser':'inapplicable: direct JS loadDll path; no mount arguments or CLI guest runner','supervisorCleanupReview':'unchanged retained supervisor: TERM wait2s, KILL/reap window2s; two windows within5s; no new runner or limit weakening','ssh':'ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes','moduleSHA256':prior['normalModule'],'sdlSHA256':prior['originalSDL'],'source':prior['source'],'review':'same exact fixture replacement verified against original Git blob; API4590 and name bounds/alignment reviewed; original output oracle preserved'}
(P/'closeout-check.json').write_text(json.dumps(receipt,indent=2)+'\n')
print('PASS exact inputs, helper, fixture, unchanged output oracle and retained baseline seals; no baseline execution')
