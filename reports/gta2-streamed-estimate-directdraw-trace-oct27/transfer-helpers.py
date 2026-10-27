import pathlib,json,base64,shlex
from api import api
O=pathlib.Path(__file__).parent;g=json.loads((O/'helpers-plan.json').read_text());R='/home/user/wineops-gta2-causal-trace-oct27';rp=R+'/helpers.tar.gz'
with (O/'helpers.tar.gz').open('rb') as f:
 count=0
 while b:=f.read(22500):
  code='import pathlib,base64;p=pathlib.Path('+repr(rp)+');f=p.open('+repr('xb' if count==0 else 'ab')+');f.write(base64.b64decode('+repr(base64.b64encode(b).decode())+'));f.close();print("ok")'
  api('python3 -c '+shlex.quote(code));count+=1
code='import pathlib,tarfile,hashlib;p=pathlib.Path('+repr(rp)+');assert hashlib.sha256(p.read_bytes()).hexdigest()=='+repr(g['sha256'])+'\nwith tarfile.open(p,"r|gz") as t:\n for m in t:\n  assert m.isfile() and not m.name.startswith("/") and ".." not in pathlib.Path(m.name).parts\n  t.extract(m,'+repr(R)+',filter="data")\np.unlink();print("helpers verified")'
print(json.dumps(api('python3 -c '+shlex.quote(code))))
