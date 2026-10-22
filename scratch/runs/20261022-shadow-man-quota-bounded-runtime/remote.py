"""Single assigned Boat API transport. No lifecycle operations or binary retrieval."""
import base64,hashlib,json,pathlib,subprocess
E=pathlib.Path(__file__).resolve().parent
W=E.parents[2]
BOX='bx_495585da'
REMOTE='/home/user/shadow-man-tools-ready-oct22'
def save(name,value):
 (E/name).write_text(json.dumps(value,indent=2)+'\n')
def run(code,name=None,timeout=30):
 p=subprocess.run(['boat','--json','exec',BOX,'--timeout',str(timeout),'--','python3','-c',code],capture_output=True,text=True)
 r=json.loads(p.stdout)
 if name:save(name,r)
 assert p.returncode==0 and r.get('exitCode')==0,(p.returncode,r,p.stderr)
 return r
def transfer(data,rel):
 target=REMOTE+'/'+rel
 run('import pathlib;p=pathlib.Path(%r);p.parent.mkdir(parents=True,exist_ok=True);assert not p.exists();p.write_bytes(b"")'%target)
 for pos in range(0,len(data),60000):
  run('import os,base64;f=os.open(%r,os.O_WRONLY);b=base64.b64decode(%r);assert os.pwrite(f,b,%d)==len(b);os.close(f)'%(target,base64.b64encode(data[pos:pos+60000]).decode(),pos))
 run('import pathlib,hashlib;p=pathlib.Path(%r);assert p.stat().st_size==%d;assert hashlib.sha256(p.read_bytes()).hexdigest()==%r'%(target,len(data),hashlib.sha256(data).hexdigest()))
