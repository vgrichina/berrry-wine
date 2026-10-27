import pathlib,json,hashlib,base64,zlib
H=pathlib.Path(__file__).parent
D=pathlib.Path('/tmp/penguin-visible-projectile-gameplay-oct27')
v=json.loads((D/'ops/verification.json').read_text());i=json.loads((D/'ops/incidents.json').read_text())
assert v['startupEnvironmentSha256']!=v['guestEnvironmentSha256']
old=(D/'ops/supervise.py').read_text();collector=(D/'ops/work.py').read_text()
assert 'env=dict(os.environ)' in old and "assert json.load(open(H/'startup/terminal.json'))['returncode']==0" in old
assert "responseBytes=len(p.stdout.encode())+len(p.stderr.encode())" in collector
assert "assert (H/'api-history.jsonl').stat().st_size<1048576" in collector
images=[]
for n in ['b39999.png','b40060.png']:
 p=D/'repo/docs/re-notes/penguin-visible-projectile-gameplay-20261027/decision'/n
 b=p.read_bytes();z=zlib.compress(b);images.append(dict(path=str(p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),zlibBytes=len(z),base64Bytes=len(base64.b64encode(z))))
j=dict(historicalEnvironmentMismatch=True,differingVariables='UNKNOWN; hashes alone do not establish cause',oldGate='exitCode only; no pre-guest environment identity comparison',oldAPIGate='bounds history metadata file, not cumulative serialized responses',historicalSerializedBytes=i['apiTransferOutput']['serializedResponseBytes'],apiCap=1048576,images=images,sourceHashes={n:hashlib.sha256((D/'ops'/n).read_bytes()).hexdigest() for n in ['supervise.py','startup.cjs','execute.py','work.py','collect.py','launch-config.json','verification.json','incidents.json']},initialExcerptIncident='First policy/source tool responses exceeded ordinary8192 excerpt; retained, subsequent output bounded; no blanket excerpt compliance claim')
assert j['historicalSerializedBytes']>j['apiCap']
(H/'old-contract-reproductions.json').write_text(json.dumps(j,indent=2)+'\n');print(json.dumps(dict(reproduced=2,images=images)))
