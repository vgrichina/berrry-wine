import sys,hashlib,io,json,pathlib
sys.path.insert(0,'/home/user/wine-assembly-shadow-man-settings-observer-repair-runtime-oct23/scratch/runs/20261023-shadow-man-settings-observer-repair-runtime')
from transport import *
for n in ['settings-observer-repaired.cjs','settings-observer-fixture.cjs']:
 p=E/n
 with p.open('rb') as f:save(n+'-upload.json',upload_stream(f,p.stat().st_size,ROOT+'/fixed/'+n))
code='''import pathlib,subprocess,json,os
R=pathlib.Path(ROOT_PATH);F=R/'fixed'
p=subprocess.run(['node',str(F/'settings-observer-fixture.cjs')],env=dict(PATH='/bin:/usr/bin',SHADOW_ROOT=str(R),NODE_PATH=str(R/'immutable/runtime/node_modules')),capture_output=True,text=True,timeout=10)
r=dict(exit=p.returncode,stdout=p.stdout,stderr=p.stderr);(F/'settings-capture-repaired-fixture-v4.json').write_text(json.dumps(r,indent=2));print(json.dumps(r));assert p.returncode==0
'''
r=run('ROOT_PATH='+repr(ROOT)+'\n'+code,'settings-capture-repaired-fixture-v4-api.json',20);print(r['stdout'])
