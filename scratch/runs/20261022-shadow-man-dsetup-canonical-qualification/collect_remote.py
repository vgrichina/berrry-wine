import base64,hashlib,json,os,subprocess,zlib
from pathlib import Path
R=Path('/home/user/shadow-man-dsetup-canonical-qualification-oct22');E=R/'evidence'
# Read-only localization of the first gate diagnostic; no additional gate/test run.
term='changed producer'
locations=[]
for prefix in ['test','tools','lib']:
    for p in (R/prefix).rglob('*.js'):
        s=p.read_text()
        if term in s:
            lines=s.splitlines()
            for i,line in enumerate(lines):
                if term in line:locations.append(dict(path=str(p.relative_to(R)),line=i+1,context='\n'.join(lines[max(0,i-25):i+18])))
selected=['test/test-wat-memory-map.js']+sorted({r['path'] for r in locations})
facts=dict(locations=locations,sourceSnippets={p:(R/p).read_text() for p in selected})
(E/'first-gate-localization.json').write_text(json.dumps(facts,indent=2)+'\n')
processes=subprocess.check_output(['ps','-eo','pid,ppid,pgid,etimes,args'],text=True)
(E/'handback-processes.txt').write_text(processes)
facts=dict(box='bx_f3gs8qm2',state='RUNNING; API exec responding',expiry='2026-10-22T23:20:32.491Z',lifecycleOwner='coordinator',taskProcesses='No owned build/test process remains; build subprocess reaped',retainedRoot=str(R),retainedEvidence=str(E),bytesAllocated=int(subprocess.check_output(['du','-s','-B1',str(R)]).split()[0]),freeBytes=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize,cap=1073741824,reserve=67108864,buildAttempts=1,buildExit=1,moduleIdentity=None,fullModuleTests=0,nativeCalls=0,gameLaunches=0)
(E/'handback.json').write_text(json.dumps(facts,indent=2)+'\n')
# Small evidence-only transport. Source checkout and Git objects stay remote.
files={p.name:base64.b64encode(p.read_bytes()).decode() for p in E.iterdir() if p.is_file()}
raw=json.dumps(files).encode()
print(base64.b64encode(zlib.compress(raw)).decode())
