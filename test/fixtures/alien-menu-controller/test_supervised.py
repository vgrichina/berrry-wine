"""Discriminating actual production NEW-launch tests, no Node or game guest."""
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import unittest

FIX = Path(__file__).parent
ROOT = FIX.parents[2]
CLI = ROOT / 'tools/alien-supervised-gameplay.py'
LEGACY = ROOT / 'tools/alien-menu-gameplay-controller.py'
OUT = Path(sys.argv.pop(1)).absolute()


def read(p):
    return json.loads(p.read_text())


def wait_file(p, proc):
    until = time.monotonic()+8
    while not p.exists():
        if proc.poll() is not None:
            raise AssertionError(('launcher exited', proc.communicate()))
        if time.monotonic() > until:
            raise AssertionError('missing fixture synchronization ' + str(p))
        time.sleep(.01)
    return p


class Supervised(unittest.TestCase):
    def setUp(self):
        self.base = OUT / self._testMethodName
        self.base.mkdir(parents=True, exist_ok=False)
        self.processes = []
        self.addCleanup(self.cleanup)

    def cleanup(self):
        for p, home in self.processes:
            if p.poll() is None:
                p.send_signal(2)
            try:
                out, err = p.communicate(timeout=6)
            except subprocess.TimeoutExpired:
                p.kill()
                out, err = p.communicate(timeout=2)
                self.fail('production cleanup did not finish')
            (self.base / (home.name+'-cli.json')).write_text(json.dumps(dict(argv=p.args, exit=p.returncode, stdout=out, stderr=err)))
            if (home / 'cleanup.json').exists():
                self.assertEqual(read(home / 'cleanup.json')['remainingOwnedLive'], [])

    def start(self, mode='', inject=None, name='original', extra=(), approve=True):
        self.assertTrue(all(p.poll() is not None for p,h in self.processes),
                        'previous subcase still live; refuse another launch')
        home = self.base / name
        with socket.socket() as s:
            s.bind(('127.0.0.1',0))
            port = s.getsockname()[1]
        endpoint = 'http://127.0.0.1:%d/ctl' % port
        argv = [sys.executable, str(CLI), '--invocation', str(home), '--endpoint', endpoint,
            '--cwd', str(ROOT), '--deadline', str(time.time()+115), '--capture-limit','8',
            '--captures-used','5', '--capture-bytes', str(2*1024**2), '--rss-limit', str(96*1024**2),
            '--after-batches','128', *extra, '--', sys.executable, '-S', str(FIX/'child_server.py'), str(home), str(port), mode]
        env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
        env.pop('PYTHONPATH', None)
        if inject:
            env['PYTHONPATH'] = str(FIX/'inject')
            env['ALIEN_BOUNDARY_INJECT'] = json.dumps(dict(home=str(home), mode=inject))
        p = subprocess.Popen(argv, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.processes.append((p,home))
        wait_file(home/'command.json', p)
        wait_file(home/'ready.json', p)
        command = read(home/'command.json')
        ready = read(home/'ready.json')
        self.assertEqual(ready['serverPID'], command['pid'])
        if approve:
            self.approve(home)
        return p,home,endpoint

    def approve(self, home, valid=True):
        run = read(home/'command.json')['runId']
        frame = home/'menu.png'
        frame.write_bytes(b'offline reviewed frame; no gameplay claim')
        digest = hashlib.sha256(frame.read_bytes()).hexdigest()
        (home/'menu-frame.json').write_text(json.dumps(dict(runId=run,batch=4722,path=str(frame),sha256=digest)))
        (home/'approval.json').write_text(json.dumps(dict(runId=run,batch=4722,frameSHA256=digest,
            humanReviewed=valid,reviewId='explicit-offline-review',action='New Game',command='click:98:296')))

    def finish(self,p,home,expected=0):
        out, err = p.communicate(timeout=10)
        (self.base/(home.name+'-result.json')).write_text(json.dumps(dict(exit=p.returncode,stdout=out,stderr=err)))
        self.assertEqual(p.returncode,expected,(out,err))
        cleanup = read(home/'cleanup.json')
        self.assertEqual(cleanup['remainingOwnedLive'],[])
        self.assertTrue((home/'terminal.json').exists())
        return json.loads(out)

    def wire(self, home):
        return read(home/'wire.json') if (home/'wire.json').exists() else []

    def commands(self,home):
        return [r['command'] for r in self.wire(home)]

    def competitor(self, endpoint, home, pid):
        directory = self.base/('competitor-%d' % len(list(self.base.glob('competitor-*'))))
        directory.mkdir()
        # Changed output, times, budget/config/PID/endpoint must grant nothing.
        (directory/'process.json').write_text(json.dumps(dict(pid=pid,endpoint=endpoint)))
        (directory/'budget.json').write_text(json.dumps(dict(startedAt=time.time(),deadline=time.time()+120,captureLimit=999)))
        registry = Path('/tmp/wine-ops-alien-menu-owners-'+str(os.getuid()))
        before = {str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in registry.glob('*.json')}
        owned = (home/'delegation.json').read_bytes()
        argv = [sys.executable,str(LEGACY),'--invocation',str(directory),'--endpoint',endpoint,
            '--terminal-file',str(directory/'new-terminal.json'),'--after-batches','1','--approve-new-game']
        r = subprocess.run(argv,capture_output=True,text=True,timeout=5)
        (directory/'result.json').write_text(json.dumps(dict(argv=argv,exit=r.returncode,stdout=r.stdout,stderr=r.stderr)))
        self.assertEqual(r.returncode,1)
        self.assertIn('attachment retired',r.stdout)
        self.assertEqual(before,{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in registry.glob('*.json')})
        self.assertEqual((home/'delegation.json').read_bytes(),owned)
        self.assertFalse((directory/'owner.json').exists())

    def test_positive_original_and_live_competitors(self):
        p,h,endpoint = self.start('hold')
        wait_file(h/'input-pending',p)
        ready = read(h/'ready.json')
        links = [os.readlink(x) for x in Path('/proc/%d/fd'%ready['idlePID']).iterdir()]
        alternate = os.readlink('/proc/%d/fd/%d'%(ready['serverPID'],ready['alternateFD']))
        primary = os.readlink('/proc/%d/fd/%d'%(ready['serverPID'],ready['primaryFD']))
        self.assertIn(alternate,links)
        self.assertNotIn(primary,links)
        before = self.commands(h)
        self.competitor(endpoint,h,ready['serverPID'])
        self.competitor('http://127.0.0.1:%d/ctl'%ready['alternatePort'],h,ready['idlePID'])
        self.assertEqual(self.commands(h),before)
        self.assertIsNone(p.poll())
        (h/'release-input').touch()
        result = self.finish(p,h)
        commands = self.commands(h)
        self.assertEqual(commands[:2],[dict(action='snapshot'),dict(cmd='click:98:296')])
        self.assertEqual([c['n'] for c in commands if c.get('action')=='step'],[128,128])
        self.assertEqual(sum(c.get('action')=='png' for c in commands),3)
        self.assertEqual(commands[-1],dict(action='quit'))
        self.assertEqual(result['capturesCharged'],8)
        self.assertTrue(all(r['serverPID']==ready['serverPID'] for r in self.wire(h)))
        self.assertTrue(all(r['socketPort']==int(endpoint.split(':')[2].split('/')[0]) for r in self.wire(h)))
        ledger = read(h/'sequence-ledger.json')
        self.assertEqual(len(ledger['receipts']),len(commands))
        self.assertEqual(ledger['status'],'terminal')

    def test_pending_failure_no_replay(self):
        p,h,e = self.start('uncertain')
        self.finish(p,h,1)
        self.assertEqual(self.commands(h),[dict(action='snapshot'),dict(cmd='click:98:296')])
        ledger = read(h/'sequence-ledger.json')
        self.assertEqual(ledger['pending']['command'],dict(cmd='click:98:296'))
        self.assertEqual(ledger['status'],'terminal')
        before = self.commands(h)
        self.competitor(e,h,read(h/'ready.json')['serverPID'])
        self.assertEqual(self.commands(h),before)

    def test_distinct_new_children(self):
        identities=[]
        for name in ('one','two'):
            p,h,e = self.start(name=name)
            self.finish(p,h)
            identities.append(read(h/'command.json'))
            self.assertEqual(self.commands(h)[-1],dict(action='quit'))
        self.assertNotEqual(identities[0]['pid'],identities[1]['pid'])
        self.assertNotEqual(identities[0]['runId'],identities[1]['runId'])

    def test_dispatch_guards_and_crash(self):
        for mode in ('death','terminal','crash','time','budget'):
            with self.subTest(mode=mode):
                p,h,e = self.start(inject=mode,name=mode)
                self.finish(p,h,1)
                self.assertEqual(self.commands(h),[dict(action='snapshot')])
                self.assertTrue(read(h/'usage.json')['inputIssued'])
                self.assertTrue(read(h/'delegation.json')['consumed'])
                self.competitor(e,h,read(h/'ready.json')['serverPID'])
                self.assertEqual(self.commands(h),[dict(action='snapshot')])

    def test_completion_and_review_fail_closed(self):
        for mode in ('credits','partial','terminal','review'):
            with self.subTest(mode=mode):
                p,h,e = self.start(mode,name=mode,approve=mode!='review')
                if mode=='review':
                    self.approve(h,valid=False)
                self.finish(p,h,1)
                commands=self.commands(h)
                if mode=='review':
                    self.assertEqual(commands,[])
                elif mode=='partial':
                    self.assertEqual(commands[-1],dict(action='step',n=128))
                else:
                    self.assertEqual(commands,[dict(action='snapshot')])
                self.assertFalse(any(c.get('action') in ('png','quit') for c in commands))

    def test_capture_and_startup_reserves(self):
        p,h,e=self.start(extra=['--captures-used','6'])
        self.finish(p,h,1)
        self.assertEqual(self.commands(h),[])
        # Actual elapsed original startup, no fake clock or increased timeout.
        p,h,e=self.start(name='expired-startup',extra=['--startup-maximum','0.2'],approve=False)
        self.finish(p,h,1)
        self.assertEqual(self.commands(h),[])
        self.assertFalse(read(h/'cleanup.json')['delegationConsumed'])

    def test_after_action_keeps_cleanup_reserve(self):
        p,h,e=self.start(inject='cleanup')
        result=self.finish(p,h,1)
        self.assertIn('required 10.000000s',result['error'])
        self.assertEqual(self.commands(h),[dict(action='snapshot'),dict(cmd='click:98:296'),
            dict(action='snapshot'),dict(action='step',n=128)])
        self.assertEqual(read(h/'usage.json')['capturesReserved'],3)

    def test_new_launcher_cannot_attach_or_replace_original(self):
        p,h,e=self.start('hold')
        wait_file(h/'input-pending',p)
        budget=(h/'budget.json').read_bytes()
        delegation=(h/'delegation.json').read_bytes()
        before=self.commands(h)
        argv=list(p.args)
        other=self.base/'attempted-attach'
        argv[argv.index('--invocation')+1]=str(other)
        r=subprocess.run(argv,capture_output=True,text=True,timeout=5)
        self.assertEqual(r.returncode,1)
        self.assertIn('Address already in use',r.stdout)
        self.assertFalse(other.exists())
        self.assertEqual(self.commands(h),before)
        self.assertEqual((h/'budget.json').read_bytes(),budget)

        self.assertEqual((h/'delegation.json').read_bytes(),delegation)
        self.assertIsNone(p.poll())
        (h/'release-input').touch()
        self.finish(p,h)
        argv=list(p.args)
        # An unused new port does not allow the original invocation to restart.
        with socket.socket() as s:
            s.bind(('127.0.0.1',0))
            argv[argv.index('--endpoint')+1]='http://127.0.0.1:%d/ctl'%s.getsockname()[1]
        r=subprocess.run(argv,capture_output=True,text=True,timeout=5)
        self.assertEqual(r.returncode,1)
        self.assertIn('File exists',r.stdout)
        self.assertEqual((h/'budget.json').read_bytes(),budget)


    def test_original_startup_and_before_capture_share_budget(self):
        p,h,e=self.start('startup',approve=False,extra=['--startup-batches','4722','--captures-used','4'])
        wait_file(h/'menu-frame.json',p)
        frame=read(h/'menu-frame.json')
        self.assertEqual(frame['batch'],4722)
        image=Path(frame['path'])
        self.assertEqual(hashlib.sha256(image.read_bytes()).hexdigest(),frame['sha256'])
        self.assertEqual(read(h/'startup-usage.json')['capturesCharged'],5)
        self.assertFalse((h/'delegation.json').exists())
        self.assertFalse(any('cmd' in c for c in self.commands(h)))
        (h/'approval.json').write_text(json.dumps(dict(runId=frame['runId'],batch=frame['batch'],
            frameSHA256=frame['sha256'],humanReviewed=True,reviewId='offline-original-before-frame',
            action='New Game',command='click:98:296')))
        result=self.finish(p,h)
        self.assertEqual(result['capturesCharged'],8)
        commands=self.commands(h)
        self.assertEqual(sum(c.get('action')=='png' for c in commands),4)
        self.assertEqual(sum('cmd' in c for c in commands),1)
        self.assertEqual(sum(c['n'] for c in commands if c.get('action')=='step'),4722+256)
        self.assertEqual(commands[-1],dict(action='quit'))


if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=False)
    unittest.main(verbosity=2)
