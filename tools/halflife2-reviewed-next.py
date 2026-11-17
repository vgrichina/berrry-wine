#!/usr/bin/env python3
"""Bind a personally selected captured native BUTTON, never its parent frame.

This preflight uses public captured USER metadata only. The existing native
broker still proves the actual actor, generation and dispatch return fence.
No label selection, OCR, solver, or original installer automation lives here.
"""
import hashlib,json,os,pathlib,subprocess,sys,types
ROOT=pathlib.Path(__file__).resolve().parent.parent

def startup(m):
    m.reserve();target=m.identity();started=m.time.time()
    assert not (m.R/'startup-ready.json').exists(),'startup preflight is single-use'
    assert not (m.R/'input-owner.json').exists(),'startup cannot wait away a later context'
    deadline=min(started+15,m.read('launch.json')['gameplayCutoff']-3)
    polls=0
    while True:
        remaining=deadline-m.time.time();assert remaining>0,'passive startup readiness UNKNOWN'
        reply=m.call(dict(action='native-startup-readiness'),timeout=min(1,remaining));polls+=1
        assert reply['contract']=='native-startup-readiness-v1'
        with (m.R/'startup-polls.jsonl').open('a') as f:
            s=reply['snapshot']
            f.write(json.dumps(dict(at=m.time.time(),ready=reply['ready'],failures=reply['failures'],
                mainHwnd=s['mainHwnd'],modalHwnd=s['modalHwnd'],focus=s['focus'],
                focusTopLevel=s['focusTopLevel'],ordinaryOwner=reply['ordinaryOwner']))+'\n')
        if reply['ready']:
            assert m.identity()==target
            m.save('startup-ready.json',dict(startedAt=started,completedAt=m.time.time(),deadline=deadline,
                polls=polls,target=target,port=m.PORT,passive=True,**reply))
            return
        m.time.sleep(min(.02,max(0,deadline-m.time.time())))

def preflight(snapshot,target,x,y,label):
    rows=snapshot['windows'];matches=[w for w in rows if w['hwnd']==target]
    assert len(matches)==1,'target must be one captured native control'
    button=matches[0]
    assert button['controlClass']==1 and button['isChild'],'target must be native BUTTON, not frame'
    assert button['live'] and button['visible'] and not button['style']&0x08000000,'unavailable BUTTON'
    assert button['generation'] not in ('0','',None) and button['nativeTextAvailable']
    assert button['title']==label,'reviewed visible caption differs'
    assert button['processId']==snapshot['focusWindow']['processId']
    assert button['threadId']==snapshot['focusWindow']['threadId'],'wrong actual owner'
    top=snapshot['modalHwnd'] if snapshot['modalHwnd']!='0x0' else snapshot['mainHwnd']
    assert snapshot['focusTopLevel']==top and snapshot['physicalUp'] and snapshot['capture']=='0x0'
    chain=[];row=button
    while row['hwnd']!=top:
        assert row['hwnd'] not in chain and row['live'] and row['visible'],'invalid captured ancestry'
        assert row['processId']==button['processId'] and row['threadId']==button['threadId']
        chain.append(row['hwnd'])
        parents=[w for w in rows if w['hwnd']==row['parent']];assert len(parents)==1
        row=parents[0]
    assert row['live'] and row['visible'] and not row['isChild']
    mapping=snapshot['pointerMapping']
    assert all(mapping.get(k) is None for k in ('transform','viewport','clip')),'unsupported presentation mapping'
    assert mapping['canvas']==snapshot['screen']
    assert type(x) is int and type(y) is int
    assert 0<=x<snapshot['screen']['w'] and 0<=y<snapshot['screen']['h']
    assert button['screenX']<=x<button['screenX']+button['w']
    assert button['screenY']<=y<button['screenY']+button['h'],'pointer outside actual BUTTON'
    return dict(targetHwnd=target,generation=button['generation'],processId=button['processId'],
                threadId=button['threadId'],parent=button['parent'],top=top,chain=chain,
                x=x,y=y,nativeDispatchFenceRequired=True)

def controller():
    run=pathlib.Path(os.environ['DELPHI5_RUN']);pins=json.loads((run/'runtime-inputs.json').read_text())
    helper_name='tools/vb5cce-reviewed-control.py'
    body=subprocess.check_output(['git','show',pins['gitSHA']+':'+helper_name],cwd=ROOT)
    assert hashlib.sha256(body).hexdigest()==pins['sources'][helper_name]
    m=types.ModuleType('hl2_pinned_control');m.__file__=str(ROOT/helper_name)
    exec(compile(body,m.__file__,'exec'),m.__dict__)
    def sourcecheck():
        # The borrowed controller above was compiled from this exact Git blob,
        # not imported from its concurrently leased mutable checkout path.
        assert hashlib.sha256(body).hexdigest()==pins['sources'][helper_name]
        assert hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()==pins['sources']['tools/halflife2-reviewed-next.py']
    m.sourcecheck=sourcecheck
    reviewed=m.reviewed
    def checked(scene):
        rr,r=reviewed(scene)
        p=r['buttonPreflight']
        assert preflight(rr['snapshot'],r['targetHwnd'],p['x'],p['y'],r['visibleLabel'])==p
        return rr,r
    m.reviewed=checked
    mode=sys.argv[1]
    try:
        if mode=='startup':startup(m)
        elif mode=='capture':
            ready=m.read('startup-ready.json')
            assert ready['ready'] and ready['passive'] and ready['target']==m.identity() and ready['port']==m.PORT
            m.capture(sys.argv[2])
        elif mode=='review':
            scene,description,label,kind,target,x,y=sys.argv[2:9]
            assert kind in ('install','quit')
            rr=m.read(scene+'.json');assert m.hashlib.sha256((m.R/(scene+'.png')).read_bytes()).hexdigest()==rr['pngSHA256']
            p=preflight(rr['snapshot'],target,int(x),int(y),label)
            m.save(scene+'-review.json',dict(at=m.time.time(),rawCompleteScene=True,observation=description,
                 visibleLabel=label,kind=kind,targetHwnd=target,pngSHA256=rr['pngSHA256'],buttonPreflight=p))
        elif mode=='bind':m.bind(sys.argv[2])
        elif mode=='intent':
            name,scene,x,y,kind=sys.argv[2:7];rr,r=checked(scene)
            assert (int(x),int(y))==(r['buttonPreflight']['x'],r['buttonPreflight']['y'])
            m.intent(name,scene,int(x),int(y),kind)
        else:raise AssertionError('unsupported finite control operation')
    except BaseException as e:m.fail('hl2-button-preflight',e);raise

if __name__=='__main__':controller()
