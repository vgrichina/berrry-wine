import guard,json,pathlib,shutil,os
B=guard.B;r=B/'repo';d='/tmp/d3d-render-cache-independent-closeout-oct23/repo'
j=json.loads((B/'source-inventory.json').read_text());assert json.loads((B/'admission.json').read_text())['verdict']=='PASS'
def git(*a):return guard.run(['git','-C',str(r),*a],phase='python')
guard.run(['git','clone','--shared','--no-checkout',d,str(r)],phase='python')
git('config','core.sparseCheckout','true');git('config','core.sparseCheckoutCone','false')
(r/'.git/info/sparse-checkout').write_text(''.join('/'+x['path']+'\n' for x in j['closure']))
branch='task/d3d-scoped-native-qualification-oct23'
git('update-ref','refs/heads/'+branch,j['base']);git('symbolic-ref','HEAD','refs/heads/'+branch)
git('read-tree','-mu','HEAD')
for x in j['closure']:
 p=r/x['path']
 if x['revision']!=j['base']:
  # The sole accepted fixture delta; no production bytes change.
  assert x['path']=='test/test-d3d-software-compaction.js'
  import subprocess
  p.write_bytes(subprocess.check_output(['git','-C',d,'show',x['revision']+':'+x['path']],timeout=30))
 assert p.stat().st_size==x['bytes'] and guard.hashlib.sha256(p.read_bytes()).hexdigest()==x['sha256'],x['path']
for x in j['codec']['files']:
 p=pathlib.Path(x['path']);dest=r/'node_modules/pngjs'/p.relative_to(pathlib.Path(j['codec']['root'])/'node_modules/pngjs');dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
git('config','user.name','Wine Ops');git('config','user.email','wine-ops@users.noreply.github.com')
url=guard.run(['git','-C',d,'remote','get-url','origin'],phase='python').strip();git('remote','set-url','origin',url)
guard.write(B/'checkout.json',{'base':j['base'],'branch':branch,'files':len(j['closure']),'verifiedAll':True,'fixtureDiff':git('diff','--','test/test-d3d-software-compaction.js'),'productionDiff':git('diff','--','src','lib'),'sample':guard.sample()})
node=j['tools']['node']['path']
guard.run([node,'--max-old-space-size=256','tools/check-wat-manifest.js'],cwd=r)
guard.run([node,'--max-old-space-size=256','tools/check-wat-fragments.js',*[x['path'] for x in j['closure'] if x['path'].startswith('src/') and x['path'].endswith('.wat')]],cwd=r)
guard.run([node,'--max-old-space-size=256','tools/check-watx-provenance.js'],cwd=r)
print('CHECKOUT_AND_SELECTED_SOURCE_COMPILER_GATES_PASS')
