import importlib.util,pathlib,json,hashlib
H=pathlib.Path(__file__).parent
D=pathlib.Path('/tmp/airstrike-complete-controller-main-integration-oct27/repo')
P=D/'tools/airstrike-menu-controller.py'
assert hashlib.sha256(P.read_bytes()).hexdigest()=='e96344c2a89dba87c28eba0aba9cd3ea5b400cc0245734b2bbc9248e110e7ebb'
s=importlib.util.spec_from_file_location('controller',P);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
q=json.loads((H/'frozen-runner-result.json').read_text());sent=[]
startup=json.loads((H/'node-startup-explicit.stdout').read_text())
assert q['node']['executable']==startup['executable']
assert q['node']['flags']==startup['flags']
assert q['node']['limits']==startup['limits']
assert q['node']['environmentSHA256']==startup['environmentSHA256']
c=m.Controller(lambda:{'ack':q['ack']},sent.append)
try:c.key('keydown',27)
except m.Refusal as e:reason=str(e)
else:raise AssertionError('queued ACK unexpectedly accepted')
assert sent==[q['command']]
B=(D/'tools/airstrike-observation-bridge.py').read_bytes()
assert hashlib.sha256(B).hexdigest()=='72df7a6e70d41bb3bb6c659e43b73f053bea1269c1b1a134f4060976a7d5f65f'
assert b"self.request('step'" not in B and b"self.request('frozen'" not in B
result=dict(status='BLOCKED_EXACT_PRODUCTION_FROZEN_DISPATCH_CONTRACT',fixtureOnly=True,actualGuestStarts=0,controllerSHA256=hashlib.sha256(P.read_bytes()).hexdigest(),bridgeSHA256=hashlib.sha256(B).hexdigest(),reason=reason,commands=sent,sourceRunnerSHA256=q['sourceSHA256'],extractions=q['extractions'],gate='unchanged bridge has no step/thaw orchestration; frozen input ACK is queued and lacks actual input logs; unchanged controller refuses before key release, Down or Enter',remaining='Actual focus/menu rows0..6, ordinary Quit, guest Exit0 and runner exit remain unqualified',resolution='Coordinator must authorize a bridge/runner protocol repair or clarify a permitted thaw/freeze adapter; no source semantic edits authorized in this task')
(H/'dispatch-boundary-result.json').write_text(json.dumps(result,indent=2)+'\n');print(result['status'],reason)
