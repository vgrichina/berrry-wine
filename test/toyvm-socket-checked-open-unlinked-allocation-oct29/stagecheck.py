from ops import *
import shlex
box=json.loads((E/'box.json').read_text())['id']
code='''import pathlib,json,hashlib,os,ast
p=pathlib.Path('/tmp/tvunlink');d=json.loads((p/'dispatch.json').read_text());r={}
for rel,pin in d['sourcePins'].items():
 b=(p/'repo'/rel).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256'];r[rel]=pin
for file,key in [('remote_test.py','runtimeObserverPin'),('fixture.py','runtimeFixturePin')]:
 b=(p/file).read_bytes();ast.parse(b);assert len(b)==d[key]['bytes'] and hashlib.sha256(b).hexdigest()==d[key]['sha256']
assert hashlib.sha256((p/'cancellation.json').read_bytes()).hexdigest()==d['originalCancellationReceiptPin']['sha256']
x={}
for file in ['/usr/bin/python3','/usr/bin/fusermount3']:
 assert os.access(file,os.X_OK);x[file]=dict(realpath=os.path.realpath(file),sha256=hashlib.sha256(pathlib.Path(file).read_bytes()).hexdigest())
assert pathlib.Path('/dev/fuse').exists();assert len(os.fsencode('/tmp/tvunlink/w/status.sock'))<108
print(json.dumps(dict(PASS=True,pins=r,executables=x,socketBytes=len(os.fsencode('/tmp/tvunlink/w/status.sock')))))'''
rc,out,err=run(['/home/user/.ascii/boat','--json','exec',box,'--timeout','20','--',shlex.join(['/usr/bin/python3','-B','-c',code])],cwd=OWN,name='stagecheck',timeout=30)
assert rc==0,(rc,err[:500]);envelope=json.loads(out);assert envelope['exitCode']==0;check=json.loads(envelope['stdout']);assert check['PASS'];record('staged-pins',check);print('stagecheck PASS socket27 five source pins and observer/fixture/executables')
