from common import *
admission('pretests')
fixture='test/keyboard-focus-renderer-interoperability-oct26.test.cjs'
pins=json.loads((OPS/'sourcepins.json').read_text())
def checkpins():
 for pin in pins:
  file=OPS/'inputs'/pin['path'] if pin['revision']==BROWSER else REPO/pin['path']
  assert sha(file.read_bytes())==pin['sha256'],pin
checkpins()
checkpoint={'fixture':fixture,'fixtureSHA256':sha((REPO/fixture).read_bytes()),'pins':pins,'groups':[]}
for group,negative,count in [('cancellation',None,12),('ownership',None,6),('timeline',None,3),('focus-transfer',None,3),('legacy-contract',None,1),('negative-control','bridge-release',0),('negative-control','renderer-keyup',0)]:
 label=negative or group
 command=['node','--max-old-space-size=16',fixture]
 env=dict(ENV,BROWSER_INPUT_SOURCE=str(OPS/'inputs/lib/browser-input.js'),FOCUS_INTEROP_GROUP=group)
 if negative: env['FOCUS_INTEROP_NEGATIVE']=negative
 p=subprocess.run(command,cwd=REPO,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=20)
 assert len(p.stdout)<=131072 and len(p.stderr)<=131072,'output limit'
 (OPS/(label+'.log')).write_bytes(p.stdout);(OPS/(label+'.stderr')).write_bytes(p.stderr)
 summary=json.loads(p.stdout.decode().splitlines()[-1])
 expected=(p.returncode==1 and summary['pass']==0 and summary['fail']==1 and b'release must reach renderer delivery exactly once' in p.stdout) if negative else (p.returncode==0 and summary['pass']==count and summary['fail']==0)
 item={'label':label,'command':command,'environment':{k:v for k,v in env.items() if k in ['BROWSER_INPUT_SOURCE','FOCUS_INTEROP_GROUP','FOCUS_INTEROP_NEGATIVE']},'exit':p.returncode,'summary':summary,'expectedNegative':bool(negative),'accepted':expected,'logSHA256':sha(p.stdout),'stderrSHA256':sha(p.stderr),'fixtureSHA256':checkpoint['fixtureSHA256'],'sourcePinsVerified':True}
 checkpins();checkpoint['groups'].append(item);write(OPS/'checkpoint.json',checkpoint)
 print(label,'PASS' if expected else 'REJECT',p.returncode,summary)
 if not expected:
  print(p.stdout.decode()[:8192]);raise SystemExit(1)
