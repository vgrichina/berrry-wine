from guard import *
import base64
configure_parent()
box='bx_67byn6ct'
# Remote first launch stopped before any fixture, backend or CLI invocation.
# Preserve the unmodified failed wrapper and update only this owned wrapper.
data=base64.b64encode((ROOT/'guard.py').read_bytes()).decode()
code="import pathlib,base64,os; p=pathlib.Path('/tmp/tvdt/guard.py'); p.rename('/tmp/tvdt/guard-initial.py'); p.write_bytes(base64.b64decode("+repr(data)+")); os.execv('/usr/bin/python3',['/usr/bin/python3','-B','/tmp/tvdt/remote_test.py'])"
r=run(['/home/user/.ascii/boat','exec',box,'--cwd','/tmp/tvdt','--timeout','110','--json','--','/usr/bin/python3','-B','-c',code],cwd=ROOT,check=False)
save('boat-production-runtime.json',r)
obj=json.loads(r['stdout']);print(json.dumps({k:obj.get(k) for k in ['exitCode','stderr','stdout','timedOut','stdoutTruncated','stderrTruncated']}))
