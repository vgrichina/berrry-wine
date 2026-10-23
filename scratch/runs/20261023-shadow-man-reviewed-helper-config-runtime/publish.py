"""Publish only the owned coherent evidence tree; preserve every base path."""
import pathlib,json,subprocess,os,hashlib,sys
E=pathlib.Path(__file__).resolve().parent;W=E.parents[2];env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
def git(*a,cwd=W,input=None):return subprocess.check_output(['git',*a],cwd=cwd,env=env,input=input)
assert git('branch','--show-current').decode().strip()=='task/shadow-man-reviewed-helper-config-runtime-oct23'
files=[str(p.relative_to(W)) for p in E.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.name not in ['publication.json']]
note=W/'docs/re-notes/shadow-man-reviewed-helper-config-runtime-20261023.md'
if note.exists():files.append(str(note.relative_to(W)))
git('add','-f','--',*files)
base={l.split('\t')[1]:l.split('\t')[0] for l in (E/'base-index.txt').read_text().splitlines()}
current={l.split('\t')[1]:l.split('\t')[0] for l in git('ls-files','--stage').decode().splitlines()};assert all(current.get(p)==v for p,v in base.items())
parent=git('rev-parse','HEAD').decode().strip();tree=git('write-tree','--missing-ok').decode().strip()
commit=git('commit-tree',tree,'-p',parent,input=(sys.argv[1]+'\n').encode()).decode().strip();git('update-ref','HEAD',commit,parent)
ssh=git('config','--get','core.sshCommand',cwd='/home/user/wine-assembly').decode().strip()
push=subprocess.run(['git','-c','core.sshCommand='+ssh,'push','origin','HEAD:refs/heads/task/shadow-man-reviewed-helper-config-runtime-oct23'],cwd=W,env=env,text=True,capture_output=True)
receipt=dict(commit=commit,parent=parent,branch='task/shadow-man-reviewed-helper-config-runtime-oct23',pushExit=push.returncode,pushStdout=push.stdout,pushStderr=push.stderr)
(E/'publication.json').write_text(json.dumps(receipt,indent=2)+'\n');assert push.returncode==0,receipt
remote=git('-c','core.sshCommand='+ssh,'ls-remote','origin','refs/heads/task/shadow-man-reviewed-helper-config-runtime-oct23').decode().split()[0];assert remote==commit
receipt.update(actualRemote=remote,independentRemoteVerified=True);(E/'publication.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
