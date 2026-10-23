#!/usr/bin/env python3
"""Private metadata only; bounded publication of this denied-admission report."""
import hashlib,json,os,pathlib,shutil,subprocess,sys,time,traceback
sys.dont_write_bytecode=True
from guard import run,H,ROOT,EXT
BRANCH='task/shadow-man-memory-recovered-handler-qualification-oct23'
BASE='594537144f3e153a338c5f7861cf87c9c183fece'
ENV=dict(os.environ,GIT_NO_LAZY_FETCH='1')
ENV['GIT_SSH_COMMAND']='ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -i /home/user/.ssh/wine_github_ed25519'
def retain_error(kind,error,tb):
    (EXT/'publication-failure.txt').write_text(''.join(traceback.format_exception(kind,error,tb)))
sys.excepthook=retain_error
def dump(p,j): p.write_text(json.dumps(j,indent=2)+'\n')
def git(*args):
    return subprocess.check_output(['git','-C',str(ROOT),*args],env=ENV).decode().strip()
def account(label):
    def size(p):return sum(q.stat().st_size for q in p.rglob('*') if q.is_file()) if p.is_dir() else p.stat().st_size
    session=next(pathlib.Path('/home/user/.codex/sessions/2026/10/23').glob('*01a167bf-0542-7773-ba00-f21b473ebde4.jsonl'))
    measured=dict(privateTaskTree=size(ROOT),externalLauncher=size(EXT),separateCodexSession=size(session))
    allowance=dict(privateGitNewObjectsTempEvidenceFuture=12*1024**2,externalFuture=4*1024**2,sessionFuture=12*1024**2,reserve=8*1024**2)
    projected=sum(measured.values())+sum(allowance.values());free=shutil.disk_usage(ROOT).free
    receipt=dict(measured=measured,allowances=allowance,projectedPeak=projected,cap=67108864,hostFree=free,hostAfterProjection=free-projected,hostFloor=2982150144)
    dump(EXT/(label+'.json'),receipt)
    assert projected<=67108864 and free-projected>=2982150144
    return receipt
if sys.argv[1]=='setup':
    assert not (ROOT/'.git').exists()
    account('private-git-admission')
    git('init','--template=')
    # One measured DIRECT standing store. No nested alternate stores or fetch.
    (ROOT/'.git/objects/info/alternates').write_text('/home/user/wine-assembly/.git/objects\n')
    git('config','user.name','Wine Ops')
    git('config','user.email','wine-ops@localhost')
    git('config','remote.origin.url','git@github.com:vgrichina/wine-assembly.git')
    git('symbolic-ref','HEAD','refs/heads/'+BRANCH)
    git('update-ref','HEAD',BASE)
    git('read-tree',BASE)
    names=subprocess.check_output(['git','-C',str(ROOT),'ls-files','-z'],env=ENV)
    subprocess.run(['git','-C',str(ROOT),'update-index','--skip-worktree','-z','--stdin'],input=names,env=ENV,check=True)
    dump(H/'private-git.json',dict(base=BASE,branch=BRANCH,privateGit=str(ROOT/'.git'),index=str(ROOT/'.git/index'),directStandingObjectStore='/home/user/wine-assembly/.git/objects',standingObjectStoreMutation=False))
    print('Private Git/index initialized; no production files materialized.')
elif sys.argv[1]=='remote':
    run('remote-before',['git','ls-remote','origin','refs/heads/main','refs/heads/'+BRANCH])
elif sys.argv[1]=='commit':
    account('commit-admission')
    allowed='docs/re-notes/shadow-man-memory-recovered-handler-qualification-20261023'
    files=sorted(p for p in (ROOT/'docs').rglob('*') if p.is_file())
    assert all(str(p.relative_to(ROOT)).startswith(allowed) for p in files)
    dump(H/'seals.json',[dict(path=str(p.relative_to(ROOT)),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in files if p.name!='seals.json'])
    git('add','--',allowed+'.md',allowed)
    changed=git('diff','--cached','--name-only',BASE).splitlines()
    assert changed and all(p.startswith(allowed) for p in changed),changed
    assert all(line.startswith('A\t') for line in git('diff','--cached','--name-status',BASE).splitlines())
    git('diff','--cached','--check')
    git('commit','-m','test: qualify retained Shadow Man native handler capture')
    dump(EXT/'commit.json',dict(commit=git('rev-parse','HEAD'),branch=BRANCH))
elif sys.argv[1]=='push':
    account('publication-admission')
    head=git('rev-parse','HEAD')
    # Structured Git data stays inside this supervised Python command and is
    # retained as bounded files. Its outer stdout/stderr budget remains zero.
    results=[]
    for label,args in [('strict-push',['git','push','--quiet','origin','HEAD:refs/heads/'+BRANCH]),('remote-after',['git','ls-remote','origin','refs/heads/'+BRANCH,'refs/heads/main'])]:
        start=time.monotonic()
        p=subprocess.run(args,cwd=ROOT,env=ENV,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=40)
        assert len(p.stdout)+len(p.stderr)<=524288
        data=dict(argv=args,exit=p.returncode,stdout=p.stdout.decode(),stderr=p.stderr.decode(),bytes=len(p.stdout)+len(p.stderr),seconds=time.monotonic()-start)
        dump(EXT/(label+'.git-data.json'),data);results.append(data)
        assert p.returncode==0,data
    refs=dict(line.split()[::-1] for line in results[-1]['stdout'].splitlines())
    assert refs['refs/heads/'+BRANCH]==head,refs
    dump(EXT/'publication.json',dict(commit=head,branch=BRANCH,actualRemote=refs,strictSSH=True,GIT_NO_LAZY_FETCH='1',resources=account('final-resources'),sharedRefsMutated=False))
else:raise SystemExit('setup | remote | commit | push')
