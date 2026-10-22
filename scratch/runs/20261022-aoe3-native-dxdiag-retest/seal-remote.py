from pathlib import Path
import json,hashlib,socket,subprocess,shutil,datetime
E=Path('/home/user/aoe3-native-dxdiag-retest-oct22');D=E/'guest';O=E/'overlay';R=Path('/home/user/aoe3-original-oct22');S=Path('/home/user/aoe3-canonical-c7fae5ac-staged')
assert (D/'exit.json').exists()
def seal(p):
 b=p.read_bytes();return dict(path=str(p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
raw=(D/'output.log').read_bytes();lines=raw.splitlines(keepends=True);offset=0;rows=[];seen=set();nextLines=0
for n,line in enumerate(lines,1):
 t=line.decode(errors='strict');keep=False
 if t.startswith('[EIP] '):
  eip=t.split()[1]
  if eip not in seen:keep=True;seen.add(eip)
 if any(x in t for x in ['CoCreateInstance','DxDiag','dxdiagn','dwDirectX','VersionMajor','VersionMinor','szDirectX','DirectX','[TRACE-AT','OpenSCManager','OpenServiceA','QueryServiceConfigA','[COM','[com','unimplemented','Unimplemented']):keep=True;nextLines=2
 elif nextLines>0:keep=True;nextLines-=1
 if keep:rows.append(dict(line=n,offset=offset,bytes=len(line),sha256=hashlib.sha256(line).hexdigest(),text=t))
 offset+=len(line)
(D/'excerpts.json').write_text(json.dumps(dict(raw=seal(D/'output.log'),method='first native EIP occurrence plus COM/provider/DirectX names and two following lines; exact offsets, raw retained remotely',samples=rows),indent=2)+'\n')
base=json.loads((R/'installed-audit/launch-registry.json').read_text());overlay=json.loads((O/'registry.json').read_text());final=json.loads((D/'final-registry.json').read_text())
key='reg:HKCR\\CLSID\\{A65B8071-3BFE-4213-9A5B-491DA4461CA7}\\InprocServer32';assert {k:v for k,v in overlay.items() if k!=key}==base
dx='reg:HKLM\\SOFTWARE\\Microsoft\\DirectX';assert overlay[dx]==base[dx] and final[dx]==base[dx]
(E/'registry-proof.json').write_text(json.dumps(dict(baseSHA256=seal(R/'installed-audit/launch-registry.json')['sha256'],addedKeys=[key],modifiedKeys=[],removedKeys=[],directXOriginal=json.loads(base[dx]),directXOverlay=json.loads(overlay[dx]),directXFinal=json.loads(final[dx])),indent=2)+'\n')
pid=json.loads((D/'launch.json').read_text())['pid'];assert not Path(f'/proc/{pid}').exists()
ports={}
for port in [8123,8124]:
 s=socket.socket();ports[str(port)]=s.connect_ex(('127.0.0.1',port));s.close();assert ports[str(port)]!=0
state=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),box='bx_h44kbrcy',state='RUNNING; lifecycle untouched; API exec successful',expiry='2026-10-22T15:12:24.097Z',shutdownOwner='coordinator',shutdownCheckpoint='14:55 UTC',handbackBefore='14:45 UTC',guestPid=pid,guestProcessPresent=False,portsConnectEx=ports,processes=subprocess.check_output(['ps','-eo','pid,args']).decode(),remoteAllocated=sum(p.stat().st_blocks*512 for p in E.rglob('*') if p.is_file()),free=shutil.disk_usage(E).free,attempts=dict(staging=1,startup=1,ordinaryAccept=1,build=0,guestRetry=0,failedStartup=0,failedCapture=0))
(E/'final-state.json').write_text(json.dumps(state,indent=2)+'\n')
seals={str(p.relative_to(E)):seal(p) for p in E.rglob('*') if p.is_file()}
(E/'remote-seals.json').write_text(json.dumps(seals,indent=2)+'\n')
print(json.dumps(dict(raw=seal(D/'output.log'),excerptRows=len(rows),excerptBytes=(D/'excerpts.json').stat().st_size,state={k:v for k,v in state.items() if k!='processes'})))
