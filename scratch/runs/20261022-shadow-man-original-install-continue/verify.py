"""Offline evidence checks only: never start a guest or change remote state."""
import pathlib,json,hashlib,struct,re,subprocess
E=pathlib.Path(__file__).resolve().parent
load=lambda n:json.loads((E/n).read_text())
p=load('installed-payload.json');assert p['files']==p['matched']==1959 and not p['mismatches'];assert p['originalPayloadBytes']==100354053
for m in p['mapping']:assert m['match'] and m['original']['size']==m['installed']['size'] and m['original']['sha256']==m['installed']['sha256']
assert p['installedExe']['sha256']=='4b32868bb30a8ca089483203f8c2b637507f12de4f11f39bf45b1fa41d5f5772'
a=load('acceptance.json');assert a['acceptedInGuest'] and a['childBatch']==1191279 and a['ordinaryVisibleAction']=='Ja'
assert load('license-authorization.json')['acceptedInGuest'] is False
assert 'NEW-GAME-SHADOW-MAN-DEMO-20261013' in load('license-authorization.json')['taskIds']
licenseCtl=load('04-after-license-yes-control.json');assert licenseCtl['rows'][0]['command']=={'cmd':'click:413:394'};assert licenseCtl['rows'][0]['response']['ok'];assert licenseCtl['rows'][0]['response']['value']['batch']==1191279
assert any(w['visible'] and 'Zielpfad' in w['title'] for w in licenseCtl['rows'][1]['response']['value']['windows'])
log=(E/'raw/installer/output.log').read_text();assert '[child 4004 _ins5576._mp] [input] click 415,394 at batch 3531087' in log
for msg in ['click 414,394 at batch 746055','click 413,394 at batch 1191279','click 414,394 at batch 1517038','click 414,394 at batch 1837065']:assert '[child 4004 _ins5576._mp] [input] '+msg in log
assert 'ENOSPC' not in log and 'RuntimeError:' not in log
rows=[json.loads(l) for l in (E/'raw/installer/parent-23832.jsonl').read_text().splitlines()];forks=[x for x in rows if x.get('kind')=='fork'];assert len(forks)==2
ins=next(x for x in forks if '_ins5576' in x['args'][0]);helper=next(x for x in forks if '_isdel' in x['args'][0]);assert '--control=49171' in ins['args'];assert not any(x.startswith('--control') for x in helper['args']);assert not any('--control' in x for x in ins['args'] if x.startswith('--pipe-child-args='))
for name in ['child-24078.jsonl','child-24090.jsonl']:
 rows=[json.loads(l) for l in (E/'raw/installer'/name).read_text().splitlines()];assert any(x.get('kind')=='module-instance' and x['realTicks'] for x in rows);assert any(x.get('kind')=='entry' and x.get('name')=='ExitProcess' and x['args'][0]==0 for x in rows);assert any(x.get('kind')=='node-exit' and x['code']==0 for x in rows)
x=load('raw/installer/exit.json');assert x['aggregateBoundPassed'] and x['elapsedSeconds']<120 and not x['remainingLiveProcesses'] and x['postSealCount']==243
assert load('preflight.json')['codecFixture']['actualCodecRoundTrip']
assert load('preflight.json')['controlFixture']['syntheticFixtureOnly']
assert len(load('staged-runtime-manifest.json'))==214 and len(load('source-manifest.json')['files'])==158
for n in ['02-before-next.png','03-after-welcome-next.png','04-after-license-yes.png','05-after-default-path-next.png','06-after-default-folder-next.png','07-install-progress.png','09-install-progress.png','10-install-progress.png']:
 b=(E/n).read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',b[16:24])==(640,480)
glog=(E/'raw/game/output.log').read_text();assert 'D3DConfigUtility.exe' in glog and 'ENOSPC' in glog and 'saveVfsToHost' in glog
assert load('game-run-api.json')['exitCode']==1 and 'No space left on device' in load('game-run-api.json')['stderr']
h=load('final-handback.json');assert h['pinsPreserved']==243 and not h['remainingOwnedLiveProcesses'];assert not h['gameWatchdogCompleted'];assert h['tmpfsFullObservedBytes']==419430400;assert h['aggregateRuntimeAllocation']<=h['runtimeCap'];assert h['recoveryAllocated']<h['recoveryCap'];assert h['hostFree']>2982150144;assert not h['gameRetry']
assert load('game-allocation-analysis.json')['lowerEnvelopeBeforeMetadata']>419430400
for n in ['parent-26750.png','child-26758.png']:assert (E/'raw/game'/n).exists() is False # zero-byte invalid images intentionally not offered as local screenshots
for r in load('retrieval.json'):
 b=(E/r['local']).read_bytes();assert len(b)==r['size'] and hashlib.sha256(b).hexdigest()==r['sha256'],r['local']
f=subprocess.run(['node',str(E/'input-fixture.cjs')],capture_output=True,text=True);assert f.returncode==0,f.stderr
print('PASS offline: 1959 original-to-installed hashes; observed authorized Ja and five real child inputs; installer/helper exits and two actual forks; 243-pin receipts; historical identities; PNG dimensions; exact game ENOSPC/watchdog-failure limitations; backup/retrieval integrity; no guest launched')
