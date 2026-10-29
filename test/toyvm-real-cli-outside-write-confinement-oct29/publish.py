from ops import *
import shutil,datetime
admission('prepare-publication')
d=json.loads((E/'pins.json').read_text());r=json.loads((E/'runtime-result.json').read_text());c=json.loads((E/'canonical-receipt.json').read_text());s=json.loads((E/'stopped-info-final.stdout').read_text())['sandbox']
assert r['gatePASS'] and c['productionInvocations']==1 and s['state']=='stopped' and s['lastSnapshotStatus']=='completed'
for relative,pin in d['sourcePins'].items():
 data=(REPO/relative).read_bytes();assert len(data)==pin['bytes'] and hashlib.sha256(data).hexdigest()==pin['sha256']
assert hashlib.sha256((OWN/'limit_contract.py').read_bytes()).hexdigest()==d['limitModulePin']['sha256']
expiry=(datetime.datetime.fromisoformat(s['createdAt'].replace('Z','+00:00'))+datetime.timedelta(seconds=1800)).isoformat()
c['boxLifecycle']=dict(id=s['id'],state=s['state'],createdAt=s['createdAt'],ttlSeconds=1800,originalExpiry=expiry,cutoff=d['box']['cutoffUTC'],snapshotStatus=s['lastSnapshotStatus'],snapshotVerifiedAt=s['snapshotVerifiedAt'],stoppedAt=s['stoppedAt'],stop=s['stop'])
c['pinLocations']=dict(local=str(REPO),remote='/tmp/tvdeny/repo',localBeforeAndAfterVerified=True,remoteBeforeAndAfterVerified=True)
c['pathOverride']='Explicit task short path /tmp/tvdeny replaces historical dispatch /tmp/tvdt; actual AF_UNIX status socket 25 bytes verified before CLI.'
c['historicalEvidence']=dict(previousVerifiedReceipt=d['previousVerifiedReceipt'],originalCancellationReceipt=d['originalCancellationReceipt'],prelaunchControls=str(OWN/'prelaunch-controls.json'))
c['sourcePinsPath']='../source-pins.json';c['runtimeResult']='runtime-result.json'
record('canonical-receipt',c)
rel='test/'+d['task'];dest=REPO/rel;ev=dest/'evidence';ev.mkdir(parents=True,exist_ok=True)
for name in ['ops.py','limit_contract.py','verify.py','fixture.py','remote_test.py','launch.py','execute.py','preserve_stop.py','publish.py']:shutil.copyfile(OWN/name,dest/name)
for name in ['canonical-receipt.json','runtime-result.json','runtime.stdout','boat-file-argv.json','actual-stopped.json','stopped-info-final.stdout','admissions.jsonl','wal-baseline.json','initial-admission.json','mount-contract.json']:
 shutil.copyfile(E/name,ev/name)
for name in ['prelaunch-controls.json','dispatch-preflight.json','git-readiness.json','quota-preflight.json']:shutil.copyfile(OWN/name,ev/name)
(dest/'source-pins.json').write_text(json.dumps(d['sourcePins'],sort_keys=True,indent=2)+'\n')
(dest/'README.md').write_text('''# Absolute outside-path write denial: PASS

One invocation of the unmodified pinned production qualify_accounted.py CLI accepted the tiny Python fixture, exit 0. The workload attempted exactly one os.open('/tmp/tvdeny/outside-canary', os.O_WRONLY | os.O_TRUNC). Only PermissionError is caught; errno must equal EACCES or EPERM. The observed marker was OUTSIDE_WRITE_DENIED:13. A successful open would close the descriptor and immediately exit 3 without an additional write.

Fixture setup and inspection ran outside the confined workload. The 24-byte host canary retained exact bytes, SHA-256 fdd41b4d95330415e0c94195cbf2fe0ed5818699328de57a5bcb1bf1088ddbb9, device 64769 and inode 141162. The synchronous FUSE receipt reported live 4096, peak 4096, written 0, openHandles 0, no filesystem failure and no supervisor stop reason. Production accepted the workload; no quota or guard rejection substituted for denial.

All five production source hashes matched locally and at the actual execution location before execution, remotely afterward and locally before publication. Python and fusermount executable real paths, sizes and hashes are recorded. The actual status socket /tmp/tvdeny/w/status.sock is 25 bytes. The API result was not truncated. Production-owned PID/start identities were independently observed and absent afterward; all observed owned identities were reaped. FUSE disconnected with no remaining mounts. No external safety cleanup was used.

Boat bx_pa82m6h6 was created at 2026-10-29T04:28:56.525Z with TTL 1800 (original expiry 04:58:56.525 UTC, earlier than cutoff 05:10). Evidence was preserved before snapshot-stop. Actual stopped state with completed verified snapshot was observed; stoppedAt 04:29:24.217 UTC. The original task explicitly delegated shutdown.

Limits were separate argv tokens: live 32768, write 65536, file 16384, RSS 134217728, CPU 2, wall 5, output 4096. The observer retained its 8-second identity-aware safety guard; it did not fire. Parent DATA soft 128 MiB retains inherited hard unchanged; Git children only use 256 MiB, Python children 128 MiB. Per-operation local disk and physical-RSS admission remained enabled with 24 MiB allocation and positive WAL growth counted once from the task pre-operation baseline. Retained startup negative controls passed. Historical startup and post-WAL limitations from earlier work remain limitations; this baseline is not retroactive launcher-startup proof.

This qualifies this single absolute-path write-open denial. Complete filesystem, syscall and browser confinement remain UNKNOWN. No attack matrix, historical test replay, source repair, Node execution, browser or guest run occurred. There are no guest filename-bearing mount arguments; the guest canonical mount parser is inapplicable. Actual Boat --file arguments enumerate each staged file separately, with no comma-bearing filenames. Browser allowance remains CPU 35.353183, wall 101.495550694, captures 1.

Canonical evidence: evidence/canonical-receipt.json; complete runtime and unchanged canary observations: evidence/runtime-result.json. Production sources are unchanged and source-pins.json identifies all five inputs. The task-owned fixture and observer are included for review, not automatic rerun.
''')
files=sorted(str(x.relative_to(REPO)) for x in dest.rglob('*') if x.is_file())
assert sum(x.stat().st_size for x in ev.iterdir())<1048576
rc,out,err=git(['add','--sparse','--',*files],name='stage-exact-paths',mutate=True);assert rc==0,err
rc,out,err=git(['diff','--cached','--check'],name='whitespace');assert rc==0,err
rc,out,err=git(['diff','--cached','--name-only'],name='cached-paths');assert rc==0 and set(out.splitlines())==set(files)
rc,out,err=git(['diff','--cached','--stat'],name='cached-review');assert rc==0
print(out)
