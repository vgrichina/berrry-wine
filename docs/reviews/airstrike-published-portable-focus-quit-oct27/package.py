import pathlib,json,hashlib,time,shutil
import run as c
H,R=c.H,c.R
D=pathlib.Path('/tmp/airstrike-portable-fixtures-accepted-main-integration-oct27/repo')
rev='097f3b2904d833ca8fb152e686032c156c16e39a'
branch='task/airstrike-published-portable-focus-quit-oct27'
g=R/'.git'
for p in ('objects/info','refs/heads/task','info'): (g/p).mkdir(parents=True,exist_ok=True)
(g/'objects/info/alternates').write_text(str(D/'.git/objects')+'\n'+(D/'.git/objects/info/alternates').read_text())
(g/'config').write_text('[core]\n repositoryformatversion = 0\n bare = false\n sparseCheckout = true\n[user]\n name = Wine Ops Worker\n email = wine-ops@local\n[gc]\n auto = 0\n[maintenance]\n auto = false\n[remote "origin"]\n url = git@github.com:vgrichina/wine-assembly.git\n')
(g/'HEAD').write_text('ref: refs/heads/'+branch+'\n');(g/'refs/heads'/branch).write_text(rev+'\n')
report='docs/reviews/airstrike-published-portable-focus-quit-oct27'
(g/'info/sparse-checkout').write_text('/'+report+'/\n')
q=json.loads((H/'capture-plan.json').read_text())
q['historicalFrameInspection']=dict(at=time.time(),path=str(D/'test/fixtures/airstrike-caption/9b55685e506a4124abd456510ebaf254.png'),sha256='a0d213dfefdda68876792c1819711dd3c470dfece91b0d9280f6462ce01aee61',dimensions=[800,600],inspection='Viewed full lossless historical frame: Console overlays Airstrike; Press any key to start and In the game press ESC for a menu are readable. No menu rows visible. Historical frame only, no current-frame/focus/activation claim.')
c.dump('capture-plan.json',q)
c.dump('report-path.json',dict(report=report,branch=branch,parent=rev))
print('Sparse report repository configured; no full checkout or source edits')
