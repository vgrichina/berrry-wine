"""Offline actual CLI/Bridge.run dispatch admission; no guest or renderer execution."""
import copy
import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile
import threading
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
OPS=ROOT.parent/'ops'
s=importlib.util.spec_from_file_location('startup',ROOT/'test/test-airstrike-console-obscuration.py')
t=importlib.util.module_from_spec(s);s.loader.exec_module(t)

def snapshot(kind):
    s=copy.deepcopy(t.SNAPSHOT);m=s['windows'][0]
    if kind.startswith('height-'):m['h']=int(kind.split('-')[1])
    if kind=='zero-width':m['w']=0
    if kind=='narrow':m['w']=88
    if kind=='negative-x':m['x']=-1
    if kind=='negative-y':m['y']=-1
    if kind=='right-clipped':s['screen']['w']=656
    if kind=='bottom-clipped':s['screen']['h']=33
    if kind=='caption-band-clipped':s['screen']['h']=40
    if kind=='offscreen':m['y']=s['screen']['h']+1
    if kind=='fractional':m['h']=30.5
    if kind=='bool':m['h']=True
    if kind=='console-clipped':s['windows'][1]['y']=-1
    if kind=='screen-zero':s['screen']['h']=0
    return s

def transport(directory,kind):
    d=pathlib.Path(directory);count=0
    print('OFFLINE fake transport; no guest/renderer',file=sys.stderr,flush=True)
    for line in sys.stdin:
        cmd=json.loads(line)
        with (d/'received.jsonl').open('a') as f:f.write(json.dumps(cmd)+'\n')
        if 'cmd' in cmd:
            print('OFFLINE terminal after first input',file=sys.stderr,flush=True);return
        if cmd['action']=='snapshot':
            count+=1;v=snapshot('normal' if kind.startswith('changed-') else kind)
            if count>=3:
                if kind=='changed-height':v['windows'][0]['h']=8
                if kind=='changed-valid':v['windows'][0]['h']-=1
                if kind=='changed-batch':v['batch']+=1
        elif cmd['action']=='png':
            data=b'OFFLINE same pixels';pathlib.Path(cmd['path']).write_bytes(data);v=dict(path=cmd['path'],bytes=len(data))
        else:raise AssertionError(cmd)
        print('[ctl] '+json.dumps(dict(id=cmd['id'],ok=True,value=v)),flush=True)

class Interior(unittest.TestCase):
    def cli(self,kind):
        o=t.approved();o['startupSnapshot']=snapshot(kind)
        o['consoleObstruction']=copy.deepcopy(o['startupSnapshot']['windows'][1])
        q=subprocess.run([sys.executable,'-B',str(ROOT/'tools/airstrike-menu-controller.py')],input=json.dumps(dict(observation=o))+'\n',text=True,capture_output=True,timeout=5)
        return q,[json.loads(x) for x in q.stdout.splitlines()]

    def bridge(self,kind):
        d=pathlib.Path(tempfile.mkdtemp(prefix='interior-'+kind+'-',dir=OPS))
        obj=t.b.Bridge([sys.executable,'-B',__file__,'--transport',str(d),kind],ROOT/'tools/airstrike-menu-controller.py',d/'evidence',guest_seconds=12)
        done=threading.Event();errors=[]
        def review():
            seen=set()
            try:
                while not done.wait(.005):
                    p=obj.root/'review-request.json'
                    if not p.exists():continue
                    q=json.loads(p.read_text())
                    if q['token'] in seen:continue
                    seen.add(q['token']);o=t.approved();o.pop('startupSnapshot')
                    o['consoleObstruction']=copy.deepcopy(q['snapshot']['windows'][1]);o['evidence']=q['path']
                    reply={k:q[k] for k in ('session','token','sha256','after')};reply['observation']=o
                    t.b.save(obj.root/('review-'+q['token']+'.json'),reply)
            except Exception as e:errors.append(str(e))
        thread=threading.Thread(target=review);thread.start()
        try:result=obj.run()
        finally:done.set();thread.join(2)
        self.assertFalse(thread.is_alive());self.assertEqual(errors,[])
        self.assertTrue(result['cleanup']['complete'],result)
        received=[json.loads(x) for x in (d/'received.jsonl').read_text().splitlines()]
        inputs=[x for x in received if 'cmd' in x]
        (d/'assertions.json').write_text(json.dumps(dict(kind=kind,result=result,inputs=inputs),indent=2)+'\n')
        return inputs

    def test_unchanged_original_attack_after_repair(self):
        d=pathlib.Path(tempfile.mkdtemp(prefix='unchanged-attack-',dir=OPS));h=d/'ops';h.mkdir()
        (d/'repo').symlink_to(ROOT,target_is_directory=True)
        for n in ('reproduce.py','production-renderer-input.js'):(h/n).write_bytes((OPS/n).read_bytes())
        q=subprocess.run([sys.executable,'-B',str(h/'reproduce.py')],capture_output=True,timeout=20)
        (h/'stdout').write_bytes(q.stdout);(h/'stderr').write_bytes(q.stderr)
        report=json.loads((h/'independent-rejection.json').read_text())
        # The unchanged oracle asserts the original vulnerability: its final
        # assertion must now fail, after preserving its own PASS/no-input report.
        self.assertEqual(q.returncode,1)
        self.assertEqual(report['verdict'],'PASS')
        self.assertEqual(report['controllerCLI']['commands'],[])
        self.assertEqual(report['bridge']['inputs'],[])
        self.assertTrue(report['bridge']['result']['cleanup']['complete'])

    def test_actual_cli_and_bridge_negative_geometry(self):
        for kind in ('height-0','height-8','height-13','height-14','height-26','zero-width','narrow','negative-x','negative-y','right-clipped','bottom-clipped','caption-band-clipped','offscreen','fractional','bool','console-clipped','screen-zero'):
            with self.subTest(kind=kind):
                q,commands=self.cli(kind)
                self.assertEqual(q.returncode,2,q.stderr);self.assertEqual(commands,[])
                self.assertEqual(self.bridge(kind),[])

    def test_changed_geometry_and_stale_batch_before_dispatch(self):
        for kind in ('changed-height','changed-valid','changed-batch'):
            with self.subTest(kind=kind):self.assertEqual(self.bridge(kind),[])

    def test_valid_normal_and_minimum_caption_interior(self):
        for kind in ('normal','height-27'):
            with self.subTest(kind=kind):
                q,commands=self.cli(kind)
                self.assertEqual(commands,[dict(id='airstrike-1',cmd='click:656:33')],q.stderr)
                self.assertEqual(self.bridge(kind),commands)

if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='--transport':transport(sys.argv[2],sys.argv[3])
    else:unittest.main(verbosity=2)
