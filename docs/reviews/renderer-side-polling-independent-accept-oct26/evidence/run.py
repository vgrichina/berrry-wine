import subprocess,pathlib,json,hashlib,datetime
b=pathlib.Path('/tmp/renderer-side-polling-independent-accept-oct26');r=b/'repo';o=b/'ops'
checkpoint={'candidate':'54af699eee71ed0cebc95de71ffd9248e6814679','sourcepinsSha256':hashlib.sha256((o/'sourcepins.json').read_bytes()).hexdigest(),'groups':[],'remaining':['independent29','supplied37','side28','legacy','challenges25','preRepairChallenge'],'blockers':[]}
commands=[('independent29',['--test','test/renderer-modifier-independent-accept.test.cjs']),('supplied37',['--test','test/renderer-physical-modifiers.test.cjs']),('side28',['--test','test/renderer-side-modifier-polling.test.cjs']),('legacy',['../ops/run-legacy.cjs']),('challenges25',['--test','test/renderer-side-polling-independent-oct26.test.cjs']),('preRepairChallenge',['--require','../ops/candidate-loader.cjs','--test','test/renderer-side-polling-independent-oct26.test.cjs'])]
for name,args in commands:
 cmd=['timeout','25s','node','--max-old-space-size=16',*args]
 with (o/(name+'.log')).open('wb') as f:
  p=subprocess.run(cmd,cwd=r,stdout=f,stderr=subprocess.STDOUT,timeout=28)
 data=(o/(name+'.log')).read_bytes();assert len(data)<=131072
 group={'name':name,'command':cmd,'exitCode':p.returncode,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'evidence':name+'.log','at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 group['testSha256']=hashlib.sha256((r/args[-1]).read_bytes()).hexdigest() if args[-1].startswith('test/') else hashlib.sha256((o/'legacy-keyboard-message-lparam.cjs').read_bytes()).hexdigest()
 checkpoint['groups'].append(group);checkpoint['remaining'].remove(name)
 temp=o/'checkpoint.tmp';temp.write_text(json.dumps(checkpoint,indent=2)+'\n');temp.replace(o/'checkpoint.json')
 print(name,p.returncode,data.decode()[-250:],flush=True)
