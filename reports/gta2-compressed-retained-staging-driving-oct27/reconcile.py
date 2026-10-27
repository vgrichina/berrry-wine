OLD=pathlib.Path('/tmp/gta2-census-cleared-driving-oct27/ops')
assert sha((OLD/'receipt-manifest.json').read_bytes())=='0b308391aa92c502a874e8a516cbc80e1e4f59b2c86debc3b47fb87376e27143'
req=json.loads((OLD/'commands/1793103981773541913.json').read_text());argv=shlex.split(req['command']);import ast
tr=ast.parse(argv[2]);part=next(x.value.args[0].value for x in ast.walk(tr) if isinstance(x,ast.Expr) and isinstance(x.value,ast.Call) and isinstance(x.value.func,ast.Attribute) and x.value.func.attr=='write')
prior=[]
for p in sorted((OLD/'commands').glob('*.json')):
 j=json.loads(p.read_text())
 if 'pack-8.tar.z64' in j['command'] and p.stem<='1793103981773541913':
  t=ast.parse(shlex.split(j['command'])[2]);s=next(x.value.args[0].value for x in ast.walk(t) if isinstance(x,ast.Expr) and isinstance(x.value,ast.Call) and isinstance(x.value.func,ast.Attribute) and x.value.func.attr=='write');prior.append(s)
b=''.join(prior).encode();save('original-request-identity.json',dict(request='1793103981773541913',localStart=json.loads((OLD/'requests/1793103981773541913.start.json').read_text()),commandSHA256=req['sha256'],expectedPartialBytes=len(b),expectedPartialSHA256=sha(b),responseBytes={p.name:p.stat().st_size for p in (OLD/'responses').glob('1793103981773541913.*')},readOnlyObservation=True))
q=py('import pathlib,hashlib,json,os;p=pathlib.Path("/tmp/gta2-census-cleared-driving-oct27/ops/pack-8.tar.z64");b=p.read_bytes();print(json.dumps(dict(path=str(p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),processes=[dict(pid=x.name,cmd=(x/"cmdline").read_bytes().decode(errors="replace")[:200]) for x in pathlib.Path("/proc").glob("[0-9]*") if (x/"cmdline").exists() and b"pack-8.tar.z64" in (x/"cmdline").read_bytes() and b"python3\\x00-c" not in (x/"cmdline").read_bytes()])))')
save('original-request-observation.json',q);v=json.loads(q['stdout']);assert v['bytes']==len(b) and v['sha256']==sha(b),v
save('original-request-reconciliation.json',dict(result='pending append committed exactly once; observed exact full prefix; never replayed',request='1793103981773541913',bytes=len(b),sha256=sha(b)))
manifest=json.loads((OLD/'receipt-manifest.json').read_text());r=next(x for x in manifest['reportPayloads'] if x['path']=='README.md');p=OLD.parent/'repo/reports/gta2-census-cleared-driving-oct27/README.md';assert sha(p.read_bytes())==r['sha256'];save('predecessor-report-mapping.json',dict(path=str(p),sha256=r['sha256'],opsReadmeAbsent=not (OLD/'README.md').exists()))
print('original request reconciled exact; no replay; report README mapping verified')
