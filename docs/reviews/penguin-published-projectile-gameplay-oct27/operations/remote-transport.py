import pathlib,json,hashlib,importlib.util,sys
H=pathlib.Path(__file__).parent
p=H/'penguin_capture_contract.py';assert hashlib.sha256(p.read_bytes()).hexdigest()=='efcf3c5656a40800a4add90f1882d24830b8cb142626161dd3535d0027491c0b'
sp=importlib.util.spec_from_file_location('contract',p);c=importlib.util.module_from_spec(sp);sp.loader.exec_module(c)
used=int(sys.argv[1]);paths=[H/'captures'/n for n in ('b39999.png','b40060.png','b40100.png','b40295.png')]
plan=c.plan_provider_images(paths,used=used,tail_reserve=1048576,chunk_bytes=4096,envelope_overhead=1024,capture_budget=8388608)
t=H/'transport';t.mkdir(exist_ok=False)
for i,r in enumerate(plan['records']):(t/(str(i)+'.json')).write_bytes(c.wire(r)+b'\n')
meta={k:v for k,v in plan.items() if k not in ('records','canonical')}
meta.update(images=plan['canonical']['images'],recordCount=len(plan['records']),recordsSHA256=c.sha(c.wire(plan['records'])),helperSHA256=c.sha(p.read_bytes()))
(H/'actual-capture-plan.json').write_bytes(c.wire(meta))
print(json.dumps(meta,separators=(',',':')))
