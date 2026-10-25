from control import *
admission('tests')
tree=json.loads((OUT/'merged-tree.json').read_text())['tree']
results={}
commands=[('original-six',['node','--test','test/test-d3d9-immutable-rgba-snapshot.js'],6),('unchanged-reviewer',['node','--test','test/test-d3d9-rgba-generation-independent.js'],2),('extended',['node','--test','test/test-d3d9-rgba-source-identity.js'],6),('independent',['node','--test','test/test-d3d9-byte-identity-acceptance.js'],2),('legacy-js',['node','test/test-d3d9-texture-snapshot-cache.js','--js-only'],None),('syntax',['node','--check','lib/d3d9-host.js'],None),('overlay-existing',['node','test/test-vfs-overlay.js'],20)]
for name,argv,count in commands:
 rc,a,b=run(argv,cwd=R,env=E,label=name);assert rc==0,(name,(a+b)[:2000])
 output=(a+b).decode()
 if count and name!='overlay-existing':assert ('# pass '+str(count)+'\n') in output or ('\u2139 pass '+str(count)+'\n') in output,output
 if name=='overlay-existing':assert output.count('PASS  ')==20 and 'All 20 overlay cases pass' in output
 results[name]=dict(argv=argv,exitCode=rc,expectedPass=count,outputSHA256=hashlib.sha256(a+b).hexdigest())
 print(name,'PASS')
host=R/'lib/d3d9-host.js';source=host.read_bytes()
previous=git('show','9f3fcdc221ec48b64293f212500cbeadfd7f21fc:lib/d3d9-host.js')
for name,data in [('predecessor-control',previous),('alias-control',source.replace(b'entry.source = source.slice();',b'entry.source = source;'))]:
 assert data!=source
 try:
  host.write_bytes(data);rc,a,b=run(['node','--test','test/test-d3d9-byte-identity-acceptance.js'],cwd=R,env=E,label=name);assert rc==1,(name,rc)
  results[name]=dict(exitCode=rc,requiredExit=1,outputSHA256=hashlib.sha256(a+b).hexdigest())
 finally:host.write_bytes(source)
identities();assert git('diff','--name-only').strip()==b''
assert git('write-tree').decode().strip()==tree
save('tests',dict(tree=tree,results=results,allPass=True))
print('Exact merged tree fixtures and rejecting controls PASS')
