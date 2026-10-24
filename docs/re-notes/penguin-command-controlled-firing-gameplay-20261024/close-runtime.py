from admit import *
import shlex
q='''import os,pathlib,json,shutil
h=pathlib.Path(ROOT)
owned=[]
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  cmd=(p/'cmdline').read_bytes().split(b'\\0')
  if cmd and b'node' in pathlib.Path(os.fsdecode(cmd[0])).name.encode() and any(str(h).encode() in c for c in cmd):owned.append(int(p.name))
 except (OSError,ValueError):pass
files=[p for p in h.rglob('*') if p.is_file()]
j=dict(uid=os.getuid(),ownedGuestNodes=owned,files=len(files),bytes=sum(p.stat().st_size for p in files),maxFile=max(p.stat().st_size for p in files),free=shutil.disk_usage('/tmp').free,box='bx_spn54373',disposition='RUNNING; coordinator owns shutdown03:42UTC',expires='2026-10-24T03:52:49.910Z')
assert not owned
print(json.dumps(j))'''.replace('ROOT',repr(R))
save('remote-before-cleanup.json',remote('python3 -c '+shlex.quote(q)))
# All runtime evidence is already collected and hashed; remove only exact immutable staging copies.
q2='import pathlib,shutil,json;h=pathlib.Path('+repr(R)+');names=["game","runner","runtime"];[(shutil.rmtree(h/n)) for n in names];print(json.dumps(dict(removed=names,evidenceRetained=True)))'
save('remote-staging-cleanup.json',remote('python3 -c '+shlex.quote(q2)))
save('remote-final.json',remote('python3 -c '+shlex.quote(q)))
p=subprocess.run([B,'--no-update','--json','info',BOX],capture_output=True,text=True,check=True);save('box-final.json',json.loads(p.stdout));print(json.dumps(json.loads(p.stdout)['sandbox'],separators=(',',':')))
