#!/usr/bin/env python3
"""Run the actual adapted confirmation block under delayed durable receipt IO."""
import importlib.util,pathlib,subprocess,types
root=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('hl2',root/'tools/halflife2-reviewed-next.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
body=subprocess.check_output(['git','show','70e85792eefac2489f655a415490f9e0a5c9297d:tools/vb5cce-reviewed-control.py'],cwd=root)
fixed=m.receipt_clock_body(body).decode();a=fixed.index('        confirmation_at=time.time()');z=fixed.index('        assert all(receipt.get(k)',a)
import textwrap
block=textwrap.dedent(fixed[a:z])
for arrival,save_delay,state,consumed,ok in [(100.499,.020,'CONSUMED',True,True),(100.500,.001,'CONSUMED',True,False),(100.501,0,'CONSUMED',True,False),(100.499,0,'UNKNOWN',False,False),(100.499,0,'CANCELLED',False,False)]:
 now=[arrival];saved=[]
 def save(name,value):saved.append((name,value));now[0]+=save_delay
 env=dict(time=types.SimpleNamespace(time=lambda:now[0]),save=save,name='accept',start=100.,receipt=dict(state=state,consumed=consumed))
 try:exec(block,env)
 except AssertionError:assert not ok,(arrival,state)
 else:assert ok,(arrival,state)
 assert saved[0][1]['at']==arrival
# Reproduce the concrete old failure: reply on time, save pushes clock past500.
old=textwrap.dedent(body.decode()[body.decode().index("        save(name+'-down.json'"):body.decode().index('        assert all(receipt.get(k)')])
now=[100.499];env=dict(time=types.SimpleNamespace(time=lambda:now[0]),save=save,name='accept',start=100.,receipt=dict(state='CONSUMED',consumed=True))
# Explicit delayed save for the old comparison.
def oldsave(name,value):now[0]+=.020
env['save']=oldsave
try:exec(old,env)
except AssertionError:pass
else:raise AssertionError('old defect was not reproduced')
assert "start*1000<=receipt['consumedAt']" in fixed
assert "up['at']<start+1.75" in fixed and "time.time()<start+3" in fixed
print('PASS actual old confirmation defect reproduced; fixed on-time arrival survives durable IO, late/cancelled/UNKNOWN refused; all native/UP/aggregate bounds retained')
