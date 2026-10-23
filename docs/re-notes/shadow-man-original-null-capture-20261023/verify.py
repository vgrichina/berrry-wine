"""Offline evaluation of the sole original trace; never replays the guest."""
import pathlib,json,hashlib
E=pathlib.Path(__file__).resolve().parent;D=E/'original-evidence'
rows=[json.loads(s) for s in (D/'null-capture.jsonl').read_text().splitlines()]
for row in rows:
 if 'sha256' in row:
  payload=row.get('receipt',row.get('record'))
  assert hashlib.sha256(json.dumps(payload,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()==row['sha256']
pre=rows[0]['receipt'];s=pre['selection'];records=[r['record'] for r in rows if 'record' in r]
assert s['actionSequence']==3 and s['cmdId']==3 and s['hwnd']==65564 and s['batch']==24720
assert [(r['actionSequence'],r['cmdId'],r['hwnd'],r['batch'],r['returned']) for r in s['priorActions']]==[(1,1024,65537,5585,True),(2,1,65542,14859,True)]
pid=json.loads((D/'actual-process.json').read_text())['pid'];assert pid==28583 and s['pid']==pid
assert pre['prior']['boundary']['eventCount']==0 and pre['prior']['boundary']['syncDepth']==0
assert [r['kind'] for r in records]==['sender-pre','first-zero']
assert [r['boundary']['eventCount'] for r in records]==[1,2]
assert all(r['boundary']['token']=='13' and r['boundary']['root']=='2' and r['boundary']['syncDepth']==1 for r in records)
assert records[-1]['registers']['eip']==0 and records[-1]['stop'] is True and records[-1]['continuation']=='forbidden'
assert rows[-1]==dict(terminal=True,reason='capture-failed: first-zero before required block',exit=86)
assert all(r['metadata']['pid']==pid and r['metadata']['actualModule']['moduleSha256']=='8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686' for r in records)
module=[json.loads(s) for s in (D/'module-consumption.jsonl').read_text().splitlines()]
assert [r['event'] for r in module]==['command-file-verified','canonical-input-consumed','instantiate'] and all(r['pid']==pid for r in module)
resources=[json.loads(s) for s in (D/'resource-events.jsonl').read_text().splitlines()]
assert [r['event'] for r in resources]==['actual-node-entry','fixed-arena']
assert resources[0]['argv'][1]==s['runner'] and resources[-1]['bytes']==536870912
result=json.loads((D/'session-result.json').read_text());assert result['guestAttempts']==1 and result['osExit']==86 and result['remaining']==[] and result['operatorJoined']
assert result['elapsedSeconds']<=90 and result['capturedBytes']<=524288
assert result['captureConditions']==dict(preArm=True,decodedBlock=False,firstZero=True,modalConsume=False,modalComplete=False,terminal=False,actualOsExit86=True,allGroupsReaped=True)
for n,title in [('launcher-before','ShadowMan Launcher'),('configuration','ShadowMan Configuration'),('launcher-after-ok','ShadowMan Launcher')]:
 v=json.loads(json.loads((D/(n+'.json')).read_text())['stdout']);assert v['quit'] is False
 assert any(w['visible'] and not w['isChild'] and w['title']==title for w in v['windows'])
 controls=json.loads(json.loads((D/(n+'-controls.json')).read_text())['stdout'])['controls']
 if n=='launcher-before':assert any(c['id']==1025 and c['style']&0x08000000 for c in controls)
 if n=='launcher-after-ok':assert any(c['id']==1025 and c['parent']==65564 and not c['style']&0x08000000 for c in controls)
verdict=dict(evidenceIntegrity=True,verdict='BLOCKED_FIRST_ZERO_BEFORE_REQUIRED_BLOCK',captureAccepted=False,guestAttempts=1,pid=pid,selection=s,conditions=result['captureConditions'],missing=['decoded block0x4015d4','modal-frame-consume','modal-frame-complete','successful first-zero terminal'],ordinaryZeroClassification=records[-1]['classification'])
(E/'evaluation.json').write_text(json.dumps(verdict,indent=2)+'\n')
