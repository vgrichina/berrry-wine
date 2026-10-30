import os,subprocess,json,hashlib,pathlib
root=pathlib.Path('/home/user/wine-assembly'); donor=pathlib.Path('/home/user/wine-assembly-shadow-man-settings-observer-repair-runtime-oct23'); run=donor/'scratch/runs/20261023-shadow-man-settings-observer-repair-runtime'
paths=['CLAUDE.md','AGENTS.md','ops/README.md','test/run.js','src/09c3a-dialog-runtime.wat','src/09a-handlers1-user.wat','src/04-cache.wat','src/05-alu.wat','src/09b-dispatch.wat','src/07-decoder.wat','src/03-registers.wat']
def git(*args):return subprocess.check_output(['git','-C',str(donor),*args],env={**os.environ,'GIT_NO_LAZY_FETCH':'1'})
entries=[]
for p in paths:
 expected=git('rev-parse','58e90870a40a541a4083cae5e987ca8de31889e6:'+p).decode().strip()
 origin=root/p
 if p=='test/run.js': origin=pathlib.Path('/home/user/wine-assembly-shadow-man-child-window-runtime-oct22')/p
 if p in json.loads(pathlib.Path('/tmp/shadow-null-origins.json').read_text()): origin=pathlib.Path(json.loads(pathlib.Path('/tmp/shadow-null-origins.json').read_text())[p])
 data=origin.read_bytes(); actual=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
 assert expected==actual or p=='ops/README.md',(p,expected,actual)
 entries.append(dict(path=p,origin=str(origin),bytes=len(data),blob=actual,sha256=hashlib.sha256(data).hexdigest()))
files=['REPORT.md','RECOVERY.md','session1-fixed-session.log','session1-fixed-session-result.json','session1-fixed-ordinary-exit-command.json','session1-fixed-module-consumption.jsonl','session1-grafix.cfg','session1-preflight.json','session1-live_operator.py','session_runner-repaired.py','session1-fixed-after-ok-controls.json','session1-fixed-after-ok-snapshot.json','session1-output-parent-54631.jsonl','session1-fixed-watchdog-receipt.json','handback.json','publication.json']
for p in files:assert (run/p).is_file(),p
used=sum(e['bytes'] for e in entries)+sum((run/p).stat().st_size for p in files)
donor_git=sum(p.stat().st_size for p in (donor/'.git').rglob('*') if p.is_file())
# Count used donor files + copies, donor Git + independent Git upper bound, tools/temp/evidence + reserve.
upper=used*2+donor_git*2+8*1024**2+8*1024**2
free=os.statvfs(root).f_bavail*os.statvfs(root).f_frsize
out=dict(base='bb9c496ed13095cc832fdf607f0937fb9c14b7de',runtime='58e90870a40a541a4083cae5e987ca8de31889e6',source=entries,evidence=files,usedDonorAndCopy=used*2,donorGitAndOwnGitUpper=donor_git*2,toolsTempEvidenceAllowance=8*1024**2,reserve=8*1024**2,upperBytes=upper,cap=67108864,hostFree=free,hostFloor=2982150144)
assert upper<67108864 and free-upper>2982150144
pathlib.Path('/tmp/shadow-null-admission.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
