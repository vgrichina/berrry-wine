from common import *
col=O/'collected';rawfile=col/'guest/native.jsonl.raw.jsonl';nativefile=col/'guest/native.jsonl'
raw=[json.loads(x) for x in rawfile.read_text().splitlines()] if rawfile.exists() else []
native=[json.loads(x) for x in nativefile.read_text().splitlines()] if nativefile.exists() else []
terminal=json.load(open(O/'checkpoint-guest-terminal.json'))
first=next((x for x in native if x['kind'] in ['rejected','captured']),None)
failure=next((x for x in raw if x.get('error')),None)
loaded=next((x for x in raw if x.get('stage')=='loaded-before-validation'),None)
verified=next((x for x in raw if x.get('stage')=='loaded-verified'),None)
mapping=json.load(open('/tmp/maelstrom-retained-logger-original-capture-oct26/ops/authentic-getptd-mapping.json'))
getptd=None
if loaded:
 anchor=next((a for a in loaded['anchors'] if a['va']==mapping['getptdLoadedVA']),None)
 getptd=dict(targetMatches=loaded['crtGetptdTarget']==mapping['getptdLoadedVA'],loaded64BytesMatch=bool(anchor and anchor['bytes']==mapping['expected']),target=loaded['crtGetptdTarget'],expected=mapping['expected'],observed=anchor['bytes'] if anchor else None,crtIdentity=mapping['inputSHA256'])
lat=first['historicalNativeLatch'] if first else None
sel=first['historicalSelectLatch'] if first else None
rej=first.get('historicalNativeRejection') if first else None
specific=bool(rej and rej['reason']!=0)
captured=bool(first and first['kind']=='captured')
authentic=bool(verified and getptd and getptd['targetMatches'] and getptd['loaded64BytesMatch'])
outcome='SPECIFIC_NATIVE_DIAGNOSTIC_REJECTION' if specific else 'INVOCATION_OWNED_NATIVE_RECORD' if captured else 'BLOCKED_WITHOUT_SPECIFIC_REJECTION'
absence=dict(selectCompletionAbsent=not(sel and sel['completions']),nativeOwnedCallAbsent=not(lat and lat['nativeEntry']),nativeOwnedReturnAbsent=not(lat and lat['event']==3),errnoUnobserved=not captured,callerBeforeCMPUnobserved=not captured,gameplayUnproven=True,PNGAbsent=not list(col.rglob('*.png')))
obs=dict(schema='maelstrom-qualified-authentic-original/v1',outcome=outcome,source=SOURCE,evidenceBase=BASE,guestAttempts=1,originalGameAcceptance=False,specificDiagnosticCaptured=specific,invocationOwnedNativeCaptured=captured,batch=first.get('batch') if first else failure.get('batch') if failure else None,native=lat,select=sel,rejection=rej,firstRawFailure=failure,loadedVerified=verified,authenticGetptd=getptd,errno=lat['errno'] if captured else None,caller=lat['caller'] if captured else None,absence=absence,firstFailureIsDiagnosticNotProofOfOriginalGameFailure=True,zeroUncapturedFieldsAreNotErrnoZero=True,screenshots=[],priorQualificationReused=dict(builds=2,nativeGroups=30,offlineControls=119,replayed=0),remainingQualificationGaps=['Original game acceptance and gameplay remain unproven','Original select return result and invocation ownership unless captured','Authentic native errno/caller before CMP unless captured','Other engines and full memory qualification remain outside this task'])
obs['authenticLoadedIdentityPass']=authentic
obs['livePCIsHostObservationNotRejectionInstructionPC']=True
if specific:
 obs['predicateSource']='accepted pinned maelstrom-native-errno-latch.cjs GUARD_REJECTION_REASONS and storage()';obs['diagnosticExplanation']='First immutable native guard diagnostic decoded by exact pinned adapter. Historical select phase/token/completions determine whether select was reached; do not infer errno from zero-filled fields.'
save('observation.json',obs)
summary=(f"First authentic diagnostic: reason {rej['reason']} ({rej['predicate']}), batch {obs['batch']}, status/event {lat['status']}/{lat['event']}; errno/caller before CMP remain unobserved." if specific else f"Capture outcome {outcome}; retain first raw failure and unknown fields without synthetic positives.")
receipt=dict(schema='maelstrom-qualified-original-api-capture/v1',summary=summary,outcome=outcome,objectiveAchieved=specific or captured,originalGameAcceptance=False,source=SOURCE,evidenceBase=BASE,moduleSHA256='98e136b5e61a0b731e3ecc84fa17eafe1a91fa2a86ba1a4451697abb15c89ad4',helperSHA256='52d044f14d6ee129b2b6f5b81335f7d2c00b70a9f7513b7bd179203936150da8',adapterSHA256='85d86f19ce431c7c9248ef080e4267451f6027b5d8927dd2ebdf0d955d3dd075',command=terminal['argv'],reproducibleCommand='python3 '+str(O/'supervise.py')+' guest',cutoff='2026-10-26T19:10:00Z',oneAttemptConsumed=True,guestSecondsLimit=60,wallLimit=85,terminal=terminal,processCleanup=dict(remainingGroup=terminal['remainingGroup'],ownedGuestOnly=True),box=dict(id=BOX,state='RUNNING',observedState='pending final API info',expiry='2026-10-26T19:29:32Z',shutdownOwner='coordinator',notStoppedByWorker=True),rawManifestSHA256=sha((O/'collected-manifest.json').read_bytes()),traceManifest=json.load(open(O/'collected-manifest.json')),PNG=[],screenshotsClaim=False,remainingQualificationGaps=obs['remainingQualificationGaps'])
receipt['objectiveAchieved']=authentic and (specific or captured)
receipt['authenticLoadedIdentityPass']=authentic
receipt['firstBlocker']=dict(kind='native-diagnostic-rejection',reason=rej['reason'],predicate=rej['predicate'],batch=obs['batch']) if specific else dict(kind='first-raw-failure-or-no-qualified-capture',raw=failure)
receipt['qualificationBoundary']='A diagnostic guard rejection is established only by its immutable nonzero reason. It does not establish the original program failure cause, errno/caller before CMP, or gameplay.'
save('final-receipt.json',receipt)
print(json.dumps(dict(outcome=outcome,summary=summary,originalGameAcceptance=False)))
