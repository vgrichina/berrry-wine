import sys,json,pathlib,subprocess,base64,hashlib,os
ROOT=pathlib.Path(__file__).parent
BOX='bx_wbedea9e'
def guard(n=1048576):
 s=os.statvfs(ROOT);assert s.f_bavail*s.f_frsize-n>=2915041280,'local reserve'
 assert sum(p.stat().st_size for p in ROOT.rglob('*') if p.is_file())+n<64*1024**2,'task cap'
def run(args,name,timeout=180):
 p=subprocess.run(['boat','--json','exec',BOX,'--timeout',str(timeout),'--',*args],capture_output=True,text=True)
 v=json.loads(p.stdout);guard(len(p.stdout)+4096)
 (ROOT/(name+'.json')).write_text(json.dumps(v,indent=2))
 assert not v.get('stdoutTruncated') and not v.get('stderrTruncated'), 'truncated'
 print(v.get('stdout','')[-7000:]);print(v.get('stderr','')[-3000:])
 assert v.get('exitCode')==0,v
 return v
def put(src,dst):
 b=pathlib.Path(src).read_bytes()
 for i in range(0,len(b),48000):
  code='import pathlib,base64;p=pathlib.Path('+repr(dst)+');p.parent.mkdir(parents=True,exist_ok=True);f=p.open('+repr('wb' if i==0 else 'ab')+');f.write(base64.b64decode('+repr(base64.b64encode(b[i:i+48000]).decode())+'));f.close()'
  p=subprocess.run(['boat','--json','exec',BOX,'--timeout','30','--','python3','-c',code],capture_output=True,text=True);v=json.loads(p.stdout);assert v.get('exitCode')==0,v
 run(['sha256sum',dst],pathlib.Path(src).name+'-upload')
if __name__=='__main__':
 mode=sys.argv[1]
 if mode=='put':put(*sys.argv[2:])
 elif mode=='run':run(['bash','-lc',sys.argv[3]],sys.argv[2])
 elif mode in ('py','js'):
  f=ROOT/sys.argv[2];run(['python3' if mode=='py' else 'node','-c' if mode=='py' else '-e',f.read_text()],f.stem+'-receipt')
 elif mode=='get':
  remote,local=sys.argv[2:];v=run(['python3','-c','import pathlib,base64;print(base64.b64encode(pathlib.Path('+repr(remote)+').read_bytes()).decode())'],'transfer',60)
  b=base64.b64decode(v['stdout']);guard(len(b));(ROOT/local).write_bytes(b);print({'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
