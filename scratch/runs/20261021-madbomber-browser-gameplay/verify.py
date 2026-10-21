import hashlib,json,pathlib,subprocess,datetime
p=pathlib.Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda n:json.loads((p/n).read_text())
seals=read('SHA256SUMS.json')
for f in seals:
    b=(p/f['path']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'],f['path']
base='0c0fa3ebd7a84b6254a160c6cdfa6774c556d4cb'
manifest=read('source-manifest.json');assert manifest['revision']==base
tree={}
for line in subprocess.check_output(['git','ls-tree','--full-tree','-rl',base],cwd=p).decode().splitlines():
    m,n=line.split('\t');mode,kind,oid,size=m.split()
    if kind=='blob':tree[n]=(oid,int(size))
for f in manifest['files']:assert tree[f['path']]==(f['oid'],f['size']),f['path']
old={f['path']:f for f in read('provenance/build-source-manifest.json')['files']}
changed=[]
for f in manifest['files']:
    if f['path'].startswith('docs/') or f['path'] in ['TODOS.md','ops/STATUS.md']:continue
    if old.get(f['path'],{}).get('oid')!=f['oid']:changed.append(f['path'])
assert set(changed)=={'tools/army-bltfast-observer.js','tools/army-bltfast-preload.test.js'},changed
prior={f['path']:f for f in read('prior-seals.json')}
for n in ['build.log','build.exit','build-source-manifest.json']:
    assert sha((p/'provenance'/n).read_bytes())==prior['provenance/'+n]['sha256']
assert (p/'provenance/build.exit').read_text().strip()=='0'
module='728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c'
assert len(read('preflight.json')['closure'])==168
for when in ['before','after']:
    r=read('evidence/'+when+'.json');assert r['revision']==base and r['sourceVerified']==len(manifest['files'])==6908
    assert r['assetsVerified']==168 and r['moduleSha256']==module and r['moduleBytes']==1878508 and r['dependencyFiles']==2407
post=read('evidence/postflight.json');assert post['port8080Absent'] and len(post['ownedPidsAbsent'])==6
assert sha((p/'evidence/dependencies.json').read_bytes())==post['dependenciesUnchanged']
screens=0;actions=0
for d,pid in [('browser',26554),('browser2',28600)]:
    q='evidence/'+d+'/'
    r=read(q+'identity.json');assert r['revision']==base and r['route']=='http://127.0.0.1:8080/index.html?app=madbomber&debug'
    assert read(q+'errors.json')==[]
    response=read(q+'module-responses.json');assert len(response)==1 and response[0]['sha256']==module and response[0]['bytes']==1878508
    terminal=read('process-'+str(pid)+'.json');assert terminal['exitCode']==0 and not terminal['running']
    end=read(q+'cleanup.json');start=read(q+'window-start.json');assert end['reason']=='60-second gameplay window completed' and start['limitMs']==60000
    duration=(datetime.datetime.fromisoformat(end['at'].replace('Z','+00:00'))-datetime.datetime.fromisoformat(start['at'].replace('Z','+00:00'))).total_seconds()
    assert 60<=duration<62,duration
    inputs=read(q+'inputs.json');assert sum(a.get('key')=='Enter' for a in inputs)==1 and sum(a.get('key')=='Space' for a in inputs)==1
    assert all(a.get('action') in [None,'click'] and a.get('key') in [None,'Enter','Space'] for a in inputs)
    actions+=len(inputs)
    for f in (p/'evidence'/d).glob('*.png'):
        assert f.read_bytes().startswith(b'\x89PNG\r\n\x1a\n');screens+=1
assert screens==14
print(json.dumps({'pass':True,'seals':len(seals),'sourceFiles':6908,'assetPins':168,'dependencyFiles':2407,'browserSessions':2,'screenshots':screens,'timestampedActionsAndSnapshots':actions,'moduleSha256':module,'visualVerdict':'manual review; report and screenshots establish catch/score'}))
