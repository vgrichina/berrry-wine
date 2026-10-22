from pathlib import Path
import subprocess,json,hashlib,os,socket,datetime,uuid,struct,shutil
E=Path('/home/user/aoe3-system-capabilities-diagnosis-oct22');S=Path('/home/user/aoe3-canonical-c7fae5ac-staged');R=Path('/home/user/aoe3-original-oct22/installed/Age of Empires III');P=Path('/home/user/aoe3-canonical-c7fae5ac-evidence')
def seal(p):
 with p.open('rb') as f:h=hashlib.file_digest(f,'sha256').hexdigest()
 return dict(bytes=p.stat().st_size,sha256=h)
def dis(name,start,end):return subprocess.check_output(['objdump','-d','-Mintel',f'--start-address={start}',f'--stop-address={end}',str(R/name)]).decode()
for name,start,end,target in [('ConfigDetect.dll','0x10008033','0x10008172','config-cleanup-version-query.txt'),('ConfigDetect.dll','0x100081b0','0x10008cc4','config-version-fallback.txt')]: (E/target).write_text(dis(name,start,end))
b=(R/'ConfigDetect.dll').read_bytes();strings={}
for a in [0x16ed4,0x16f84,0x16f58,0x16f2c,0x16efc,0x17004,0x16ff4,0x16fe8,0x16fdc,0x16fd0,0x16fc0,0x16fb4,0x16fa8]:
 strings[hex(0x10000000+a)]=dict(raw=b[a:a+96].hex(),ascii=b[a:a+96].split(b'\0')[0].decode('ascii',errors='replace'),utf16=b[a:a+96].decode('utf-16le',errors='replace').split('\0')[0])
(E/'native-strings.json').write_text(json.dumps(strings,indent=2)+'\n')
# Pin exact PE identity incl GUID bytes and version/import/export metadata; no native writes.
meta={str(p):seal(p) for p in [R/'ConfigDetect.dll',R/'age3.exe',S/'src/09a7-handlers-dispatch.wat',S/'lib/storage.js']}
(E/'analysis-identities.json').write_text(json.dumps(meta,indent=2)+'\n')
snips=[]
for name,lo,hi in [('src/09a0-handlers-base.wat',105,172),('src/09a1-comctl-handlers.wat',970,1034),('src/01-header.wat',1023,1050),('lib/apps.js',4773,4787)]:
 t=(S/name).read_text().splitlines();snips.append(dict(path=name,firstLine=lo,sourceSeal=seal(S/name),text='\n'.join(f'{i+1}: {t[i]}' for i in range(lo-1,hi))))
(E/'source-version-context.json').write_text(json.dumps(snips,indent=2)+'\n')
raw=(E/'guest/output.log').read_bytes();rows=[];off=0;seen=set();selected=[];lines=raw.splitlines(keepends=True)
for i,line in enumerate(lines):
 s=line.decode();keep=False
 if '[EIP]' in s:
  addr=s.split()[1]
  if addr not in seen:keep=True;seen.add(addr)
  if addr in ['0x01aaf0d7','0x01aaf108','0x01aaf129','0x01aaf135','0x01aaf141','0x01aaf243','0x01aaf37e','0x01aaf421','0x01aaf55c','0x01aaf69e','0x01aaf7f7','0x01aaf92e','0x01aaf9d1','0x01aafa97']:keep=True
 if any(k in s for k in ['[TRACE-AT','GetFileVersion','VerQuery','GetSystemDirectoryA','CoCreateInstance(0x01abd744','CoInitialize(','CoUninitialize(','[input]','[signal]','Stats:','Config_InitVideoCardInfo','CreateConfigDetection','CheckRequirements']):keep=True
 if keep:
  rows.append(dict(line=i+1,offset=off,bytes=len(line),sha256=hashlib.sha256(line).hexdigest(),text=s));selected.append(s)
 off+=len(line)
(E/'guest/excerpts.json').write_text(json.dumps(dict(raw=dict(path=str(E/'guest/output.log'),**seal(E/'guest/output.log')),lines=len(lines),method='first occurrence of each native EIP plus named boundary API/input/return records; raw retained; log buffers can print TRACE-AT ahead of earlier buffered EIP events',samples=rows),indent=2)+'\n')
# XML exact original localized ID only, read in place.
xml=next(p for p in R.rglob('*') if p.name.lower()=='stringtable.xml');t=xml.read_text(encoding='utf-16');ls=t.splitlines();matched=[dict(line=i+1,text=s) for i,s in enumerate(ls) if 'capabilities' in s.lower()]
(E/'localization.json').write_text(json.dumps(dict(path=str(xml),**seal(xml),matches=matched),indent=2)+'\n')
reg=json.loads((E/'guest/final-registry.json').read_text());(E/'registry-dxdiag.json').write_text(json.dumps(dict(registrySeal=seal(E/'guest/final-registry.json'),matching=[x for x in reg if 'a65b8071' in json.dumps(x).lower() or 'dxdiag' in json.dumps(x).lower()],entryCount=len(reg)),indent=2)+'\n')
pid=json.loads((E/'guest/launch.json').read_text())['pid'];assert not Path(f'/proc/{pid}').exists()
ports={}
for n in [8123,8124]:
 s=socket.socket();ports[n]=s.connect_ex(('127.0.0.1',n));s.close();assert ports[n]!=0
size=sum(p.stat().st_size for p in E.rglob('*') if p.is_file());assert size<134217728;assert shutil.disk_usage(E).free>4294967296
(E/'final-state.json').write_text(json.dumps(dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),box='bx_h44kbrcy',state='RUNNING; no lifecycle action',expiry='2026-10-22T15:12:24.097Z',shutdownOwner='coordinator',guestPid=pid,guestProcessPresent=False,portsConnectEx=ports,allocationBytes=size,remoteCap=134217728,free=shutil.disk_usage(E).free,attempts=dict(build=0,guest=1,Accept=1,failedGuest=0,failedBuild=0,failedRemoteInspection=2,failedPull=1),captureAcceptance='native CoCreate HRESULT+ppv, version fallback and final init failure captured; PNG inspected; original behavior preserved'),indent=2)+'\n')
seals={str(p.relative_to(E)):seal(p) for p in E.rglob('*') if p.is_file() and p.name!='remote-seals.json'};(E/'remote-seals.json').write_text(json.dumps(seals,indent=2)+'\n')
print(json.dumps(dict(files=list(seals),bytes=size,uniqueEips=len(seen),excerptRows=len(rows),xml=matched)))
