from pathlib import Path as P
import subprocess,sys,json,hashlib
h=P(__file__).resolve().parent.parent;p=h/'repo/test/helpers/palette-browser-supervisor.py';o=h/'ops';original=p.read_bytes()
assert original.count(b'if prior != version:')==1
try:
 p.write_bytes(original.replace(b'if prior != version:',b'if False:'))
 r=subprocess.run([sys.executable,str(o/'required-cross-sample.py')],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 (o/'reproducer-omission-child.log').write_bytes(r.stdout)
 result=json.loads((o/'required-cross-sample-result.json').read_text())
 (o/'reproducer-omission-result.json').write_text(json.dumps(result,indent=2)+'\n')
 assert r.returncode!=0
 assert all(not q['requiredMutationRejected'] for q in result['results'])
 print(json.dumps(dict(omission='cross-sample file version comparison disabled ONLY',unchangedReproducerSHA256=hashlib.sha256((o/'required-cross-sample.py').read_bytes()).hexdigest(),bothActualBoundariesAcceptedMutation=True,unchangedReproducerRejectedMutant=True,exit=r.returncode)))
finally:
 p.write_bytes(original)
assert p.read_bytes()==original
