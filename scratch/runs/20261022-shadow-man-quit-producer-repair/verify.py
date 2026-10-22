#!/usr/bin/env python3
"""Offline causal and preservation checks; no guest, build, network or state edits."""
import copy, datetime, hashlib, json, pathlib, struct
E=pathlib.Path(__file__).resolve().parent
SETUP=pathlib.Path('/home/user/wine-assembly-shadow-man-original-recover-runtime-oct22/scratch/runs/20261022-shadow-man-original-source/ranges/161796096-73728.bin')
sha=lambda b:hashlib.sha256(b).hexdigest()
def analyze(a):
    def one(pred):
        hits=[(i+1,r) for i,r in enumerate(a) if pred(r)];assert hits;return hits[0]
    init=one(lambda r:r.get('kind')=='return' and r.get('name')=='GetTickCount' and r.get('caller')==0x402ffd)
    deadline=init[1]['eax']+120000;assert deadline==219801
    timers=[(i+1,r) for i,r in enumerate(a) if r.get('kind')=='return' and r.get('name')=='GetTickCount' and r.get('caller')==0x4030d1]
    assert timers[-2][1]['eax']==214206<deadline<timers[-1][1]['eax']==222206
    dispatch=one(lambda r:r.get('kind')=='quit-api' and r.get('name')=='DispatchMessageA' and r.get('phase')=='entry' and r.get('tick')==222204)
    assert dispatch[1]['message'][:4]==[0x10001,0x113,1001,0]
    destroy=one(lambda r:r.get('kind')=='entry' and r.get('name')=='DestroyWindow' and r.get('caller')==0x403869)
    assert destroy[1]['args'][0]==0x10001
    callback=one(lambda r:r.get('kind')=='window-callback' and r.get('pc')==0x403034 and r['stack'][1:3]==[0x10001,2])
    producer=one(lambda r:r.get('kind')=='entry' and r.get('name')=='PostQuitMessage')
    assert producer[1]['caller']==0x403242 and producer[1]['args'][0]==0
    transition=one(lambda r:r.get('kind')=='quit-transition' and r.get('quit')==2)
    assert transition[1]['where']=='api-return' and transition[1]['queue']==[] and transition[1]['tick']==222206
    peek=one(lambda r:r.get('kind')=='return' and r.get('name')=='PeekMessageA' and r.get('message',[0,0])[1]==0x12)
    assert peek[1]['caller']==0x4062fc and peek[1]['eax']==1 and peek[1]['message'][:4]==[0x10008,0x12,0,0]
    assert init[0]<dispatch[0]<timers[-1][0]<destroy[0]<callback[0]<producer[0]<transition[0]<peek[0]
    assert not [r for r in a[:producer[0]-1] if r.get('kind')=='quit-transition' and r.get('quit')]
    assert not [r for r in a[:peek[0]] if r.get('kind')=='host-input' and r.get('name')=='check_input' and r.get('result',0)&0xffff==0x12]
    resource=one(lambda r:r.get('kind')=='pc' and r.get('pc')==0x405ea1)
    assert resource[1]['resourceCall']=={'return':0x406581,'resource':0x1b98,'argument':0}
    assert resource[1]['status']==-11
    writes=[r for r in a if r.get('kind')=='return' and r.get('name')=='WriteFile']
    assert len(writes)==17 and all(r['actual']==r['args'][2]==4096 and r['eax']==1 for r in writes)
    assert not [r for r in a if r.get('kind')=='observer-fault']
    return dict(deadline=deadline,initialTick=init[1]['eax'],previousTimerTick=timers[-2][1]['eax'],expiryTick=timers[-1][1]['eax'],lines={k:v[0] for k,v in dict(initialTick=init,timerDispatch=dispatch,destroyWindow=destroy,wmDestroyCallback=callback,actualPostQuitMessage=producer,quitFlagTransition=transition,peekWMQuit=peek,errorResource=resource).items()},producerCall='0x40323c',producerReturn='0x403242',callback='0x403034 WM_DESTROY',reason='WM_TIMER/id1001 observes GetTickCount222206 > initialization99801+120000; guest timeout destroys splash, whose WM_DESTROY posts explicit quit',writeCalls=len(writes))
