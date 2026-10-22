#!/usr/bin/env python3
"""Offline failure-evidence verification only; never builds or executes a guest."""
import hashlib,json,os,subprocess
from pathlib import Path
E=Path(__file__).resolve().parent; R=E.parents[2]; X=E/'remote-evidence'
C='7a21579f9adb208164312961c249a0aa9080a8b7';B='89f1e9d2c67aa94d56d2319115589d07204d42e0'
ENV=dict(os.environ,GIT_NO_LAZY_FETCH='1',PYTHONDONTWRITEBYTECODE='1')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def alloc(p):
    if not p.exists():return 0
    return p.lstat().st_blocks*512+(sum(alloc(q) for q in p.iterdir()) if p.is_dir() and not p.is_symlink() else 0)
def git(*args):return subprocess.check_output(['git','-C',str(R),*args],env=ENV)
def main():
    manifest=json.loads((X/'build-inputs.json').read_text());assert manifest['revision']==C and manifest['main']==B
    wanted={}
    extra={'CLAUDE.md','AGENTS.md','.gitignore','index.html','package.json','package-lock.json','docs/dos-corpus/live/toyvm-bundle.js','docs/dos-corpus/live/toyvm-jit-bundle.js'}
    for row in git('ls-tree','-rz',C).split(b'\0'):
        if not row:continue
        meta,path=row.split(b'\t');mode,kind,oid=meta.decode().split();path=path.decode()
        if path.startswith(('src/','lib/','tools/','test/','fonts/')) or path in extra or ('/' not in path and path.endswith('.js')):
            assert kind=='blob';wanted[path]=(mode,oid)
    actual={r['path']:(r['mode'],r['blob']) for r in manifest['inputs']}
    assert actual==wanted and len(actual)==len(manifest['inputs'])==3426
    assert sum(r['bytes'] for r in manifest['inputs'])==manifest['bytes']==84995127
    assert {'fonts/Terminal.fon','tools/toyvm/emit-decoder.js'}.issubset(actual)
    attempt=json.loads((X/'build-attempt.json').read_text())
    assert attempt['source']==C and attempt['parent']==B and attempt['main']==B
    assert attempt['command']==['bash','tools/build.sh'] and attempt['attempt']==1 and attempt['exit']==1
    assert not attempt['outputs'] and not attempt['changedTrackedInputs'] and attempt['guard'] is None
    assert sha(X/'canonical-build.log')==attempt['logSHA256']
    log=(X/'canonical-build.log').read_text()
    assert 'changed producer lib/process-boot.js:host-file (sha256); review its lifetime' in log
    assert 'changed producer lib/storage.js:host-file (sha256); review its lifetime' in log
    assert 'index check only' not in (X/'api-main-preflight.log').read_text()
    assert json.loads((X/'api-main-preflight.json').read_text())['exit']==0
    details=json.loads((X/'blocker-details.json').read_text())
    assert details['firstFailedCommand']==['node','tools/callback-ownership-census.js']
    for r in details['mismatches']:
        assert r['actualSHA256']==next(p['sha256'] for p in manifest['inputs'] if p['path']==r['path'])
        assert r['actualSHA256']!=r['reviewedEntry']['sha256']
    originals=Path('/home/user/wine-assembly/scratch/usage-watch/shadow-man-dsetup-native-input-oct22')
    for row in json.loads((originals/'receipt.json').read_text())['originalInstalledFiles']:
        p=originals/row['name'];assert p.stat().st_size==row['size'] and sha(p)==row['sha256']
    for path,digest in json.loads((E/'reused-acceptance.json').read_text()).items():assert sha(Path(path))==digest,path
    for root,files in json.loads((E/'protected-before.json').read_text()).items():
        for p,digest in files.items():assert (sha(Path(p)) if Path(p).exists() else None)==digest,p
    assert git('rev-parse',C+'^').decode().strip()==B
    info=json.loads((E/'boat-handback-info.json').read_text())['sandbox']
    assert info['id']=='bx_f3gs8qm2' and info['state']=='idle' and info['stop'] is None and info['health']=='ok'
    assert info['archiveAfter']=='2026-10-22T23:20:32.491Z'
    handback=json.loads((X/'handback.json').read_text())
    assert handback['fullModuleTests']==handback['nativeCalls']==handback['gameLaunches']==0
    assert handback['bytesAllocated']+handback['reserve']+1048576<handback['cap']
    donor=Path('/home/user/wine-assembly-shadow-man-dsetup-native-version-repair-oct22')
    launcher=originals.parent/'shadow-man-dsetup-canonical-qualification-oct22'
    amounts=dict(own=alloc(R),entireReadonlyDonor=alloc(donor),sharedNative=alloc(originals),launcher=alloc(launcher)+alloc(Path(str(launcher)+'.task.txt')),reserve=8388608,publicationAllowance=2097152)
    total=sum(amounts.values()); free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize
    assert total<67108864 and free>2982150144,(amounts,total,free)
    result=dict(result='PASS',scope='offline evidence integrity only',candidate=C,main=B,filesIndependentlyReconciled=3426,originalPins=4,protectedMetadata='UNCHANGED',resources=dict(amounts=amounts,total=total,cap=67108864,hostFree=free,hostFloor=2982150144),buildAttempts=1,buildExit=1,fullModuleTests=0,moduleSHA256=None)
    (E/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
if __name__=='__main__':main()
