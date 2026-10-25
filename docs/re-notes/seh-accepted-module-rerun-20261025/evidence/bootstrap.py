import pathlib,json,hashlib,os,subprocess
O=pathlib.Path(__file__).resolve().parent
P=pathlib.Path('/tmp/seh-current-canonical-qualifier-oct25/ops')
def sha(b):return hashlib.sha256(b).hexdigest()
pins={'account.py':'18b8fe0d11e730c3711d7739e13a7227e0a573eee6aa9e5aeccf891805e691b3','supervise.py':'0dccd283ae90dfcd46c75f4e4c483f06124c895da90c2bf22ead565d601246de'}
seal=json.load(open(P/'final-evidence-manifest.json'))
for n,h in pins.items():
 b=(P/n).read_bytes();assert sha(b)==h
 assert any(r['path']==str(P/n) and r['sha256']==h for r in seal)
 text=b.decode()
 if n=='account.py':text=text.replace('scratch/usage-watch/seh-current-canonical-qualifier-oct25','scratch/usage-watch/seh-accepted-module-rerun-oct25')
 (O/n).write_text(text)
receipt=json.load(open('/home/user/wine-assembly/scratch/usage-watch/seh-accepted-module-rerun-launch-admission-oct25.json'))
assert receipt['heavyPass'] and receipt['heavyMemoryRequired']==3689041920 and receipt['availableMemoryBytes']>=3689041920 and receipt['freeDiskBytes']>=3676782592
(O/'coordinator-launch-admission.json').write_text(json.dumps(receipt,indent=2)+'\n')
(O/'reuse-semantics.json').write_text(json.dumps(dict(pins=pins,priorSupervisor='c2ee4204502d9998703d86520b01055f5c025f40dd53d97a30962eef0aae6911',resolvedFinalManifest=True,inspection='Final retained supervisor explicitly admits Module stages with aggregate524288, heavy lock, kernel CPU/FSIZE,900s wall,5s TERM/KILL/reap, strict SSH. Historical hash is not final retained file. No supervisor code adaptation.',adaptations=['account launcher ownership path only; __file__ derives owned roots'],preserved='RAM2684354560 ALL stages;64MiB including view1789952, shared WALSHM, DB growth, futures+8MiB reserve; precheckout volatility627523584; no module copies'),indent=2)+'\n')
root=pathlib.Path('/home/user/wine-assembly')
(O/'root-before.json').write_text(json.dumps(dict(indexSHA256=sha((root/'.git/index').read_bytes()),refs=json.load(open(root/'scratch/usage-watch/seh-accepted-module-rerun-oct25/root-ref-digest.json'))),indent=2)+'\n')
watch=open(O/'board-watch.txt','ab');p=subprocess.Popen(['tail','-n','0','-f',str(root/'messageboard.txt')],stdout=watch,stderr=watch,start_new_session=True)
(O/'watcher.pid').write_text(str(p.pid))
print('Pinned retained helpers verified; ownership-only adaptation; coordinator PASS')
