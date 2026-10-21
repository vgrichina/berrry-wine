import pathlib,json,hashlib,subprocess,tempfile
r=pathlib.Path(__file__).parent; e=r/'recovered'
sha=lambda b:hashlib.sha256(b).hexdigest()
rows=json.loads((e/'SHA256SUMS.json').read_text())
for x in rows:
    b=(e/x['path']).read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256'],x['path']
m=json.loads((e/'source-manifest.json').read_text())
tree=subprocess.check_output(['git','ls-tree','-r',m['commit']],text=True)
oids={line.split('\t')[1]:line.split('\t')[0].split()[2] for line in tree.splitlines()}
assert len(oids)==len(m['files'])==7403
with tempfile.TemporaryFile() as ids:
    ids.write(''.join(x['oid']+'\n' for x in m['files']).encode());ids.seek(0)
    p=subprocess.Popen(['git','cat-file','--batch'],stdin=ids,stdout=subprocess.PIPE)
    for x in m['files']:
        assert oids[x['path']]==x['oid']
        oid,kind,size=p.stdout.readline().decode().split();assert oid==x['oid'] and kind=='blob'
        b=p.stdout.read(int(size));assert p.stdout.read(1)==b'\n';assert sha(b)==x['sha256'],x['path']
    assert p.wait()==0
source={x['path']:x for x in m['files']};original={x['name']:x for x in json.loads((e/'original-manifest.json').read_text())['files']}
trees=json.loads((e/'recovery-trees.json').read_text())['trees'];count=0
for tree,files in trees.items():
    for x in files:
        rec=x['recovery'];kind=rec['kind'];path=rec['path']
        if kind=='original':assert original[path]['sha256']==x['sha256'] and original[path]['size']==x['bytes']
        elif kind=='source':assert source[path]['sha256']==x['sha256']
        else:
            assert kind=='payload';b=(e/'recovery-payload'/path).read_bytes();assert sha(b)==x['sha256'] and len(b)==x['bytes']
        count+=1
b=json.loads((e/'payload-blocker.json').read_text());assert b['attempts']==2 and b['acceptedInGuest'] and not b['gameLaunched']
assert b['installs']['install1']['files']==b['installs']['install2']['files']
for stage in ['install1','install2']:
    assert b['installs'][stage]['terminal']['code']==0
    assert len(b['installs'][stage]['files'])==3
    targets=b['installs'][stage]['missingInstalledTargets'];paths={x['path'] for x in trees[stage+'/vfs']}
    assert all('program files/lucasarts/jedi knight demo/'+x not in paths for x in targets)
assert (e/'canonical-build.exit').read_text().strip()=='0'
summary={'remoteSeals':len(rows),'sourceGitBlobs':len(oids),'recoveryFileMappings':count,'treeCounts':{k:len(v) for k,v in trees.items()},'sameThreeInstalledMetadataFiles':True,'twoNormalInstallerExits':True,'canonicalBuildExit':0,'archiveSha256':sha((r/'evidence.tgz').read_bytes())}
(r/'validation.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary,indent=2))
