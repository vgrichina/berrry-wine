"""Read-only final integrity and recoverable handoff inventory on assigned Boat."""
import datetime,hashlib,json,pathlib,os,socket,subprocess
R=pathlib.Path('/home/user/shadow-man-original-oct22')
def digest(p,alg='sha256'):
    with p.open('rb') as f:return hashlib.file_digest(f,alg).hexdigest()
def save(n,x):(R/n).write_text(json.dumps(x,indent=2)+'\n')
def manifest(root):return [dict(path=p.relative_to(root).as_posix(),size=p.stat().st_size,sha256=digest(p)) for p in sorted(root.rglob('*')) if p.is_file()]
iso=R/'recovery/GS1199.iso'
assert iso.stat().st_size==674328576 and digest(iso,'sha1')=='f985ca1349af958f886957aa662e87956a7db22d'
assert digest(iso)=='db9ca33413c53d2d333a3d4b2e220d19daab625526d8acf55c1f11e780b28a12'
members=json.loads((R/'recovery/extracted-members.json').read_text())['extractedMembers']
vfs=R/'setup-run/vfs'
for x in members:
    for p in [R/'recovery/source/Demos/Shadowman'/x['name'],vfs/x['name'].lower()]:
        assert p.stat().st_size==x['bytes'] and digest(p)==x['sha256'],str(p)
native=json.loads((R/'native-audit/native-manifest.json').read_text())
assert manifest(R/'native')==native['files']
save('setup-run/vfs-manifest.json',manifest(vfs))
reg=json.loads((R/'setup-run/final-registry.json').read_text())
save('setup-run/installed-state-audit.json',dict(sourceFilesMatched=len(members),nativeUnchanged=True,registryAcclaimShadowManMentions=[line for line in json.dumps(reg,indent=2).splitlines() if any(w in line.lower() for w in ['acclaim','shadowman','shadow man'])],installedDemo=False,configurationAttempted=False,acceptedInGuest=False))
pid=json.loads((R/'setup-run/pid.json').read_text())['pid']
proc=[]
for p in pathlib.Path('/proc').iterdir():
    if not p.name.isdigit():continue
    try:
        stat=(p/'stat').read_text();tail=stat[stat.rfind(')')+2:].split()
        if int(tail[2])==pid:proc.append(dict(pid=int(p.name),cmd=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')))
    except (OSError,ValueError,IndexError):pass
assert not proc,proc
ports={}
for port in [8123,8124]:
    s=socket.socket();s.settimeout(.5);ports[str(port)]=s.connect_ex(('127.0.0.1',port))!=0;s.close()
assert all(ports.values())
v=os.statvfs(R)
save('HANDOFF.json',dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),box='bx_5mu9dnhg',boxLeftRunning=True,lifecycleOwner='coordinator',expiry='2026-10-22T10:48:47.315Z',handbackDeadline='2026-10-22T10:28:00Z',shutdownCheckpoint='2026-10-22T10:38:00Z',retainedRoot=str(R),retained=['recovery/GS1199.iso','recovery/source/Demos/Shadowman','recovery/source/Diverses/Directx6','native','support','runtime','runner','setup-run','receipt'],media=[dict(path=str(iso),size=iso.stat().st_size,sha1=digest(iso,'sha1'),sha256=digest(iso)),dict(path='recovery/source/Demos/Shadowman/data1.cab',size=(R/'recovery/source/Demos/Shadowman/data1.cab').stat().st_size,sha256=digest(R/'recovery/source/Demos/Shadowman/data1.cab'))],guestProcesses=proc,controlPortsClosed=ports,freeBytes=v.f_bavail*v.f_frsize,outcome='blocked',blocker='Original Setup Initialization Error, decompression/copy failure Error 112; exact failing operation/API unproved.',acceptedInGuest=False,noRetest=True))
print((R/'HANDOFF.json').read_text())
