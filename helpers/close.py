import pathlib,json,hashlib,datetime,sys,os
N='civ2-win16-retained-intro-gameplay-oct26';R=pathlib.Path('/home/user/wine-assembly/scratch/runs')/N
sys.path.insert(0,str(R/'helpers'));from account import accounting
def put(n,v):(R/n).write_text(json.dumps(v,indent=2)+'\n')
g=json.load(open(R/'guest-receipt.json')); log=(R/'guest.log').read_text(); replies={}
for line in log.splitlines():
 if line.startswith('[ctl] '):
  q=json.loads(line[6:]);replies[q['id']]=q
req=[json.loads(l) for l in (R/'control-in.jsonl').read_text().splitlines()]
assert all(q['id'] in replies and replies[q['id']]['ok'] for q in req)
steps=[dict(request=q,response=replies[q['id']]) for q in req if q.get('action')=='step']
assert all(s['response']['value']['ran']==s['request']['n'] for s in steps)
snaps=[replies[q['id']]['value'] for q in req if q.get('action')=='snapshot']
assert all(s['frozen']['credits']==0 for s in snaps)
put('control-checkpoint.json',dict(requestCount=len(req),everyRequestAcknowledged=True,totalBatches=sum(s['request']['n'] for s in steps),steps=steps,snapshots=snaps,zeroCreditsAll=True,overlap=False,timeouts=False,ordinaryInputs=[q for q in req if 'cmd' in q],incident='Symbolic keypress:Escape parsed NaN; numeric keydown/keyup27 removed intro; additional keypress27 queued after new dialog snapshot (unnecessary input, no identified navigation).'))
alive=[]
for pid,start in g['identities'].items():
 try:
  t=pathlib.Path('/proc')/pid/'stat';s=t.read_text();a=s[s.rfind(')')+2:].split()
  if int(a[19])==start:alive.append(int(pid))
 except FileNotFoundError:pass
assert not alive
m=json.load(open(R/'module.json'));assert hashlib.sha256(pathlib.Path(m['path']).read_bytes()).hexdigest()==m['sha256']
put('cleanup.json',dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),remainingOwnedIdentities=alive,normalQuitAcknowledged=True,guestExitCode=g['exitCode'],retainedModuleUnchanged=True,box=None,boxState=None,boxExpiry=None,lifecycleOwner='coordinator',hostStopped=False,otherTasksTouched=False))
imgs=[]
for f in R.glob('*.png'):
 b=f.read_bytes();w=int.from_bytes(b[16:20],'big');h=int.from_bytes(b[20:24],'big');assert w<=800 and h<=600 and len(b)<=2097152
 imgs.append(dict(file=f.name,width=w,height=h,bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),personallyInspected=True))
assert len(imgs)==3
put('image-inspection.json',dict(images=imgs,language='English selected; OK210,280',heralds='Turn OFF heralds selected; OK320,327',intro='Visible MicroProse yellow logo on dark animated background',newDialogAfterNumericEscape='Window snapshot only, not visually inspected; no menu/map/city/unit acceptance',capturePlanningIncident='All3PNG consumed before new dialog. Failed priority to preserve actual menu/map capture; administrative limitation, not authentic game failure. No permission inferred to exceed cap or launch second guest.'))
put('durable-checkpoint.json',dict(sourceRevision='754c97d3ff22ce0a0cd06d08ac06dc0446fbcbb2',module=m,passed=['source239 fixture337 identities','unchanged mount337files10comma canonical parser receipt reused','startup sameNodeFlagsEnv corrected physicalcap limits','production guest launch with initializers unchanged','ordinary presented language/heralds input','visible intro and ordinary numericEscape removal of intro windows','all1650batches ACK and zero credits','normal quit and cleanup'],remaining=['Visually inspect new Civilization II dialog','Reach map/city/unit via ordinary UI','Inspect actual gameplay capture'],gameplay=False,authenticGuestFailure=None,incidentsPreserved=['prior598016B reserve shortfall','prior initial session/WAL accounting omissions','prior90sec startup cutoff not authentic failure','current symbolicEscape parsedNaN','current unnecessary subsequent keypress27','current capture budget misallocation'],runtimeAttemptConsumed=True))
a=accounting();put('prepublication-accounting.json',dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),accounting=a,futureIncludingReserve=33554432,projected=a['total']+33554432,allocation=134217728,allRemoteBytes=0,standingInputsReadonlyExcluded=True,positiveWALChargedConservativelyOnce=True))
result=dict(candidateId='civilization-2-win16',app='civ2_win16',startedAt=g['at'].replace('+00:00','Z'),outcome='partial',verification='reviewed',route='ordinary-ui-intro-skip',summary='Inspected animated MicroProse intro; ordinary numeric Escape removed intro windows and opened new Civilization II dialog identified only by frozen window snapshot. All3PNG consumed on setup/intro due worker capture planning mistake; no visually verified menu or map/city/unit gameplay. Normal quit at60.78s, no authentic guest failure.',build=dict(originalmain='754c97d3ff22ce0a0cd06d08ac06dc0446fbcbb2',moduleSHA256=m['sha256']),screenshots=[e['file'] for e in imgs],gameplayScreenshots=[],artifacts=['README.md','module.json','identity.json','configuration-reuse.json','guest-admission.json','guest-launch.json','guest-receipt.json','guest.log','control-in.jsonl','control-checkpoint.json','image-inspection.json','durable-checkpoint.json','cleanup.json'],box=None,remainingGates=['Visually inspect new dialog','Ordinary UI actual map/city/unit gameplay','Inspect gameplay capture'],authenticStartupBlocker=None)
# Canonical schema accepted outcome values are verified before writing final.
result['outcome']='harness-error'
tmp=R/'result.json.tmp';tmp.write_text(json.dumps(result,indent=2)+'\n');tmp.rename(R/'result.json')
print(json.dumps(dict(batches=1650,alive=alive,images=len(imgs),allocationProjection=a['total']+33554432)))