def verify():
    setup=SETUP.read_bytes();assert len(setup)==73728 and sha(setup)=='5656e87da0641c9dcfcd0ee8949ce72b3fa6a7d0e8b1fd985a16f6bd6c34ce52'
    pe=struct.unpack_from('<I',setup,60)[0]; n=struct.unpack_from('<H',setup,pe+6)[0];opt=pe+24;size=struct.unpack_from('<H',setup,pe+20)[0]
    sections=[struct.unpack_from('<IIII',setup,opt+size+40*i+8) for i in range(n)]
    def offset(va):
        rva=va-0x400000
        return next(ptr+rva-base for vs,base,raw,ptr in sections if base<=rva<base+max(vs,raw))
    def at(va,b):assert setup[offset(va):offset(va)+len(b)]==b
    imports={};desc=offset(0x400000+struct.unpack_from('<I',setup,opt+104)[0])
    while any(setup[desc:desc+20]):
        oft,_,_,_,ft=struct.unpack_from('<5I',setup,desc);i=0
        while True:
            thunk=struct.unpack_from('<I',setup,offset(0x400000+(oft or ft)+i*4))[0]
            if not thunk:break
            if not thunk&0x80000000:
                pos=offset(0x400000+thunk)+2;end=setup.index(0,pos);imports[0x400000+ft+i*4]=setup[pos:end].decode()
            i+=1
        desc+=20
    for va,name in {0x40d1e8:'PostQuitMessage',0x40d1bc:'DestroyWindow',0x40d0c8:'GetTickCount',0x40d280:'SetTimer'}.items():assert imports[va]==name
    at(0x402ffd,bytes.fromhex('05c0d40100a3b0074100'))
    at(0x4030d1,bytes.fromhex('3b05b007410076105757ff7508e837070000'))
    at(0x40323b,bytes.fromhex('57ff15e8d14000'))
    at(0x40385f,bytes.fromhex('ff742408ff15bcd14000'))
    a=[json.loads(x) for x in (E/'raw/observer.jsonl').read_text().splitlines()];result=analyze(a)
    output=(E/'raw/output-0.bin').read_bytes();assert len(output)==69632 and sha(output)=='23eaf19af07202fae358284fcc2d9e045b1fd16fbfecc2066136b3f3ba311d90'
    archive=pathlib.Path('/home/user/wine-assembly-shadow-man-error112-cause-oct22/local/source/Demos/Shadowman/_inst32i.ex_').read_bytes()
    assert len(archive)==296674 and sha(archive)=='b2ff4e8402a5160c491b1ac7eba0073fbbe2220dce107441461b250544eff35a'
    entries={r['seq']:r for r in a if r.get('kind')=='entry'};readCount=0
    for r in a:
        if r.get('kind')=='entry' and r.get('name')=='WriteFile':
            start=r['file']['position'];assert sha(output[start:start+r['args'][2]])==r['buffer']['sha256']
        if r.get('kind')=='return' and r.get('name')=='ReadFile' and r.get('caller')==0x404583:
            start=entries[r['seq']]['file']['position'];assert r['eax']==1 and r['actual']==6192 and sha(archive[start:start+r['actual']])==r['buffer']['sha256'];readCount+=1
    assert readCount==7
    rejected=[]
    for name,mutate in [
      ('missing-first-producer',lambda b:b.pop(result['lines']['actualPostQuitMessage']-1)),
      ('deadline-not-expired',lambda b:b.__setitem__(next(i for i,r in enumerate(b) if r.get('kind')=='return' and r.get('seq')==248),dict(b[next(i for i,r in enumerate(b) if r.get('kind')=='return' and r.get('seq')==248)],eax=219000))),
      ('synthetic-quit-claim',lambda b:b[result['lines']['quitFlagTransition']-1].__setitem__('quit',1)),
      ('wrong-callback',lambda b:b[result['lines']['wmDestroyCallback']-1]['stack'].__setitem__(2,0x113))]:
        b=copy.deepcopy(a);mutate(b)
        try:analyze(b)
        except (AssertionError,IndexError,KeyError):rejected.append(name)
        else:raise AssertionError('mutation accepted: '+name)
    for x in json.loads((E/'raw/manifest.json').read_text()):
        p=E/'raw'/x['path']
        if not p.exists():p=E/x['path']
        data=p.read_bytes();assert len(data)==x['size'] and sha(data)==x['sha256'],x['path']
    for x in json.loads((E/'source-seals.json').read_text()):
        label='historical' if x['revision'].startswith('c262') else 'main';data=(E/'source'/label/x['path']).read_bytes()
        assert len(data)==x['bytes'] and sha(data)==x['sha256']
        assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==x['blob']
    gate=json.loads((E/'offline-gate.json').read_text());assert gate['passAll']
    for x in gate['seals']:assert sha((E/x['path']).read_bytes())==x['sha256']
    exit=json.loads((E/'raw/exit.json').read_text());assert exit['exitCode']==0 and exit['reason']=='first-dialog' and exit['elapsedSeconds']<45
    pins=json.loads((E/'raw/preflight.json').read_text());assert pins['passAll']
    module=next(x for x in pins['seals'] if x['path'].endswith('/runtime/build/wine-assembly.wasm'))
    assert module['size']==1878971 and module['sha256']=='f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
    assert exit['sealedFiles']==390 and exit['prePostSealsMatch'] and exit['previousCaptureUnchanged'] and exit['previousCaptureFiles']==45
    assert exit['guestProcesses']==[] and all(exit['portsClosed'].values()) and exit['freeBytes']>=4*1024**3 and exit['newBytes']+16*1024**2<128*1024**2
    summary=json.loads((E/'raw/observer-summary.json').read_text());assert summary['errors']==summary['missing']==[] and not summary['quota']['exhausted']
    ctl=json.loads((E/'raw/control-input.json').read_text());stop=json.loads((E/'raw/stop-request.json').read_text())
    transition=a[result['lines']['quitFlagTransition']-1];assert transition['time']<stop['time']<=ctl['at']
    command=json.loads((E/'raw/command.json').read_text());assert '--no-build' in command and '--max-seconds=45' in command and '--spawn-processes' not in command
    for p,digest in json.loads((E/'root-before.json').read_text()).items():assert sha(pathlib.Path(p).read_bytes())==digest
    result.update(rejectControls=rejected,originalSetupSha256=sha(setup),traceSha256=sha((E/'raw/observer.jsonl').read_bytes()),traceEvents=len(a),traceBytes=(E/'raw/observer.jsonl').stat().st_size,scope='historical diagnostic only; actual guest explicit quit, no emulator defect demonstrated; no production repair')
    return result
if __name__=='__main__':print(json.dumps(verify(),indent=2))
