from work import *
rows=json.loads((O/'manifest.json').read_text());zero=[x for x in rows if not x['bytes']];save('staging-correction.json',dict(cause='recipe transfer omitted zero-byte files',files=zero,guestInvocationsSpent=0,accessDenial=False))
code='import pathlib,os;h=pathlib.Path('+repr(R)+')\n'
for x in zero:code+='p=h/'+repr(x['target'])+';p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b"");os.chmod(p,'+str(x['mode'])+')\n'
py(code)
code='import pathlib,json,hashlib;h=pathlib.Path('+repr(R)+');rows=json.loads((h/"ops/manifest.json").read_text());bad=[]\nfor x in rows:\n p=h/x["target"];b=p.read_bytes()\n if len(b)!=x["bytes"] or hashlib.sha256(b).hexdigest()!=x["sha256"] or p.stat().st_mode&511!=x["mode"]:bad.append(x["target"])\nprint(json.dumps(dict(rows=len(rows),bytes=sum(x["bytes"] for x in rows),bad=bad)))\nassert not bad'
j=py(code);save('remote-integrity.json',j);print(j['stdout'])
