import pathlib,shutil,json,hashlib,base64,gzip,os,time
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';E=R/'docs/re-notes/maelstrom-errno-api-canonical-native-20261025';E.mkdir(parents=True,exist_ok=True)
names=['remote-evidence.json.gz','remote-evidence-manifest.json','qualification-summary.json','execution-identities.json','pinned-inputs.json','configuration.json','compressed-projection.json','admission-expanded-projection-rejected.json','admission-precheckout.json','execution-complete.json','compiler-detach.json','remote-before-publication.json','remote-size.json','runtime.json','remote-admission.json','prepublication-admission.json','standing-tools.json','box-final-state.json','root-ref-comparison.json','cheap-1792972710033759922.json','cheap-1792972710033759922.stdout']
for n in names:shutil.copyfile(O/n,E/n)
recipes=['setup.py','api.py','stage.py','run-stage.py','supervise.py','remote-account.py','account.py','make-oracle.py','local-cheap.py','native-batch.py','collect.py','publish.py','prepare-publication.py']
(E/'recipe').mkdir(exist_ok=True)
for n in recipes:shutil.copyfile(O/n,E/'recipe'/n)
# Full remote evidence is compressed to avoid a duplicate multi-MiB ABI JSON.
archive=json.loads(gzip.decompress((E/'remote-evidence.json.gz').read_bytes()))
for row in json.load(open(E/'remote-evidence-manifest.json'))['files']:
 b=base64.b64decode(archive[row['name']]);assert hashlib.sha256(b).hexdigest()==row['sha256'] and len(b)==row['bytes']
summary=json.load(open(O/'qualification-summary.json'));assert all(r['status']=='PASS' for r in summary['results'])
assert len(summary['results'])==10 and len(summary['outputs'])==2 and summary['static']['status']=='PASS'
manifest=[]
for p in sorted(E.rglob('*')):
 if p.is_file() and p!=E/'manifest.json':b=p.read_bytes();manifest.append(dict(path=str(p.relative_to(R)),bytes=len(b),sha256=hashlib.sha256(b).hexdigest()))
for rel in ['tools/maelstrom-errno-canonical-build.cjs','test/maelstrom-errno-canonical-static.py','test/maelstrom-errno-canonical-native.cjs','docs/re-notes/maelstrom-errno-api-canonical-native-20261025.md']:
 b=(R/rel).read_bytes();manifest.append(dict(path=rel,bytes=len(b),sha256=hashlib.sha256(b).hexdigest()))
(E/'manifest.json').write_text(json.dumps(manifest,indent=2))
(O/'publication-plan.json').write_text(json.dumps(dict(copyBytes=sum(r['bytes'] for r in manifest),files=len(manifest),paths=[r['path'] for r in manifest]+[str((E/'manifest.json').relative_to(R))]),indent=2))
print(json.dumps(dict(evidenceFiles=len(manifest),bytes=sum(r['bytes'] for r in manifest),nativeCases=10,compileModules=2)))
