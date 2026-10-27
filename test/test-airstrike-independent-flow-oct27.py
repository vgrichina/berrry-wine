"""Full serial protocol flow with explicit external factual fixture approval.

All images/menus/exit markers are synthetic and are not gameplay evidence.
"""
import importlib.util
import json
import os
from pathlib import Path
import threading
import time
import unittest
P=Path(__file__).with_name('test-airstrike-independent-accept-oct27.py')
spec=importlib.util.spec_from_file_location('base_accept',P);base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
bridge=base.bridge;ROOT=base.ROOT;BASE=base.BASE

class Flow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):base.Independent.setUpClass.__func__(cls)

    def exercise(self,name,mode='full-normal',mutation=None):
        b=bridge.Bridge(self.node+[str(ROOT/'test/fixtures/airstrike-independent-accept-oct27.cjs'),str(base.RUNNER),mode],ROOT/'tools/airstrike-menu-controller.py',BASE/name,env=self.env,guest_seconds=2,wall_seconds=3)
        stop=threading.Event();errors=[]
        def reviewer():
            seen=set()
            try:
                while not stop.wait(.002):
                    p=b.root/'review-request.json'
                    if not p.exists():continue
                    req=json.loads(p.read_text());token=req['token']
                    if token in seen:continue
                    seen.add(token)
                    after=req['after'];idx=None if after is None else int(after.split('-')[-1])//2-1
                    o=dict(after=after,focus='airstrike',unobscured=True,evidence='SYNTHETIC '+req['sha256'],keysReleased=True,state='gameplay' if idx is None else 'menu')
                    if idx is not None:o.update(selected=idx,items=b.module.ITEMS,header='Airstrike menu')
                    reply={k:req[k] for k in ('session','token','sha256','after')};reply['observation']=o
                    if mutation=='no-approval':continue
                    if mutation in ('session','token','sha256','after'):reply[mutation]='stale-prior-review'
                    if mutation=='menu-row' and idx is not None:o['selected']=6
                    if mutation=='menu-items' and idx is not None:o['items']=['Quit game']
                    bridge.save(b.root/('review-'+token+'.json'),reply)
            except Exception as e:errors.append(repr(e))
        t=threading.Thread(target=reviewer);t.start()
        try:r=b.run()
        finally:stop.set();t.join(timeout=1)
        self.assertFalse(t.is_alive());self.assertEqual(errors,[])
        self.assertTrue(r['cleanup']['complete']);self.assertEqual(r['cleanup']['remaining'],[])
        commands=[e['command'] for e in b.events if e['kind']=='dispatch']
        self.assertFalse(any(c.get('action') in ('frozen','quit') for c in commands))
        return b,r,commands

    def test_full16_action_capture_cleanup_contract(self):
        b,r,commands=self.exercise('full16')
        self.assertEqual(r['status'],'normal-quit-observed',r)
        inputs=[c['cmd'] for c in commands if 'cmd' in c]
        expected=[f'{a}:{vk}' for vk in [27]+[40]*6+[13] for a in ('keydown','keyup')]
        self.assertEqual(inputs,expected)
        self.assertEqual(len([c for c in commands if c.get('action')=='step']),16)
        self.assertEqual(len([e for e in b.events if e['kind']=='frozen-input-complete']),16)
        frames=list(b.root.glob('capture-*.png'))
        self.assertEqual(len(frames),16)
        self.assertTrue(all(p.stat().st_size<=1048576 for p in frames))
        self.assertLessEqual(sum(p.stat().st_size for p in frames),16*1048576)
        self.assertEqual(r['cleanup']['signals'],[])
        self.assertTrue((b.root/'owned-cleanup.json').exists())
        self.assertTrue((b.root/'runner.stdout').exists());self.assertTrue((b.root/'runner.stderr').exists())

    def test_external_image_approval_binding(self):
        for field in ('session','token','sha256','after','no-approval'):
            with self.subTest(field=field):
                _,r,commands=self.exercise('approval-'+field,mutation=field)
                self.assertEqual(r['status'],'refused',r)
                self.assertFalse(any('cmd' in c for c in commands))

    def test_menu_binding_prevents_enter(self):
        for field in ('menu-row','menu-items'):
            with self.subTest(field=field):
                _,r,commands=self.exercise(field,mutation=field)
                self.assertEqual(r['status'],'refused',r)
                self.assertEqual([c['cmd'] for c in commands if 'cmd' in c],['keydown:27','keyup:27'])

    def test_timeout_exit0_and_cleanup_not_normal_quit(self):
        b,r,commands=self.exercise('timeout-exit0',mode='full-timeout')
        self.assertEqual(r['status'],'refused',r)
        self.assertEqual(len([c for c in commands if 'cmd' in c]),16)
        # Cleanup is allowed after refusal and cannot make the result successful.
        self.assertTrue(r['cleanup']['complete'])
        terminal=json.loads((b.root/'terminal.json').read_text())
        self.assertFalse(terminal['hostExitObserved']);self.assertEqual(terminal['reason'],'unproven-terminal')

if __name__=='__main__':unittest.main(verbosity=2)
