from admit import *
import base64,zlib,shlex
m=json.loads((H/'manifest.json').read_text());assert json.loads((H/'admission.json').read_text())['passAdmission']
code='import pathlib,json,base64,zlib;root=pathlib.Path('+repr(R)+');rows=json.loads(zlib.decompress(base64.b64decode(DATA)));[( (root/x[0]).parent.mkdir(parents=True,exist_ok=True),(root/x[0]).open(x[1]).write(base64.b64decode(x[2]))) for x in rows];print(len(rows))'
batch=[];receipts=[]
def command(rows):
 enc=base64.b64encode(zlib.compress(json.dumps(rows,separators=(',',':')).encode())).decode()
 return 'python3 -c '+shlex.quote(code.replace('DATA',repr(enc)))
def flush():
 global batch
 if not batch:return
 cmd=command(batch);assert len(cmd.encode())<=36000
 j=remote(cmd);receipts.append(dict(commandId=j.get('commandId'),requestBytes=len(cmd.encode()),segments=len(batch)))
 save('transfer-receipts.json',receipts);batch=[]
for i,x in enumerate(m):
 b=payload(x);assert len(b)==x['bytes'] and sha(b)==x['sha256']
 for off in range(0,len(b),18000):
  row=[x['target'],'wb' if off==0 else 'ab',base64.b64encode(b[off:off+18000]).decode()]
  if len(command(batch+[row]).encode())>36000:flush()
  batch.append(row)
 if i%50==0:print('files',i,flush=True)
flush()
def send(b,target):
 for off in range(0,len(b),18000):
  row=[target,'wb' if off==0 else 'ab',base64.b64encode(b[off:off+18000]).decode()]
  cmd=command([row]);assert len(cmd.encode())<=36000;remote(cmd)
send((H/'manifest.json').read_bytes(),'manifest.json')
verify='import pathlib,json,hashlib;h=pathlib.Path('+repr(R)+');m=json.loads((h/"manifest.json").read_text());bad=[x["target"] for x in m if (h/x["target"]).stat().st_size!=x["bytes"] or hashlib.sha256((h/x["target"]).read_bytes()).hexdigest()!=x["sha256"]];assert not bad,bad;print(json.dumps(dict(files=len(m),bytes=sum(x["bytes"] for x in m),passHash=True)))'
save('remote-rehash.json',remote('python3 -c '+shlex.quote(verify)))
print('complete',len(receipts),flush=True)
