from ops import *
import shlex
life=json.loads((E/'lifecycle.json').read_text());box=life['box']
assert not (E/'production-attempt.json').exists(),'one attempt only'
record('production-attempt',dict(box=box,at=time.time(),maximumInvocations=1))
cmd=shlex.join(['/usr/bin/python3','-B','/tmp/tvdr/runtime-observer.py'])
rc,out,err=run(['/home/user/.ascii/boat','exec',box,'--cwd','/tmp/tvdr/repo','--timeout','100','--json','--',cmd],cwd=REPO,name='runtime',timeout=120)
print(json.dumps(dict(exit=rc,stdoutBytes=len(out),stderrBytes=len(err))))
print(out[:5200]);print(err[:800])
