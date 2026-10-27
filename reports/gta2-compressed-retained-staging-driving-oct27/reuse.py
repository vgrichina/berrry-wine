old=pathlib.Path('/tmp/gta2-census-cleared-driving-oct27/ops');pins=json.loads((old/'completed-pins.json').read_text());assert len(pins)==320
for n in range(0,320,40):
 rows=pins[n:n+40];code='import pathlib,hashlib,json,shutil;rows='+repr(rows)+';src=pathlib.Path("/tmp/gta2-census-cleared-driving-oct27/repo");dst=pathlib.Path('+repr(str(H/'repo'))+');\nfor r in rows:\n p=src/r["target"];b=p.read_bytes();assert len(b)==r["bytes"] and hashlib.sha256(b).hexdigest()==r["sha256"];q=dst/r["target"];q.parent.mkdir(parents=True,exist_ok=True);assert not q.exists();shutil.copyfile(p,q)\nprint("verified reused",len(rows))'
 py(code)
save('retained-reuse.json',dict(count=320,bytes=sum(r['bytes'] for r in pins),remoteCopyOnly=True,originalUnmodified=True,pins=pins));print('320 remote retained files verified/reused; no retransmission')
