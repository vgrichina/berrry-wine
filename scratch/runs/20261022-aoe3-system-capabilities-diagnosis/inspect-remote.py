from pathlib import Path
import subprocess,json,hashlib,uuid
E=Path('/home/user/aoe3-system-capabilities-diagnosis-oct22');E.mkdir(exist_ok=True)
R=Path('/home/user/aoe3-original-oct22/installed/Age of Empires III');S=Path('/home/user/aoe3-canonical-c7fae5ac-staged')
def dis(name,start,end):
 p=R/name
 return subprocess.check_output(['objdump','-d','-Mintel',f'--start-address={start}',f'--stop-address={end}',str(p)]).decode()
texts={'config-create.txt':dis('ConfigDetect.dll','0x10007d50','0x10008040'),'game-detection.txt':dis('age3.exe','0x4888a0','0x488cc0'),'config-init.txt':dis('ConfigDetect.dll','0x10007ec0','0x100081e0'),'config-requirements.txt':dis('ConfigDetect.dll','0x10006520','0x10006720')}
b=(R/'ConfigDetect.dll').read_bytes();texts['guids.json']=json.dumps({hex(v):dict(raw=b[v-0x10000000:v-0x10000000+16].hex(),guid=str(uuid.UUID(bytes_le=b[v-0x10000000:v-0x10000000+16]))) for v in [0x10016744,0x10016734]},indent=2)
s=(Path('/home/user/aoe3-canonical-c7fae5ac-evidence/guest/output.log')).read_bytes();lines=s.splitlines(keepends=True); off=0;rows=[]
for n,line in enumerate(lines,1):
 if 86768<=n<=86825:rows.append(dict(line=n,offset=off,bytes=len(line),sha256=hashlib.sha256(line).hexdigest(),text=line.decode()))
 off+=len(line)
texts['prior-boundary.json']=json.dumps(dict(raw=dict(path='/home/user/aoe3-canonical-c7fae5ac-evidence/guest/output.log',bytes=len(s),sha256=hashlib.sha256(s).hexdigest()),samples=rows),indent=2)
texts['com-handler.wat']=(S/'src/09a7-handlers-dispatch.wat').read_text().split('  (func $handle_CoCreateInstance',1)[1].split('  (func ',1)[0]
# Only bounded complete function plus host COM branch relevant to unknown CLSID.
t=(S/'lib/storage.js').read_text().splitlines();texts['com-host.txt']='\n'.join(f'{i+1}: {t[i]}' for i in range(1070,1255))+'\n'
for name,t in texts.items():(E/name).write_text(t)
print(json.dumps({name:dict(bytes=(E/name).stat().st_size,sha256=hashlib.sha256((E/name).read_bytes()).hexdigest(),text=t) for name,t in texts.items()}))
