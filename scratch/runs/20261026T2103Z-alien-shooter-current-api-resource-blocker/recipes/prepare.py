from work import *
save('sqlite-baseline.json',{str(p):allocated(p) for p in pathlib.Path('/home/user/.codex').glob('*sqlite*')})
s=json.loads((ROOT/'scratch/usage-watch/civ2-win16-pinned-inputs-oct26.json').read_text());f=json.loads((ROOT/'scratch/usage-watch/alien-shooter-current-gameplay-api-oct26-inputs.json').read_text());S=pathlib.Path(s['source'])
def check(p,x):
 assert p.stat().st_size==x['bytes'] and hashlib.file_digest(p.open('rb'),'sha256').hexdigest()==x['sha256'],str(p)
for x in s['files']:check(S/x['path'],x)
for x in f['files']:check(ROOT/x['path'],x)
mf=ROOT/'test/binaries/candidates/reflexive-alien-shooter/.wine-assembly-browser.json';assert sha(mf.read_bytes())==f['manifestSHA256']
save('input-verification.json',dict(source=s['revision'],sourceFiles=len(s['files']),fixtureFiles=len(f['files']),allVerified=True,manifestSHA256=f['manifestSHA256']))
(O/'source-pins.json.gz').write_bytes(gzip.compress(json.dumps(s['files']).encode(),mtime=0));(O/'fixture-pins.json.gz').write_bytes(gzip.compress(json.dumps(f['files']).encode(),mtime=0))
runtime=[x for x in s['files'] if not x['path'].startswith('src/')]
save('runtime-source.json',runtime)
nodecode="const f=require("+json.dumps(str(S/'lib/font-substitutions.js'))+"),s=require("+json.dumps(str(ROOT/'fonts/substitutions.json'))+");console.log(JSON.stringify([...f.BUNDLED_BITMAP_FONTS,...f.fontMounts(s,{subset:true}).map(x=>x.file)]))"
p=subprocess.run(['node','--max-old-space-size=32','-e',nodecode],capture_output=True,text=True,timeout=20);assert p.returncode==0,p.stderr
extras=['fonts/'+x for x in sorted(set(json.loads(p.stdout)))]+['fonts/substitutions.json']
# Exact production system data is unconditional, and retained without substitutions.
text=(S/'lib/process-boot.js').read_text();import re
print(text[text.index('const SYSTEM_DATA_FILES'):text.index('const SYSTEM_DATA_FILES')+700],flush=True)
save('extras.json',extras)
print('VERIFIED',len(s['files']),len(f['files']),flush=True)
