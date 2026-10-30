"""Preserve first control failure; no acceptance retries."""
import datetime,hashlib,json,os,pathlib,tarfile
OWN=pathlib.Path(__file__).resolve().parent
EV=OWN/'test/toyvm-offline-nonfinite-json-repair-oct29/evidence'
fixture=EV/'input.json'
incident=dict(atObserved='2026-10-29T02:55:04 UTC',stage='exact-input-bound pre-spawn admission evidence write',
    exception='RuntimeError: evidence bound',cause='1 MiB transient boundary fixture incorrectly placed inside evidence directory',
    fixtureBytes=fixture.stat().st_size,fixtureSHA256=hashlib.sha256(fixture.read_bytes()).hexdigest(),
    childSpawned=False,noRetry=True,exactFailureAdmissionRecord='not persisted: evidence guard rejected its own record; see preceding fixture admission',
    priorAdmission=json.loads((EV/'admission-fixture-exact-input-bound.json').read_text()),
    evidenceLogicalBytes=sum(p.stat().st_size for p in EV.iterdir() if p.is_file()),
    evidenceAllocatedBytes=sum(p.stat().st_blocks*512 for p in EV.iterdir() if p.is_file()),
    limitation='Supervisor measured logical evidence bytes, not allocated blocks, and fixture writer did not enforce aggregate evidence cap before writing. Full per-operation control compliance NOT established.')
results=json.loads((EV/'focused-results.json').read_text())
assert len(results['records'])==53 and all(r['PASS'] for r in results['records'])
incident['completedFocusedChecks']=53
incident['remainingChecks']=['exact/over input byte boundary','explicit finite/nonfinite CLI limit delta','restored-parser rejecting mutation']
fixture.unlink()  # Transient generated padding; recipe and hash retained instead.
(EV/'first-control-incident.json').write_text(json.dumps(incident,indent=2))
with tarfile.open(OWN/'test/toyvm-offline-nonfinite-json-repair-oct29/operation-evidence.tar.gz','w:gz') as tar:
    for p in sorted(EV.iterdir()):tar.add(p,arcname='evidence/'+p.name)
for p in list(EV.iterdir()):
    if p.name!='initial-baseline.json':p.unlink()
# Compact canonical evidence remains directly readable; all original operation records in archive.
(EV/'first-control-incident.json').write_text(json.dumps(incident,indent=2))
(EV/'focused-results.json').write_text(json.dumps(results,indent=2))
import supervisor as s
s.admission('closeout')
prior=s.ROOT/'scratch/usage-watch/toyvm-offline-command-independent-accept-oct29/retained-evidence/test/toyvm-offline-command-independent-accept-oct29/evidence/canonical-receipt.json'
canonical=json.loads(prior.read_text())
reuse=dict(priorCanonicalPath=str(prior),priorCanonicalSHA256=hashlib.sha256(prior.read_bytes()).hexdigest(),candidate=canonical['candidate'],rejectionCommit=canonical['publication']['commit'],priorPassed=72,prior52Reused=True,
    status='Historical unchanged-group evidence reused; parser-boundary delta tested separately, incomplete due control incident',sourcePins=canonical['sourcePins'])
s.save('reuse.json',reuse)
print(json.dumps(dict(PASS=False,status='BLOCKED_CONTROL_INCIDENT',completed=53,archiveBytes=(OWN/'test/toyvm-offline-nonfinite-json-repair-oct29/operation-evidence.tar.gz').stat().st_size)))
