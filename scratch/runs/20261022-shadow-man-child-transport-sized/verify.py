import pathlib,json,hashlib,copy
E=pathlib.Path(__file__).resolve().parent
def validate(a,manifest):
 assert a['attempts']==1 and a['childProcesses']==0 and a['retries']==0
 assert a['runtimeWinExecReturn'] is None and a['sourceDerivedReturn']==33
 assert a['childLoad'] is None and a['childExit'] is None
 assert a['preserved'] and a['originalSeals']==390 and a['previousSeals']==120
 assert a['exit']['elapsedSeconds']<60 and not a['cleanup']['guestProcesses'] and all(a['cleanup']['portsClosed'].values())
 for r in manifest:
  p=E/'raw'/r['path'];assert p.stat().st_size==r['size'] and hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256'],r['path']
 p=json.loads((E/'raw/preflight.json').read_text())
 pins={r['path']:r['sha256'] for r in p['seals']}
 assert pins['/home/user/shadow-man-original-oct22/runtime/build/wine-assembly.wasm']=='f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
 for f in ['test/run.js','lib/host-imports.js']:
  assert hashlib.sha256((E/'raw'/('source-'+f.replace('/','_'))).read_bytes()).hexdigest()==pins['/home/user/shadow-man-original-oct22/runtime/'+f]
 assert json.loads((E/'raw/transport-blocker-check.json').read_text())['exitCode']==0
 return True
if __name__=='__main__':
 a=json.loads((E/'raw/analysis.json').read_text());m=json.loads((E/'raw/manifest.json').read_text());validate(a,m)
 for kind in ['false-child','bad-hash']:
  aa=copy.deepcopy(a);mm=copy.deepcopy(m)
  if kind=='false-child':aa['childProcesses']=1
  else:mm[0]['sha256']='0'*64
  try:validate(aa,mm)
  except AssertionError:continue
  raise AssertionError('negative control accepted: '+kind)
 print('PASS: manifest, sealed actual runner/host/module identity, one attempt/no child, preservation/cleanup, two rejecting controls')
