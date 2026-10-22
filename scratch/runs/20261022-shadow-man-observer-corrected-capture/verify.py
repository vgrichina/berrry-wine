"""Offline sealed-capture verification; never launches Setup or repairs runtime."""
import copy,hashlib,json,pathlib,subprocess
E=pathlib.Path(__file__).resolve().parent
def sha(data):return hashlib.sha256(data).hexdigest()
def load(name):return json.loads((E/name).read_text())
def causal(events):
    # Locate the actual first negative-progress path, not a short-write theory.
    cancel=next(i for i,x in enumerate(events) if x.get('pc')==0x40473e)
    pump=events[cancel-2];progress=events[cancel-1];reader=events[cancel]
    assert pump['pc']==0x40636f and pump['regs']['eax']==1 and pump['status']==0
    assert progress['pc']==0x4065f2 and progress['regs']['eax']==0xffffffff
    assert progress['stack'][0]==0x404739 and reader['regs']['eax']==0xffffffff
    peek=events[cancel-3];assert peek['kind']=='return' and peek['name']=='PeekMessageA'
    assert peek['caller']==0x4062fc and peek['eax']==1 and peek['args'][1:5]==[0,0,0,0]
    assert peek['message'][:4]==[0x10008,0x12,0,0]
    assert events[cancel+1]['pc']==0x404750 and events[cancel+1]['status']==-11
    decoder=next(x for x in events[cancel:] if x.get('pc')==0x40434b)
    assert decoder['regs']['eax']==4 and decoder['status']==-11
    returned=next(x for x in events[cancel:] if x.get('pc')==0x406571)
    assert returned['regs']['eax']==0xfffffff5 and returned['status']==-11
    resource=next(x for x in events if x.get('resourceCall'))
    assert resource['resourceCall']['return']==0x406581 and resource['resourceCall']['resource']==0x1b98
    assert not any(x.get('pc')==0x40478e or x.get('firstMismatch') for x in events)
    writes=[x for x in events if x['kind']=='return' and x.get('name')=='WriteFile']
    assert len(writes)==17 and all(x['eax']==1 and x['actual']==x['args'][2]==4096 for x in writes)
    assert [x['file']['position'] for x in writes]==list(range(4096,69633,4096))
    return dict(peekLine=cancel-2,pumpLine=cancel-1,progressLine=cancel,readerCancellationLine=cancel+1,peek=peek,pump=pump,progress=progress,reader=reader,decoder=decoder,extractorReturn=returned,resource=resource,writeCalls=len(writes),writtenBytes=69632)
def preservation(exit):
    assert exit['prePostSealsMatch'] and exit['sealedFiles']==390 and exit['previousCaptureUnchanged'] and exit['previousCaptureFiles']==21
    assert exit['guestProcesses']==[] and all(exit['portsClosed'].values())
    assert exit['elapsedSeconds']<=60 and exit['reason']=='first-dialog' and exit['exitCode']==0
    assert not exit['externalTERM'] and not exit['externalKILL'] and not exit['stdoutTruncated']
manifest={x['path']:x for x in load('raw/manifest.json')}
for name in ['abi-check.json','attempt.json','command.json','exit.json','fallback.png','final.png','observer-fixture.json','observer-summary.json','observer.jsonl','output-0.bin','output.log','outputs.json','preflight.json','previous-capture-seals.json','stop-request.json','stop.png']:
    p=E/'raw'/name;assert p.stat().st_size==manifest[name]['size'] and sha(p.read_bytes())==manifest[name]['sha256'],name
for name in ['sealed/observer.cjs','sealed/observer-fixture.cjs','launch.py','preflight.py','offline-gate.json']:
    p=E/name;assert sha(p.read_bytes())==manifest[name]['sha256'],name
