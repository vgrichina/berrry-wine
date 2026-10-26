from work import *
save('compile-result-api.json',py('import pathlib,json,hashlib,shutil;h=pathlib.Path('+repr(R)+');t=json.loads((h/"compile/terminal.json").read_text());assert t["returncode"]==0 and not t["remainingOwnedLive"];print(json.dumps(dict(terminal=t,moduleSHA256=hashlib.file_digest((h/"current.wasm").open("rb"),"sha256").hexdigest(),moduleBytes=(h/"current.wasm").stat().st_size)));shutil.rmtree(h/"runner/src")'))
m=json.loads((O/'runtime-manifest.json').read_text());s=json.loads((O/'runtime-source.json').read_text());standing={x['path'] for x in s};items=[]
for x in m:
 if x['path'] in standing:continue
 p=pathlib.Path('/tmp/wa-local-runtime-deps')/x['path'] if x['path'].startswith('node_modules/') else ROOT/x['path']
 assert p.stat().st_size==x['bytes'] and hashlib.file_digest(p.open('rb'),'sha256').hexdigest()==x['sha256']
 items.append(('runner/'+x['path'],p))
transfer(items);transfer([('runtime-manifest.json',O/'runtime-manifest.json')]);print('ASSETS STAGED',flush=True)
save('remote-assets-verified.json',py('import pathlib,json,hashlib;h=pathlib.Path('+repr(R)+');m=json.loads((h/"runtime-manifest.json").read_text())\nfor x in m:\n p=h/"runner"/x["path"];assert p.stat().st_size==x["bytes"] and hashlib.file_digest(p.open("rb"),"sha256").hexdigest()==x["sha256"] and p.stat().st_mode&511==x["mode"],x["path"]\nprint(json.dumps(dict(files=len(m),verified=True,allocated=sum(p.stat().st_blocks*512 for p in h.rglob("*") if p.is_file()))))'))
