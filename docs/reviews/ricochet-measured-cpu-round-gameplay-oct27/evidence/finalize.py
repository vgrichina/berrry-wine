import signal
phase=sys.argv[2]
if phase=='prepare':
 p=O/'historical-incidents.json';j=json.loads(p.read_text());j.update(checkerMissingLocalNode='Checker first attempted Boat-only Node24.22.1 path locally: FileNotFoundError, distinct streams/traceback retained. Corrected to installed localNode24.18.1; exact local startup and checker passed. Guest remains exactNode24.22.1.',unwrappedVersionProbe='One local node --version identification probe was outside the prescribed supervisor; no retrospective compliance claimed.',priorWALProjection='Early admission conservatively subtracted positiveWAL a second time from measured free. Final formula corrects this: actual WAL materialization is already reflected in free; positivegrowth recorded once for footprint, remainingfutures deducted once.',CPUAccountingLimitation='Trusted supervisor final charged total includes cleanup; separate precleanup and cleanupCPU counters unavailable. Explicit limitation in cpu-accounting.json.');save(p.name,j)
 checker=json.loads((O/'checker-result.json').read_text());assert checker['exit']==0
 save('accounting-final.json',gate());print('final projection PASS; checker PASS')
elif phase=='published':
 pub=json.loads((O/'publication.json').read_text());assert pub['verified'] and pub['status']==''
 result=json.loads((O/'result.json').read_text());result['publication']=pub;save('result.json',result)
 pid=int((O/'board-watch.pid').read_text());proc=pathlib.Path('/proc')/str(pid);argv=(proc/'cmdline').read_bytes().split(b'\0');assert argv[:4]==[b'tail',b'-n',b'0',b'-f'] and b'/home/user/wine-assembly/messageboard.txt' in argv
 stat=(proc/'stat').read_text().split(') ')[1].split();identity=dict(pid=pid,start=stat[19],argv=[a.decode() for a in argv if a],stdout=os.readlink(proc/'fd/1'),stderr=os.readlink(proc/'fd/2'))
 assert identity['stdout']==str(O/'board-watch.log') and identity['stderr']==str(O/'board-watch.stderr')
 fd=os.pidfd_open(pid);assert (proc/'stat').read_text().split(') ')[1].split()[19]==identity['start'];signal.pidfd_send_signal(fd,signal.SIGTERM);os.close(fd)
 for _ in range(30):
  if not proc.exists() or (proc/'stat').read_text().split(') ')[1].split()[0]=='Z':break
  time.sleep(.02)
 else:raise RuntimeError('own watcher remains live')
 save('owned-cleanup.json',dict(watcher=identity,watcherNotLive=True,otherWatchersUntouched=True,remote='remote-owned-cleanup.json',box=BOX,state='RUNNING',expiry='2026-10-27T09:43:37Z',shutdownOwner='coordinator'))
 save('accounting-final.json',gate());save('checkpoint-final.json',dict(outcome='BLOCKED_ACCOUNTING_SCAN_RACE_PUBLISHED_STOP',commit=pub['commit'],branch=pub['branch'],evidence=str(H/'repo/docs/reviews'/H.name),cleanup='owned-cleanup.json',box=BOX,state='RUNNING',expiry='2026-10-27T09:43:37Z',shutdownOwner='coordinator',remaining=result['remaining'],stop=True));print(json.dumps(dict(commit=pub['commit'],branch=pub['branch'],verified=True,cleanup=True,stop=True)))
