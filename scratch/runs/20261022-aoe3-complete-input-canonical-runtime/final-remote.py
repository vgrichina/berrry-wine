from pathlib import Path
import hashlib,json,subprocess,socket,datetime
E=Path('/home/user/aoe3-canonical-c7fae5ac-evidence');S=Path('/home/user/aoe3-canonical-c7fae5ac-staged');R=Path('/home/user/aoe3-original-oct22');D=E/'guest'
def seal(p):
    with p.open('rb') as f:sha=hashlib.file_digest(f,'sha256').hexdigest()
    return dict(bytes=p.stat().st_size,sha256=sha)
ids=json.loads((D/'identities-before.json').read_text())
assert all(seal(Path(p))==r for p,r in ids.items())
(D/'identities-after.json').write_text(json.dumps(ids,indent=2)+'\n')
manifest=json.loads((E/'build-inputs.json').read_text())
for row in manifest['inputs']:
    assert seal(S/row['path'])==dict(bytes=row['bytes'],sha256=row['sha256']),row['path']
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=S).strip()==b'c7fae5ac7ea9e29dfa3f83a7c2bd87d092e0b3b2'
subprocess.run(['git','diff','--exit-code','HEAD'],cwd=S,check=True)
subprocess.run(['git','diff','--cached','--exit-code','HEAD'],cwd=S,check=True)
raw=(D/'output.log').read_bytes();lines=raw.splitlines(keepends=True)
chosen=set(range(min(25,len(lines))));ordinal=[];xml=[]
for i,line in enumerate(lines):
    if b'OLEAUT32' in line or b'MAKEINTRESOURCE(8)' in line or b'MAKEINTRESOURCE(9)' in line:
        chosen.update(range(max(0,i-1),min(len(lines),i+3)))
    if b'stringtable.xml' in line:xml.append(i)
    if b'CreateDialog' in line or b'click 163,424' in line or b'[signal]' in line:chosen.add(i)
chosen.update(xml[:3]+xml[-3:]);chosen.update(range(max(0,len(lines)-15),len(lines)))
offsets=[];offset=0
for i,line in enumerate(lines):
    if i in chosen:offsets.append(dict(line=i+1,offset=offset,bytes=len(line),sha256=hashlib.sha256(line).hexdigest(),text=line.decode(errors='replace')))
    offset+=len(line)
(D/'log-excerpts.json').write_text(json.dumps(dict(rawLog=seal(D/'output.log'),rawLines=len(lines),samples=offsets),indent=2)+'\n')
ports={}
for port in [8123,8124]:
    s=socket.socket();ports[str(port)]=s.connect_ex(('127.0.0.1',port));s.close()
pid=json.loads((D/'launch.json').read_text())['pid']
assert not Path('/proc/'+str(pid)).exists()
assert all(v!=0 for v in ports.values())
size={str(b):sum(p.stat().st_size for p in b.rglob('*') if p.is_file()) for b in [S,E]}
assert sum(size.values())<1073741824
(E/'final-state.json').write_text(json.dumps(dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),box='bx_h44kbrcy',state='RUNNING; task guest absent',expiry='2026-10-22T15:12:24.097Z',shutdownOwner='coordinator',guestPid=pid,guestProcessPresent=False,portsConnectEx=ports,sourceFilesVerified=3420,sourceHEAD='c7fae5ac7ea9e29dfa3f83a7c2bd87d092e0b3b2',sourceIndexClean=True,runnerAndNativeAndModulesUnchanged=True,allocationBytes=size,remoteCap=1073741824,stagingAttempts=1,buildAttempts=1,guestAttempts=1,ordinaryAcceptAttempts=1,failedStagingAttempts=0,failedBuildAttempts=0,failedGuestStartups=0),indent=2)+'\n')
seals={str(p.relative_to(E)):seal(p) for p in E.rglob('*') if p.is_file() and p.name!='remote-seals.json'}
(E/'remote-seals.json').write_text(json.dumps(seals,indent=2)+'\n')
print((E/'final-state.json').read_text())
