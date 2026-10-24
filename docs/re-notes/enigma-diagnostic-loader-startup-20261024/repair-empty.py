from work import *
from ledger import measure
measure('empty-file-correction')
m=json.load(open(H/'manifest.json'));empty=[x['target'] for x in m if x['bytes']==0]
save('empty-file-correction.json',dict(firstFailure='standing transfer recipe skipped range(0,0,18000); no guest launched; hash guard stopped at missing empty enigma_conf.lua',paths=empty,action='materialize only zero-length files in owned remote tree, then rerun complete verification after actual state change'))
save('empty-files-api.json',py('import pathlib,json;h=pathlib.Path('+repr(str(H))+');rows='+repr(empty)+';[( (h/n).parent.mkdir(parents=True,exist_ok=True),(h/n).write_bytes(b"")) for n in rows];print(json.dumps(dict(emptyFiles=len(rows))))'))
code='import pathlib,json,hashlib;h=pathlib.Path('+repr(str(H))+');m=json.loads((h/"manifest.json").read_text());bad=[x["target"] for x in m if not (h/x["target"]).is_file() or (h/x["target"]).stat().st_size!=x["bytes"] or hashlib.sha256((h/x["target"]).read_bytes()).hexdigest()!=x["sha256"]];assert not bad,bad;print(json.dumps(dict(files=len(m),bytes=sum(x["bytes"] for x in m),passHash=True,emptyFiles='+str(len(empty))+')))'
save('remote-rehash.json',py(code));print('complete hash verification PASS')
