import pathlib,json,hashlib,datetime,os,struct,shutil
from account import accounting
N='civ2-win16-map-movement-gameplay-oct26';R=pathlib.Path('/home/user/wine-assembly/scratch/runs')/N;B=pathlib.Path('/tmp')/N
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def put(n,o):
 p=R/n;t=p.with_name(p.name+'.tmp');t.write_text(json.dumps(o,indent=2)+'\n');os.replace(t,p)
g=json.load(open(R/'guest-receipt.json'));log=(R/'guest.log').read_text()
req=[json.loads(l) for l in (R/'control-in.jsonl').read_text().splitlines()]
resp=[json.loads(l[6:]) for l in log.splitlines() if l.startswith('[ctl] ')]
byid={r['id']:r for r in resp};steps=[];snaps=[]
for r in req:
 if r['id'] not in byid:continue
 a=byid[r['id']];assert a['ok']
 if r.get('action')=='step':assert a['value']['ran']==r['n'] and a['value']['frozen'];steps.append(a['value'])
 if r.get('action')=='snapshot':assert a['value']['frozen']['credits']==0 and a['value']['frozen']['frozen'];snaps.append(a['value'])
unacked=[r for r in req if r['id'] not in byid]
assert len(unacked)==1 and unacked[0].get('action')=='step' and unacked[0]['n']==1
assert '[Exit] code=0' in log and g['exitCode']==0 and g['stopReason'] is None
movement=[r for r in req if r.get('cmd') in ['keydown:39','keyup:39']];assert len(movement)==2 and all(r['id'] in byid for r in movement)
put('control-checkpoint.json',dict(requests=len(req),responses=len(resp),steps=steps,totalAcknowledgedBatches=sum(x['ran'] for x in steps),zeroCreditSnapshots=len(snaps),zeroCreditsAllSnapshots=True,overlap=False,replay=False,movementKeyEvents=movement,unacknowledged=unacked,explanation='Only final1-batch ordinary quit execution lacks ACK: guest exited0 during batch3611 after Yes/OK. Not replayed. All movement/setup batches ACK and frozenzero.'))
live=[]
for pid,start in g['identities'].items():
 try:
  s=pathlib.Path('/proc',pid,'stat').read_text();a=s[s.rfind(')')+2:].split()
  if int(a[19])==start:live.append(int(pid))
 except FileNotFoundError:pass
assert not live
m=pathlib.Path(json.load(open(R/'module.json'))['path']);assert sha(m)=='f3f3cd439c50a2bc441de67c5f138e32cc060186d84d37d85de2b200ca806d75'
put('cleanup.json',dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),ownedLive=live,normalQuit=True,ordinaryQuitRoute='Game menu Quit; Confirmation Yes; OK; guest Exit0',moduleUnchanged=True,moduleSHA256=sha(m),box=None,state=None,expiry=None,hostStopped=False,coordinatorLifecycleUnchanged=True))
notes={'gameplay-before':'Roman Map4000BC; Roman Settlers selected, Moves1, Plains. Map sprite in blink-off phase, so exact initial sprite pixel coordinate is not directly visible.', 'gameplay-after':'After acknowledged right-arrow down/up and150batches: Settlers sprite/shield at approximately269,315 on grassland, newly revealed terrain to east; panel Roman Settlers/Grassland/Moves1;3900BC. Automatic end of exhausted turn replenished Moves1; not an unchangedunit claim.', 'quit-menu':'Game menu visibly offers Quit Ctrl+Q at37,252.', 'quit-confirm':'Do you really want to quit? No/Yes and OK; selected Yes215,262 then OK320,291.', 'intro':'Rendered Microprose logo; verified black letterbox borders and central logo colors plus window geometry before exactly one numericEscape27down/up.'}
imgs=[]
for p in sorted(R.glob('*.png')):
 b=p.read_bytes();w,h=struct.unpack('>II',b[16:24]);assert (w,h)==(640,480) and len(b)<=2097152
 imgs.append(dict(path=p.name,width=w,height=h,bytes=len(b),sha256=sha(p),personallyInspected=p.stem in notes,visible=notes.get(p.stem,'Live dialog crop matched byte-exact retained personally inspected reference before ordinary known input; pixel-checkpoints.json.'),gameplay=p.stem in ['gameplay-before','gameplay-after']))
