"""Independent deterministic parent receipts; invokes unchanged production CLI.

No guest, Node, screenshots, OCR or production-runner execution. Observations
and terminal receipts are supplied by a factual trusted parent in this model.
"""
import copy,json,pathlib,subprocess,sys,hashlib,os
H=pathlib.Path(__file__).parent
ENTRY=H.parent/'repo/tools/airstrike-menu-controller.py'
assert hashlib.sha256(ENTRY.read_bytes()).hexdigest()=='e96344c2a89dba87c28eba0aba9cd3ea5b400cc0245734b2bbc9248e110e7ebb'
O={'observation':{'after':None,'selected':6,'focus':'airstrike','unobscured':True,'evidence':'trusted-parent-desktop-1','keysReleased':True,'state':'menu','header':'Airstrike menu','items':['Resume game','Players setup','Toggle fullscreen','About the game','Release notes','Toggle debug mode','Quit game']}}
T={'terminal':{'reason':'guest-exit','guestExitCode':0,'runnerExitCode':0,'signals':[],'cleanupComplete':True,'evidence':'trusted-parent-terminal-1','timeout':False,'controlQuit':False,'wmClose':False,'fault':False,'hostExitObserved':True,'runnerLog':'[Exit] code=0\n'}}
def obs(**kw):
    x=copy.deepcopy(O);x['observation'].update(kw);return x
def ack(n,action,vk,**kw):
    a={'id':f'airstrike-{n}','ok':True,'value':{'batch':87+n,'logs':[f'[input] {action} vk={vk} at batch {87+n}']}};a.update(kw);return {'ack':a}
def term(**kw):
    x=copy.deepcopy(T);x['terminal'].update(kw);return x
def cmd(n,s):return {'id':f'airstrike-{n}','cmd':s}
records=[]
def case(name,messages,expected,success=False):
    p=subprocess.run([sys.executable,'-B',str(ENTRY)],input=''.join(json.dumps(x)+'\n' for x in messages),text=True,capture_output=True,timeout=12)
    got=[json.loads(x) for x in p.stdout.splitlines()];result=json.loads(p.stderr)
    record=dict(name=name,messages=messages,argv=[sys.executable,'-B',str(ENTRY)],returncode=p.returncode,stdout=p.stdout,stderr=p.stderr,expectedCommands=expected,expectedSuccess=success)
    records.append(record);(H/'boundary-transcripts.json').write_text(json.dumps(records,indent=2)+'\n')
    assert got==expected,(name,got,expected)
    assert (p.returncode,result['status'])==((0,'normal-quit-observed') if success else (2,'refused')),(name,p.returncode,result)
    if success:assert result['commands']==len(expected)
    checkpoint=dict(candidate='565ceadbe8e63c88754bda4590df156cbba6bf85',sourceSha256=hashlib.sha256(ENTRY.read_bytes()).hexdigest(),fixtureSha256=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),reusedGroups=5,completedIndependentCases=[x['name'] for x in records],evidence=str(H/'boundary-transcripts.json'),remaining=['remaining bounded boundary cases','task branch publication'],runtime=False)
    tmp=H/'checkpoint.tmp';tmp.write_text(json.dumps(checkpoint,indent=2)+'\n');os.replace(tmp,H/'checkpoint.json')
    print('PASS '+name,flush=True)

# Earliest actual-CLI execution boundary first: terminal receipt before any
# ordinary Quit activation must refuse with no dispatch.
case('terminal-before-observation',[T],[])
case('quit-keydown-terminal-without-ack',[O,T],[cmd(1,'keydown:13')],True)
case('terminal-after-keyup-ack',[O,ack(1,'keydown',13),ack(2,'keyup',13),T],[cmd(1,'keydown:13'),cmd(2,'keyup:13')],True)
case('stale-initial-observation',[obs(after='airstrike-2')],[])
case('uncertain-keys-released',[obs(keysReleased=None)],[])
case('boolean-menu-row-refused',[obs(selected=True)],[])
case('ack-identity-mismatch',[O,ack(1,'keydown',13,id='other')],[cmd(1,'keydown:13')])
case('queued-ack-even-with-input-log',[O,ack(1,'keydown',13,value={'queued':True,'batch':88,'logs':['[input] keydown vk=13 at batch 88']})],[cmd(1,'keydown:13')])
case('wrong-dispatched-key-log',[O,ack(1,'keydown',13,value={'batch':88,'logs':['[input] keydown vk=40 at batch 88']})],[cmd(1,'keydown:13')])
case('terminal-before-ordinary-quit-on-navigation',[obs(selected=5),T],[cmd(1,'keydown:40')])
case('keyup-ack-mismatch-stops',[O,ack(1,'keydown',13),ack(2,'keyup',13,id='airstrike-1'),T],[cmd(1,'keydown:13'),cmd(2,'keyup:13')])
case('stale-post-release-observation',[obs(selected=5),ack(1,'keydown',40),ack(2,'keyup',40),obs(after='airstrike-1')],[cmd(1,'keydown:40'),cmd(2,'keyup:40')])
case('fresh-observed-final-row-then-normal-quit',[obs(selected=5),ack(1,'keydown',40),ack(2,'keyup',40),obs(after='airstrike-2'),ack(3,'keydown',13),T],[cmd(1,'keydown:40'),cmd(2,'keyup:40'),cmd(3,'keydown:13')],True)
case('post-activation-fault-refused',[O,ack(1,'keydown',13),term(fault=True)],[cmd(1,'keydown:13'),cmd(2,'keyup:13')])
