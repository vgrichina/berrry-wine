from run import *
m=json.loads((H/'stage-manifest.json').read_text());old=hashlib.sha256((H/'stage-manifest.json').read_bytes()).hexdigest();added=[]
assert not any(x['target'].startswith('runner/fonts/') for x in m)
for p in sorted((R/'fonts').rglob('*')):
 if p.is_file():
  b=p.read_bytes();added.append(dict(path=str(p),target='runner/'+p.relative_to(R).as_posix(),bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),kind='source',revision='4a2bec145ef34b0d084b96b09a682a16e89703fd'))
m+=added;dump('stage-manifest.json',m);dump('font-closure-extension.json',dict(previousManifestSHA256=old,addedFiles=len(added),addedBytes=sum(x['bytes'] for x in added),newManifestSHA256=hashlib.sha256((H/'stage-manifest.json').read_bytes()).hexdigest(),appendOnly=True))
print('font closure appended',len(added),sum(x['bytes'] for x in added))
