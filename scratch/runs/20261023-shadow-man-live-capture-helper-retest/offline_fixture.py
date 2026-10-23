import copy,json,pathlib
from live_operator import capture
E=pathlib.Path(__file__).resolve().parent
actual=json.loads((E/'remote-launcher-live-snapshot.json').read_text())
calls=[]
assert capture(lambda args,label:calls.append([args,label]),actual,'fixture-only.png')
assert calls==[[['png','fixture-only.png'],'launcher-live-png']]
cases=[]
for name in ['nonlauncher','unready','malformed','hidden','child','wrongHWND','quit','ctlFailure']:
    r=copy.deepcopy(actual);s=json.loads(r['stdout'])
    if name=='nonlauncher':s['windows'][0]['title']='Other'
    if name=='unready':s['windows']=[]
    if name=='hidden':s['windows'][0]['visible']=False
    if name=='child':s['windows'][0]['isChild']=True
    if name=='wrongHWND':s['windows'][0]['hwnd']='0x10002'
    if name=='quit':s['quit']=True
    if name=='ctlFailure':r['exit']=1
    r['stdout']='{' if name=='malformed' else json.dumps(s)
    rejected=[];assert capture(lambda *a:rejected.append(a),r,'never.png') is False and not rejected
    cases.append(name)
(E/'offline-fixture.json').write_text(json.dumps(dict(passAll=True,actualSnapshotAdvancedToPng=True,pngCalls=calls,rejected=cases,guestCalls=0),indent=2))
print('PASS actual top-level snapshot advances to PNG; eight negative cases issue no command')
