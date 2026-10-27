from work import *
metadata=json.loads(py('import pathlib,json,hashlib;h=pathlib.Path('+repr(R+'/ops/decision')+');print(json.dumps({p.name:dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in h.iterdir() if p.is_file()}))')['stdout'])
save('remote-capture-seals.json',metadata)
# Retain the matching full before/earliest-after pair; the later frames remain remote and sealed.
save('seal-b40060.png.json',get(R+'/ops/decision/b40060.png',H/'decision/b40060.png'))
get(R+'/ops/capture-reservation.json',H/'capture-reservation.json')
save('collection.json',dict(fullSelected=['b39999.png','b40060.png'],additionalRemote=['b40100.png','b40200.png'],reason='Two full matching frames suffice; no additional guest or capture.',transportInterruptedAfterBefore=True,partialSecondInMemoryDiscarded=True,binaryCaptureTransportChargedSeparately=True))
print('selected full before/after collected',flush=True)
