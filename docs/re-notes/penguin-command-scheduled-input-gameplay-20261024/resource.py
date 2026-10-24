from admit import *
def size(p):return sum(x.stat().st_size for x in p.rglob('*') if x.is_file() and not x.is_symlink()) if p.exists() else 0
def measure():
 baseline=json.loads((H/'sqlite-baseline.json').read_text())
 sql=sum(max(0,p.stat().st_size-baseline.get(str(p),0)) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite*') if p.is_file())
 session=next(pathlib.Path('/home/user/.codex/sessions/2026/10/24').glob('*01a16bc8-e2ab-7941-98ac-8e205008daa9.jsonl'))
 external=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/penguin-command-scheduled-input-gameplay-oct24')
 rr=json.loads(json.loads((H/'remote-final.json').read_text())['stdout'])
 charges=dict(localOwned=size(H),remoteOwned=rr['ownedBytes'],priorRetainedHistory=sum(size(pathlib.Path('/tmp')/n) for n in ['penguin-retained-codec-oct24','penguin-quiet-gameplay-oct24']),externalLauncher=size(external),session=session.stat().st_size,positiveSQLite=sql,futureGitPushTransport=9*1048576,futureEvidence=1048576,futureEventsSessionSQLite=4*1048576,reserve=8*1048576)
 peak=sum(charges.values());free=shutil.disk_usage('/tmp').free
 files=[p for p in H.rglob('*') if p.is_file() and not p.is_symlink()]
 j=dict(at=time.time(),charges=charges,projectedPeak=peak,cap=67108864,localFree=free,localAfter=free-peak,remoteAfter=rr['free']-peak,maxLocalFile=max(p.stat().st_size for p in files),remoteMax=rr['maxFile'],captureConservativeText=400000,captureCap=1048576,historyRetained=True,standingInputs='exact immutable 287-file manifest and installed tools separately identified in admission; no copies hidden by links',passAdmission=peak<=67108864 and min(free-peak,rr['free']-peak)>=2982150144 and max(p.stat().st_size for p in files)<=25165824)
 save('resource-final.json',j);assert j['passAdmission'],j;return j
if __name__=='__main__':
 j=measure();print(json.dumps(j))
