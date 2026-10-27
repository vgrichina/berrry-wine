import pathlib,hashlib,json,shutil,importlib.util
R=pathlib.Path(__file__).resolve().parent.parent/'repo';O=R.parent/'ops'
B=R/'docs/reviews/ricochet-final-inventory-writer-contract-repair-oct27';B.mkdir(parents=True,exist_ok=True)
D=pathlib.Path('/tmp/ricochet-measured-cpu-round-gameplay-oct27/repo/docs/reviews/ricochet-measured-cpu-round-gameplay-oct27/evidence')
s=importlib.util.spec_from_file_location('commands',R/'tools/ricochet/production-commands.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
helper=hashlib.sha256((R/'tools/ricochet/control-publisher.py').read_bytes()).hexdigest();sources={};transforms={}
manifest_path=D.parent/'payload-manifest.json';historical=json.loads(manifest_path.read_text());entries={pathlib.Path(v['path']).name:v for v in historical}
shutil.copyfile(manifest_path,B/'historical-payload-manifest.json')
observed=[]
for item in historical:
 if not item['path'].endswith('-command.json'):continue
 p=pathlib.Path('/tmp/ricochet-measured-cpu-round-gameplay-oct27/repo')/item['path'];raw=p.read_bytes()
 assert len(raw)==item['bytes'] and hashlib.sha256(raw).hexdigest()==item['sha256']
 if b'p.write_text(json.dumps(j))' in raw and b'continue.json' in raw:observed.append(p.name)
assert sorted(observed)==sorted('api-'+n+'-command.json' for n in m.PRODUCERS),observed
for n in m.PRODUCERS:
 p=D/('api-'+n+'-command.json');raw=p.read_bytes();h=hashlib.sha256(raw).hexdigest();sources[n]=h
 assert h==entries[p.name]['sha256'] and len(raw)==entries[p.name]['bytes']
 (B/p.name).write_bytes(raw)
 transformed=m.build(raw,h,helper);(B/('bounded-api-'+n+'-command.json')).write_text(json.dumps(transformed,indent=2));transforms[n]=transformed['transformedSourceSHA256']
(B/'producer-manifest.json').write_text(json.dumps(dict(sources=sources,helperSHA256=helper,transformedSources=transforms,historicalPayloadManifestSHA256=hashlib.sha256(manifest_path.read_bytes()).hexdigest(),allManifestCommandSourcesVerified=True,observedHistoricalPublishers=observed,closure='all four API control producers in measured-cpu-round report; serial.py consumes and does not publish continue.json',caller='python3 -B tools/ricochet/production-commands.py PRODUCER --bundle '+str(B)),indent=2))
print(json.dumps(dict(producers=len(sources),helperSHA256=helper)))
