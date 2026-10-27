gate('prepare')
base=OLD/'repo/docs/reviews/enigma-separated-stream-runtime-oct27';manifest=json.loads((base/'manifest.json').read_text());mismatch=[]
for r in manifest['files']:
 p=base/r['path']
 if p.stat().st_size!=r['bytes'] or sha(p.read_bytes())!=r['sha256']:mismatch.append(r['path'])
save('predecessor-verification.json',dict(files=len(manifest['files']),mismatches=mismatch));assert not mismatch
c=json.loads((OLD/'ops/launch-config.json').read_text());oldc=json.loads(json.dumps(c));c['launch_dir']=str(O/'launch');c['controller']['decision_path']=str(O/'decision.json')
# Same 110-second aggregate; 35 startup/checkpoint + 25 review + 20 after-action preserves action/cleanup reserve.
save('launch-config.json',c)
mount=json.loads((OLD/'ops/mount-check.json').read_text());assert c['command']==oldc['command'];save('mount-reused.json',dict(exactCommandUnchanged=True,receipt=mount,enumerationSHA256=sha((OLD/'ops/remote/mount-enumeration.json').read_bytes()) if (OLD/'ops/remote/mount-enumeration.json').exists() else None,parserSHA256=sha((OLD/'ops/parser-check.cjs').read_bytes())))
src=(OLD/'ops/launch.py').read_text().replace("h=pathlib.Path('/tmp/enigma-separated-stream-runtime-oct27')","h=pathlib.Path('/tmp/enigma-prepared-readback-startgame-oct27'); retained=pathlib.Path('/tmp/enigma-separated-stream-runtime-oct27')")
src=src.replace("assert (h/'ops/mount-check.json').is_file()","assert (h/'ops/mount-reused.json').is_file()")
src=src.replace("(h/p).read_bytes()","(retained/p).read_bytes()").replace("str(h/'runner/tools/enigma-supervised-gameplay.py')","str(retained/'runner/tools/enigma-supervised-gameplay.py')").replace("cwd=h/'runner'","cwd=retained/'runner'")
(O/'launch.py').write_text(src)
save('review-plan.json',dict(historicalInspected=True,historicalPreauthorizesNothing=True,coordinatesCandidate=[343,213],decisionSchema={'reviewed':True,'safeStartGame':True,'frameSHA256':'actual-new-capture SHA256','batch':'actual-new-capture integer','x':343,'y':213},pollSeconds=.25,transportSeconds=4.630762290908024,reviewSeconds=25,aggregateSeconds=110,cleanupSeconds=10,remainingSerializedResponseBytes=1048576-sum(p.stat().st_size for p in (O/'responses').glob('*')),dedup='New capture may use exact bytes from hash-addressed retained local PNG only after actual remote metadata proves byte length and SHA256; inspect new local path before decision.',ordinaryQuit='Exact accepted controller exposes Start Game then after-action capture and harness cleanup only; ordinary guest Quit remains unqualified unless reachable under that unchanged path. No custom controller or direct extra requests.'))
payload={str(O/'launch-config.json'):(O/'launch-config.json').read_text(),str(O/'launch.py'):src,str(O/'mount-reused.json'):(O/'mount-reused.json').read_text()}
code='import pathlib,json;items=json.loads('+repr(json.dumps(payload))+');\nfor name,data in items.items():\n p=pathlib.Path(name);p.parent.mkdir(parents=True,exist_ok=True);assert not p.exists();p.write_text(data)\nprint("new owned wrapper/config staged")'
print(py(code)['stdout'])
print('ready; no guest started')
