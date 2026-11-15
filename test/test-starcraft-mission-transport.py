"""Actual HTTP and CLI controls; synthetic reviews never enter StarCraft."""
import importlib.util
import json
import os
import pathlib
import subprocess
import sys
import time
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load(name, path):
    s=importlib.util.spec_from_file_location(name,ROOT/path)
    m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m


a=load('mission','tools/starcraft-mission-controller.py')
b=load('released','test/test-barrage-transport.py')
c=a.c
b.c=c; b.r.c=c; b.r.b.control=c; b.t.c=c; b.t.base.control=c
b.p.c=c; b.p.p.c=c; b.p.b.control=c


class MissionHTTP(b.r.Refusal):
    def start(self,name):
        original=b.r.b.save
        def save(out,key,value):
            if key=='recipe.json':value={**value,'seconds':240}
            return original(out,key,value)
        with patch.object(b.r.b,'save',save):super().start(name)

    def review(self, name, **changes):
        c.capture(name);rr=c.read(name+'.json')
        r=dict(at=time.time(),pngSHA256=rr['pngSHA256'],submittedScene=True,
            observation='Synthetic HTTP fixture only',mode='command',sceneType='mission',unobstructedMission=True,
            completeWorldReview='Fixture complete world',visibleObjectives='Fixture objective',pauseState='not-observed',
            visibleTarget='Fixture training button',selectedUnitsEvidence='Fixture selected building',nativeCommandSemantics='Fixture train',
            commandKind='train',selectedBuildingEvidence='Fixture command center',visibleTrainUnit='Fixture SCV',resourcesBefore='Fixture 250 minerals',
            pixelGeometry=dict(source='current-full-scene',target=c.read('native-pid.json'),chosenCenter=[200,200]))
        r.update(changes);c.save(name+'-review.json',r)
        if not (c.R/'mission-admitted.json').exists():c.save('mission-admitted.json',dict(fixture=True))
    def test_mission_train_actual_endpoint(self):
        self.start('mission-http-train')
        try:
            self.review('fresh')
            a.pulse('train',['mousedown:200:200'],400,'fresh','Fixture train','command')
            self.assertEqual(c.read('train-mission-order.json')['commandKind'],'train')
            self.assertEqual(c.read('train-up.json')['state'],'ACK')
            self.assertTrue(c.read('train-release-wait.json')['actualWait'])
        finally:self.finish()
    def test_consumed_foreign_ack_fails_closed_and_releases(self):
        self.start('mission-http-foreign-ack')
        try:
            self.review('fresh');real=c.call
            def foreign(command,timeout=10):
                result=real(command,timeout)
                return {**result,'owner':'foreign'} if command.get('action')=='guarded-input' else result
            with patch.object(c,'call',foreign):
                with self.assertRaisesRegex(AssertionError,'ACK identity'):
                    a.pulse('foreign',['mousedown:200:200'],400,'fresh','Fixture foreign ACK','command')
            self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
            self.assertEqual(c.read('foreign-up.json')['state'],'ACK')
            with self.assertRaisesRegex(AssertionError,'sticky'):c.capture('no-replay')
        finally:self.finish()


