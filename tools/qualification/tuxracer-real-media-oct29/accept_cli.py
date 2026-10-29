import json, sys, importlib.util
from pathlib import Path
import supervisor as s

s.resource.setrlimit(s.resource.RLIMIT_DATA,(128*s.M,s.resource.getrlimit(s.resource.RLIMIT_DATA)[1]))
d=json.loads((s.ROOT/'scratch/usage-watch/tuxracer-admitted-workdir-real-media-oct29-dispatch.json').read_text())
source=s.REPO/d['source']['path']
assert s.digest(source)==d['source']['sha256']
rc,out,err=s.run('real-media-cli',['/usr/bin/python3',str(source),'literal-sources',d['extracted'],d['inventory']['path']],cwd=s.REPO)
assert rc==0,err
api=json.loads((s.OWN/'api-output/closure.json').read_text())['literalSources']
assert json.loads(out)==api
s.save('api-cli-equivalence',dict(PASS=True,checked=len(api['checked']),unknown=len(api['unknown']),sourceSHA256=s.digest(source)))
fixture=s.OWN/'unknown-control'
fixture.mkdir()
(fixture/'init.tcl').write_text('source "$computed"\n')
(fixture/'inventory.json').write_text(json.dumps({'files':[{'path':'init.tcl'}]}))
rc,out,err=s.run('unknown-control',['/usr/bin/python3',str(source),'literal-sources',str(fixture),str(fixture/'inventory.json')],cwd=s.REPO)
assert rc==0,err
r=json.loads(out)
assert r['checked']==[] and len(r['unknown'])==1 and r['unknown'][0]['script']=='init.tcl'
s.save('unknown-control-result',dict(PASS=True,result=r,fixtureSHA256=s.digest(fixture/'init.tcl')))
print('CLI matches production API; computed source is UNKNOWN')
