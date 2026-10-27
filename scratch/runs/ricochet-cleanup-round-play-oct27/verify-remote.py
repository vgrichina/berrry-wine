import pathlib,json,hashlib,shutil,os
h=pathlib.Path('/tmp/ricochet-cleanup-round-play-oct27');j=json.loads((h/'inputs.json').read_text());bad=[]
for x in j['files']:
 p=h/x['target'];s=p.stat()
 if s.st_size!=x['bytes'] or s.st_mode&511!=x['mode'] or hashlib.file_digest(p.open('rb'),'sha256').hexdigest()!=x['sha256']:bad.append(x['target'])
v=dict(verified=len(j['files']),bad=bad,bytes=sum(x['bytes'] for x in j['files']),allocated=sum(p.stat().st_blocks*512 for p in h.rglob('*') if p.is_file()),mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024,free=shutil.disk_usage(h).free)
(h/'remote-input-verification.json').write_text(json.dumps(v,indent=2));print(json.dumps(v));assert not bad
