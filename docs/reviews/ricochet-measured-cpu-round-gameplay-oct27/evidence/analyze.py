E=O/'remote-evidence';s=json.loads((E/'guest/supervision.json').read_text());assert s['cleanupComplete'] and 'accounting check failed' in s['stopReason'] and 'serial/continue.json' in s['stopReason']
rows=[json.loads(x) for x in (E/'serial/control.jsonl').read_text().splitlines()];steps=0;inputs=[];last=None
for i,row in enumerate(rows):
 q=row['request'];v=row['response'];assert v['ok']
 if q.get('action')=='step':
  assert 0<q['n']<=256 and v['value']['ran']==q['n'];steps+=1
  nxt=rows[i+1];f=nxt['response']['value'];assert nxt['request']['action']=='snapshot' and f['batch']==v['value']['batch'] and f['frozen']['credits']==0 and f['frozen']['frozen']
 if 'cmd' in q:inputs.append(dict(command=q['cmd'],batch=v['value'].get('batch')))
helper=pathlib.Path('/tmp/ricochet-accepted-cleanup-merged-integration-oct26/repo/tools/boat-capture-readback.py');assert sha(helper.read_bytes())=='b4fe820ca51edab45ace65371a4561442f5ee6ecf165920b426ce5206d155336'
for name in ['menu.png','round-before.png']:
 b=(O/name).read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n' and int.from_bytes(b[16:20],'big')==640 and int.from_bytes(b[20:24],'big')==480 and len(b)<=1572864
assert not (O/'round-after.png').exists();assert not any(r['request'].get('action')=='quit' for r in rows)
save('acceptance-tests.json',dict(steps=steps,serial256ACKFrozenZero='PASS',closure537='PASS',exactStartupParser='PASS',captureHashes={n:sha((O/n).read_bytes()) for n in ['menu.png','round-before.png']},inputs=inputs,roundBatch=1869,afterInputCompletion='UNCERTAIN',paddleBallResponse='NOT_VERIFIED',ordinaryQuit=False))
save('cpu-accounting.json',dict(totalConservativeChargedIncludingCleanup=s['cpuSeconds'],wallIncludingCleanup=s['wallSeconds'],activeAndCleanupSplit=None,splitLimitation='Pinned trusted supervisor exposes final charged total only; no pre-cleanup CPU sample was retained. No exact active/cleanup split can be reconstructed.',cleanupComplete=s['cleanupComplete'],physicalPeakRSS=s['peakRSS'],cause=s['stopReason']))
save('outcome.json',dict(status='BLOCKED_ACCOUNTING_SCAN_RACE',summary='Fresh main menu and Round1-1 entry visually verified at batch1869; running timer/bricks/shield visible. Relative movement and normal mousedown queued and seen in Node input logs; following4-batch step interrupted by accounting scan FileNotFoundError on consumed serial/continue.json. Supervisor SIGTERM cleanup completed. No after-input frame, paddle/ball-response acceptance or ordinary Quit. One invocation; no replay.',remaining=['verified completed post-input step and paddle/ball before-after response','ordinary in-game Quit'],cause=s['stopReason']))
shutil.copyfile(OLD/'ops/inputs.json',O/'retained-inputs.json');save('checkpoint.json',dict(phase='runtime terminal and evidence collected; no replay',tests='acceptance-tests.json',cpu='cpu-accounting.json',remaining=['report checker','commit/push/exactref','own watcher cleanup','coordinator handback']))
print('causal assertions and capture hashes PASS; behavioral acceptance remains blocked')
