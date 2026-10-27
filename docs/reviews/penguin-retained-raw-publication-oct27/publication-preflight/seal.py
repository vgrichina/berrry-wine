import pathlib,json,hashlib,os,signal,resource,time
H=pathlib.Path(__file__).parent; E=H.parent/'repo/docs/reviews/penguin-retained-raw-publication-oct27'
def ident(p):
 h=hashlib.sha256();n=0
 with p.open('rb') as f:
  for b in iter(lambda:f.read(65536),b''):h.update(b);n+=len(b)
 return dict(bytes=n,sha256=h.hexdigest())
def write(p,j):p.write_text(json.dumps(j,indent=2)+'\n')
pid=4150464;p=pathlib.Path('/proc')/str(pid)
args=(p/'cmdline').read_bytes().split(b'\0')
stat=(p/'stat').read_text(); fields=stat[stat.rindex(')')+2:].split()
assert args[:6]==[b'tail',b'-n',b'0',b'-f',b'/home/user/wine-assembly/messageboard.txt',b''] and int(fields[1])==4148928
fd=os.pidfd_open(pid)
assert (p/'stat').read_text().split()[21]==stat.split()[21]
signal.pidfd_send_signal(fd,signal.SIGTERM);os.close(fd)
for i in range(50):
 if not p.exists():break
 time.sleep(.02)
assert not p.exists()
write(H/'owned-cleanup.json',dict(boardWatcherPID=pid,parentPID=4148928,startTicks=fields[19],exactArgv=[os.fsdecode(x) for x in args if x],identityVerified=True,signal='SIGTERM',procAbsent=True,otherWatchersUntouched=True,packageSupervisorCleanupComplete=json.loads((H/'package-preservation.json').read_text())['cleanupComplete'],runtimeAccess=False,box='bx_5pu4jynk',boxState='Historical last-observed RUNNING only; no lifecycle operation or shutdown claim',coordinatorOwnsLifecycle=True,shutdown='2026-10-27T11:07:00Z',expiry='2026-10-27T11:14:33.925Z'))
names=['package-preservation.json','package-preservation.stdout','package-preservation.stderr','package-preservation.supervisor-output','init-report.json','init-report.stdout','init-report.stderr','init-report.supervisor-output','owned-cleanup.json','report-integrity.json','seal.py']
m=json.loads((E/'manifest.json').read_text())
for n in names:
 dst=E/'publication-preflight'/n;dst.write_bytes((H/n).read_bytes());m['files'][str(dst.relative_to(E))]=ident(dst)
write(E/'manifest.json',m)
write(H/'sealed-integrity.json',dict(status='PASS_CHANGED_PAYLOAD_HASHES_ONLY',canonicalManifest=ident(E/'manifest.json'),changedPayloads=names,previousPayloadHashesReused=True,archiveUnchanged=ident(E/'all-original-and-recovered-api.tar.gz')==json.loads((H/'archive-integrity.json').read_text())['archive'],noAcceptance=True))
assert json.loads((H/'sealed-integrity.json').read_text())['archiveUnchanged']
print('Sealed report; exact owned watcher identity terminated and absent. Original diagnostics and packaging receipts retained.')
