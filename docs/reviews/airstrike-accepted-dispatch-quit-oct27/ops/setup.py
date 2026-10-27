import pathlib,json,hashlib,shutil
import run as c
H,R=c.H,c.R
donor=pathlib.Path('/tmp/airstrike-accepted-frozen-dispatch-main-integrate-oct27/repo')
cfg=(donor/'.git/config').read_text();url=cfg.split('[remote "origin"]')[1].split('url=')[1].splitlines()[0].strip()
(R/'.git/config').write_text('[core]\n repositoryformatversion = 0\n bare = false\n logallrefupdates = true\n[remote "origin"]\n url = '+url+'\n fetch = +refs/heads/*:refs/remotes/origin/*\n[user]\n name = Wine Ops\n email = wine-ops@localhost\n')
(R/'.git/HEAD').write_text('ref: refs/heads/task/airstrike-accepted-dispatch-quit-oct27\n')
(R/'.git/objects/info/alternates').write_text(str(donor/'.git/objects')+'\n')
(R/'.git/info/sparse-checkout').write_text('/docs/reviews/airstrike-accepted-dispatch-quit-oct27/\n')
rows=json.loads((c.ROOT/'scratch/usage-watch/airstrike-cleanup-verified-runtime-map-oct27.json').read_text())['files']
pins=json.loads((donor/'docs/reviews/airstrike-accepted-frozen-dispatch-main-integrate-oct27/receipt.json').read_text())['acceptedPins']
for x in rows:
 p=x['target'].removeprefix('runner/')
 if p in pins:
  b=(donor/p).read_bytes();assert hashlib.sha256(b).hexdigest()==pins[p]
  x.update(kind='file',source=str(donor/p),sha256=pins[p],bytes=len(b))
for p in ('test/test-airstrike-frozen-dispatch.py','test/fixtures/airstrike-frozen-dispatch.cjs'):
 b=(donor/p).read_bytes();assert hashlib.sha256(b).hexdigest()==pins[p];rows.append(dict(target='runner/'+p,source=str(donor/p),kind='file',bytes=len(b),sha256=pins[p]))
c.dump('runtime-map.json',dict(files=rows,acceptedMain='c220ffccd69932bb2e5f05189f4845581de0d723',reusedExecutions=19,reusedRegressions=25))
# Immutable source objects, one bounded Git archive child, no checkout.
gitrows=[x for x in rows if x['kind']=='git'];(H/'git-paths.json').write_text(json.dumps([x['source'] for x in gitrows]))
files=[x for x in rows if x['kind']=='file']
for x in files:
 b=pathlib.Path(x['source']).read_bytes();assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'],x['source']
c.dump('setup-pass.json',dict(filePins=len(files),gitPending=len(gitrows),bytes=sum(x['bytes'] for x in rows),strictSSH=c.SSH,incidents=['Exploratory displays exceeded8192B; raw session retained. Missing optional remote.py/proxy.py read failed; no guest started.']))
print('setup file pins',len(files),'Git pending',len(gitrows))
