import pathlib,json,os,subprocess,hashlib,shutil,datetime
R=pathlib.Path('/home/user/shadow-man-install-continue-oct22');Q=pathlib.Path('/home/user/shadow-man-install-quota-oct22');G=Q/'game';O=Q/'session'
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def rows(root):return [dict(path=str(p.relative_to(root)),size=p.stat().st_size,sha256=sha(p)) for p in sorted(root.rglob('*')) if p.is_file()]
# No guest/session retry. Explicitly check all members of both owned process groups.
processes=[]
for d in pathlib.Path('/proc').iterdir():
 if not d.name.isdigit():continue
 try:
  st=(d/'stat').read_text();f=st[st.rfind(')')+2:].split();cmd=(d/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
  if int(f[2]) in [23832,26750] and cmd:processes.append(dict(pid=int(d.name),pgid=int(f[2]),command=cmd))
 except (FileNotFoundError,ProcessLookupError,PermissionError):pass
assert not processes,processes
pre=json.loads((O/'preflight.json').read_text())
for x in pre['seals']:
 p=pathlib.Path(x['path']);assert p.stat().st_size==x['size'] and sha(p)==x['sha256']
old=json.loads((R/'handback.json').read_text());assert rows(O)==old['files'];assert rows(R/'retained-session')==old['files']
files=rows(G);logical=sum(x['size'] for x in files);allocated=sum(p.stat().st_blocks*512 for p in G.rglob('*'));beforeUsed=(os.statvfs(Q).f_blocks-os.statvfs(Q).f_bfree)*os.statvfs(Q).f_frsize
current=sum(p.stat().st_blocks*512 for p in R.rglob('*'));assert current+allocated+16777216<2147483648;assert shutil.disk_usage(R).free-allocated-16777216>=2982150144
B=R/'retained-game';assert not B.exists();shutil.copytree(G,B);assert rows(B)==files
removed=[]
for name in ['tmp','game-vfs']:
 p=G/name
 if p.exists():
  # Only this owned directory; every regular byte is hash-verified in inactive backup.
  for f in p.rglob('*'):
   if f.is_file():assert sha(f)==sha(B/f.relative_to(G))
  shutil.rmtree(p);removed.append(str(p))
sv=os.statvfs(Q)
result=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),verdict='INSTALL_VERIFIED_GAME_LAUNCH_QUOTA_BLOCKED',box='bx_m4xrrj5a',boxLeftRunning=True,expiry='2026-10-22T21:52:45.530Z',lifecycleMutations=0,shutdownOwner='coordinator',ownedProcessGroups=[23832,26750],remainingOwnedLiveProcesses=processes,installerPreserved=True,installerFiles=old['retainedFiles'],installerLogicalBytes=old['retainedLogicalBytes'],gameFiles=files,gameRetainedLogicalBytes=logical,gameRetainedAllocated=allocated,gameBackup=str(B),hashVerifiedBeforeRemoving=removed,tmpfsFullObservedBytes=beforeUsed,tmpfsFinalUsed=(sv.f_blocks-sv.f_bfree)*sv.f_frsize,tmpfsQuota=sv.f_blocks*sv.f_frsize,fixedAllocated=pre['fixedAllocatedBytes'],reserve=16777216,aggregateRuntimeAllocation=pre['fixedAllocatedBytes']+sv.f_blocks*sv.f_frsize+16777216,runtimeCap=536870912,recoveryAllocated=sum(p.stat().st_blocks*512 for p in R.rglob('*')),recoveryCap=2147483648,hostFree=shutil.disk_usage(R).free,pinsPreserved=243,gameWatchdogCompleted=False,gameWatchdogFailure='ENOSPC writing watchdog-quit-error.txt before group-kill finally completed',gameProcessAbsenceObservedBy='2026-10-22T20:05:41.806867Z',gameStartedAt=json.loads((G/'attempt.json').read_text())['startedAt'],gameActualElapsedUnknown=True,gameProcessAbsenceWithin60Seconds=True,gameRetry=False)
(R/'final-handback.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
