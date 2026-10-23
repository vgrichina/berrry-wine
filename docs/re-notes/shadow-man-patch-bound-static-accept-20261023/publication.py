#!/usr/bin/env python3
"""Publish only this bounded blocker report; never rerun acceptance checks."""
import hashlib, importlib.util, json, pathlib, shutil, sys
sys.dont_write_bytecode = True
H = pathlib.Path(__file__).resolve().parent
R = H.parents[2]
E = pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/shadow-man-patch-bound-static-accept-oct23')
spec = importlib.util.spec_from_file_location('guard', H/'guard.py')
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)
sha = lambda b: hashlib.sha256(b).hexdigest()
dump = lambda p, v: p.write_text(json.dumps(v, indent=2)+'\n')
ssh = json.loads((H/'ssh-standing-identities.json').read_text())
assert sha(pathlib.Path('/home/user/.ssh/wine_github_known_hosts').read_bytes()) == ssh['knownHostsSHA256']
assert sha(pathlib.Path('/home/user/.ssh/wine_github_ed25519.pub').read_bytes()) == ssh['publicKeySHA256']
env = dict(GIT_SSH_COMMAND=ssh['sshCommand'])
branch = 'task/shadow-man-patch-bound-static-accept-oct23'
base = '9ceffa0c7927431fc0ea575ee5ad2318f68e494c'
relative = H.relative_to(R)
report = pathlib.Path(str(relative)+'.md')
def git(label, *args):
    return g.bounded(label, ['git', '-C', str(R), *args], extra_env=env)
prior = sum(json.loads(p.read_text())['capturedBytes'] for p in H.glob('*.receipt.json'))
g.EXT = E
dump(E/'prior-capture.receipt.json', dict(capturedBytes=prior, meaning='cumulative earlier evidence receipts; not another command'))
before = git('publication-remote-before', 'ls-remote', '--heads', 'origin', 'main', branch)
assert len(before['stdout'].splitlines()) == 1 and before['stdout'].split()[1] == 'refs/heads/main'
oldmain = before['stdout'].split()[0]
admission = json.loads((H/'admission.json').read_text())
size = lambda p: sum(f.stat().st_size for f in p.rglob('*') if f.is_file())
session = pathlib.Path(admission['session'])
measured = dict(privateGit=size(R/'.git'), focusedCopiesEvidenceReport=size(R)-size(R/'.git'), externalLauncherEventsStderr=size(E), separateCodexSession=session.stat().st_size)
allowances = dict(privateGitIndexNewObjectsTempEvidenceFuture=4194304, externalFutureGrowth=4194304, sessionFutureGrowth=12582912, reserve=8388608)
projected = sum(measured.values())+sum(allowances.values())
free = shutil.disk_usage(R).free
assert projected <= 67108864 and free-sum(allowances.values()) >= 2982150144
dump(H/'publication-admission.json', dict(verdict='ADMISSION_PASS', measured=measured, allowances=allowances, projectedPeak=projected, allocation=67108864, hostFree=free, hostAfterIncrementalGrowth=free-sum(allowances.values()), hostFloor=2982150144))
seals = []
for p in sorted([R/report]+[p for p in H.rglob('*') if p.is_file()]):
    assert p.name != 'seals.json'
    b = p.read_bytes()
    seals.append(dict(path=str(p.relative_to(R)), bytes=len(b), sha256=sha(b)))
dump(H/'seals.json', seals)
git('publication-add', 'add', '--', str(report), str(relative))
git('publication-whitespace', 'diff', '--cached', '--check')
staged = git('publication-scope', 'diff', '--cached', '--name-status')['stdout'].splitlines()
assert staged and all(line.startswith('A\t') and (line[2:]==str(report) or line[2:].startswith(str(relative)+'/')) for line in staged)
git('publication-commit', 'commit', '-m', 'docs: record blocked patch-bound static inspector acceptance')
head = git('publication-head', 'rev-parse', 'HEAD')['stdout'].strip()
assert head != base
status = git('publication-status', 'status', '--porcelain')['stdout']
assert status == ''
for row in seals:
    b = (R/row['path']).read_bytes()
    assert len(b)==row['bytes'] and sha(b)==row['sha256']
git('publication-push', 'push', 'origin', 'HEAD:refs/heads/'+branch)
after = git('publication-remote-after', 'ls-remote', '--heads', 'origin', 'main', branch)
refs = dict(line.split()[::-1] for line in after['stdout'].splitlines())
assert refs['refs/heads/'+branch] == head
assert refs['refs/heads/main'] == oldmain
result = dict(verdict='BLOCKER_COMPILER_EXCERPT_IDENTITY', commit=head, branch=branch, actualRemoteSHA=refs['refs/heads/'+branch], mainUnchanged=oldmain, seals=len(seals), retainedSealsVerified=True, scopeOnlyOwnedAdditions=len(staged), projectedPeak=projected, allocation=67108864, hostAfterIncrementalGrowth=free-sum(allowances.values()), aggregateCaptureBytes=sum(json.loads(p.read_text())['capturedBytes'] for p in E.glob('*.receipt.json')), allRecordedGroupsReaped=all(json.loads(p.read_text()).get('reaped',True) for p in E.glob('*.receipt.json')), acceptanceStoppedAfter='verify-inputs exit1 compiler-excerpt assertion', testsRan=False, staticInspectionRan=False, box=None, lifecycleOwner='coordinator')
dump(E/'publication.json', result)
print(json.dumps(result))
