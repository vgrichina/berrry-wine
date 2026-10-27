from common import *
old=pathlib.Path('/tmp/generally-ordinary-driving-gameplay-oct27/ops')
text=(old/'remote-v3.py').read_text()
text=text.replace('/tmp/generally-driving',REMOTE).replace('4a2bec145ef34b0d084b96b09a682a16e89703fd',PIN).replace('1793100240','1793106480').replace('11:24UTC','13:08UTC')
text=text.replace("rows=json.loads((R/'source-inputs.json').read_text())['files']+json.loads((H/'extras-map.json').read_text())","rows=json.loads((H/'stage-manifest.json').read_text())")
text=text.replace("str(H/'remote-startup-v2.cjs')","str(H/'remote-startup.cjs')")
text=text.replace("out.touch();err.touch()","out.touch(exist_ok=False);err.touch(exist_ok=False)")
text=text.replace("if time.time()>=1793106480:return", "if time.time()>=1793106480:return")
# Successful module preserved; compile attempt count remains one even on failure.
(H/'remote.py').write_text(text)
startup=(old/'remote-startup-v2.cjs').read_text().replace('/tmp/generally-driving',REMOTE)
startup=startup.replace("for(const f of ['src/api_table.json','lib/host-import-sigs.generated.json','lib/worker-imports.js','lib/guest-worker.js','lib/render-worker.js','test/run.js'])", "for(const f of ['src/api_table.json','lib/worker-imports.js','lib/guest-worker.js','lib/render-worker.js','test/run.js'])")
(H/'remote-startup.cjs').write_text(startup)
rows=json.loads((H/'stage-manifest.json').read_text())
sup=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
for p,target in [(sup,'ops/supervisor-original.py'),(H/'remote.py','ops/remote.py'),(H/'remote-startup.cjs','ops/remote-startup.cjs')]:
 b=p.read_bytes();rows.append(dict(source=str(p),target=target,bytes=len(b),sha256=sha(b)))
save('stage-manifest.json',rows)
p=H/'stage-manifest.json';rows.append(dict(source=str(p),target='ops/stage-manifest.json',bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
# Self-manifest stored separately; immutable file list covers all runtime inputs.
save('transfer-manifest.json',rows)
print('stage groups',(len(rows)+39)//40,'files',len(rows))
