import pathlib,json,tarfile,gzip,hashlib,io,time
O=pathlib.Path(__file__).parent;OLD=pathlib.Path('/tmp/gta2-compressed-retained-staging-driving-oct27/ops')
T=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
assert hashlib.sha256(T.read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
b=T.read_bytes().replace(b'lower_limit(resource.RLIMIT_CPU, 90)',b'lower_limit(resource.RLIMIT_CPU, 180)')
(O/'remote-supervisor.py').write_bytes(b)
(O/'remote-supervisor-derivation.json').write_text(json.dumps(dict(source=str(T),sha256=hashlib.sha256(b).hexdigest(),change='remote CPU180 authorized, local original unchanged')))
(O/'preflight.js').write_bytes((OLD/'preflight.js').read_bytes())
plan=json.loads((O/'transfer-plan.json').read_text())
game=[r for g in plan['groups'] for r in g['pins'] if r['kind']=='game']
(O/'game-pins.json').write_text(json.dumps(game))
rows=[]
for name in ['remote-supervisor.py','preflight.js','game-pins.json','remote-trace.py']:
 p=O/name;rows.append(dict(path=str(p),target='../ops/'+name,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
P=pathlib.Path('/tmp/enigma-remote-host-validated-startgame-oct27/repo/runner')
for r in json.loads((OLD/'pngjs-pins.json').read_text()):rows.append(dict(r,path=str(P/r['path']),target=r['path']))
assert len(rows)<=40 and sum(r['bytes'] for r in rows)<2097152
with (O/'helpers.tar.gz').open('xb') as f:
 with gzip.GzipFile(fileobj=f,mode='wb',mtime=0,filename='') as z:
  with tarfile.open(fileobj=z,mode='w|',bufsize=65536) as t:
   for r in rows:
    p=pathlib.Path(r['path']);h=hashlib.sha256()
    with p.open('rb') as src:
     while b:=src.read(65536):h.update(b)
    assert h.hexdigest()==r['sha256'];i=tarfile.TarInfo(('ops/'+p.name) if r['target'].startswith('../ops/') else ('repo/'+r['target']));i.size=r['bytes'];i.mode=420
    with p.open('rb') as src:t.addfile(i,src)
p=O/'helpers.tar.gz';v=dict(files=rows,bytes=sum(r['bytes'] for r in rows),gzipBytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),requests=(p.stat().st_size+22499)//22500+1,estimatedSeconds=((p.stat().st_size+22499)//22500+1)*.18,at=time.time())
(O/'helpers-plan.json').write_text(json.dumps(v,indent=2));print(json.dumps({k:v for k,v in v.items() if k!='files'}))
