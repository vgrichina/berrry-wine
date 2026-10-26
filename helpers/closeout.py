from pathlib import Path
import json,hashlib,struct,os
r=Path('/home/user/wine-assembly/scratch/runs/civ2-win16-post-intro-dialog-gameplay-oct26');p=r.parent/'civ2-win16-retained-intro-gameplay-oct26'
def put(n,o):(r/n).write_text(json.dumps(o,indent=2)+'\n')
msgs=[json.loads(l[6:]) for l in (r/'guest.log').read_text().splitlines() if l.startswith('[ctl] ')]
req=[json.loads(l) for l in (r/'control-in.jsonl').read_text().splitlines()]
assert all(x.get('ok') for x in msgs) and len(req)==len(msgs) and {x['id'] for x in req}=={x['id'] for x in msgs}
steps=[x['value'] for x in msgs if 'ran' in x.get('value',{})]
snaps=[x['value'] for x in msgs if isinstance(x.get('value',{}).get('frozen'),dict)]
assert sum(x['ran'] for x in steps)==1950 and all(x['ran']==x['steps'] for x in steps)
assert all(x['frozen']['credits']==0 for x in snaps)
put('control-checkpoint.json',dict(requests=len(req),responses=len(msgs),allAcknowledged=True,steps=steps,total=1950,zeroCreditsAllSnapshots=True,overlap=False,timeout=False,replay=False))
texts={'language.png':'English selected; visible OK210,280 clicked.', 'heralds.png':'Turn OFF heralds selected; visible OK320,327 clicked.', 'post-intro.png':'Menu reads Start a New Game(selected), Start on Premade World, Customize World, Begin Scenario, Load a Game, View Hall of Fame, View Credits. Visible OK478,464 clicked.', 'new-game.png':'Select Size of World: Small40x50, Normal50x80(selected), Large75x120; chose Small180,391 then OK320,464.', 'difficulty.png':'Select Difficulty Level: Chieftain(easiest selected), Warlord, Prince, King, Emperor, Deity(toughest); OK90,465 clicked.', 'civilizations.png':'Select Level Of Competition:7(selected),6,5,4,3 Civilizations; chose3 at327,435 then OK468,465.'}
images=[]
for name,desc in texts.items():
 b=(r/name).read_bytes();w,h=struct.unpack('>II',b[16:24]);assert w<=800 and h<=600 and len(b)<=2097152
 images.append(dict(path=name,width=w,height=h,bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),personallyInspected=True,visible=desc,gameplay=False))
assert len(images)==6
incident='Six PNGs consumed before map/city/unit. Setup verification consumed2; sequential new-game setup required more captures than four remaining. Gameplay unverified; not authentic guest failure.'
put('image-inspection.json',dict(images=images,captureBudget=6,setupCaptures=2,postIntroCaptures=4,remaining=0,remainingDialogPixelsInspected=False,incident=incident))
module=json.load(open(r/'module.json'));assert hashlib.sha256(Path(module['path']).read_bytes()).hexdigest()==module['sha256']
g=json.load(open(r/'guest-receipt.json'));alive=[]
for pid,start in g['identities'].items():
 try:
  s=Path('/proc',pid,'stat').read_text();a=s[s.rfind(')')+2:].split()
  if int(a[19])==start:alive.append(pid)
 except FileNotFoundError:pass
