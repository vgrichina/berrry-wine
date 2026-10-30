import sys,pathlib,json,base64,hashlib
import ops
from limit_contract import configure_parent
ops.BASE=configure_parent();R=pathlib.Path(__file__).parent.resolve()
B=['/home/user/.ascii/boat'];box='bx_w5kuxjed'
def invoke(label,args):
 rc,out=ops.run(label,B+args,cwd=R/'repo');assert rc==0,(label,rc)
 return json.loads(out)
def remote(label,code):
 got=invoke(label,['exec','--json','--timeout','85',box,'--','/usr/bin/python3','-B','-c',code])
 assert got['exitCode']==0 and not got['stderr'],got
 return got
mode=sys.argv[1]
if mode=='transfer':
 m=json.loads((R/'manifest.json').read_text())
 files={'repo/'+k:(R/'repo'/k).read_bytes() for k in m['sourcePins']}
 for name in ['manifest.json','fixture.py','observer.py','cancellation-receipt.json']:files[name]=(R/name).read_bytes()
 for i,(name,data) in enumerate(files.items()):
  assert len(data)<=65536
  code='import pathlib,base64;r=pathlib.Path("/tmp/tvmr");r.mkdir(exist_ok=True);p=r/'+repr(name)+';p.parent.mkdir(parents=True,exist_ok=True);assert not p.exists();p.write_bytes(base64.b64decode('+repr(base64.b64encode(data).decode())+'));print(p.stat().st_size)'
  remote('transfer-'+str(i),code)
 print('TRANSFER PASS',sum(map(len,files.values())))
elif mode in ['preflight','guards']:
 got=invoke(mode+'-api',['exec','--json','--timeout','85',box,'--','/usr/bin/python3','-B','/tmp/tvmr/observer.py',mode])
 assert got['exitCode']==0,got
 data=b''
 for offset in range(0,65536,4096):
  got=remote(mode+'-read-'+str(offset),'import pathlib,base64;print(base64.b64encode(pathlib.Path("/tmp/tvmr/'+mode+'.json").read_bytes()['+str(offset)+':'+str(offset+4096)+']).decode())')
  chunk=base64.b64decode(got['stdout']);data+=chunk
  if len(chunk)<4096:break
 else:raise AssertionError('receipt too large')
 (R/(mode+'.json')).write_bytes(data)
 print('RETAINED',mode,len(data))
elif mode=='stop':invoke('boat-stop',['stop','--json',box])
elif mode=='state':
 got=invoke('boat-state',['info','--json',box]);(R/'lifecycle.json').write_text(json.dumps(got,indent=2));print('STATE',got['sandbox']['state'])
