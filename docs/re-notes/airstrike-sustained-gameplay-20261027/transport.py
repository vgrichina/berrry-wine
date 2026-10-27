import pathlib,json,subprocess,sys,base64,hashlib,time,shutil,os
H=pathlib.Path(__file__).parent;R='/home/user/airstrike-sustained-oct27';BOX='bx_ra5kxtgq';D='/home/user/wine-assembly-shadow-man-span-static-canonical-oct23';C='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
sys.path.insert(0,str(H));from git import git
M=pathlib.Path('/tmp/airstrike-retained-codec-gameplay-oct24/complete-runtime-manifest.json')
def save(n,x):(H/n).write_text(json.dumps(x,indent=2)+'\n')
def remote(code,*args,timeout=30):
 cmd=['/home/user/.ascii/boat','exec','--json','--timeout',str(timeout),BOX,'--','python3','-c',code,*args]
 assert sum(len(s.encode())+1 for s in cmd)<65536
 p=subprocess.run(cmd,capture_output=True,text=True,timeout=timeout+20)
 try:r=json.loads(p.stdout)
 except Exception:raise RuntimeError(p.stdout[:1000]+p.stderr[:1000])
 if p.returncode or not r.get('success') or r.get('exitCode')!=0:save('access-or-command-failure.json',r);raise RuntimeError(str(r)[:2000])
 assert not r.get('stdoutTruncated') and len(r.get('stdout',''))<8192
 return r
def put(dest,b):
 for i in range(0,len(b),30000):
  chunk=b[i:i+30000]
  code='import pathlib,base64,sys,shutil; r=pathlib.Path(sys.argv[1]);r.parent.mkdir(parents=True,exist_ok=True);assert shutil.disk_usage(r.parent).free>2982150144+100663296;f=r.open("wb" if sys.argv[2]=="0" else "ab");f.write(base64.b64decode(sys.argv[3]));f.close();print("ok")'
  remote(code,R+'/'+dest,str(i),base64.b64encode(chunk).decode())
def main():
 assert hashlib.sha256(M.read_bytes()).hexdigest()=='1f275b43aa49116ec14559ee9fe6686749aeed077ea9e7123f52728f568d4241'
 rows=json.loads(M.read_text());receipt=[]
 for n,f in enumerate(rows):
  b=git(['-C',D,'show',C+':'+f['source']]) if f['kind']=='git' else pathlib.Path(f['source']).read_bytes()
  assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256']
  put(f['dest'],b);receipt.append(f['dest'])
  if n%25==0:save('transfer-progress.json',{'completed':n+1,'files':receipt,'at':time.time()})
 put('manifest.json',M.read_bytes())
 r=remote('import json,pathlib,hashlib,sys,shutil; r=pathlib.Path(sys.argv[1]);m=json.loads((r/"manifest.json").read_text());bad=[f["dest"] for f in m if (r/f["dest"]).stat().st_size!=f["bytes"] or hashlib.sha256((r/f["dest"]).read_bytes()).hexdigest()!=f["sha256"]];assert not bad,bad;print(json.dumps(dict(files=len(m),bytes=sum(f["bytes"] for f in m),bad=bad,free=shutil.disk_usage(r).free)))',R)
 save('remote-input-verification.json',r)
 print('261 exact files transferred and remotely rehashed')
if __name__=='__main__':main()
