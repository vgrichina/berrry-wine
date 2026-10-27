import sys,json,base64
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent));import manage as m
from stage import api,put,REM
def command(label,items):put('commands/'+label+'.json',json.dumps(items).encode())
def get(name):
 info=json.loads(api('from pathlib import Path;import json,hashlib;p=Path('+repr(REM+'/'+name)+');b=p.read_bytes(); print(json.dumps({"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest()}))'))
 assert info['bytes']<=4194304
 data=bytearray()
 for pos in range(0,info['bytes'],32768):data.extend(base64.b64decode(api('from pathlib import Path;import base64;p=Path('+repr(REM+'/'+name)+');f=p.open("rb");f.seek('+str(pos)+');print(base64.b64encode(f.read(32768)).decode())')))
 assert len(data)==info['bytes'] and m.sha(data)==info['sha256'];dest=m.O/'selected'/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data);return dest
if __name__=='__main__':
 if sys.argv[1]=='get':print(get(sys.argv[2]))
 if sys.argv[1]=='command':command(sys.argv[2],json.loads(sys.argv[3]));print('sent',sys.argv[2])
 if sys.argv[1]=='status':print(api('from pathlib import Path;import json;p=Path('+repr(REM+'/out')+');print(json.dumps({"files":[[f.name,f.stat().st_size] for f in p.glob("*")],"tail":(p/"output.log").read_text()[-2500:] if (p/"output.log").exists() else ""}))'))
