from common import *
p=H/'remote.py';t=p.read_text().replace("'--tick-ms-per-batch=1'","'--tick-ms-per-batch=2','--stuck-after=0','--no-close'")
t=t.replace("print(json.dumps(q))","print(json.dumps({k:v for k,v in q.items() if k!='owned'}))")
p.write_text(t)
p=H/'remote-startup.cjs';t=p.read_text();t=t.replace("console.log('module imports '+WebAssembly.Module.imports(mod).length)","const sig=JSON.parse(fs.readFileSync(root+'/lib/host-import-sigs.generated.json'));const im=WebAssembly.Module.imports(mod);for(const i of im)if(i.module==='host'&&i.kind==='function')assert(sig[i.name],i.name);console.log(JSON.stringify({moduleSHA256:crypto.createHash('sha256').update(wasm).digest('hex'),moduleBytes:wasm.length,imports:im,signaturesSHA256:crypto.createHash('sha256').update(fs.readFileSync(root+'/lib/host-import-sigs.generated.json')).digest('hex')}))")
p.write_text(t)
# Refresh pins only for these task-owned controls, before transfer; source/game pins unchanged.
rs=json.loads((H/'stage-manifest.json').read_text())
for x in rs:
 if x['target'] in ('ops/remote.py','ops/remote-startup.cjs'):
  b=pathlib.Path(x['source']).read_bytes();x.update(bytes=len(b),sha256=sha(b))
save('stage-manifest.json',rs);p=H/'stage-manifest.json';rs.append(dict(source=str(p),target='ops/stage-manifest.json',bytes=p.stat().st_size,sha256=sha(p.read_bytes())));save('transfer-manifest.json',rs)
print('owned configuration pinned; canonical source unchanged; tick2 ordinary input; no-close; signatures validated against compiled imports')
