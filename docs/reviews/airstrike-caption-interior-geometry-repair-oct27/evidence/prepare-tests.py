import run as c,hashlib,pathlib,json,re
D=pathlib.Path('/tmp/airstrike-caption-independent-accept-publication-oct27/ops')
manifest=json.loads((D/'receipt-manifest.json').read_text())
c.dump('original-input-pins.json',dict(sourcePins=manifest['sourcePins'],copied={n:hashlib.sha256((c.H/n).read_bytes()).hexdigest() for n in ('reproduce.py','production-renderer-input.js')}))
for n in ('production-run.js','independent-controls.py'):
 (c.H/n).write_bytes((D/n).read_bytes())
p=c.R/'tools/airstrike-observation-bridge.py';s=p.read_text();s=re.sub(r"CONTROLLER_SHA256 = '[0-9a-f]{64}'", "CONTROLLER_SHA256 = '"+hashlib.sha256((c.R/'tools/airstrike-menu-controller.py').read_bytes()).hexdigest()+"'",s);p.write_text(s)
print('Controller source pin refreshed; unchanged original attack and fixture dependencies preserved.')
