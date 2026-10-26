from pathlib import Path as P
import hashlib,json,sys,time
h=P(__file__).resolve().parent.parent;o=h/'ops';p=o/'checkpoint.json'
j=json.loads(p.read_text()) if p.exists() else dict(baseCandidate='9e7b74218b6518534638efdd9a48310df7b6f1ad',completed=[],historicalRejection='7123b7ce3bb0641afdb048457664e1e7419ff522',mainForbidden=True)
j.update(at=time.time(),sourceHashes={str(p.relative_to(h/'repo')):hashlib.sha256(p.read_bytes()).hexdigest() for p in (h/'repo/test').rglob('*.py')},remaining=sys.argv[2:])
j['completed'].append(sys.argv[1]);tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(j,indent=2)+'\n');tmp.replace(p)
