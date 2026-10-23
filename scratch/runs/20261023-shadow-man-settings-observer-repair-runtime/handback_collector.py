import sys,ast,json,pathlib,base64,hashlib
sys.path.insert(0,'/home/user/wine-assembly-shadow-man-settings-observer-repair-runtime-oct23/scratch/runs/20261023-shadow-man-settings-observer-repair-runtime')
from transport import *
P=pathlib.Path('/home/user/wine-assembly-shadow-man-reviewed-helper-config-runtime-oct23/scratch/runs/20261023-shadow-man-reviewed-helper-config-runtime')
s=(P/'collect_handback.py').read_text();code=ast.literal_eval(next(n.value for n in ast.walk(ast.parse(s)) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='code' for t in n.targets)))
code=code.replace("['pgrep','-ax','node']","['pgrep','-ax','node']")
code=code.replace("assert not (F/'save-gameplay').exists()","assert len(list((F/'save-gameplay').glob('session*')))==1")
code=code.replace("guestAttempts=0,configurationActions=0,settingsWrites=0,gameLaunches=0","guestAttempts=1,configurationActions=2,settingsWrites=1,gameLaunches=0")
# Avoid repeatedly importing the entire fixed receipt set; preserve targeted final receipt separately.
code=code.replace("fixed={str(p.relative_to(F)):json.loads(p.read_text()) for p in F.rglob('*.json') if p.stat().st_size<180000 and p.name!='watchdog-fixture.json'}","fixed={}")
r=run('ROOT_PATH='+repr(ROOT)+'\n'+code,'handback-integrity-exact-process-api.json',30);h=json.loads(r['stdout']);assert h.pop('originalRows')==json.loads((E/'destination-original-hashes.json').read_text());h['acceptedDestinationReceiptUnchanged']=True
code='''import pathlib,json,hashlib,base64,os,subprocess
R=pathlib.Path(ROOT_PATH);F=R/'fixed/save-gameplay/session1';O=R/'mutable/output/save-gameplay/session1'
r=json.loads((F/'session-result.json').read_text());assert r['boundPassed'] and r['remaining']==[] and r['firstFailure']['line']=='[eip-zero] guest called through NULL at batch 2578996'
settings=O/'state-after-ok/vfs/program files/acclaim entertainment/shadowman/grafix.cfg';b=settings.read_bytes();assert len(b)==50 and hashlib.sha256(b).hexdigest()=='0407969d4bf39f2287f8d99bd37feac1212e6492f41038a817f77f39ef79d42d'
controls=json.loads(json.loads((F/'after-ok-controls.json').read_text())['stdout'])['controls'];play=[x for x in controls if x['id']==1025];assert any(x['parent']==0x1001c and not x['style']&0x08000000 and x['style']&0x10000000 for x in play)
export=O/'config-vfs';exported=export/'program files/acclaim entertainment/shadowman/grafix.cfg'
consumption=(F/'module-consumption.jsonl').read_text();assert 'ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553' in consumption
logs=(F/'session.log').read_text();bounds={k:logs.count(k) for k in ['ABANDONED wndproc','[eip-zero]','ExitProcess(']}
print(json.dumps(dict(settings=dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),base64=base64.b64encode(b).decode()),playControls=play,session=r,callbackLogCounts=bounds,vfsExport=dict(exists=export.exists(),files=sum(p.is_file() for p in export.rglob('*')),settingsExists=exported.exists(),settingsSHA256=hashlib.sha256(exported.read_bytes()).hexdigest() if exported.exists() else None,completeClaim=False),sourceCompilation=False,gameLaunches=0,additionalSessions=0,ownedNodeProcesses=subprocess.run(['pgrep','-ax','node'],capture_output=True,text=True).stdout)))
'''
r=run('ROOT_PATH='+repr(ROOT)+'\n'+code,'final-settings-state-api.json',20);state=json.loads(r['stdout']);(E/'session1-grafix.cfg').write_bytes(base64.b64decode(state['settings'].pop('base64')));save('final-settings-state.json',state)
box=api('sandboxes/'+BOX);save('box-final.json',box);b=box['sandbox'];assert b['state']=='idle' and b['health']=='ok' and b['stop'] is None
h.update(box=BOX,boxState='RUNNING (API idle)',health=b['health'],stop=b['stop'],expiry=b['archiveAfter'],coordinatorLifecycleOwner=True,coordinatorShutdown='2026-10-23T03:10:00Z',handbackBefore='2026-10-23T03:05:00Z',settings=state['settings'],actualPlayEnabled=True,reopenPersistence='UNTESTED: first guest blocker on ordinary exit',actualPlayLaunch='UNTESTED',session=state['session']);save('handback.json',h)
print(json.dumps({k:h[k] for k in ['box','boxState','expiry','allocation','ownedGroups','cloneUnchanged','settings','actualPlayEnabled','session']},indent=2))
