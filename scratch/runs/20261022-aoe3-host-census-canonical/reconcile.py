import pathlib,subprocess,json,base64,hashlib,zlib
E=pathlib.Path(__file__).parent; R=E.parents[2]
lock=(R/'tools/callback-ownership-census.json').read_bytes()
code=r'''
import pathlib,subprocess,json,base64,hashlib,zlib,os
r=pathlib.Path('/home/user/aoe3-oleaut-repair-oct22');e=r/'evidence/host-census-canonical-20261022T1237Z';e.mkdir(exist_ok=True)
f=r/'tools/callback-ownership-census.json';old=f.read_bytes();new=zlib.decompress(base64.b64decode(LOCK))
a=json.loads(old);b=json.loads(new);diff=[]
for x,y in zip(a['entries'],b['entries']):
 if x!=y:diff.append({'before':x,'after':y})
assert len(a['entries'])==len(b['entries']) and len(diff)==1 and diff[0]['before']['file']=='lib/host-imports.js'
assert {k for k in diff[0]['before'] if diff[0]['before'][k]!=diff[0]['after'][k]}=={'sha256','reason'}
(e/'census-delta.json').write_text(json.dumps(diff,indent=2));(e/'census-before.json').write_bytes(old)
env=os.environ.copy();env['NODE_PATH']='/home/user/aoe3-original-oct22/runner/node_modules'
results=[]
def run(label,cmd):
 p=subprocess.run(cmd,cwd=r,env=env,capture_output=True,text=True,timeout=80);(e/(label+'.log')).write_text(p.stdout+p.stderr);row=dict(label=label,command=cmd,exit=p.returncode,stdout=p.stdout,stderr=p.stderr);results.append(row);return p
p=run('baseline-census',['node','tools/callback-ownership-census.js']);assert p.returncode==1 and p.stderr.strip()=='changed producer lib/host-imports.js:host-file (sha256); review its lifetime'
f.write_bytes(new)
p=run('corrected-census',['node','tools/callback-ownership-census.js']);assert p.returncode==0
host=r/'lib/host-imports.js';orig=host.read_bytes();needle=b"'OLEAUT32.DLL#8': 'VariantInit'";assert orig.count(needle)==1
try:
 host.write_bytes(orig.replace(needle,b"'OLEAUT32.DLL#8': 'VariantClear'"))
 p=run('changed-producer-control',['node','tools/callback-ownership-census.js']);assert p.returncode==1 and p.stderr.strip()=='changed producer lib/host-imports.js:host-file (sha256); review its lifetime'
finally:host.write_bytes(orig)
p=run('restored-census',['node','tools/callback-ownership-census.js']);assert p.returncode==0
p=run('existing-census-mutations',['node','test/test-callback-ownership-census.js']);assert p.returncode==0
assert host.read_bytes()==orig and f.read_bytes()==new
(e/'checks.json').write_text(json.dumps(results,indent=2));print(json.dumps({'results':results,'remoteEvidence':str(e),'censusSHA256':hashlib.sha256(new).hexdigest(),'restored':True}))
'''.replace('LOCK',repr(base64.b64encode(zlib.compress(lock)).decode()))
(E/'remote-reconcile.py').write_text(code)
p=subprocess.run(['boat','exec','--json','--timeout','200','bx_32262dnp','--','python3','-c',code],capture_output=True,text=True);(E/'reconcile-receipt.json').write_text(p.stdout);(E/'reconcile-stderr.txt').write_text(p.stderr);print(p.stdout,p.stderr)
