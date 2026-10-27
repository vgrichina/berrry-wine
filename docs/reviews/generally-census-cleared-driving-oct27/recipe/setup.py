import pathlib,json,hashlib,os,time,shutil
H=pathlib.Path(__file__).parent;R=H.parent/'repo';ROOT=pathlib.Path('/home/user/wine-assembly');PIN='1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba'
q=json.loads((ROOT/'scratch/usage-watch/census-cleared-games-readiness-oct27/generally.json').read_text())
(H/'readiness-shape.json').write_text(json.dumps({k:(len(v) if isinstance(v,list) else v) for k,v in q.items()},indent=2))
print({k:(len(v) if isinstance(v,list) else v) for k,v in q.items()})
rows=next(v for v in q.values() if isinstance(v,list) and v and isinstance(v[0],dict) and 'oid' in v[0])
seen=set();todo=[pathlib.Path('/tmp/generally-census-accepted-main-integration-oct27/repo/.git/objects')]
while todo:
 p=todo.pop().resolve()
 if p in seen:continue
 seen.add(p);a=p/'info/alternates'
 if a.exists():
  for l in a.read_text().splitlines():
   x=pathlib.Path(l);todo.append(x if x.is_absolute() else p/x)
proxies=H/'readonly-object-proxies';proxies.mkdir(exist_ok=True);alts=[]
for i,p in enumerate(sorted(seen)):
 d=proxies/str(i);d.mkdir(exist_ok=True)
 for x in p.iterdir():
  if x.name=='pack' or (len(x.name)==2 and all(c in '0123456789abcdef' for c in x.name)):(d/x.name).symlink_to(x,target_is_directory=True)
 alts.append(str(d))
(R/'.git/objects/info/alternates').write_text('\n'.join(alts)+'\n')
(R/'.git/config').write_text('[core]\n repositoryformatversion = 0\n filemode = true\n bare = false\n sparseCheckout = true\n[user]\n name = Wine Ops Worker\n email = wine-ops@local\n[gc]\n auto = 0\n[maintenance]\n auto = false\n[remote "origin"]\n url = git@github.com:vgrichina/wine-assembly.git\n')
(R/'.git/HEAD').write_text('ref: refs/heads/task/generally-census-cleared-driving-oct27\n')
(R/'.git/info/sparse-checkout').write_text(''.join('/'+x['path']+'\n' for x in rows))
(H/'source-rows.json').write_text(json.dumps(rows))
(H/'donors.json').write_text(json.dumps([str(p) for p in seen]))
(H/'initial-configuration.json').write_text(json.dumps(dict(pin=PIN,strictSSH=os.environ.get('GIT_SSH_COMMAND','as pinned in run.py'),rootRefReceipt=str(ROOT/'scratch/usage-watch/generally-census-cleared-driving-oct27/root-ref-digest.json'),watcher=17923,incidents=['initial oversized document/readiness display','missing aggregate-admission.json path; actual coordinator admission supplied separately']),indent=2))
