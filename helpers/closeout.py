import pathlib,json,hashlib,struct,datetime,os
N='civ2-win16-complete-setup-map-gameplay-oct26';R=pathlib.Path('/home/user/wine-assembly/scratch/runs')/N;B=pathlib.Path('/tmp')/N
put=lambda n,o:(R/n).write_text(json.dumps(o,indent=2)+'\n')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
notes={
'language':'English selected; clicked visible OK210,280.',
'heralds':'Turn OFF heralds selected; clicked visible OK320,327.',
'post-intro':'Start a New Game selected; clicked visible OK478,464. Intro windows had presented in frozen snapshot; numeric27 down/up once.',
'world':'Selected Small40x50 at180,391; visible OK320,464.',
'difficulty':'Chieftain easiest selected; visible OK90,465.',
'civilizations':'Selected3civilizations327,435 then visible OK468,465.',
'barbarians':'NEW gate: Villages Only/Roving Bands/Restless Tribes(selected)/Raging Hordes visibly inspected; accepted Restless Tribes with OK172,465.',
'rules':'Use Standard Rules selected; visible OK385,465.',
'gender':'Male selected; visible OK235,465.',
'tribe':'Romans selected among21tribes; visible OK320,465.',
'name':'Please Enter Your Name; Caesar text visible selected; accepted unchanged with OK210,465.',
'ready':'Select Your City Style; Classical Forum outlined; accepted default with visible OK388,465.',
'map-entry':'In the Beginning: Caesar leader of Romans; starting technologies Irrigation/Mining/BronzeWorking/CeremonialBurial/Roads. Visible OK320,460.',
'map-before':'Civ Tutorial overlays map; instructs find suitable capital site. Dismissed visible OK320,118.',
'gameplay-before':'ACTUAL Roman Map gameplay: explored green terrain/forest/hills/water surrounded by black fog; World minimap; Status10,000People/4000B.C./50Gold; MovingUnits panel Roman Settlers, Moves1, NONE, Plains. No city founded, no move verified.'}
imgs=[]
for n,note in notes.items():
 p=R/(n+'.png');raw=p.read_bytes();w,h=struct.unpack('>II',raw[16:24]);assert w<=800 and h<=600 and len(raw)<=2097152
 imgs.append(dict(path=p.name,width=w,height=h,bytes=len(raw),sha256=sha(p),personallyInspected=True,visible=note,gameplay=n=='gameplay-before'))
put('image-inspection.json',dict(images=imgs,allowance=20,knownSetupCaptures=6,newStateCaptures=9,unused=5,maximumNewAllowanceAtStart=14,lossless=True))
req=[json.loads(l) for l in (R/'control-in.jsonl').read_text().splitlines()];responses=[json.loads(l[6:]) for l in (R/'guest.log').read_text().splitlines() if l.startswith('[ctl] ')]
byid={o['id']:o for o in responses};steps=[];snaps=[]
for r in req:
 if r.get('action')=='step':
  o=byid[r['id']];assert o['ok'] and o['value']['ran']==r['n'] and o['value']['frozen'];steps.append(o['value'])
 if r.get('action')=='snapshot':
  o=byid[r['id']];assert o['ok'] and o['value']['frozen']['credits']==0;snaps.append(o['value'])
unacked=[r for r in req if r['id'] not in byid]
assert len(unacked)==1 and unacked[0]['cmd']=='keydown:39'
put('control-checkpoint.json',dict(requests=len(req),responses=len(responses),steps=steps,totalAcknowledgedBatches=sum(x['ran'] for x in steps),zeroCreditSnapshots=len(snaps),zeroCreditsAllSnapshots=True,overlap=False,replay=False,timeout=True,unacknowledged=unacked,explanation='Move requested only after rendered map inspection, but supervisor had ended; no response, no move/keyup/afterPNG/quit executed. No replay.'))
g=json.load(open(R/'guest-receipt.json'));live=[]
for pid,start in g['identities'].items():
 try:
  s=pathlib.Path('/proc',pid,'stat').read_text();a=s[s.rfind(')')+2:].split()
  if int(a[19])==start:live.append(int(pid))
 except FileNotFoundError:pass
