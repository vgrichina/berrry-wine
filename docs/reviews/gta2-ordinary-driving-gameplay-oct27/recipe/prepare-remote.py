from common import *
assert json.loads((H/'stage-cursor.json').read_text())['complete']
send((H/'stage-manifest.json').read_bytes(),'stage-manifest.json')
for name in ['remote-supervise.py','startup.js','remote-control.py']:send((H/name).read_bytes(),name)
args=['test/run.js','--app=gta2_demo','--no-build','--wasm='+REMOTE+'/runner/build/wine-assembly.wasm','--quiet-api','--quiet-blocks','--trace-input','--max-seconds=180','--batch-size=10000','--tick-ms-per-batch=10','--control=8123','--frozen','--screen=640x480','--vfs-tree='+REMOTE+'/runner/test/binaries/candidates/gta2-demo/installed/Program_Executable_Files']
save('guest-args.json',args);send((H/'guest-args.json').read_bytes(),'guest-args.json')
code='import pathlib,json,hashlib,shutil;h=pathlib.Path('+repr(REMOTE)+');m=json.loads((h/"stage-manifest.json").read_text());bad=[x["target"] for x in m if (h/x["target"]).stat().st_size!=x["bytes"] or hashlib.sha256((h/x["target"]).read_bytes()).hexdigest()!=x["sha256"]];assert not bad,bad;print(json.dumps(dict(files=len(m),bytes=sum(x["bytes"] for x in m),manifestSHA256=hashlib.sha256((h/"stage-manifest.json").read_bytes()).hexdigest(),free=shutil.disk_usage(h).free,verified=True)))'
j,raw=py(code);save('remote-stage-verified.json',j);print(j['stdout'])
# Exact full provider envelope for selected full-frame transfer profile.
j,raw=py('import base64;print(base64.b85encode(bytes(6000)).decode())');overhead=len(raw)-len(j['stdout'].strip())
rawFiltered=640*480*4+480
maxPNG=rawFiltered+(rawFiltered>>12)+(rawFiltered>>14)+(rawFiltered>>25)+13+128
chunks=(maxPNG+5999)//6000
projected=used()+4*chunks*(7500+overhead+64)+M
save('capture-reservation.json',dict(actualEnvelopeOverhead=overhead,rawChunk=6000,encoding='Python-base85-no-JSON-quote-or-backslash-alphabet',maxDisplayedResponse=7500+overhead+64,expectedDimensions=[640,480],fullPNGBytesConservative=maxPNG,remoteEachCeiling=4*M,reservedRemotePNGs=4,remoteCaptureAllocation=32*M,rawAPIBudget=8*M,alreadyUsed=used(),terminalReserve=M,projectedTotal=projected,passBudget=projected<=8*M,remainingTimePlan=dict(guestWall=240,initialLoading=80,menuAction=35,worldLoading=40,ordinaryMovement=20,captureReviewTransfer=45,cleanup=20)))
assert projected<=8*M,('capture envelope incompatible',projected)
print('capture envelope reserved',projected,'of',8*M)
