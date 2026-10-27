import signal
exec((O/'package.py').read_text())
D=H/'repo/docs/reviews'/H.name
v=json.loads((O/'verification.json').read_text());terminal=json.loads((O/'terminal-meta.json').read_text())['summary']
review=dict(at=time.time(),tool='view_image',actualFrame=v['capture'],reviewed=True,afterTerminal=True,visual='Actual Enigma main menu with Start Game, Level Pack, Options, Credits, Quit; no gameplay field.',inputAuthorized=False,reason='Transport 502 had already ended attempt; terminal capture inspection authorizes no replay.')
save('image-review.json',review)
c=json.loads((O/'checkpoint.json').read_text());c.update(phase='BLOCKED_TRANSPORT_502_TERMINAL_VERIFIED',startup=True,serialSteps=v['serialSteps'],acknowledgedBatches=v['acknowledgedBatches'],cliExit=0,ownedProcessesAbsent=True,actualMenuInspectedAfterTerminal=True,serializedResponseBytes=v['serializedAPIResponseBytes'],boxState='Last coordinator info idle/snapshot completed; supported API execution succeeds; no lifecycle mutation');save('checkpoint.json',c)
found=[]
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  if os.readlink(p/'fd/1')!=str(O/'board-watch.log'):continue
  cmd=(p/'cmdline').read_bytes();s=(p/'stat').read_text().split(') ')[1].split();start=s[19]
  if cmd!=b'tail\x00-f\x00messageboard.txt\x00':continue
  fd=os.pidfd_open(int(p.name));cur=(p/'stat').read_text().split(') ')[1].split();assert cur[19]==start;signal.pidfd_send_signal(fd,signal.SIGTERM);os.close(fd);found.append(dict(pid=int(p.name),start=start))
 except (FileNotFoundError,ProcessLookupError,PermissionError):pass
time.sleep(.1)
for r in found:
 p=pathlib.Path('/proc')/str(r['pid'])/'stat'
 try:s=p.read_text().split(') ')[1].split();assert s[19]!=r['start'] or s[0] in ['Z','X']
 except FileNotFoundError:pass
save('owned-cleanup.json',dict(remote=terminal,watchers=found,watcherNotLive=True,boxShutdownOwner='coordinator'))
for n in ['checkpoint.json','verification.json','image-review.json','owned-cleanup.json']:
 shutil.copyfile(O/n,D/n)
with (D/'REPORT.md').open('a') as f:f.write('\nTerminal verification: actual Node v24.22.1 startup passed with identical sanitized environment and source/module/EXE pins, 2048 MiB old-space flag, unlimited DATA/AS, CPU90 and 24 MiB file limits. All '+str(v['serialSteps'])+' serial steps totaling '+str(v['acknowledgedBatches'])+' acknowledged batches had matching following frozen-zero snapshots; first n1 passed. CLI/supervisor/guest exited 0; no input was sent. The same-run captured main menu was content-hash/length matched to retained PNG bytes and inspected via view_image only after terminal collection; no new review decision was delivered. Peak tree RSS '+str(v['peakRSS'])+' bytes, CPU '+str(v['cpuSeconds'])+' seconds, separate streams '+str(v['outputBytes'])+' bytes. All three owned remote process identities were absent. Supervisor outcome preserves reason control-listener-identity-changed with failed=false after normal harness cleanup; that is not ordinary guest Quit. Actual retained serialized API responses, including detached-launch acknowledgement, total '+str(v['serializedAPIResponseBytes'])+' bytes, below cumulative 1 MiB. Remote terminal evidence bundle SHA256 dadaa28a5a7549538ffa2ca0cae03714f4b869722335d91fd70554143779ef6e. API execution succeeded at final collection; last coordinator info was idle/snapshot-completed, so no stronger lifecycle state is inferred. Coordinator retains shutdown.\n')
rows=[dict(path=str(p.relative_to(D)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(D.rglob('*')) if p.is_file() and p.name not in ['manifest.json','result.json']]
(D/'manifest.json').write_text(json.dumps(dict(files=rows),indent=2)+'\n')
for r in rows:assert sha((D/r['path']).read_bytes())==r['sha256']
result=dict(**c,verification=v,manifestEntries=len(rows),manifestSHA256=sha((D/'manifest.json').read_bytes()),report=str(D/'REPORT.md'),resumeCondition='Coordinator must resolve API transport instability and explicitly assign another fresh attempt; spent guest never replayed. This worker stops.',finalAccounting=gate('finalize'))
save('result.json',result);shutil.copyfile(O/'result.json',D/'result.json');print(json.dumps(dict(files=len(rows),bytes=sum(r['bytes'] for r in rows),checkpoint=c['phase'],accounting=result['finalAccounting'])))
