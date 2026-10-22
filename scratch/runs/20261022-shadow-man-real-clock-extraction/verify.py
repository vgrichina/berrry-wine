"""Offline evidence acceptance only; never launches a guest."""
import hashlib,json,pathlib,struct,copy
E=pathlib.Path(__file__).resolve().parent
def read(n):return json.loads((E/n).read_text())
def sha(b):return hashlib.sha256(b).hexdigest()
def accept(cmd,summary,outputs,exit):
    assert cmd.count('--real-ticks')==1 and '--max-seconds=55' in cmd
    assert not any(x.startswith(('--spawn-processes','--input=','--time-scale=','--startup-clock','--pipe-child')) for x in cmd)
    assert not summary['errors'] and not summary['missing'] and not summary['quota']['exhausted']
    real=summary['real'];initial=real['ticks']['initial'];final=real['finalTick']
    assert 0<=initial<=final<initial+120000
    assert real['totals']['shortWrites']==0
    assert exit['reason']=='child-attempt' and 0<exit['elapsedSeconds']<=60
    assert exit['prePostSealsMatch'] and exit['sealedFiles']==390 and exit['previousCaptureUnchanged']
    assert exit['previousCaptureFiles']==73 and not exit['guestProcesses'] and all(exit['portsClosed'].values())
    expected=read('accepted-archive-analysis.json')['members'][:3]
    assert len(outputs)==4
    for member,out in zip(expected,outputs):
        assert out['length']==member['expanded'] and out['path'].lower().endswith(member['names'][1].lower())
        data=(E/'raw'/out['artifact']).read_bytes();assert len(data)==out['length'] and sha(data)==out['sha256']
        assert data[:2]==b'MZ';pe=struct.unpack_from('<I',data,0x3c)[0];assert data[pe:pe+4]==b'PE\0\0'
    assert sum(x['length'] for x in outputs)==656970
    assert real['totals']['writeBytes']==657162
    return dict(initialTick=initial,firstTick=real['ticks']['first'],finalTick=final,deadline=initial+120000,deadlineExpired=False,elapsedSeconds=exit['elapsedSeconds'],outputs=outputs,writeCalls=real['counts']['return:WriteFile'],boundary='WinExec entry 0x405b1f before API execution',guestInstallationSuccess=False)
def main():
    pins=read('raw/preflight.json')['seals']
    for suffix,size,digest in [('/runtime/build/wine-assembly.wasm',1878971,'f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'),('/recovery/source/Demos/Shadowman/Setup.exe',73728,'5656e87da0641c9dcfcd0ee8949ce72b3fa6a7d0e8b1fd985a16f6bd6c34ce52')]:
        row=[x for x in pins if x['path'].endswith(suffix)];assert len(row)==1 and row[0]['size']==size and row[0]['sha256']==digest
    gate=json.loads(read('offline-gate.json')['stdout'])
    assert sha((E/'source/run.js').read_bytes())==gate['runnerSha256']
    assert sha((E/'source/guest-clock.js').read_bytes())==gate['clockSha256']
    assert read('protected-root.json')['passAll'] and json.loads(read('final-preservation.json')['stdout'])['passAll']
    manifest=read('raw/manifest.json')
    for x in manifest:
        b=(E/'raw'/x['path']).read_bytes();assert len(b)==x['size'] and sha(b)==x['sha256'],x['path']
    assert sum(x['size'] for x in manifest)<8*1024**2
    cmd=read('raw/command.json');summary=read('raw/observer-summary.json');outputs=read('raw/outputs.json');exit=read('raw/exit.json')
    result=accept(cmd,summary,outputs,exit)
    partial=read('accepted-archive-analysis.json')['partial']
    assert sha((E/'raw/output-0.bin').read_bytes()[:partial['bytes']])==partial['sha256']
    stop=read('raw/stop-request.json');assert stop['record']['name']=='WinExec' and stop['record']['caller']==0x405b1f
    events=[json.loads(x) for x in (E/'raw/observer.jsonl').read_text().splitlines()]
    assert not any(x.get('kind')=='observer-fault' or x.get('name')=='MessageBoxA' for x in events)
    assert not any(x.get('name')=='PostQuitMessage' for x in events)
    assert any(x.get('name')=='SetTimer' and x.get('kind')=='entry' and x['args'][1:3]==[1001,1000] for x in events)
    assert not any(x.get('kind')=='return' and x.get('name')=='WinExec' for x in events)
    initial=[x for x in events if x.get('kind')=='return' and x.get('name')=='GetTickCount' and x['caller']==0x402ffd];assert len(initial)==1 and initial[0]['eax']==result['initialTick']
    assert '[max-seconds]' not in (E/'raw/output.log').read_text()
    assert read('offline-gate.json')['exitCode']==0
    controls=[]
    for kind in ['clock','deadline','output','child-boundary']:
        c=copy.deepcopy(cmd);s=copy.deepcopy(summary);o=copy.deepcopy(outputs);x=copy.deepcopy(exit)
        if kind=='clock':c.remove('--real-ticks')
        if kind=='deadline':s['real']['finalTick']=s['real']['ticks']['initial']+120001
        if kind=='output':o[0]['length']-=1
        if kind=='child-boundary':x['reason']='installed'
        try:accept(c,s,o,x)
        except AssertionError:controls.append(kind)
        else:raise AssertionError('rejecting control accepted '+kind)
    result['rejectingControls']=controls;result['passAll']=True
    print(json.dumps(result,indent=2))
if __name__=='__main__':main()
