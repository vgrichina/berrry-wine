from ops import *
box=json.loads((E/'box.json').read_text())['id']
rc,out,err=run(['/home/user/.ascii/boat','--json','exec',box,'--timeout','30','--','python3','-B','/tmp/tvdrss/remote_test.py'],cwd=OWN,name='runtime',timeout=45)
print(json.dumps(dict(apiExit=rc,stdoutBytes=len(out),stderrBytes=len(err),box=box)))
