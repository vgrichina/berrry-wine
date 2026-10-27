import pathlib,os,hashlib,json,importlib.util,tempfile
O=pathlib.Path(os.environ['RICOCHET_ACCEPT_OPS']);R=O.parent/'repo';D=pathlib.Path('/tmp/ricochet-final-inventory-writer-contract-repair-oct27/repo');report=pathlib.Path('docs/reviews/ricochet-final-inventory-writer-contract-repair-oct27')
for name in ['tools/ricochet/control-publisher.py','tools/ricochet/production-commands.py',str(report/'producer-manifest.json')]:
 p=R/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((D/name).read_bytes())
p=R/report/'integrate.py';s=importlib.util.spec_from_file_location('recipe',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
remote=D/'docs/reviews/ricochet-measured-cpu-round-gameplay-oct27/remote-tools'
with tempfile.TemporaryDirectory() as tmp:
 dest=pathlib.Path(tmp)
 for n in ['remote-supervisor.py','serial.py','trusted-supervisor.py']:(dest/n).write_bytes((remote/n).read_bytes())
 immutable={str(dest/'serial.py'):hashlib.sha256((dest/'serial.py').read_bytes()).hexdigest(),str(dest/'trusted-supervisor.py'):hashlib.sha256((dest/'trusted-supervisor.py').read_bytes()).hexdigest()}
 receipt=m.prepare(dest,immutable,str(dest/'secondary'))
 assert receipt['immutable'][str(dest/'runtime-accounting.py')]==m.ACCOUNTING_SHA256
 runner=(dest/'remote-supervisor.py').read_bytes();assert m.ACCOUNTING_SHA256.encode() in runner
 assert b'ephemeral_files={H/\'serial/continue.json\':25165824}' in runner and b'ceiling=268435456' in runner
 compile(runner,str(dest/'remote-supervisor.py'),'exec')
 # Negative control: an incorrect exact helper pin must reject before staging it.
 (dest/'remote-supervisor.py').write_bytes((remote/'remote-supervisor.py').read_bytes());m.ACCOUNTING_SHA256='0'*64
 try:m.prepare(dest,immutable,str(dest/'secondary'))
 except AssertionError:rejected=True
 else:rejected=False
 assert rejected
 (O/'recipe-check.json').write_text(json.dumps(dict(status='PASS',recipeSHA256=hashlib.sha256(p.read_bytes()).hexdigest(),accountingSHA256=receipt['immutable'][str(dest/'runtime-accounting.py')],runnerSHA256=receipt['runnerSHA256'],wrongHelperPinRejected=rejected,cap=268435456,reserve=25165824,scope='synthetic local staging of recipe; full runtime immutable closure and independent acceptance not attempted',cleanup='TemporaryDirectory'),indent=2))
 print('PASS recipe exact helper pin and rejecting wrong-pin control; no execution of generated runner')
