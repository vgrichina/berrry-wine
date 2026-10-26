import pathlib,json,hashlib,subprocess,shutil
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';S=pathlib.Path('/tmp/maelstrom-frozen-original-recovered-capture-oct25')
sha=lambda b:hashlib.sha256(b).hexdigest()
m=json.load(open(S/'manifest.json'));out=[]
for x in m:
 if x['target']=='runner/test/run.js' or x['target'].startswith('runner/tools/maelstrom-select-'):continue
 p=pathlib.Path(x['path']); target=x['target']
 if target=='runtime/build/wine-assembly.wasm':p=pathlib.Path('/tmp/maelstrom-diagnostic-changed-module-native-oct26/ops/errno-latch.wasm')
 b=p.read_bytes();out.append(dict(target=target,path=str(p),bytes=len(b),sha256=sha(b),standing=True))
for n in ['maelstrom-native-errno-latch.cjs','maelstrom-original-errno-adapter.cjs','maelstrom-select-completion-hook.cjs']:
 p=H/'repo/tools'/n;b=p.read_bytes();out.append(dict(target='runner/tools/'+n,path=str(p),bytes=len(b),sha256=sha(b)))
p=H/'runner/test/run.js';b=p.read_bytes();out.append(dict(target='runner/test/run.js',path=str(p),bytes=len(b),sha256=sha(b)))
args=json.load(open(S/'guest-args.json'));args=[a.replace(str(S),str(H)) for a in args if not a.startswith('--maelstrom-select-frozen-record=')];args.append('--original-native-record='+str(H/'guest/native.jsonl'));(H/'guest-args.json').write_text(json.dumps(args,indent=2)+'\n')
(H/'manifest.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(dict(files=len(out),remoteBytes=sum(x['bytes'] for x in out),localDuplicates=False)))
