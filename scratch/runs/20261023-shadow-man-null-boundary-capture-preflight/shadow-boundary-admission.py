import os, pathlib, json, shutil, subprocess, hashlib
root=pathlib.Path('/home/user/wine-assembly')
donor=pathlib.Path('/home/user/wine-assembly-shadow-man-null-exit-diagnosis-oct23')
dest=pathlib.Path('/home/user/wine-assembly-shadow-man-null-boundary-capture-preflight-oct23')
base='bb9c496ed13095cc832fdf607f0937fb9c14b7de'
def size(p):
    return sum(x.stat().st_size for x in p.rglob('*') if x.is_file())
tools={str(pathlib.Path(p).resolve()):pathlib.Path(p).stat().st_size for p in ['/usr/bin/python3','/usr/bin/git','/usr/bin/bash','/usr/bin/ssh']}
node=pathlib.Path('/usr/local/bin/node').resolve()
free=os.statvfs(root).f_bavail*os.statvfs(root).f_frsize
parts={'entireDiagnosisDonorIncludingGitSourceEvidence':size(donor),
       'ownGitUpper':size(donor/'.git')+1048576,
       'otherReadInputsIncludingPoliciesInventory':1048576,
       'measuredToolExecutables':sum(tools.values()),
       'toolLibrariesTempOutputAndEvidenceAllowance':8388608,
       'reserve':8388608}
report={'base':base,'diagnosis':'26dffaa0995cdf19d61ae30117729ca0588108b9',
 'runtime':'58e90870a40a541a4083cae5e987ca8de31889e6',
 'capBytes':67108864,'hostFloorBytes':2982150144,'hostFreeBefore':free,
 'plannedHelperVerification':{'nodePath':str(node),'nodeBytes':node.stat().st_size,
 'minimumBytesWithOnlyNode':node.stat().st_size,'admitted':False,
 'reason':'Node executable alone exceeds whole-task cap; Node was NOT executed; no retry or alternate runtime acquired'},
 'blockerOnlyPublication':{'parts':parts,'upperBytes':sum(parts.values()),'toolBinaries':tools,
 'materialize':['docs/re-notes/shadow-man-null-boundary-capture-preflight-20261023.md',
 'docs/re-notes/shadow-man-null-boundary-capture-preflight-20261023/admission.json',
 'docs/re-notes/shadow-man-null-boundary-capture-preflight-20261023/check.py',
 'docs/re-notes/shadow-man-null-boundary-capture-preflight-20261023/checks.json'],
 'noRuntimeSourceCopies':True}}
assert sum(parts.values())<report['capBytes']
assert free-sum(parts.values())>report['hostFloorBytes']
assert not dest.exists()
pathlib.Path('/tmp/shadow-boundary-admission.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
# This is a report-only thin checkout, admitted separately before creation.
dest.mkdir()
shutil.copytree(donor/'.git/objects',dest/'.git/objects')
subprocess.run(['git','init',str(dest)],check=True,stdout=subprocess.DEVNULL)
env={**os.environ,'GIT_NO_LAZY_FETCH':'1'}
def git(*args):return subprocess.check_output(['git','-C',str(dest),*args],env=env)
git('config','user.name','Wine capture preflight worker')
git('config','user.email','wine-worker@local')
git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
branch='task/shadow-man-null-boundary-capture-preflight-oct23'
git('update-ref','refs/heads/'+branch,base)
git('symbolic-ref','HEAD','refs/heads/'+branch)
out=dest/'docs/re-notes/shadow-man-null-boundary-capture-preflight-20261023'
out.mkdir(parents=True)
shutil.copyfile('/tmp/shadow-boundary-admission.json',out/'admission.json')
