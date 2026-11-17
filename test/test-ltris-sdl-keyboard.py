"""Bounded authored native SDL keyboard qualification; no original process."""
import os, sys, pathlib, json, subprocess, socket, time, signal, importlib.util
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = pathlib.Path(os.environ['LTRIS_KEYBOARD_OUT']).resolve()
OUT.mkdir()
HEAD = subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip()
def save(n,v):
    with (OUT/n).open('x') as f: json.dump(v,f,indent=2);f.write('\n')
fixture = json.loads(subprocess.check_output(['node','test/test-ltris-sdl-keyboard.cjs'],cwd=ROOT))
with socket.socket() as s: s.bind(('127.0.0.1',0));port=s.getsockname()[1]
env = dict(os.environ,WINE_CONTROL_PHASE_TRACE=str(OUT/'http-phases.json'))
args = ['python3','-B','tools/ltris-parallel-native-runtime.py',str(OUT),'240',
        'node','test/run.js','--exe='+fixture['file'],'--no-build','--threads','--real-ticks',
        '--screen=1024x768','--max-seconds=240','--max-batches=10000000',
        '--control='+str(port),'--quiet-api','--quiet-blocks','--no-close']
for n in ['SDL.dll','libgcc_s_sjlj-1.dll','libwinpthread-1.dll']:
    args += ['--dll-seed='+str(ROOT/'test/binaries/candidates/ltris-128/game/LTRIS'/n)]
args += ['--dll-seed='+str(ROOT/'test/binaries/dlls/msvcrt.dll')]
save('fixture.json',dict(fixture=fixture,head=HEAD,args=args,original=False))
p = subprocess.Popen(args,cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
error = None
try:
    until=time.monotonic()+15
    while not (OUT/'native-pid.json').exists():
        assert p.poll() is None and time.monotonic()<until;time.sleep(.02)
    os.environ.update(FORSAKEN_CONTROL_OUT=str(OUT),FORSAKEN_CONTROL_URL='http://127.0.0.1:'+str(port)+'/ctl',LTRIS_CONTROL_HEAD=HEAD,LTRIS_CONTROL_PHASES='1')
    spec=importlib.util.spec_from_file_location('manual',ROOT/'tools/ltris-parallel-control.py')
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);c=m.c
    while True:
        try:
            snap=m.call(dict(action='snapshot'))
            if snap['mainHwnd']!='0x0' and snap['physicalUp']:break
        except RuntimeError as e:
            if 'ConnectionRefusedError' not in str(e):raise
        assert time.monotonic()<until;time.sleep(.05)
    c.capture('menu');rr=c.read('menu.json')
    owner=m.call(dict(action='guarded-bind',reviewedScene=dict(route='native-scene-v1',snapshot=rr['snapshot'],pngSHA256=rr['pngSHA256'])))
    c.save('input-owner.json',owner);c.save('lease-snapshot.json',{k:rr['snapshot'][k] for k in ('mainHwnd','screen')})
    review='menu'
    for name,key in [('board',13),('paused',80),('resumed',80),('left',37),('right',39),('exit',27)]:
        os.environ['LTRIS_REVIEW']=review
        c.save(review+'-review.json',dict(at=time.time(),pngSHA256=c.read(review+'.json')['pngSHA256'],observation='Authored SDL keyboard fixture expected transition; automated fixture review only'))
        c.call=m.safe_call
        result=c.pulse(name,['keydown:'+str(key)],400,review,'Authored keyboard menu board Pause release route',maxSceneAge=30,final=name=='exit')
        print(name,result,flush=True)
        if name!='exit':
            snap=m.call(dict(action='snapshot'));assert snap['physicalUp'],snap
        review=name
except BaseException as e:
    error=repr(e);save('failure.json',dict(error=error));print(error,flush=True)
finally:
    if error and p.poll() is None:
        info=json.loads((OUT/'native-pid.json').read_text());st=pathlib.Path('/proc/'+str(info['pid'])+'/stat').read_text()
        assert st[st.rindex(')')+2:].split()[19]==info['startToken'];os.killpg(info['pid'],signal.SIGTERM)
        save('host-cleanup.json',dict(signal=15,nativeQuit=False))
    a,b=p.communicate(timeout=30)
    save('outer-wait.json',dict(pid=p.pid,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
assert error is None,error
assert p.returncode==0
for name in ['native-wait.json','watchdog-wait.json','supervisor-child-wait.json']:
    r=json.loads((OUT/name).read_text());assert r['exit']==0 and all(r[k] for k in ['actualWait','stdoutEOF','stderrEOF']),r
assert '[Exit] code=0' in (OUT/'native.stdout.log').read_text()
names=['menu','board','paused','resumed','left','right']
pixels=json.loads(subprocess.check_output(['node','-e',"const fs=require('fs'),{PNG}=require('pngjs');console.log(JSON.stringify(process.argv.slice(1).map(p=>{const v=PNG.sync.read(fs.readFileSync(p)),i=(200*v.width+400)*4;return Array.from(v.data.slice(i,i+4));})))",*[str(OUT/(n+'.png')) for n in names]],cwd=ROOT))
assert pixels==[[0,0,0,255],[0,255,0,255],[255,0,0,255],[0,255,0,255],[0,0,255,255],[0,255,0,255]],pixels
receipts=[json.loads((OUT/(n+'-receipt.json')).read_text()) for n in names[1:]+['exit']]
assert all(r['consumed'] and r['receiptBoundary']=='native-input-return' for r in receipts)
assert not (OUT/'host-cleanup.json').exists() and not (OUT/'watchdog-fired.json').exists()
save('qualification.json',dict(pass_=True,original=False,SDLKeyboard=True,menuBoardPauseResume=True,matchingKeyupRequired=True,physicalUp=True,nativeQuit=True,pixels=dict(zip(names,pixels))))