class Production(b.Production):
    def test_parent_kill_uses_1750ms_cap(self):
        import ctypes
        assert ctypes.CDLL(None,use_errno=True).prctl(36,1,0,0,0)==0
        self.start('mission-parent-death')
        try:
            # Shared inherited pipes reach the actual test parent, allowing
            # both EOFs AND a subreaper wait after the immediate parent dies.
            code=r'''import sys,subprocess,os,json,time,signal,importlib.util
s=importlib.util.spec_from_file_location('c',sys.argv[1]);c=importlib.util.module_from_spec(s);s.loader.exec_module(c)
owner=c.read('input-owner.json')
release=r"""import sys,importlib.util,builtins,time,os
s=importlib.util.spec_from_file_location('c',sys.argv[1]);c=importlib.util.module_from_spec(s);s.loader.exec_module(c)
real=builtins.print
def observable(*args,**kwargs):
 real(*args,**kwargs);c.save('death-arm-ready.json',dict(pid=os.getpid(),at=time.time()))
builtins.print=observable
c.release('death',sys.argv[2],float(sys.argv[3]),channel=True)
"""
child=subprocess.Popen([sys.executable,'-B','-c',release,sys.argv[1],owner['owner'],str(time.time()+6)],stdin=subprocess.PIPE)
end=time.time()+2
while not (c.R/'death-arm-ready.json').exists():
 assert time.time()<end;time.sleep(.005)
cap=time.time()+1.750;c.save('death-release-cap.json',dict(at=cap,beforeFirstDown=True,fallbackMilliseconds=1750))
r=c.call(dict(action='guarded-input',cmd='keydown:40',guard={**owner,'nonce':'death-fresh','reviewed':True,'deadline':int(cap*1000)}))
c.save('death-consumed.json',r);os.kill(os.getpid(),signal.SIGKILL)
'''
            parent=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/barrage-guard.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            out,err=parent.communicate(timeout=9)
            self.assertEqual(parent.returncode,-9,(out,err))
            c.save('death-parent-wait.json',dict(pid=parent.pid,exit=parent.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
            pid=c.read('death-arm-ready.json')['pid']
            waited,status=os.waitpid(pid,0)
            c.save('death-release-actual-wait.json',dict(pid=waited,exit=os.waitstatus_to_exitcode(status),actualWait=True,
                stdoutEOF=True,stderrEOF=True,inheritedPipesDrainedByActualParentCommunicate=True))
            self.assertEqual(os.waitstatus_to_exitcode(status),0)
            self.assertEqual(c.read('death-up.json')['state'],'ACK')
            self.assertTrue(c.read('death-release-fired.json')['channelEOF'])
        finally: summary=self.finish()
        down=next(e for e in summary['effects'] if e['kind']=='DOWN')
        up=next(e for e in summary['effects'] if e['kind']=='UP')
        self.assertLess(up['at']-down['at'],1800)

    def test_mission_commands_actual_cli_no_pause(self):
        original_save=b.p.b.save
        def save(out,name,value):
            if name=='recipe.json':value={**value,'seconds':240}
            return original_save(out,name,value)
        native_bind=c.bind
        def instrumented_bind():
            c.call(dict(action='eval',code="""for(const [method,kind] of [['handleMouseDown','MOUSEDOWN'],['handleMouseUp','MOUSEUP']]){const original=renderer[method];renderer[method]=function(...args){const result=original.apply(this,args);persistenceEffects.push({kind,at:Date.now(),args});return result}};const take=renderer.checkInput;renderer.checkInput=function(...args){const result=take.apply(this,args);if(result)persistenceEffects.push({kind:'DEQUEUE',at:Date.now(),event:{msg:result.msg,x:result.mouseX,y:result.mouseY}});return result};true"""))
            native_bind()
        with patch.object(b.p.b,'save',save),patch.object(c,'bind',instrumented_bind):self.start('mission-policy')
        try:
            c.save('mission-admitted.json',dict(fixture=True))
            start=c.call(dict(action='snapshot'))
            nonces=[]
            for i,kind in enumerate(('train','gather','gather')):
                mode='target' if i==2 else 'command';scene='scene'+str(i);name='order'+str(i)
                c.capture(scene);rr=c.read(scene+'.json')
                c.save(scene+'-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],submittedScene=True,
                    observation='Synthetic mission assertion in isolated Solitaire fixture', mode=mode,
                    sceneType='mission',unobstructedMission=True,completeWorldReview='Fixture world, not a game claim',
                    visibleObjectives='Fixture objective',pauseState='not-observed',visibleTarget='Fixture pixel',
                    selectedUnitsEvidence='Fixture selected HUD',nativeCommandSemantics='Fixture '+kind,commandKind=kind,
                    selectedBuildingEvidence='Fixture command center',visibleTrainUnit='Fixture SCV',resourcesBefore='Fixture 250 minerals',
                    selectedWorkerEvidence='Fixture worker',activeCommandEvidence='Fixture Select Target',
                    visibleResourceTarget='Fixture mineral patch',commandIntent='order1',
                    pixelGeometry=dict(source='current-full-scene',target=c.read('native-pid.json'),chosenCenter=[240,240])))
                args=[sys.executable,'-B',str(ROOT/'tools/starcraft-mission-controller.py'),mode,name,'mousedown:240:240','400',scene]
                child=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
                out,err=child.communicate(timeout=15)
                c.save(name+'-actual-controller-wait.json',dict(args=args,pid=child.pid,exit=child.returncode,
                    actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
                self.assertEqual(child.returncode,0,err.decode())
                self.assertTrue(c.read(name+'-receipt.json')['consumed'])
                self.assertEqual(c.read(name+'-up.json')['state'],'ACK')
                self.assertEqual(c.read(name+'-mission-order.json')['commandKind'],kind)
                self.assertFalse((c.R/(name+'-midpress.png')).exists())
                nonces.extend(c.read(name+'-intent.json')['nonces'])
            self.assertEqual(len(set(nonces)),3)
            end=c.call(dict(action='snapshot'))
            self.assertGreater(end['batch'],start['batch'])
            c.save('no-pause-control.json',dict(before=start,after=end,realTicks=True,
                nativePauseObserved=False,fixtureOnly=True,noFrozenClock=True))
            effects=c.call(dict(action='eval',code='persistenceEffects'))
            self.assertEqual(len([e for e in effects if e['kind']=='MOUSEDOWN']),3)
            self.assertGreaterEqual(len([e for e in effects if e['kind']=='DEQUEUE' and e['event']['msg']==513]),3)
            for down in [e for e in effects if e['kind']=='MOUSEDOWN']:
                up=next(e for e in effects if e['kind']=='MOUSEUP' and e['at']>=down['at'])
                self.assertLess(up['at']-down['at'],1750)
        finally:self.finish()

    def test_permanent_bind_and_foreign_socket_identity(self):
        self.start('mission-identity')
        try:
            owner=c.read('input-owner.json')
            with self.assertRaisesRegex(AssertionError,'already bound'):c.bind()
            self.assertEqual(c.read('input-owner.json'),owner)
            with self.assertRaisesRegex(AssertionError,'sticky'):c.capture('after-rebind-refusal')
            with self.assertRaises(AssertionError):c.endpoint_identity(dict(pid=os.getpid()))
        finally:self.finish()


# The same inherited-pipe/subreaper proof also runs against the light HTTP
# endpoint, before qualification of any actual game consumer is permitted.
MissionHTTP.test_parent_death_actual_http = Production.test_parent_kill_uses_1750ms_cap

if __name__=='__main__':
    if '--production' in sys.argv:
        # Deliberately omit the inherited 1500ms midpress-capture fixture.
        names=['test_timely_ack_slow_parent_and_release_fsync']+[n for cls in (b.p.Production,b.Production,Production)
            for n in cls.__dict__ if n.startswith('test_') and n!='test_original_play_keys_and_1500ms']
        suite=unittest.TestSuite(Production(n) for n in dict.fromkeys(names))
    else:
        suite=unittest.TestSuite([*(b.r.Refusal(n) for n in b.r.Refusal.__dict__ if n.startswith('test_')),
            *(b.t.Terminal(n) for n in b.t.Terminal.__dict__ if n.startswith('test_')),
            *(MissionHTTP(n) for n in MissionHTTP.__dict__ if n.startswith('test_'))])
    raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful())
