assert sha(TRUST.read_bytes())=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
remote=TRUST.read_text().replace('lower_limit(resource.RLIMIT_CPU, 90)','lower_limit(resource.RLIMIT_CPU, 180)')
save('remote-supervisor-derivation.json',dict(sourceSHA256=sha(TRUST.read_bytes()),derivedSHA256=sha(remote.encode()),change='Remote task CPU rlimit 180 seconds; local trusted helper unchanged.'))
put(str(O/'remote-supervisor.py'),remote.encode(),'remote-supervisor')
put(str(O/'remote-job.py'),(O/'remote-job.py').read_bytes(),'remote-job')
P=pathlib.Path('/tmp/enigma-remote-host-validated-startgame-oct27/repo/runner/node_modules/pngjs');pins=[];buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w') as tar:
 for p in sorted(P.rglob('*')):
  if p.is_file():
   b=p.read_bytes();target='node_modules/pngjs/'+str(p.relative_to(P));i=tarfile.TarInfo(target);i.size=len(b);tar.addfile(i,io.BytesIO(b));pins.append(dict(path=target,bytes=len(b),sha256=sha(b)))
assert len(pins)<=40
put(str(O/'pngjs.tar'),buf.getvalue(),'pngjs')
py('import tarfile,pathlib;p=pathlib.Path('+repr(str(O/'pngjs.tar'))+');t=tarfile.open(p);t.extractall('+repr(str(H/'repo'))+',filter="data");t.close();p.unlink();print("pngjs staged")')
save('pngjs-pins.json',pins)
print('aux staged',len(pins))