assert len(imgs)==19
put('image-inspection.json',dict(images=imgs,allowance=20,lossless=True,setupValidation='14 live dialog/frame crops exact matched retained references; intro rendered signature plus personal inspection',movementPersonallyInspected=True,absoluteMapTileCoordinates=None,beforeSpriteBlinkOff=True))
prior=json.load(open(R/'prior-durable-checkpoint.json'))
put('durable-checkpoint.json',dict(sourceRevision=prior['sourceRevision'],module=json.load(open(R/'module.json')),predecessorCommit='f95b36cd437ca7a004b6f9b230640cc8386bbef5',reusedPassed=prior['reusedPassed']+prior['passed'],passed=['source239 fixture337 identities','unchanged canonical parser337manifest338merged10comma validated','exact Node24.18.1 startup DATA/ASunlimited CPU90 file24MiB heap768','task controller sameframeaccept/wrongdialogreject','ordinary setup with actual live pixel signatures','ordinary rightarrow movement with inspected beforeafter unit/terrain/turn change','ordinary menu Quit Yes OK Exit0','identitysafe cleanup module unchanged'],remaining=[],gameplay=True,movementVerified=True,normalQuit=True,cityVerified=False,cityRequired=False,incidentsPreserved=prior['incidentsPreserved']+['Preparation asserted337merged incorrectly; corrected to canonical338merged incl explicitir41 before runtime.','Quit final1-batch step unACK because ordinary guest exited0 during it; no replay.'],runtimeAttemptConsumed=True))
(R/'README.md').write_text('''Civilization II Win16 — ordinary selected Settlers movement and ordinary quit verified

One fresh production guest, readonly source754c97d3ff22ce0a0cd06d08ac06dc0446fbcbb2,239source files/337fixture files freshly matched. Retained1880280-byte module f3f3cd439c50a2bc441de67c5f138e32cc060186d84d37d85de2b200ca806d75 unchanged. Exact compile/static/layout/oracle/mount receipts reused; canonical337manifest/338merged/10comma-track configuration validated this task. No compile/source patch/fullcopy/assets restage/new runtime/Boat/workers.

gameplay-before.png personally inspected: Roman Map4000BC, selected Roman Settlers, Moves1, Plains. The unit sprite is in its blink-off phase, so no claim of independently measured initial sprite/tile coordinates. gameplay-after.png after ordinary keydown39/keyup39, acknowledged150batches and frozenzero: Settlers sprite/shield approximately269,315 on grassland; new terrain revealed to east; Roman Settlers/Grassland/Moves1,3900BC. The turn advanced after movement and replenished movement points. This is real ordinary unit movement and terrain/turn change, not a changed-image-hash claim. No city founded; not required.

Task-owned serial controller validates actual dialog crops against retained observed references before every known choice; no title-only progression. Intro uses presented logo pixel signature plus visible geometry; personally inspected afterward. Exact one numericEscape27down/up. Same-frame acceptance and wrong-dialog rejection checked before guest. Small/Chieftain/3civs/Restless/Standard/Male/Romans/Caesar/defaultcitystyle/intro/tutorial route. No overlapping steps, timeout replay, guest state injection, fake progression or game/runtime patches.19lossless640x480PNGs, each<=2MiB, capture allowance20. Full requests/ACKs, live snapshots, crop hashes and durable checkpoints retained.

Ordinary Game menu Quit37,252; inspected Confirmation; Yes215,262 then OK320,291. Guest logged [Exit] code=0 and process exited0, supervisor stopReasonnull,47.5125s wall,42.96s sampled aggregateCPU,528625664B sampled physical tree peak. Final1-batch quit step has no ACK because the guest exited during batch3611; this is explicitly separate from the complete movement/setup ACKs. No replay or second guest. No owned live process; module unchanged. No assigned box/state/expiry; localhost cleanup only, no host stop or coordinator watch changes.

Fresh admission:256MiB whole task allocation; predecessor entire measured ledger retained, standing readonly source/fixture excluded, prior whole-WAL peaks charged once conservatively.115343360B future covers20x2MiB captures, publication local/remoteGit8MiB, session/events/client/WAL growth and8MiBreserve. Fresh RAM3725602816>=3489660928B; projected disk3518193664>=2982150144B. Guest physical768MiB/CPU90/wall90/file24MiB/output2MiB/excerpt8192; exact Node24.18.1 heap768 environment startup passed, inherited DATA/ASunlimited. Heap flag is not a processRSS cap. Git DATA512MiB applies only to Git child. No completed guest memory reservation. final-accounting.json measures closeout/publication growth. Historic resource/capture/time incidents preserved in prior-durable-checkpoint.json.

Reproduction: helpers/prepare.py verifies handoff pins and derives unchanged source/module/fixture configuration; helpers/setup.py checks identities. helpers/admit.py performs fresh admission. helpers/supervise.py runs exact guest-launch.json command/environment/limits, launches task-only helpers/controller.js as child and feeds control-in.jsonl serially. Follow actual retained quit-menu.png/quit-confirm.png for ordinary final clicks via helpers/interact.py. Do not rerun without a fresh authorized guest assignment and lifecycle/admission. prepare.py is retained as historical derivation; helpers contain actual final versions. No installation or configuration change required. Node pngjs standing dependency readonly.

Published isolated task/civ2-win16-map-movement-gameplay-oct26, no mainmerge/roottracked edit/service/deploy/othergame. Exact commit/remote verification is in publication-receipt.json and repository messageboard.
''')
for p in B.glob('*'):
 if p.is_file() and p.suffix in ['.py','.js']:
  (R/'helpers').mkdir(exist_ok=True);shutil.copyfile(p,R/'helpers'/p.name)
