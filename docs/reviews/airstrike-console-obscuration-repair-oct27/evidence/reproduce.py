import importlib.util,json,pathlib
import run as c
p=c.R/'tools/airstrike-menu-controller.py';sp=importlib.util.spec_from_file_location('controller',p);m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
D=pathlib.Path('/tmp/airstrike-accepted-dispatch-quit-oct27/ops/retained')
v=json.loads((D/'review-9b55685e506a4124abd456510ebaf254.json').read_text());sent=[]
controller=m.Controller(lambda: {'observation':v['observation']},sent.append)
try: controller.run();raise AssertionError('original unexpectedly accepted')
except m.Refusal as e:
 assert not sent
 c.dump('before-reproduction.json',dict(status='EXPECTED_REFUSAL',reason=str(e),commands=sent,sourceSHA256=c.hashlib.sha256(p.read_bytes()).hexdigest(),reviewSHA256=c.hashlib.sha256((D/'review-9b55685e506a4124abd456510ebaf254.json').read_bytes()).hexdigest(),imageSHA256=v['sha256'],productionBoundary='Actual Controller.run(observation), exact retained first review; no guest/Node.'))
print('Exact retained startup observation refused; zero dispatch confirmed.')
