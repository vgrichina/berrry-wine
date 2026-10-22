import hashlib,json,subprocess
from pathlib import Path
R=Path('/home/user/shadow-man-dsetup-canonical-qualification-oct22');E=R/'evidence'
manifest=json.loads((E/'build-inputs.json').read_text());pins={r['path']:r for r in manifest['inputs']}
census=json.loads((R/'tools/callback-ownership-census.json').read_text())
rows=[]
for path in ['lib/process-boot.js','lib/storage.js']:
    expected=[r for r in census['entries'] if r['file']==path and r['name']=='host-file']
    assert len(expected)==1
    rows.append(dict(path=path,reviewedEntry=expected[0],actualSHA256=hashlib.sha256((R/path).read_bytes()).hexdigest(),candidatePin=pins[path]))
v=dict(firstFailedCommand=['node','tools/callback-ownership-census.js'],buildScriptPin=pins['tools/build.sh'],censusCodePin=pins['tools/callback-ownership-census.js'],censusBaselinePin=pins['tools/callback-ownership-census.json'],mismatches=rows,buildScriptGateLines=[dict(line=i+1,text=s) for i,s in enumerate((R/'tools/build.sh').read_text().splitlines()) if i<40])
(E/'blocker-details.json').write_text(json.dumps(v,indent=2)+'\n')
print(json.dumps(v,indent=2))