a=accounting();free=shutil.disk_usage(R).free
put('final-accounting.json',dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),accounting=a,futureIncluding8MiBReserve=115343360,projected=a['total']+115343360,allocation=268435456,hostDiskFree=free,hostProjectedFree=free-115343360,hostRequiredFree=2982150144,remoteRuntimeBytes=0,standingReadonlyInputsExcluded=True,admitted=a['total']+115343360<=268435456 and free-115343360>=2982150144))
result=dict(candidateId='civilization-2-win16',app='civ2_win16',startedAt=g['at'],finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),outcome='passed',verification='reviewed',route='gameplay',summary='Ordinary selected Roman Settlers movement: Plains4000BC to Grassland3900BC and eastern terrain reveal; inspected before/after; ordinary Quit Yes OK guestExit0. Cleanup complete.',command=g['command'],build=dict(commit=prior['sourceRevision'],wasmSha256=sha(m)),environment=dict(host='local',node='24.18.1',heapMiB=768,renderer='production headless raster',viewport='640x480'),screenshots=[x['path'] for x in imgs],gameplayScreenshots=['gameplay-before.png','gameplay-after.png'],artifacts=['README.md','identity.json','configuration-reuse.json','module.json','guest-admission.json','guest-launch.json','guest-receipt.json','guest.log','control-in.jsonl','control-checkpoint.json','pixel-checkpoints.json','intro-checkpoint.json','image-inspection.json','durable-checkpoint.json','prior-durable-checkpoint.json','cleanup.json','final-accounting.json'],box=None,remainingGates=[],authenticGuestError=None)
put('result.json',result)
print(json.dumps(dict(ackBatches=sum(x['ran'] for x in steps),ackSteps=len(steps),frozenZeroSnapshots=len(snaps),movement=True,ordinaryQuit=True,ownedLive=live,images=len(imgs),projected=a['total']+115343360)))
