from boat_control import *
d=json.loads(DP.read_text()); l=json.loads((E/'lifecycle.json').read_text())
raw=run('boat-stopped-verification',[BOAT,'info',l['box'],'--json','--no-update'],cwd=REPO)
info=json.loads(raw)['sandbox'];l.update(state=info['state'],snapshotAvailable=info['snapshotAvailable'],snapshotCompletedAt=info.get('snapshotCompletedAt'),stopVerified=info['state']=='stopped',shutdownActionNeeded=info['state']!='stopped')
save('lifecycle.json',l)
cli=json.loads((E/'cli.stdout').read_text()); pc=json.loads((E/'process-cleanup.json').read_text());inv=json.loads((E/'invocation.json').read_text());sock=str(E/'work/status.sock')
assert cli['accepted'] is False and 'filesystem mount/backend failed' in cli['error'];assert 'AF_UNIX path too long' in cli['filesystemCleanup']['serverStderr'];assert pc['remaining']==[] and pc['remainingMounts']==[]
save('blocker-validation.json',dict(PASS=True,meaning='original failed attempt retained truthfully; timeout qualification NOT achieved',cliExit=pc['exit'],backendError='AF_UNIX path too long',socketPath=sock,socketPathBytes=len(sock.encode()),linuxSockaddrUnSunPathBytes=108,fixtureNeverLaunched=True,remainingObservedProcesses=pc['remaining'],remainingMounts=pc['remainingMounts'],productionSourceUnchanged=True,retries=0))
report='''BLOCKED: descendant-timeout qualification was not reached.

Exact candidate: 5a88ca099b962e946160afd2d4d71a950bf46db3.
The actual unchanged qualify_accounted.py CLI was invoked once using the real
synchronous-FUSE backend on the dedicated Boat. CLI exit 1 reported
RuntimeError: filesystem mount/backend failed. The authoritative server stderr
was OSError: AF_UNIX path too long at status socket bind. The task harness
placed the fresh work directory under its long evidence path; this avoidable
harness path selection exceeded Linux's 108-byte sockaddr_un.sun_path capacity.
This is a setup-contract blocker, not a demonstrated production timeout bug.

No confined child or descendant was launched. No live handle observation was
obtained. Timeout rejection and descendant cleanup are UNQUALIFIED. No positive
or quota case, fake backend, browser, guest, build or local FUSE work was run.
No retry, repair, source change, allowance reset or limit increase was performed.
The unchanged reproducer and actual argv are retained in remote_test.py,
invocation.json and fixture.py. Original CLI stdout/stderr and backend cleanup
are in cli.stdout; process-cleanup.json independently records no remaining
observed identities and no mount. CLI unmountExit=0, serverExit=1; it correctly
withheld cleanupComplete rather than claiming a clean successful server exit.

The outer harness subsequently raised KeyError('output') because no backend
receipt existed. This secondary diagnostic is preserved in boat-real-cli.stdout;
it does not replace the authoritative CLI failure. Evidence was recovered using
only supported API execution before explicitly delegated snapshot-stop.

The owned supervisor's cwd rejection controls and sentinel passed. Source hashes
were verified locally and on the Boat. Git uses explicit -C, owned cwd and
repository identity checks; trusted Git SSH and process-local readonly alternate
objects are used. Empty guest mount argv reuses the unchanged predecessor config;
no filename-bearing guest mount is involved. The production's pinned internal
supervisors remain byte-identical, including their existing subprocess behavior.
Resource admissions and measured /proc RSS evidence are retained. No historical
ru_maxrss was used as an outer physical-RSS measurement. Original browser budget
remains 35.353183 CPU seconds, 101.495550694 wall seconds, one capture.

Diagnostic inspection incident: an initial shell head against the installed Boat
ELF and a later full retained stage recipe read produced excessive/truncated
terminal output before the bounded supervisor was installed. No secret contents
were requested; subsequent evidence commands were bounded. This is a procedural
limitation of this run, not a passing output-control qualification.

Coordinator next action: decide whether to authorize a fresh bounded qualification
with a shorter owned work path. Do not treat this run as passing timeout cleanup.
The allocation remains retained through coordinator board delivery/closeout.
Board append is delegated; publication-note.txt is the bounded delivery artifact.
'''
(E/'REPORT.txt').write_text(report)
# Commit only explicit source/test/report evidence paths. No predecessor/source modifications.
names=['guard.py','boat_control.py','remote_test.py','stage_run.py','closeout.py','publish.py','REPORT.txt','baseline.json','containment-controls.json','launch-configuration.json','remote-source-pins.json','remote-admission.json','invocation.json','fixture.py','cli.stdout','cli.stderr','live-observations.json','process-cleanup.json','blocker-validation.json','lifecycle.json','boat-real-cli.json','boat-real-cli.stdout','boat-real-cli.stderr','boat-capability.stdout','boat-create.stdout','boat-snapshot-stop.stdout','boat-stopped-verification.stdout']
manifest={n:dict(bytes=(E/n).stat().st_size,sha256=hashlib.sha256((E/n).read_bytes()).hexdigest()) for n in names}
save('artifact-manifest.json',manifest);names.append('artifact-manifest.json')
assert sum((E/n).stat().st_size for n in names)<M
paths=[str((E/n).relative_to(REPO)) for n in names]
git('stage',['add','--sparse','--',*paths],cwd=REPO,mutate=True)
git('diff-check',['diff','--cached','--check'],cwd=REPO)
changed=git('staged-names',['diff','--cached','--name-only'],cwd=REPO).splitlines();assert sorted(changed)==sorted(paths)
git('commit',['commit','-m','test: retain blocked real CLI descendant timeout qualification'],cwd=REPO,mutate=True)
sha=git('commit-sha',['rev-parse','HEAD'],cwd=REPO).strip();branch='task/'+TASK
# Rejection publishes a truthful test/report only; no production acceptance or main publication.
git('push',['push','origin','HEAD:refs/heads/'+branch],cwd=REPO,mutate=True)
remote=git('remote-sha',['ls-remote','origin','refs/heads/'+branch],cwd=REPO).split()[0];assert remote==sha
receipt=dict(task=TASK,outcome='BLOCKED: real backend status socket path too long; descendant timeout not reached',candidate=d['candidate'],sourcePins=d['sourcePins'],tests=dict(containmentControls=True,localRemoteSourcePins=True,realUnmodifiedCLIInvokedOnce=True,backendStartupFailed=True,descendantTimeoutQualified=False,fixtureNeverLaunched=True,retries=0,blockerValidation=True),resourceIncidents=['unbounded initial diagnostic reads recorded in REPORT.txt'],resources=dict(baseline=str(E/'baseline.json'),admissions=str(E/'admissions.jsonl'),admissionSHA256=hashlib.sha256(AD.read_bytes()).hexdigest(),allocationRetained=True),cleanup=l,publication=dict(branch=branch,commit=sha,remoteVerifiedSHA=remote,remote='git@github.com:vgrichina/wine-assembly.git',pushExit=0),artifactManifest=dict(path=str(E/'artifact-manifest.json'),sha256=hashlib.sha256((E/'artifact-manifest.json').read_bytes()).hexdigest()),browserAllowanceUnchanged=cli['browserAllowanceRemaining'],rootRefsInitialReceipt=str(ROOT/'scratch/usage-watch'/TASK/'root-ref-digest.json'),boardAppendDelegatedToCoordinator=True)
save('canonical-receipt.json',receipt)
(E/'publication-note.txt').write_text(f'{TASK}: BLOCKED setup socket path length; real CLI once exit1; descendant timeout never reached, no retry or repair. commit {sha}; remote refs/heads/{branch} verified exact SHA. canonical receipt {E}/canonical-receipt.json; unchanged reproducer {E}/remote_test.py; CLI evidence {E}/cli.stdout. Box {l["box"]} {l["state"]}; expiry {l["expiry"]}; snapshot {l.get("snapshotCompletedAt")}; shutdownActionNeeded={l["shutdownActionNeeded"]}. No processes/mount remain. Original browser budget unspent. Allocation retained; coordinator board delivery/closeout required.\n')
admission('completion-preservation')
print(json.dumps(dict(outcome=receipt['outcome'],commit=sha,branch=branch,remoteVerifiedSHA=remote,box=l['box'],state=l['state'],receipt=str(E/'canonical-receipt.json'),note=str(E/'publication-note.txt'))))
