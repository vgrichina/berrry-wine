from control import *
from objects import path,read,entries
import tarfile,io,re,base64,lzma
O=pathlib.Path('/tmp/gltron-original-main-render-runtime-oct30');D=pathlib.Path('/tmp/gltron-runner-closure-original-render-oct30')
assert git(['rev-parse','HEAD'],'prepare-parent').decode().strip()==BASE
pins=json.loads((O/'pinned-input-closure.json').read_text());runner=json.loads((D/'runner-closure-manifest.json').read_text())
def oid(commit,n):
 o=read(commit,'commit').splitlines()[0].split()[1].decode()
 for s in n.split('/'):mode,o=entries(o)[s.encode()]
 return o
compileNames=[n for n in pins['files'] if n.startswith(('src/','tools/','lib/'))]
changed=[n for n in compileNames if oid(BASE,n)!=oid(pins['candidate'],n)]
assert changed==['src/09a6-handlers-crt.wat'],changed
crt=path(BASE,changed[0])[1];assert pin(crt)==json.loads(pathlib.Path('/tmp/gltron-setbuf-production-repair-oct30/completion-receipt.json').read_text())['files'][changed[0]]
(R/'crt-delta.xz').write_bytes(lzma.compress(crt))
with tarfile.open(O/'pinned-source-closure.tar.xz') as t:
 src={n:t.extractfile(n).read() for n in pins['files'] if n.startswith('src/')}
 visited=set()
 def visit(n):
  assert n in src,n
  if n in visited:return
  visited.add(n)
  for v in re.findall(rb'\(include\s+"([^"]+)"',src[n]):visit(str(pathlib.PurePosixPath(n).parent/v.decode()))
 visit('src/main.watx');assert len(visited)==128,len(visited)
conf=json.loads((D/'evidence/launch-configuration.json').read_text());assert conf['trustedSSH']==SSH and len(conf['configuration']['files'])==92
# Exact unchanged canonical parser/check receipt is reused, before conditional execution.
assert conf['source']==runner['files']['test/run.js'] and conf['configuration']['parsed']==dict(app='gltron',mounts=[],trees=[],wasm='build/wine-assembly.wasm')
save('launch-configuration.json',dict(reusedExactReceipt=str(D/'evidence/launch-configuration.json'),receipt=pin((D/'evidence/launch-configuration.json').read_bytes()),trustedSSH=SSH,configuration=conf['configuration'],canonicalParserValidated=True,filenamesEnumerated=92,commaFilenames=[f['url'] for f in conf['configuration']['files'] if ',' in f['url']]))
save('source-boundary.json',dict(PASS=True,parent=BASE,retainedCandidate=pins['candidate'],compileFiles=len(compileNames),canonicalClosure=sorted(visited),onlyChanged=changed,crt=pin(crt),delta=pin((R/'crt-delta.xz').read_bytes()),runner=pin((D/'runner-closure-manifest.json').read_bytes()),allOtherParentBlobsIdentical=True))
# Reuse exact FSIZE12MiB/capture512KiB wrapper controls; source code remains byte-identical.
save('wrapper-reuse.json',dict(generatedControl=str(D/'evidence/generated-control.json'),overflowControl=str(D/'evidence/overflow-control.json'),FSIZE=12*M,capture=524288,runFunctionUnchanged=True))
recipe='''Source parent 16627061ccc5f151fbe568178471b3076f37cf42. Fork stopped bx_qbjcabve once, ttl1800, no-env. Independent all-path watchdog before first APIexec; actualcreatedAt +1200 cutoff/+1320 retrieve/+1380handback/+1500 snapshot and verifiedstop/+1800 expiry. Shutdown explicitly delegated. Supported API exec only. Tiny transfer/readback smoke first. Reuse /home/user/gltron-render, installed /usr/bin/node and compiler/media. Verify all retained pins.json files and old module SHA, all105 runner members,27 eager files,92 original files; source parent differs solely src/09a6-handlers-crt.wat. Transfer compressed exact CRT replacement, verify hash after decompress, use atomic new-inode replace ONLY this source. Every other compile input unchanged. Verify full recursive canonical128 source closure; no wat2wasm. Canonical compile /usr/bin/node --max-old-space-size=512 tools/build-compile-wat.js, no overrides, write both canonical module families, capture hashes and exact command/environment/time. Guest: /usr/bin/node --max-old-space-size=512 test/run.js --app=gltron --no-build --gl-renderer=software --wasm=build/wine-assembly.wasm --max-seconds=45 --max-batches=100000 --batch-size=10000 --png=capture/original.png. One original invocation after startup256/512 and exact parser/assets dependencies check. CPU60 wall90 groupRSS2GiB; FSIZE12MiB separately from capture512KiB; selected logs <=8192,JSON196608,PNG300000; API request/response16KiB/raw6000. No Node DATA/AS limit. No handler-suite repeat, audio disabling, synthetic UI, forced guest state, internal guest calls, CPU restoration edits or second fix. Next trap ends task. Retain original denials. Remote physical256MiB incl8MiBpublication; local64MiB physical union all inherited roots/directories/currentrollout and launcher +8work+8publication+3startup+1planned; RAMadmissionOFF; host floor latest owner1.5GiB after267292672futuregrowth. Compact evidence commit via isolated tree plumbing preserves parent entries, trustedSSH and exact remote ref verification. No shared-root edits, main integration, workers, Telegram or deployment. Coordinator appends messageboard-note.\n'''
(R/'recipe.txt').write_text(recipe)
print(json.dumps(admission('pre-provision-forecast')))
