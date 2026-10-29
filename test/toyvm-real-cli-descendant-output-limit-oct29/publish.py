from ops import *
import shutil,base64
admission('prepare-publication')
d=json.loads((E/'pins.json').read_text());r=json.loads((E/'runtime-result.json').read_text());c=json.loads((E/'canonical-receipt.json').read_text());stopped=json.loads((E/'stopped-info-final.stdout').read_text())['sandbox']
assert r['gatePASS'] and c['productionInvocations']==1 and stopped['state']=='stopped' and stopped['lastSnapshotStatus']=='completed'
for rel,pin in d['sourcePins'].items():
 data=(REPO/rel).read_bytes();assert len(data)==pin['bytes'] and hashlib.sha256(data).hexdigest()==pin['sha256']
report=r['report'];br=report['backendReceipt'];raw=base64.b64decode(br['output']['data'])
assert raw==b'D'*1024
assert len(br['owned'])==2 and {tuple(x) for x in br['owned']} <= {(i['pid'],i['start']) for i in r['observedIdentities']}
assert all(i['absentOrReused'] for i in r['observedIdentities'])
record('production-owned-identity-crosscheck',dict(PASS=True,owned=br['owned'],observedAllReaped=True))
c['boxLifecycle']=dict(id=stopped['id'],state=stopped['state'],createdAt=stopped['createdAt'],ttlSeconds=1800,originalExpiry='2026-10-29T04:52:26.261Z',cutoff='2026-10-29T04:55:00Z',snapshotStatus=stopped['lastSnapshotStatus'],snapshotVerifiedAt=stopped['snapshotVerifiedAt'],stoppedAt=stopped['stoppedAt'],stop=stopped['stop'])
c['pinLocations']=dict(local=str(REPO),remote='/tmp/tvdout/repo',localAfterRuntimeVerified=True,remoteBeforeRuntimeVerified=True,remoteWriteProtection='Unchanged Landlock confinement grants mutation only below /tmp/tvdout/w/domain; workload cannot modify production sources.')
c['pathOverride']='User short path /tmp/tvdout overrides dispatch historical /tmp/tvdt; actual socket path is 25 bytes.'
record('canonical-receipt',c)
rel='test/toyvm-real-cli-descendant-output-limit-oct29';dest=REPO/rel;dest.mkdir(parents=True,exist_ok=True);ev=dest/'evidence';ev.mkdir(exist_ok=True)
for name in ['ops.py','limit_contract.py','verify.py','fixture.py','remote_test.py','launch.py','execute.py','preserve_stop.py','publish.py']:shutil.copyfile(OWN/name,dest/name)
for name in ['canonical-receipt.json','runtime-result.json','runtime.stdout','startup-negative-controls.json','startup-negative-controls.stderr','startup-parent-context.json','boat-file-argv.json','actual-stopped.json','production-owned-identity-crosscheck.json','admissions.jsonl','wal-baseline.json','mount-contract.json']:
 shutil.copyfile(E/name,ev/name)
(ev/'shared-stdout.bin').write_bytes(raw)
(dest/'source-pins.json').write_text(json.dumps(d['sourcePins'],sort_keys=True,indent=2)+'\n')
(dest/'README.md').write_text("""# Ordinary descendant output limit: PASS

One invocation of the exact pinned production qualify_accounted.py CLI, using the synchronous FUSE backend, rejected child-only inherited output. The confined parent launched exactly one ordinary Python child without a shell or pipe capture and only waited. The child slept 0.15 seconds, attempted one os.write(1, b'D'*2048), then slept 0.3 seconds. The parent emitted zero bytes.

The observer recorded parent PID 5910/start 3666 in do_wait, child PID 5911/start 3669, their parent/child relationship, and matching stdout pipe identity. The authoritative production receipt rejected with output limit, CLI exit 1, 1024 retained D bytes, CPU 0.148806 seconds and wall 0.233312202 seconds, before CPU 2/wall 5. All five production source pins matched locally and remotely before launch, and locally after runtime. No source was changed.

The full API envelope was neither stdout- nor stderr-truncated. The production receipt exposes retained output and stop reason, not a separate total attempted-output counter. The 2048-byte attempt is immutable fixture-source evidence; the test does not claim an independently measured write return count. Canonical raw retained shared stdout is evidence/shared-stdout.bin.

Both production-owned identities were independently observed and gone after rejection; all other observed owned identities were also gone. Cleanup receipts establish zero open handles, no remaining mounts and successful FUSE unmount. No outer safety cleanup or external reap was used. Snapshot-stop was requested only after preserving the result; the initial lifecycle query correctly showed stopping, and the final query verified stopped with completed verified snapshot. Boat bx_jbsavpj2, TTL 1800, original expiry 04:52:26.261 UTC; stopped 04:23:01.748 UTC, before cutoff 04:55.

Limits were separate argv tokens: live 32768, write 65536, file 16384, RSS 134217728, CPU 2, wall 5, output 1024. Physical and disk admission stayed enabled per operation. This task established a pre-operation WAL baseline and counts positive growth once. It does not repair the previous task's historical post-runtime WAL baseline or retention RAM rejection. A redundant startup selftest was initially invoked under an incompatible hard128 Python-child context and rejected before runtime; it then passed in its intended parent context, retaining the original inherited hard limit and Git-only 256 MiB child cap. This was a wrapper correction, not a production retry.

No guest mount argv, Node, browser, game, media, build, root-output, RSS, filesystem or CPU acceptance test was run. Boat staging enumerates the actual filename-bearing argv (no commas) in evidence/boat-file-argv.json. This non-guest task did not invoke a guest mount parser. Scope is ordinary inherited descendant output only; arbitrary escaped descendants and full-resource/browser/gameplay acceptance remain UNKNOWN. Browser allowance remains CPU 35.353183, wall 101.495550694, captures 1.
""")
files=[str(x.relative_to(REPO)) for x in dest.rglob('*') if x.is_file()]
assert sum(x.stat().st_size for x in ev.iterdir())<1048576
rc,out,err=git(['add','--sparse','--',*sorted(files)],name='stage-exact-paths',mutate=True);assert rc==0,err
rc,out,err=git(['diff','--cached','--check'],name='whitespace');assert rc==0,err
rc,out,err=git(['diff','--cached','--name-only'],name='cached-paths');assert rc==0 and set(out.splitlines())==set(files)
rc,out,err=git(['diff','--cached','--stat'],name='cached-review');assert rc==0
print(out)
