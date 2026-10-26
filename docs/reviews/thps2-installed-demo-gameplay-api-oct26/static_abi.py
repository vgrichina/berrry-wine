from common import *
import re
manifest=json.load(open(O/'manifest.json'));m=next(e for e in manifest if e['target']=='runtime/build/wine-assembly.wasm')
b=pathlib.Path(m['path']).read_bytes();assert hashlib.sha256(b).hexdigest()==m['sha256'];assert b[:8]==b'\0asm\1\0\0\0'
def leb(i):
 n=0;s=0
 while True:
  v=b[i];i+=1;n|=(v&127)<<s;s+=7
  if not v&128:return n,i
i=8;custom={}
while i<len(b):
 sid=b[i];i+=1;n,i=leb(i);end=i+n
 if sid==0:
  length,j=leb(i);name=b[j:j+length].decode();custom[name]=b[j+length:end].decode(errors='replace')
 i=end
e=next(e for e in manifest if e['historicalPath']=='lib/region-map.generated.js')
s=git('show',e['revision']+':'+e['historicalPath'],cwd=pathlib.Path(e['donor'])).decode();h=re.search(r'LAYOUT_HASH[\s:="\']+([0-9a-f]{16})',s)
assert h,(s[:200]);matches=[(k,v) for k,v in custom.items() if 'region' in k or 'layout' in k]
assert any(v==h[1] for _,v in matches),(matches,h[1])
save('static-abi.json',dict(passGate=True,moduleSHA256=m['sha256'],historicalRevision=e['revision'],mirrorSHA256=e['sha256'],mirrorLayout=h[1],customLayoutSections=matches,runnerSHA256=next(e['sha256'] for e in manifest if e.get('historicalPath')=='test/run.js'),currentRootRunnerUsed=False,wasmRebuilt=False))
print('PASS exact historical module/mirror custom-section layout')
