import pathlib,hashlib,json,os
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';D=pathlib.Path('/tmp/ricochet-final-inventory-writer-contract-repair-oct27/repo')
pins={};total=0
for line in (O/'candidate-tree.stdout').read_text().splitlines():
    meta,path=line.split('\t');mode,kind,blob=meta.split();assert kind=='blob'
    raw=(D/path).read_bytes()
    assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==blob,path
    total+=len(raw);assert total<20*1048576
    target=R/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw);target.chmod(int(mode,8)&0o777)
    pins[path]=dict(blob=blob,sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw))
B=R/'docs/reviews/ricochet-final-inventory-writer-contract-repair-oct27'
checkpoint=json.loads((B/'checkpoint.json').read_text())
for path,h in checkpoint['pins'].items():assert pins[path]['sha256']==h,path
(O/'staged-pins.json').write_text(json.dumps(dict(candidate='93fce294621b5f40a1a23f6711c555dc5159e554',pins=pins,total=total),indent=2))
print('staged exact candidate',len(pins),'blobs',total,'bytes; all9 authoritative source pins pass; no donor writes')
