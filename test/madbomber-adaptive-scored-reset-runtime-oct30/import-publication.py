import pathlib,subprocess,os,time,signal,json
import ops
from limit_contract import configure_parent,child_limits
R=pathlib.Path(__file__).parent.resolve();repo=R/'repo';ops.BASE=configure_parent();a=ops.admission()
for name,args in [('identity-top',['rev-parse','--show-toplevel']),('identity-git',['rev-parse','--absolute-git-dir'])]:
 rc,out=ops.run(name,['git','-C',str(repo)]+args,cwd=repo,git=True);assert rc==0
assert repo.resolve().is_relative_to(R) and not (repo/'.git/index').exists()
start=time.monotonic();out=R/'e/import.stdout';err=R/'e/import.stderr'
with (R/'e/board-watch.stdout').open('wb') as bo,(R/'e/board-watch.stderr').open('wb') as be:
 watcher=subprocess.Popen(['/usr/bin/tail','-n','0','-f','/home/user/wine-assembly/messageboard.txt'],cwd=R,stdout=bo,stderr=be,preexec_fn=lambda:child_limits(False),start_new_session=True)
 try:
  with (R/'publication.fast-import').open('rb') as i,out.open('wb') as o,err.open('wb') as e:
   p=subprocess.Popen(['git','-C',str(repo),'fast-import','--quiet','--done'],stdin=i,stdout=o,stderr=e,cwd=repo,preexec_fn=lambda:child_limits(True),start_new_session=True)
   while p.poll() is None:
    rows=ops.rows();ids={p.pid,watcher.pid}
    while True:
     n=len(ids);ids|={pid for pid,v in rows.items() if v[0] in ids}
     if n==len(ids):break
    reason=None
    if time.monotonic()-start>90:reason='wall'
    if sum(rows.get(i,(0,0))[1] for i in ids)>512*1048576:reason='groupRSS'
    if rows.get(os.getpid(),(0,0))[1]>128*1048576:reason='parentRSS'
    if out.stat().st_size+err.stat().st_size>512*1024:reason='capture'
    if (R/'e/board-watch.stdout').stat().st_size>65536:reason='watcher capture'
    if reason:os.killpg(p.pid,signal.SIGKILL);p.wait();raise RuntimeError(reason)
    time.sleep(.03)
  assert p.returncode==0,err.read_text()[:1000]
 finally:
  os.killpg(watcher.pid,signal.SIGTERM);watcher.wait(timeout=3)
rec={'exit':p.returncode,'elapsed':time.monotonic()-start,'indexFree':True,'parentPythonDATA':128*1048576,'GitChildDATA':256*1048576,'admission':a,'identityVerifiedBeforeMutation':True,'boardWatcherReaped':True}
(R/'import-receipt.json').write_text(json.dumps(rec,indent=2));print(json.dumps(rec))
