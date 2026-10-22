"""Assigned-box API transport only. No lifecycle, SSH or environment inspection."""
import base64,hashlib,json,pathlib,subprocess,sys
E=pathlib.Path(__file__).resolve().parent
BOX='bx_2rhkq9ny'
REMOTE='/home/user/shadow-man-child-installer-handoff-oct22'
def run(code,name=None,timeout=30):
    p=subprocess.run(['boat','--json','exec',BOX,'--timeout',str(timeout),'--','python3','-c',code],capture_output=True,text=True)
    r=json.loads(p.stdout)
    if name:(E/name).write_text(json.dumps(r,indent=2)+'\n')
    assert p.returncode==0 and r.get('exitCode')==0,(p.returncode,r)
    return r
def transfer(name):
    data=(E/name).read_bytes(); assert len(data)<60000
    code='import pathlib,base64,hashlib;p=pathlib.Path(%r);p.parent.mkdir(parents=True,exist_ok=True);assert not pathlib.Path(%r).exists();b=base64.b64decode(%r);assert hashlib.sha256(b).hexdigest()==%r;p.write_bytes(b);print(len(b))'%(REMOTE+'/'+name,REMOTE+'/attempt.json',base64.b64encode(data).decode(),hashlib.sha256(data).hexdigest())
    return run(code,name+'.transfer.json')
def get(name):
    r=run('import pathlib,base64;p=pathlib.Path(%r);assert p.stat().st_size<2000000;print(base64.b64encode(p.read_bytes()).decode())'%(REMOTE+'/'+name))
    data=base64.b64decode(r['stdout']);out=E/'raw'/name;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(data);return out
if __name__=='__main__':
    if sys.argv[1]=='put':print(transfer(sys.argv[2]))
    elif sys.argv[1]=='get':print(get(sys.argv[2]))
    else:print(run(sys.argv[2],sys.argv[3] if len(sys.argv)>3 else None)['stdout'])
