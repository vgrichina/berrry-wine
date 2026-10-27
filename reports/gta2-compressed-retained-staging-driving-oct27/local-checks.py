import ast
results=[]
for p in sorted(O.glob('*.py')):
 ast.parse(p.read_text(),filename=str(p));results.append(dict(path=p.name,sha256=sha(p.read_bytes()),syntax=True))
assert sha(TRUST.read_bytes())=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
originalProc=pathlib.Path("/proc/55496/cmdline");originalNow=originalProc.read_bytes() if originalProc.exists() else b"";assert not (b"boat" in originalNow and b"pack-8.tar.z64" in originalNow)
save('local-recipe-checks.json',dict(python=results,trustedSupervisorSHA256=sha(TRUST.read_bytes()),originalLocalPendingPIDObservation=dict(exists=originalProc.exists(),currentArgvSHA256=sha(originalNow),matchesOriginalAppend=False),gitSSH=SSH,parentLimits=pathlib.Path('/proc/self/limits').read_text(),incidents=['Initial combined policy displays oversized; retained tool transcript.','A narrow process query accidentally included one base64-bearing API argv; retained transcript, command already in owned ledger, no credential content.','Pool2 initial wait45 expired before operation; capacity observed free before admitted retry.','Overbroad fonts discovery rejected78files/8456711B before transfer; corrected exact required bitmap/subset closure29files/761186B.','Canonical build prefix stopped missing fonts/Terminal.fon; no WAT compile/module/guest. Exact remaining suffix resumed with initial CPU/wall/output deducted.']))
print('local syntax, supervisor, SSH identity and original local pending process checks pass')