assert not alive
put('cleanup.json',dict(normalQuitAcknowledged=True,exitCode=g['exitCode'],stopReason=g['stopReason'],remainingOwned=alive,moduleSHA256Unchanged=True,box=None,boxState='not assigned',expiry=None,hostStopped=False,coordinatorShutdownOwnershipUnchanged=True))
prior=json.load(open(p/'durable-checkpoint.json'))
remaining=['Visually inspect barbarian activity dialog and remaining ordinary setup','Reach and visually inspect map/city/unit gameplay']
put('durable-checkpoint.json',dict(sourceRevision=prior['sourceRevision'],module=module,priorCommit='8a7870b6fbb29000ed2101c415dc4509307c6ac7',reusedPassed=prior['passed'],passed=['source239 fixture337 freshly matched','unchanged canonical mount337files10comma receipt reuse validated this task','exact Node24.18.1 startup limits/environment','production initializers and guest normal launch','numeric Escape once intro removal','visually inspected newgame/worldsize/difficulty/competition','all1950 batches ACK zero-credit snapshots','normal quit cleanup'],remaining=remaining,gameplay=False,authenticGuestFailure=None,incidentsPreserved=prior['incidentsPreserved']+[incident],runtimeAttemptConsumed=True))
readme='''Civilization II Win16 — new-game setup visually verified; gameplay incomplete

One unchanged pinned production guest, no compilation. Readonly source754c97d3ff22ce0a0cd06d08ac06dc0446fbcbb2: all239source/337fixture hashes verified. Retained1880280B canonical wasm f3f3cd439c50a2bc441de67c5f138e32cc060186d84d37d85de2b200ca806d75 verified before/after. No asset copies, source/emulator/window/memory patches or surrogate. Unchanged canonical parser mount337files/10comma receipt reused and identities verified this task; configuration-reuse binds actual retained wasm argv. Prior compiler/source oracle groups not repeated.

Six actual inspected640x480 PNGs: English; Heralds OFF; postintro CivilizationII menu with Start a New Game selected; world size; Chieftain difficulty; competition. Ordinary clicks described in image-inspection.json. One numeric keydown27/keyup27 after intro; no symbolic Escape or second Escape. All1950batches acknowledged, every snapshot frozen zero credits; no overlapping request, timeout or replay.

Selected Small world, Chieftain and3civilizations. Final snapshot title Select Level Of Barbarian Activity is metadata only; its choices uninspected. Six capture budget used exactly:2setup and4postintro, none on repeated intro. Sequential setup exceeded remaining capture plan. This is task capture-planning/allowance limitation, not authentic game/resource failure. No map/city/unit gameplay established. No blind input after last visible competition choice. Further ordinary setup/gameplay pixels remain gates; single assigned attempt finished.

Guest quit acknowledged, exit0/no stopreason,59.244559s CPU27.74s sampled physical tree peak304979968B log23478B. No observed missingAPI/trap/assets failure. ExactNode24.18.1 heap768MiB startup succeeded DATA/AS unlimited CPU90/file24MiB; external physical tree cap768MiB output2MiB guest90s/wall120 ceiling. Heap is not RSS; GitDATA512MiB only Git children. Fresh guest MemAvailable3977891840B>=2415919104B guest+host+GL+3helper+prospectiveclient caps; existing clients already deducted, no completed heavy-process reservations. Whole128MiB includes task/tmp/Git/session/events, whole allocated WAL peaks conservatively once, future50331648B including captures/remoteGit2MiB/growth/8MiB reserve. Standing readonly inputs excluded, no remote runtime bytes. Admission receipts record full projections and host projectedfree>=2982150144B.

Historical incidents preserved:598016B reserve shortage, initial session/WAL omissions, prior90sec wall stop, symbolicEscapeNaN and unnecessary laterEscape, earlier3PNG allocation mistake. Current sixPNG insufficiency is additional; no retrospective gameplay/compliance claim. A local closeout script initially treated boolean frozen as object and raised TypeError; corrected type check within task, no guest replay or lost evidence.

No box assigned/state/expiry N/A. Guest/supervisor identities gone, retained module unchanged. No host shutdown, deployment, main edits/merge, workers or other games. Coordinator lifecycle unchanged. Further acceptance needs adequate captures for remaining setup, not recompilation or repeating unchanged passed groups. Exact input/output and helpers retained.
'''
(r/'README.md').write_text(readme)
result=json.load(open(p/'result.json'));result.update(startedAt=g['at'].replace('+00:00','Z'),route='ordinary-new-game-setup',summary='Visually inspected post-intro newgame menu and Small world/Chieftain/3civilizations ordinary UI. SixPNG budget reached at competition; barbarian dialog metadata only. No map/city/unit gameplay. Normal quit59.24s no authentic guest failure.',screenshots=list(texts),artifacts=['README.md','module.json','identity.json','configuration-reuse.json','guest-admission.json','guest-launch.json','guest-receipt.json','guest.log','control-in.jsonl','control-checkpoint.json','image-inspection.json','durable-checkpoint.json','cleanup.json'],remainingGates=remaining)
(r/'result.json.tmp').write_text(json.dumps(result,indent=2)+'\n');os.replace(r/'result.json.tmp',r/'result.json')
print('1950ACK/zero-credit, sixPNG constraints, normalquit cleanup module integrity PASS; gameplay incomplete')
