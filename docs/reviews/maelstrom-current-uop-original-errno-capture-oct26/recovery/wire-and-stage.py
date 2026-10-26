from common import *
import tarfile
assert (O/'tail-retained.json').exists()
wire=(OLD/'ops/wire.cjs').read_text();wire=wire[:wire.index('// Cheap adapter control:')]+"console.log(JSON.stringify({runnerSHA256:sha(src),bytes:src.length}));\n"
(O/'wire.cjs').write_text(wire)
p=subprocess.run(['node','--max-old-space-size=512',str(O/'wire.cjs')],capture_output=True,text=True,timeout=30);assert not p.returncode,p.stderr;save('wired-runner.json',json.loads(p.stdout))
out=[]
for row in json.load(open(S/'manifest.json')):
 if row['target']=='runner/test/run.js' or row['target'].startswith('runner/tools/maelstrom-select-'):continue
 p=pathlib.Path(row['path'])
 if row['target']=='runtime/build/wine-assembly.wasm':p=O/'errno-latch.wasm'
 b=p.read_bytes();out.append(dict(target=row['target'],path=str(p),bytes=len(b),sha256=sha(b),standing=p!=O/'errno-latch.wasm'))
for n in ['maelstrom-native-errno-latch.cjs','maelstrom-original-errno-adapter.cjs','maelstrom-select-completion-hook.cjs']:
 p=R/'tools'/n;b=p.read_bytes();out.append(dict(target='runner/tools/'+n,path=str(p),bytes=len(b),sha256=sha(b)))
p=H/'runner/test/run.js';b=p.read_bytes();out.append(dict(target='runner/test/run.js',path=str(p),bytes=len(b),sha256=sha(b)))
save('../manifest.json',out)
(H/'validate-tree.cjs').write_bytes((OLD/'validate-tree.cjs').read_bytes())
# Archive standing assets without materializing a second local asset tree.
projected=sum(((x['bytes']+4095)//4096)*4096 for x in out)+2*1048576
save('asset-projection.json',dict(files=len(out),fileBytes=sum(x['bytes'] for x in out),remoteProjection=projected,noLocalAssetCopies=True,noTransferArchive=True))
account('pre-assets-transfer',remoteProjection=projected)
receipts=[]
for row in out:
 # Reuse the retained exact remote tail without a duplicate remote copy.
 if row['target']=='runtime/build/wine-assembly.wasm':
  j=py('import pathlib;h=pathlib.Path('+repr(str(H))+');p=h/"runtime/build/wine-assembly.wasm";p.parent.mkdir(parents=True,exist_ok=True);(h/"ops/errno-latch.wasm").rename(p);print("exact tail moved")');receipts.append(dict(target=row['target'],movedVerifiedTail=True));continue
 receipts.append(put(pathlib.Path(row['path']),H/row['target']));save('assets-transfer.json',receipts)
for p in [H/'guest-args.json',H/'manifest.json',H/'validate-tree.cjs']:receipts.append(put(p,p))
save('assets-transfer.json',receipts)
j=py('import pathlib,json,hashlib;h=pathlib.Path('+repr(str(H))+');m=json.load(open(h/"manifest.json"));bad=[x["target"] for x in m if len((h/x["target"]).read_bytes())!=x["bytes"] or hashlib.sha256((h/x["target"]).read_bytes()).hexdigest()!=x["sha256"]];a=lambda p:max(p.lstat().st_size,p.lstat().st_blocks*512);print(json.dumps(dict(files=len(m),bad=bad,allocated=sum(a(p) for p in [h,*h.rglob("*")]))));assert not bad');save('remote-assets-readback.json',j)
j=remote('cd '+shlex.quote(str(H))+' && node --max-old-space-size=512 validate-tree.cjs');save('mount-actual-api.json',j)
account('assets-staged',json.loads(json.load(open(O/'remote-assets-readback.json'))['stdout'])['allocated'],projected)
print(json.dumps(dict(ready=True,files=len(out),actualMountVerified=True)))
