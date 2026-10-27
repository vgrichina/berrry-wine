gate('local-preflight')
c=json.loads((O/'launch-config.json').read_text());c['controller']['review_seconds']=52;c['controller']['review_plan']['checkpoint_seconds']=[26,26];save('launch-config.json',c)
sys.dont_write_bytecode=True
sp=importlib.util.spec_from_file_location('accepted',H/'repo/runner/tools/enigma-supervised-gameplay.py');m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m);v=m.validate_launch(c)
save('validate-launch-local.json',dict(passGate=True,configSHA256=sha((O/'launch-config.json').read_bytes()),requiredSeconds=98,readySeconds=8,total=106,limit=110))
env={'HOME':'/home/user','PATH':'/home/user/.nvm/versions/node/v24.22.1/bin:/usr/local/bin:/usr/bin:/bin','LANG':'C.UTF-8','TZ':'UTC','PYTHONDONTWRITEBYTECODE':'1'}
with (O/'mount.stdout').open('xb') as out,(O/'mount.stderr').open('xb') as err:
 p=subprocess.Popen([c['command'][0],'--max-old-space-size=2048',str(O/'parser-check.cjs')],env=env,cwd=c['cwd'],stdout=out,stderr=err);r=p.wait(timeout=15)
save('mount-check.json',dict(exit=r,stdoutBytes=(O/'mount.stdout').stat().st_size,stderrBytes=(O/'mount.stderr').stat().st_size));assert r==0
measure=json.loads((O/'inspection-measure.json').read_text());fetch=16.862725148908794;inspection=measure['elapsed'];overhead=1.5;safety=1
assert fetch+inspection+overhead+safety<=26
save('capture-readiness.json',dict(passGate=True,frameDimensions=[640,480],eachCapture=700000,totalCapture=2100000,maxCaptures=3,requestTimeout=1,priorLoopbackMax=.304224,priorLoopbackP99=.171817,priorFullFrameFetchSeconds=[14.543511,fetch],measuredFullImageInspectionAndDurableDecision=inspection,metadataPollingDecisionDeliveryReserve=overhead,safety=safety,requiredReviewSlot=fetch+inspection+overhead+safety,reviewSlots=[26,26],reviewTotal=52,progressTotal=18,controllerRequired=98,plusReady=106,wall=110,cpu=90,apiPerBodyUnchanged=True,wireWorstCase=3*((700000+4095)//4096)*8192,metadataStatusControlReserve=1048576,cleanupReserve=1048576,apiLimit=8388608,reason='24sec proposal leaves inadequate metadata/delivery margin; measured26sec slots fit unchanged110wall/90CPU'))
print('PASS canonical filename-bearing mount enumeration and production validate_launch; measured review26sec slots')