m=pathlib.Path(json.load(open(R/'module.json'))['path']);assert sha(m)=='f3f3cd439c50a2bc441de67c5f138e32cc060186d84d37d85de2b200ca806d75';assert not live
put('cleanup.json',dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),ownedLive=live,exit='supervisorSIGKILL90secWall',normalQuit=False,moduleUnchanged=True,moduleSHA256=sha(m),box=None,hostStopped=False,coordinatorLifecycleUnchanged=True))
prior=json.load(open(R.parent/'civ2-win16-post-intro-dialog-gameplay-oct26/durable-checkpoint.json'))
put('durable-checkpoint.json',dict(sourceRevision=prior['sourceRevision'],module=json.load(open(R/'module.json')),predecessorCommit='1ca9a3404bc49e566ba184e50f2c158373c5381c',reusedPassed=prior['reusedPassed']+prior['passed'],passed=['source239/fixture337/hash and canonical mount337/10comma identity verification','exact Node24.18.1 startup','ordinary full newgame setup visibly inspected','barbarian activity and remaining dialogs inspected','actual rendered Roman map and selected Settlers unit inspected','3350batches acknowledged/frozenzero','cleanup noownedprocesses'],remaining=['ordinary move/action before-after evidence','city founding/city window if desired'],gameplay=True,movementVerified=False,cityVerified=False,runtimeTimeout=g['stopReason'],authenticGuestError=None,incidentsPreserved=prior['incidentsPreserved']+['This attempt90sec supervisor wall stop after mapPNG; no input replay.','Setup helper initially referenced prior configuration layer lacking pngjsStandingReadonly; corrected to original retained receipt before any runtime. Initial admission failed only because setup had not completed; no denied operation retried.'],runtimeAttemptConsumed=True))
(R/'README.md').write_text('''Civilization II Win16 — ordinary setup completed; actual map and Settlers visually verified

One exact production guest from readonly source754c97d3ff22ce0a0cd06d08ac06dc0446fbcbb2 and standing fixture337. Retained1880280-byte canonical module SHA256f3f3cd439c50a2bc441de67c5f138e32cc060186d84d37d85de2b200ca806d75 unchanged before/after. No compilation, full checkout, asset copies or emulator patches. Source239/fixture337 identities freshly matched. Unchanged canonical parser337files/10comma mount, compiler and source oracle receipts reused. Exact Node24.18.1 heap768MiB/environment startup passed; inherited DATA/AS unlimited, CPU90/file24MiB; physical process tree cap768MiB, output2MiB, guest90sec ceiling. Git DATA512MiB applies only to Git child.

15 inspected lossless640x480 PNGs: six known setup references and nine new states; every input control bound to actual presented pixels. Small world/Chieftain/3civilizations; Restless Tribes, Standard Rules, Male, Romans, Caesar, default city style. One numericEscape down/up27 after presented intro; no symbolicNaN/secondEscape. New barbarian gate and all remaining setup dialogs passed. Actual gameplay-before.png shows Roman Map, explored terrain and fog, minimap,4000B.C.,10,000People,50Gold, and selected Roman Settlers on Plains with Moves1. This is actual gameplay, not background/menu/title metadata. No city founded or unit movement proved.

3350 batches fully acknowledged,15 frozen zero-credit snapshots; serial exclusive steps, no overlap/replay. Supervisor hit90sec wall after final map capture: exit-9,90.028s,CPU52.3s,sampled tree peak415301632B. No observed missingAPI/trap/asset failure. Arrow-right keydown request was appended after guest had ended and received no acknowledgement; no keyup, step, afterPNG or quit executed. No retry. This wall stop is a real task limit, not evidence of a game crash. Normalquit was not achieved; identity-safe supervisor killed owned guest and cleanup confirms no owned children. Retained wasm unchanged.

192MiB allocation includes current/tmp/Git/evidence/launcher/session plus predecessor owned evidence/session, conservative whole allocated WAL peaks charged once,80MiB future including20PNG maxima/publication/growth/8MiB reserve. Standing readonly source/fixture/dependencies excluded; no new copies or remote runtime bytes. Fresh physicalRAM requirement2617245696B (higher than2596319232 minimum), residentclients already deducted, no exited Civ reservation. Fresh admission receipts preserve exact values; host projected free>=2982150144B. Historical3PNG/6PNG capture limits and other prior incidents remain in durable-checkpoint and are not new game defects.

Evidence result outcome is timeout with reviewed gameplayPNG: map/unit reached, move/city and normalquit remaining. No box assigned; state/expiry N/A, no host shutdown. No root tracked edits, mainmerge, service, restart, deploy, othergames or workers. Commit/push only isolated evidence branch; exact remote receipt is local publication-receipt.json.
''')
put('incidents.json',dict(preparationError='KeyError pngjsStandingReadonly fixed by reading original unchanged retained configuration layer before runtime; initial subsequent accounting could not run until setup completed.',runtimeFirstFailure=g,unacknowledgedInput=unacked))
# metadata published last
result=dict(candidateId='civilization-2-win16',app='civ2_win16',startedAt=g['at'],finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),outcome='timeout',verification='reviewed',route='gameplay',summary='Ordinary full newgame setup completed; inspected live Roman map4000BC and selected Settlers/Moves1/Plains. Supervisor90sec wall stop after mapPNG; move/city and normalquit unverified. No guest trap observed; no replay.',command=g['command'],build=dict(commit=prior['sourceRevision'],wasmSha256=sha(m)),environment=dict(host='local',node='24.18.1',heapMiB=768,renderer='production headless raster',viewport='640x480'),screenshots=[x['path'] for x in imgs],gameplayScreenshots=['gameplay-before.png'],artifacts=['README.md','identity.json','configuration-reuse.json','module.json','guest-admission.json','guest-launch.json','guest-receipt.json','guest.log','control-in.jsonl','control-checkpoint.json','image-inspection.json','durable-checkpoint.json','cleanup.json','incidents.json'],box=None,remainingGates=['ordinary move/action before-after evidence','city/citywindow unverified','normalquit not achieved'],authenticGuestError=None)
put('result.json.tmp',result);os.replace(R/'result.json.tmp',R/'result.json')
print('15PNGs inspected and dimensions/bytes checked;3350ACK;15zero-credit snapshots; cleanupPASS; result timeout with gameplay evidence')
