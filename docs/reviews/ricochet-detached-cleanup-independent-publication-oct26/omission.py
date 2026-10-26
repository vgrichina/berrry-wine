import pathlib,hashlib,json,sys,runpy
O=pathlib.Path(__file__).resolve().parent;p=O.parent/'repo/tools/boat-capture-readback.py'
original=p.read_bytes();source=original.decode();mode=sys.argv[1]
changes={
 'no-subreaper':('libc.prctl(36, 1,','libc.prctl(36, 0,','doublefork'),
 'no-signal':('signal.pidfd_send_signal(fd, signal.SIGKILL)','pass # deliberately omitted identity-bound signal','deadline'),
 'no-cancel-eof':('if select.select([control_fd], [], [], .002)[0]:','if False: # deliberately omitted EOF detection','callerexit'),
 'no-exit-cleanup':('while True:\n            try:\n                pid, _ = os.waitpid(-1, os.WNOHANG)',
                     'while status is None:\n            try:\n                pid, _ = os.waitpid(-1, os.WNOHANG)','success')}
before,after,case=changes[mode];assert source.count(before)==1
mutated=source.replace(before,after);rejected=False;failure=None
try:
 p.write_text(mutated)
 sys.argv=[str(O/'ownership.py'),case]
 try:runpy.run_path(sys.argv[0],run_name='__main__')
 except Exception as e:rejected=True;failure=type(e).__name__+': '+str(e)
finally:
 p.write_bytes(original)
assert p.read_bytes()==original
j=dict(mode=mode,testCase=case,sourceSHA256=hashlib.sha256(original).hexdigest(),mutatedSHA256=hashlib.sha256(mutated.encode()).hexdigest(),rejected=rejected,failure=failure,restored=True)
(O/(mode+'.json')).write_text(json.dumps(j,indent=2))
assert rejected,'Relevant omitted production control was not rejected'
checkpoint=O/'acceptance-checkpoint.json';state=json.loads(checkpoint.read_text())
state['completed'].append('Independent omitted control rejected: '+mode)
state.setdefault('omissions',{})[mode]=j
state['remaining']=['remaining independent omissions','verify reusable receipts','branch publication']
temporary=checkpoint.with_suffix('.new');temporary.write_text(json.dumps(state,indent=2));temporary.replace(checkpoint)
print('PASS expected rejection '+mode+': '+failure[:200])
