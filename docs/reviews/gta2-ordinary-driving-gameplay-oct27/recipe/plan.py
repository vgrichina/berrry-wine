from run import *
rows=[]
for s in (H/'focused-tree.stdout').read_text().splitlines():
 a,p=s.split('\t');m,t,b,n=a.split();rows.append(dict(path=p,blob=b,bytes=int(n)))
tot={}
for r in rows:tot[r['path'].split('/')[0]]=tot.get(r['path'].split('/')[0],0)+r['bytes']
input=json.loads((ROOT/'scratch/usage-watch/gta2-driving-input-readiness-oct27.json').read_text())
bad=[]
for r in input['files']:
 p=pathlib.Path(r['path']);h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(65536),b''):h.update(b)
 if p.stat().st_size!=r['bytes'] or h.hexdigest()!=r['sha256']:bad.append(str(p))
assert not bad,bad
dump('source-tree.json',rows);dump('game-closure.json',input)
dump('preallocation.json',dict(source=tot,gameBytes=input['totalBytes'],gameFiles=len(input['files']),gameOriginalReadOnly=True,local=dict(allocation=128*M,reserve=8*M,sourceGit=20*M,ops=52*M,events=16*M,growth=32*M),remote=dict(allocation=1024*M,source=80*M,game=26*M,tools=100*M,buildTemp=300*M,module=10*M,captures=32*M,logs=8*M,publication=64*M,growth=240*M,reserve=64*M),api=dict(budget=8*M,terminal=M,chunk=4096,envelope=1024,reservedAcceptancePNGs=4,pngCeiling=4*M),initialRefReceipt=str(ROOT/'scratch/usage-watch/gta2-ordinary-driving-gameplay-oct27/root-ref-digest.json')))
print(json.dumps(dict(source=tot,gameFiles=len(input['files']),gameBytes=input['totalBytes'],gamePins='PASS')))
