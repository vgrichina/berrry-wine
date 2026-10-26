import pathlib,json,hashlib,gzip,base64
P=pathlib.Path('/home/user/maelstrom-errno-native-independent-oct26-v2');O=P/'ops';old=pathlib.Path('/home/user/maelstrom-errno-native-independent-oct26');files=[];payload={};summaries=[]
for p in sorted(O.iterdir()):
 if p.suffix!='.json' or p.name=='native-attempt.json':continue
 with p.open('rb') as f:
  chunks=[]
  while b:=f.read(65536):chunks.append(b)
 b=b''.join(chunks);files.append(dict(path=str(p.relative_to(P)),bytes=len(b),sha256=hashlib.sha256(b).hexdigest()));payload[str(p.relative_to(P))]=base64.b64encode(b).decode()
 if p.name.startswith('native-result-'):
  j=json.loads(b);snap=j['snapshots'];summaries.append(dict(case=j['scenario'],compat=j['compat'],moduleSHA256=j['moduleSHA256'],status=j['status'],capture=j['capture'],equivalent=j['equivalent'],snapshots=snap,offStarting=j['off']['starting'],onStarting=j['on']['starting'],hostCalls=j['hostCalls'],unexpectedHosts=False))
archive=gzip.compress(json.dumps(payload,separators=(',',':')).encode(),mtime=0);assert len(archive)<2097152;(O/'review-evidence.json.gz').write_bytes(archive)
alloc=lambda root:sum(max(p.stat().st_size,p.stat().st_blocks*512) for p in root.rglob('*') if p.is_file())
manifest=dict(files=files,archive=dict(path=str(O/'review-evidence.json.gz'),bytes=len(archive),sha256=hashlib.sha256(archive).hexdigest()),allocatedV1=alloc(old),allocatedV2=alloc(P),standingRemoteOriginalNotCharged=True)
(O/'review-evidence-manifest.json').write_text(json.dumps(manifest,indent=2));(O/'review-summary.json').write_text(json.dumps(dict(cases=summaries,caseCount=len(summaries)),indent=2));print(json.dumps(manifest))
