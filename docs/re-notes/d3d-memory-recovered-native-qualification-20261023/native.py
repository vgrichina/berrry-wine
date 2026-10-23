import guard,json,os,pathlib,hashlib
B=guard.B;r=B/'repo';j=json.loads((B/'source-inventory.json').read_text());node=j['tools']['node']['path']
name=__import__('sys').argv[1];assert name in ['compaction','ctx-arena-reuse']
test='test/test-d3d-software-'+name+'.js';artifact=B/(name+'.wasm')
env=os.environ.copy();env.pop('NODE_OPTIONS',None);env.pop('WINE_RENDER_ARTIFACT',None);env.pop('WINE_RENDER_ARTIFACT_PREPARE',None)
env['WINE_RENDER_ARTIFACT_PREPARE']=str(artifact)
out=guard.run([node,'--max-old-space-size=2048',test],phase='prepare',cwd=r,env=env)
assert 'PREPARATION ONLY' in out
assert artifact.stat().st_size<=8388608 and pathlib.Path(str(artifact)+'.json').stat().st_size<=131072
manifest=json.loads(pathlib.Path(str(artifact)+'.json').read_text())
guard.write(B/(name+'-prepared.json'),{'test':test,'artifact':str(artifact),'bytes':artifact.stat().st_size,'sha256':hashlib.sha256(artifact.read_bytes()).hexdigest(),'manifestSha256':hashlib.sha256(pathlib.Path(str(artifact)+'.json').read_bytes()).hexdigest(),'manifest':manifest,'sample':guard.sample()})
env.pop('WINE_RENDER_ARTIFACT_PREPARE');env['WINE_RENDER_ARTIFACT']=str(artifact)
out=guard.run([node,'--max-old-space-size=512',test],phase='native',cwd=r,env=env)
guard.write(B/(name+'-native.json'),{'verdict':'PASS','test':test,'output':out,'preparedReceipt':name+'-prepared.json','sample':guard.sample()})
print(name+': native PASS; exact module/manifest/phase receipts retained')
