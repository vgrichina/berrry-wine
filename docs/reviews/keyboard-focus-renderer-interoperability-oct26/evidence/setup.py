from common import *
admission('precheckout')
write(OPS/'configuration.json',{'sshCommand':SSH,'mountArgv':[],'intendedMountedFiles':[],'mountValidation':'N/A: no mount argv or guest execution; local Node and Git only. No conditional mount execution authorized.','rootRefInitial':str(HOST/'scratch/usage-watch/keyboard-focus-renderer-interoperability-oct26/root-ref-digest.json')})
watch=open(OPS/'messageboard-watch.log','ab',buffering=0)
w=subprocess.Popen(['tail','-n','0','-f',str(HOST/'messageboard.txt')],stdout=watch,stderr=watch,start_new_session=True)
(OPS/'watcher.pid').write_text(str(w.pid)+'\n')
with open(HOST/'messageboard.txt','a') as f: f.write(time.strftime('%Y-%m-%dT%H:%M:%SZ')+' keyboard-focus-renderer-interoperability-oct26 CLAIM only new cross-layer fixture test/keyboard-focus-renderer-interoperability-oct26.test.cjs and own docs/ops isolated branch; renderer0d2aaf browser2b5eaa readonly. No workers/main/production edits/runtime. Watcher '+str(w.pid)+'\n')
print(run(['tail','-n','1',str(HOST/'messageboard.txt')]).stdout.decode())
run(['git','init','-q',str(REPO)])
stores=[]
def collect(p):
 p=p.resolve()
 if p in stores: return
 stores.append(p)
 a=p/'info/alternates'
 if a.exists():
  for s in a.read_text().splitlines(): collect(pathlib.Path(s) if s.startswith('/') else p/s)
for d in [RD,BD]: collect(d/'.git/objects')
(REPO/'.git/objects/info/alternates').write_text(''.join(str(p)+'\n' for p in stores))
write(OPS/'borrowed-object-stores.json',[str(p) for p in stores])
git('config','user.name','Wine Assembly Agent');git('config','user.email','agent@wine-assembly.local')
git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
git('config','core.sparseCheckout','true')
files=['lib/renderer-input.js','lib/mem-utils.js','lib/region-map.generated.js']
(REPO/'.git/info/sparse-checkout').write_text(''.join('/'+p+'\n' for p in files))
git('read-tree','-m','-u',RENDER)
git('symbolic-ref','HEAD','refs/heads/'+BRANCH);git('update-ref','refs/heads/'+BRANCH,RENDER)
pins=[]
for donor,rev,paths in [(RD,RENDER,files),(BD,BROWSER,['lib/browser-input.js'])]:
 for name in paths:
  b=git('show',rev+':'+name,repo=donor)
  assert b==(donor/name).read_bytes(),name
  pins.append({'revision':rev,'path':name,'donor':str(donor),'blob':git('rev-parse',rev+':'+name,repo=donor).decode().strip(),'bytes':len(b),'sha256':sha(b)})
  if name=='lib/browser-input.js':
   # Separate immutable dependency; never alter production tree/index to combine inputs.
   p=OPS/'inputs'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
write(OPS/'sourcepins.json',pins)
for label,donor in [('renderer',RD),('browser',BD)]:
 b=(donor.parent/'ops/result.json').read_bytes();(OPS/(label+'-accepted-result.json')).write_bytes(b)
write(OPS/'reuse.json',{'renderer':{'revision':RENDER,'groups':[29,37,28,25,'legacy'],'strictAggregateKnownFailure':3},'browser':{'revision':BROWSER,'suppliedPass':19},'rerun':False,'independentBrowserAcceptance':'separate worker owns; no duplicate groups'})
print('setup complete',len(stores),'flat readonly object stores',len(pins),'source pins')
