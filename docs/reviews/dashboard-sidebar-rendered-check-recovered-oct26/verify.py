from control import *
prior=json.loads((D.parent/'final-receipt.json').read_text())
assert sha(D/'docs/reviews/dashboard-sidebar-private-browser-activation-oct26/evidence-manifest.json')==prior['evidenceManifestSHA256']=='2c6ce4fd51054800ad93092f839553c2d73da7221e209858004152cc040015d5'
assert prior['commit']==BASE
before=service();old=json.loads((D.parent/'service-final.json').read_text());assert (before['pid'],before['startTicks'])==(old['pid'],old['startTicks'])
save('service-before.json',before)
listeners=[x.split() for x in pathlib.Path('/proc/net/tcp').read_text().splitlines()[1:] if x.split()[1].endswith(':1FA2') and x.split()[3]=='0A']
assert len(listeners)==1 and listeners[0][1]=='0100007F:1FA2'
assert 'socket:['+listeners[0][9]+']' in [os.readlink(x) for x in pathlib.Path('/proc/'+str(before['pid'])+'/fd').iterdir()]
save('loopback-listener.json',dict(localAddress=listeners[0][1],pid=before['pid']))
served={}
for f,h in [('app.js',APP),('blocker-model.js','1d3ebcd5e31e1eb2e91eb78e9996da2ae8f12840d1a2c30a11fe61c307fe3f7b'),('readers.js','079da22e440c6a3eb6efb28a994b222fe827290ccfb0874ae48f1802ef08c78c')]:
 if f=='readers.js':
  assert sha(L/f)==h;served[f]=dict(sha256=h,localServerModule=True,httpFetch=False);continue
 info,b=get('/'+f);assert info['status']==200 and info['sha256']==h and info['cacheControl']=='no-store' and sha(L/f)==h;served[f]=info
save('served-before.json',served)
gate('before-browser',browser=True)
try:
 run('real-browser',[NODE,'--max-old-space-size=192',str(P/'browser.cjs')],wall=60,browser=True)
finally:
 after=service();save('service-after.json',after)
 assert (before['pid'],before['startTicks'])==(after['pid'],after['startTicks'])
r=json.loads((P/'browser-result.json').read_text());assert r['pass']
save('checkpoint.json',dict(candidate='7681b752d7c3fe565a49e92832c3d9825bec7ed9',activationEvidenceCommit=BASE,sourceHashes={k:v['sha256'] for k,v in served.items()},recipeSHA256=sha(P/'browser.cjs'),fixture='one fresh actual private API state snapshot; no synthetic fixture',fixturePrivateHashRetainedOnlyLocally=True,browserResultSHA256=sha(P/'browser-result.json'),completed=['real rendered sidebar independent distinct-ID count with duplicate and anonymous row accounting','detail aggregate and row classification semantics','overview raw row stats','overview/blockers route return','served HTML/API/app cache no-store','service PID/start identity unchanged'],results=dict(passResult=r['pass'],counts=r['counts']),reused='All completed source/independent/merged acceptance and 1358 unchanged deployed file verification; not replayed',remaining=['sanitize evidence','task branch publication and exact remote verify'],evidence=['browser-result.json','real-browser.json','served-before.json','service-before.json','service-after.json']))
print(json.dumps(dict(passResult=r['pass'],counts=r['counts'],browserSeconds=r['elapsedSeconds'],serviceUnchanged=True,resource=json.loads((P/'resources-before-browser.json').read_text())['MemAvailable'])))