gate=load('offline-gate.json');assert gate['passAll'] and gate['originalGuestAttemptsBeforeGate']==0
assert all(sha((E/n).read_bytes())==h for n,h in gate['scripts'].items())
remote=json.loads(load('offline-gate-remote.json')['stdout']);assert remote['exitCode']==0 and json.loads(remote['stdout'])['pass']
assert load('offline-gate-local.json')['exitCode']==0
events=[json.loads(x) for x in (E/'raw/observer.jsonl').read_text().splitlines()];assert len(events)==396
summary=load('raw/observer-summary.json');assert summary['errors']==[] and summary['missing']==[] and not summary['quota']['exhausted']
assert summary['quota']['events']==len(events) and summary['quota']['bytes']==(E/'raw/observer.jsonl').stat().st_size
exit=load('raw/exit.json');preservation(exit);finding=causal(events)
assert len([x for x in events if x.get('extractor')])==1
extractor=next(x['extractor'] for x in events if x.get('extractor'));assert extractor['member']=='INSTALL.EXE' and extractor['output'].endswith('_INS5576._MP')
bitmap=next(x for x in events if x['kind']=='return' and x.get('name')=='ReadFile' and x['caller']==0x401736)
assert bitmap['actual']==493016 and bitmap['eax']==1 and 'buffer' not in bitmap
archive=pathlib.Path('/home/user/wine-assembly-shadow-man-error112-cause-oct22/local/source/Demos/Shadowman/_inst32i.ex_').read_bytes()
assert sha(archive)=='b2ff4e8402a5160c491b1ac7eba0073fbbe2220dce107441461b250544eff35a'
reads=[]
for x in events:
    if x['kind']!='return' or x.get('name')!='ReadFile' or x['caller']!=0x404583:continue
    n=x['actual'];pos=x['file']['position']-n
    assert x['eax']==1 and n==6192 and sha(archive[pos:pos+n])==x['buffer']['sha256']
    reads.append(dict(seq=x['seq'],offset=pos,count=n,sha256=x['buffer']['sha256']))
assert len(reads)==7
output=(E/'raw/output-0.bin').read_bytes();outputs=load('raw/outputs.json');assert len(output)==69632 and outputs[0]['length']==69632
assert sha(output)==outputs[0]['sha256']=='23eaf19af07202fae358284fcc2d9e045b1fd16fbfecc2066136b3f3ba311d90'
for x in events:
    if x['kind']=='entry' and x.get('name')=='WriteFile':
        pos=x['file']['position'];assert sha(output[pos:pos+x['args'][2]])==x['buffer']['sha256']
assert all(x.get('eax')!=112 for x in events if x.get('name')=='GetLastError' and x['kind']=='return')
message=next(x for x in events if x['kind']=='entry' and x.get('name')=='MessageBoxA');assert 'Error 112.' in message['text']
assert any(f['return']==0x406581 for f in message['frames'])
stop=load('raw/stop-request.json');assert stop['reason']=='first-dialog' and stop['record']['seq']==message['seq']>finding['peek']['seq']
assert all(sha((E/'raw'/n).read_bytes())==sha((E/'raw/stop.png').read_bytes()) for n in ['final.png','fallback.png'])
assert not any(x.get('name') in ['CreateProcessA','WinExec','ShellExecuteA'] for x in events)
command=load('raw/command.json');assert '--spawn-processes' not in command and '--no-build' in command and '--max-seconds=60' in command
assert load('raw/attempt.json')['attempt']==1
for name,h in load('root-before.json').items():assert sha(pathlib.Path(name).read_bytes())==h,name
rejects=[]
for label,mutate in [('missing-WM_QUIT',lambda xs:next(x for x in xs if x.get('message',[0,0])[1]==18 and x['kind']=='return')['message'].__setitem__(1,0)),('forged-short-write',lambda xs:next(x for x in xs if x.get('name')=='WriteFile' and x['kind']=='return').__setitem__('actual',0))]:
    candidate=copy.deepcopy(events);mutate(candidate)
    try:causal(candidate)
    except AssertionError:rejects.append(label)
    else:raise AssertionError('accepted '+label)
candidate=dict(exit,prePostSealsMatch=False)
try:preservation(candidate)
except AssertionError:rejects.append('false-seals')
else:raise AssertionError('accepted false seals')
p=subprocess.run(['node',str(E/'sealed/observer-fixture.cjs')],capture_output=True,text=True);assert p.returncode==0,p.stderr
print(p.stdout.strip())
finding.update(reads=reads,outputSha256=sha(output),rejectControls=rejects,upstreamQuitOrigin='UNKNOWN: producer not traced; no production repair authorized',scope='historical original Setup; runtime/main not qualified')
(E/'analysis.json').write_text(json.dumps(finding,indent=2)+'\n')
print(json.dumps(dict(passAll=True,guestAttempts=1,retries=0,verdict='Error112 via WM_QUIT progress cancellation -11; no failed WriteFile observed',readSliceHashes=len(reads),writeChunkHashes=17,rootUnchanged=True,rejectControls=rejects)))
