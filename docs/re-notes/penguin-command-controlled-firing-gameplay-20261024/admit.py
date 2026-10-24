import pathlib, subprocess, json, hashlib, os, shutil, time
H=pathlib.Path(__file__).parent
P=pathlib.Path('/tmp/penguin-quiet-gameplay-oct24/repo/docs/re-notes/penguin-command-quiet-original-gameplay-20261024')
D='/home/user/wine-assembly-shadow-man-span-static-canonical-oct23'
REV='b41a7c5f4b752d1f0bdab1141a11d4fed4dcf9a' # corrected exact revision below
REV='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
BOX='bx_spn54373'; R=str(H); B='/home/user/.ascii/boat'
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,j):(H/n).write_text(json.dumps(j,indent=2)+'\n')
def remote(cmd,timeout=30):
 p=subprocess.run([B,'--no-update','--json','exec','--timeout',str(timeout),BOX,cmd],capture_output=True,text=True,timeout=timeout+15)
 try:j=json.loads(p.stdout)
 except Exception:save('first-rejection.json',dict(returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));raise
 if p.returncode or j.get('exitCode')!=0:
  save('first-rejection.json',j);raise RuntimeError(str(j)[:2000])
 return j
def read(x):
 return subprocess.check_output(['git','-C',D,'show',REV+':'+x['path']],env=dict(os.environ,GIT_NO_LAZY_FETCH='1')) if x['kind']=='git' else pathlib.Path(x['path']).read_bytes()
