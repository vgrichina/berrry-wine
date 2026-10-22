"""Verify retained capture and its incomplete verdict, never launch a guest."""
import hashlib,json,pathlib,subprocess,sys
E=pathlib.Path(__file__).resolve().parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def check(events,exit):
    assert len(events)==43
    assert not any(x.get('name') in ['WriteFile','MessageBoxA','LoadStringA','CreateProcessA','WinExec','ShellExecuteA'] for x in events)
    assert not any(x.get('kind')=='pc' and x.get('pc')==0x404278 for x in events)
    last=events[-1];assert last['kind']=='entry' and last['name']=='ReadFile' and last['caller']==0x401736
    assert last['args'][:5]==[0x7000000a,0x688bc4,493016,0x74ffa24,0]
    assert exit['exitCode']==1 and exit['prePostSealsMatch'] and exit['elapsedSeconds']<60
    assert exit['guestProcesses']==[] and all(exit['portsClosed'].values())
    return True
events=[json.loads(x) for x in (E/'raw/observer.jsonl').read_text().splitlines()]
exit=json.loads((E/'raw/exit.json').read_text());check(events,exit)
manifest={x['path']:x for x in json.loads((E/'raw/manifest.json').read_text())}
for name in ['observer.jsonl','output.log','preflight.json','abi-check.json','command.json','attempt.json','exit.json','observer-summary.json']:
    p=E/'raw'/name;assert p.stat().st_size==manifest[name]['size'] and sha(p)==manifest[name]['sha256'],name
for name in ['observer.cjs','observer-fixture.cjs']:
    p=E/'sealed'/name;x=manifest['sealed/'+name];assert p.stat().st_size==x['size'] and sha(p)==x['sha256']
log=(E/'raw/output.log').read_text();assert '*** CRASH at batch 6: observer buffer bound' in log
assert 'n=0x785d8, read=0x785d8' in log and 'EAX=0x00000001' in log and '[0x074ffa24] = 0x000785d8' in log
pre=json.loads((E/'raw/preflight.json').read_text());assert pre['passAll'] and len(pre['seals'])==390 and pre['freeBytes']>=4*1024**3
assert json.loads((E/'local-pin-review.json').read_text())['passAll']
rejected=[]
for label,mutator in [('forged-success',lambda v:v.update(exitCode=0)),('false-seal-pass',lambda v:v.update(prePostSealsMatch=False))]:
    candidate=dict(exit);mutator(candidate)
    try:check(events,candidate)
    except AssertionError:rejected.append(label)
    else:raise AssertionError('accepted negative control '+label)
for script in ['sealed/observer-fixture.cjs','blocker-replay.cjs']:
    p=subprocess.run(['node',str(E/script)],capture_output=True,text=True);assert p.returncode==0,p.stderr;print(p.stdout.strip())
protected=json.loads((E/'root-before.json').read_text());assert all(sha(pathlib.Path(p))==h for p,h in protected.items())
print(json.dumps(dict(passAll=True,diagnosisSuccess=False,verdict='capture-blocked-by-observer-before-extraction',events=len(events),rawTraceBytes=(E/'raw/observer.jsonl').stat().st_size,sealedFiles=390,rejectControls=rejected,rootProtectedUnchanged=True,guestLaunchAttempts=1,builds=0,retries=0,lifecycleCalls=0)))
