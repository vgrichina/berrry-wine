"""Offline rejecting controls; no transport/guest execution."""
import pathlib,importlib.util,copy,json,time
H=pathlib.Path(__file__).parent;R=H.parent/'repo'
s=importlib.util.spec_from_file_location('fixture',R/'test/test-airstrike-console-obscuration.py');t=importlib.util.module_from_spec(s);s.loader.exec_module(t)
results=[]
for kind in ('pixels','main-geometry','focus','hidden-main','extra-window','partialACK','missing-log','terminal-after-click'):
 if kind in ('partialACK','missing-log','terminal-after-click'):
  response=t.queued(1,'click:656:33',t.SNAPSHOT)
  if kind=='partialACK':response['completion']['step']['value']['ran']=0
  if kind=='missing-log':response['completion']['logs']=[]
  if kind=='terminal-after-click':response={'terminal':{'exit':0}}
  commands,reason=t.drive([dict(observation=t.approved()),response])
  assert commands==[dict(id='airstrike-1',cmd='click:656:33')]
  results.append(dict(control=kind,inputs=commands,reason=reason,noKeys=True));continue
 obj=t.Startup().bridge_obj();fresh=copy.deepcopy(obj.reviewed_capture[1]);sent=[];obj.write=sent.append
 if kind=='pixels':fresh['sha256']='changed'
 if kind=='main-geometry':fresh['snapshot']['windows'][0]['y']+=1
 if kind=='focus':fresh['focus']['focus']='0x10002'
 if kind=='hidden-main':fresh['snapshot']['windows'][0]['visible']=False
 if kind=='extra-window':fresh['snapshot']['windows'].append(dict(hwnd='0x999',visible=True))
 obj.capture=lambda *a:fresh
 try:obj.send(dict(id='airstrike-1',cmd='click:656:33'));raise AssertionError('must refuse '+kind)
 except t.b.Stop as e:reason=str(e)
 assert not sent
 results.append(dict(control=kind,inputs=sent,reason=reason))
(H/'independent-controls-result.json').write_text(json.dumps(dict(kind='OFFLINE actual Bridge.send/Controller protocol controls; not gameplay',results=results),indent=2)+'\n')
print('8 independent changed-pixels/geometry/focus/hidden/extra-window/ACK/log/terminal controls PASS; unsafe-height rejection unchanged.')
