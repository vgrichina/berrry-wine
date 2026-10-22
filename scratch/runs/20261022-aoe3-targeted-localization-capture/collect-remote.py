"""Collect this run only; originals and donor evidence remain in place."""
import pathlib,json,hashlib,gzip,collections,socket,os,datetime,tarfile
D=pathlib.Path('/home/user/aoe3-original-oct22/diagnostics-targeted-localization-20261022T1058Z')
assert (D/'exit.json').exists() and (D/'postflight.json').exists()
events=[];offset=0;lines=0;raw=hashlib.sha256()
with (D/'output.log').open('rb') as f,(D/'boundary.jsonl').open('w') as b,(D/'focused-trace.log').open('w') as focus:
 for n,line in enumerate(f,1):
  raw.update(line);lines=n
  if line.startswith(b'[BOUNDARY] '):
   x=json.loads(line[11:]);x['rawLine']=n;x['rawByte']=offset;events.append(x);b.write(json.dumps(x)+'\n')
  if line.startswith(b'[BOUNDARY] ') or any(s in line for s in [b'StringTable',b'stringtable',b'UnitHelp',b'unithelp',b'RaiseException',b'exception',b'CoCreateInstance',b'48700d',b'487040',b'487070',b'4870b5',b'4870e5',b'487119',b'4871ab']):
   focus.write(f'{n}:{offset}: '+line.decode(errors='replace'))
  offset+=len(line)
with (D/'output.log').open('rb') as f,gzip.open(D/'output.log.gz','wb',compresslevel=9) as z:
 while chunk:=f.read(1024*1024):z.write(chunk)
ports={}
for port in [8123,8124]:
 with socket.socket() as s:ports[port]=s.connect_ex(('127.0.0.1',port))
launch=json.loads((D/'launch.json').read_text());pgid=launch['pgid'];present=[]
for p in pathlib.Path('/proc').iterdir():
 if p.name.isdigit():
  try:
   if os.getpgid(int(p.name))==pgid:present.append(int(p.name))
  except ProcessLookupError:pass
state=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),ownedProcessGroup=pgid,present=present,portsConnectEx=ports,freeBytes=os.statvfs(D).f_bavail*os.statvfs(D).f_frsize)
(D/'process-state.json').write_text(json.dumps(state,indent=2))
summary=dict(rawBytes=offset,rawLines=lines,rawSha256=raw.hexdigest(),records=len(events),instances=dict(collections.Counter(x['instanceId'] for x in events)),kinds=dict(collections.Counter(x['kind'] for x in events)),blocks=dict(collections.Counter(hex(x['ip']) for x in events if x['kind']=='block')))
(D/'trace-summary.json').write_text(json.dumps(summary,indent=2))
names=['output.log.gz','boundary.jsonl','focused-trace.log','launch.json','exit.json','postflight.json','final-registry.json','eula.png','rt177.png','final.png','dependency-check.json','dependency-selected-route.json','trace-summary.json','process-state.json']+[p.name for p in D.glob('*.disasm.txt')]
names=[x for x in names if (D/x).is_file()]
manifest=[dict(path=x,size=(D/x).stat().st_size,sha256=hashlib.file_digest((D/x).open('rb'),'sha256').hexdigest()) for x in names]
(D/'collected-manifest.json').write_text(json.dumps(manifest,indent=2));names+=['collected-manifest.json']
with tarfile.open(D/'capture.tar.gz','w:gz') as t:
 for x in names:t.add(D/x,arcname=x)
p=D/'capture.tar.gz';print(json.dumps(dict(summary=summary,process=state,archive=dict(path=str(p),size=p.stat().st_size,sha256=hashlib.file_digest(p.open('rb'),'sha256').hexdigest())),indent=2))
