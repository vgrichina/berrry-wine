import pathlib,json,subprocess,os,shutil,hashlib
H=pathlib.Path('/home/user'); W=H/'wine-assembly-shadow-man-configuration-save-gameplay-oct23'; BASE='bb9c496ed13095cc832fdf607f0937fb9c14b7de'
C=H/'wine-assembly-shadow-man-launcher-configuration-capture-oct23/scratch/runs/20261023-shadow-man-launcher-configuration-capture'
L=H/'wine-assembly-shadow-man-live-capture-helper-retest-oct23/scratch/runs/20261023-shadow-man-live-capture-helper-retest'
R=H/'wine-assembly-shadow-man-remaining-files-launcher-capture-oct23/scratch/runs/20261023-shadow-man-remaining-files-launcher-capture'
D=H/'wine-assembly-shadow-man-launcher-evidence-status-integrate-oct23'
plan=json.loads((C/'staging-plan.json').read_text())
paths={pathlib.Path(x['source']) for x in plan}
paths.update(p for d in [C,L,R] for p in d.rglob('*') if p.is_file())
paths.update(p for p in (D/'.git').rglob('*') if p.is_file())
paths.update([D/'docs/re-notes/shadow-man-launcher-evidence-accepted-20261023.md',H/'wine-assembly/AGENTS.md',H/'wine-assembly/CLAUDE.md',H/'wine-assembly/ops/README.md',H/'wine-assembly/tools/ctl.js',H/'wine-assembly/ops/check-run-evidence.js',H/'wine-assembly/ops/run-evidence.js',pathlib.Path(__file__)])
paths={p for p in paths if p.exists()}
rows=[dict(path=str(p),bytes=p.stat().st_size,allocated=p.stat().st_blocks*512) for p in sorted(paths)]
ad=dict(selected=rows,selectedAllocated=sum(x['allocated'] for x in rows),ownAllowance=20*1024**2,toolsAndGitAllowance=8*1024**2,reserve=8*1024**2,cap=64*1024**2,hostFloor=2982150144,hostFree=shutil.disk_usage(H).free)
ad['projected']=ad['selectedAllocated']+ad['ownAllowance']+ad['toolsAndGitAllowance']+ad['reserve']
assert ad['projected']<=ad['cap'] and ad['hostFree']>ad['hostFloor'],ad
assert not W.exists()
env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
def git(*a,cwd=W):return subprocess.check_output(['git',*a],cwd=cwd,env=env)
ssh=git('config','--get','core.sshCommand',cwd=H/'wine-assembly').decode().strip()
remote=git('-c','core.sshCommand='+ssh,'ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/main',cwd=D).decode().split()[0];assert remote==BASE,remote
W.mkdir();git('init','-q');shutil.copytree(D/'.git/objects',W/'.git/objects',dirs_exist_ok=True)
git('config','user.name','Wine runtime worker');git('config','user.email','wine-worker@local');git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
git('update-ref','refs/heads/task/shadow-man-configuration-save-gameplay-oct23',BASE);git('symbolic-ref','HEAD','refs/heads/task/shadow-man-configuration-save-gameplay-oct23');git('read-tree',BASE)
names=git('ls-files','-z');subprocess.run(['git','update-index','--skip-worktree','-z','--stdin'],input=names,cwd=W,env=env,check=True)
E=W/'scratch/runs/20261023-shadow-man-configuration-save-gameplay';E.mkdir(parents=True)
(E/'admission.json').write_text(json.dumps(ad,indent=2)+'\n');(E/'base-index.txt').write_bytes(git('ls-files','--stage'));(E/'remote-main.json').write_text(json.dumps(dict(expected=BASE,actual=remote)))
for n in ['transport.py','full-accepted-manifest.json']:shutil.copyfile(R/n,E/n)
p=E/'transport.py';p.write_text(p.read_text().replace("BOX='bx_vufrds5w'","BOX='bx_fn7pn7yg'"))
for n in ['hash_gate.py','prepare_mutable.py','preguest.py','watchdog.py','runtime-manifest.json','codec-pins.json','accepted-installed-payload.json','accepted-parent-registry.json']:shutil.copyfile(C/n,E/n)
for n in ['compile-guard.cjs','game-observer.cjs','dependency-preflight.cjs','forwarding-fixture.cjs','guard-fixture.cjs']:shutil.copyfile(C/n,E/n)
(E/'accepted').mkdir();shutil.copyfile(C/'accepted/required-data-manifest.json',E/'accepted/required-data-manifest.json')
print(json.dumps(dict(worktree=str(W),admission=ad['projected'],selectedAllocated=ad['selectedAllocated'],remote=remote,ownAllocated=int(subprocess.check_output(['du','-s','-B1',str(W)]).split()[0]))))
