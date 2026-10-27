T=O/'terminal';L=T/'launch';rows=[json.loads(l) for l in (L/'controller/requests.jsonl').read_text().splitlines()];steps=[]
for a,b in zip(rows,rows[1:]):assert a['ended']<=b['at']
for i,r in enumerate(rows):
 if r['request'].get('action')=='step':
  n=r['request']['n'];v=json.loads(r['originalResponse'])['value'];s=rows[i+1];sv=json.loads(s['originalResponse'])['value'];assert 1<=n<=256 and v==dict(batch=r['startingBatch']+n,ran=n,steps=n,frozen=True)
  assert s['request']==dict(action='snapshot') and sv['batch']==v['batch'] and sv['frozen']['frozen'] is True and sv['frozen']['credits']==0 and sv['frozen']['recording'] is False;steps.append(r)
assert steps[0]['request']==dict(action='step',n=1);assert not any('cmd' in r['request'] for r in rows)
assert rows[-1]['request']==dict(action='quit') and json.loads(rows[-1]['originalResponse'])['value']==dict(quitting=True)
ns=json.loads(json.loads((L/'node-startup.json').read_text())['output']);assert ns['version']=='v24.22.1' and ns['execArgv'][0]=='--max-old-space-size=2048'
for name in ['Max data size','Max address space']:assert 'unlimited' in next(l for l in ns['limits'].splitlines() if l.startswith(name))
env=json.loads((T/'startup-environment.json').read_text());prev=json.loads((OLD/'ops/remote/startup-environment.json').read_text());assert env['identities']==prev['identities'] and env['environmentSHA256']==prev['environmentSHA256'];assert env['configSHA256']==sha((O/'launch-config.json').read_bytes())
f=json.loads((L/'controller/menu-candidate.png.json').read_text());assert f['sha256']==sha((O/'historical-menu.png').read_bytes()) and f['bytes']==(O/'historical-menu.png').stat().st_size
(O/'new-menu.png').write_bytes((O/'historical-menu.png').read_bytes());save('new-menu-metadata.json',f);save('new-menu-transport.json',dict(method='content-addressed exact byte reuse after terminal actual-capture metadata verification',actualFrame=f,inspectedBeforeInput=False,noDecisionSent=True))
out=json.loads((L/'supervisor-outcome.json').read_text());assert out['remainingOwnedLive']==[] and out['childReturncode']==0 and not out['failed'];assert json.loads((T/'cli-exit.json').read_text())['exit']==0
streams=['node-startup-stdout.log','node-startup-stderr.log','output.log','stderr.log'];assert sum((L/n).stat().st_size for n in streams)==out['outputBytes']
responseBytes=sum(p.stat().st_size for p in (O/'responses').glob('*'))+sum((O/n).stat().st_size for n in ['launch-api.json','launch-api.stderr']);assert responseBytes<=1048576
verification=dict(PASS=True,at=time.time(),serialSteps=len(steps),acknowledgedBatches=sum(r['request']['n'] for r in steps),firstN1=True,allFollowingFrozenZero=True,noInputs=True,cliExit=0,ownedProcessesAbsent=True,startupVersion=ns['version'],sameEnvironmentAndPins=True,DATAandAS='unlimited',peakRSS=out['peakTreeRSS'],cpuSeconds=out['cpuSeconds'],outputBytes=out['outputBytes'],serializedAPIResponseBytes=responseBytes,capture=f,gameplay=False,ordinaryQuit=False)
save('verification.json',verification);print(json.dumps(verification))
