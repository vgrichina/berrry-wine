"""Full controller against authored native SDL through production batch PNGs.
Requires LMARBLES_MODULE_HOLDER and LMARBLES_SETTLE_TEST_OUT. No original game.
Faults are confined to this authored consumer's transport/presentation.
"""
import importlib.util,json,os,pathlib,socket,subprocess,sys,time,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('c',ROOT/'tools/lmarbles-controller.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
OUT=pathlib.Path(os.environ['LMARBLES_SETTLE_TEST_OUT']).resolve()
BOOT=r"""
const fs=require('node:fs'),rows=[];let active=null,afterInput=false,repaints=0;
const mark=(phase,extra={})=>{if(rows.length<256)rows.push({phase,at:Date.now(),ms:performance.now(),...extra});};
process.once('exit',()=>fs.writeFileSync(process.env.LMARBLES_SETTLE_PHASES,JSON.stringify(rows)));
const hi=require('./lib/host-imports'),oldHi=hi.createHostImports;
hi.createHostImports=(...args)=>{const v=oldHi(...args),old=v.gdi.presentBestDxOffscreen;
 v.gdi.presentBestDxOffscreen=function(...a){if(active)mark('dirty-present-enter',{force:a[0]});const r=old.apply(this,a);if(active)mark('dirty-present-return');return r;};return v;};
const {Win98Renderer}=require('./lib/renderer'),rp=Win98Renderer.prototype.repaint;
Win98Renderer.prototype.repaint=function(...a){if(active){mark('repaint-enter');repaints++;
 if(afterInput&&process.env.LMARBLES_SETTLE_FAULT==='no-presentation'&&repaints===2)throw Error('authored capture presentation refusal');}
 const r=rp.apply(this,a);if(active)mark('repaint-return');return r;};
const raster=require('./lib/raster-canvas'),cc=raster.createCanvas;
raster.createCanvas=(...a)=>{const v=cc(...a);if(a[0]===1024&&a[1]===712){const enc=v.toBufferSync;v.toBufferSync=function(...b){if(active)mark('encode-enter');const r=enc.apply(this,b);if(active)mark('encode-return',{bytes:r.length});return r;};}return v;};
const wr=fs.writeFileSync;
fs.writeFileSync=function(file,...a){const selected=active&&String(file)===active;if(selected)mark('write-enter');const r=wr.call(this,file,...a);if(selected)mark('write-return');return r;};
const transport=require('./lib/control-server'),start=transport.startControlServer;
transport.startControlServer=options=>start({...options,onCommand(command){
 if(command.action==='guarded-input'){
  afterInput=true;
  if(process.env.LMARBLES_SETTLE_FAULT==='refusal')options.onCommand({action:'eval',code:'exports.set_focus(0)'});
 }
 if(command.cmd?.startsWith('png:')){active=command.cmd.slice(4);repaints=0;mark('queued-png-enter');}
 const result=options.onCommand(command);
 if(command.cmd?.startsWith('png:'))return Promise.resolve(result).then(value=>{
  mark('queued-png-complete',{batch:value.batch});active=null;
  if(afterInput&&process.env.LMARBLES_SETTLE_FAULT==='late')return new Promise(resolve=>setTimeout(()=>resolve(value),3100));return value;
 });
 return result;
}});
process.argv=['node','test/run.js',...process.argv.slice(1)];require('./test/run.js');
"""
class Queued(unittest.TestCase):
 def start(self,name):
  self.out=OUT/name;self.out.mkdir(parents=True);c.R=self.out;self.intent='press'
  fixture=json.loads(os.environ['LMARBLES_SETTLE_FIXTURE_JSON']) if os.environ.get('LMARBLES_SETTLE_FIXTURE_JSON') else json.loads(subprocess.check_output(['node','test/test-ltris-sdl-keyboard.cjs'],cwd=ROOT))
  c.save('authored-fixture.json',fixture)
  with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
  c.URL='http://127.0.0.1:'+str(port)+'/ctl'
  env=dict(os.environ,LMARBLES_CONTROL_OUT=str(self.out),LMARBLES_CONTROL_URL=c.URL,
    LMARBLES_SETTLE_FAULT=name,LMARBLES_SETTLE_PHASES=str(self.out/'phases.json'),WINE_CONTROL_PHASE_TRACE=str(self.out/'http-phases.json'))
  os.environ.update(LMARBLES_CONTROL_OUT=str(self.out),LMARBLES_CONTROL_URL=c.URL)
  args=['node','-e',BOOT,'--','--exe='+fixture['file'],'--no-build','--threads','--real-ticks','--screen=1024x712',
    '--max-seconds=40','--max-batches=10000000','--control='+str(port),'--quiet-api','--quiet-blocks','--no-close']
  if os.environ.get('LMARBLES_SETTLE_DRIVER'):args+=['--env=SDL_VIDEODRIVER='+os.environ['LMARBLES_SETTLE_DRIVER']]
  media=ROOT/'test/binaries/candidates/lmarbles-108/game/LMARBLES'
  args+=['--dll-seed='+str(media/n) for n in ('SDL.dll','libgcc_s_sjlj-1.dll','libwinpthread-1.dll')]
  args+=['--dll-seed='+str(ROOT/'test/binaries/dlls/msvcrt.dll')]
  c.save('recipe.json',dict(cwd=str(ROOT),args=args,seconds=340,reserveSeconds=300,watchdogGrace=2,nativeScene=True,
   inputPolicy=dict(confirmationMs=500,physicalUpMs=1750,observationMs=3000,gameFreshnessSeconds=5,menuFreshnessSeconds=30),moduleHolder=os.environ['LMARBLES_MODULE_HOLDER']))
  self.p=subprocess.Popen([sys.executable,'-B','tools/lmarbles-supervisor.py','durablewait',str(self.out)],cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  self.addCleanup(self.finish)
  end=time.monotonic()+20
  while True:
   try:
    s=c.call({'action':'snapshot'},1)
    if s['mainHwnd']!='0x0' and s['focusWindow']['live'] and s['physicalUp']:break
   except Exception:pass
   assert time.monotonic()<end,'authored SDL startup';time.sleep(.02)
  c.capture('fresh');r=c.read('fresh.json')
  c.save('fresh-review.json',dict(at=time.time(),pngSHA256=r['pngSHA256'],scene='game',observation='Automated authored SDL fixture review only'))
  c.bind('fresh')
 def finish(self):
  # Never query a terminal input context, even for teardown.
  if not (self.out/'cancel-request.json').exists():c.save('cancel-request.json',dict(at=time.time(),reason='authored fixture complete',nativeQuit=False))
  a,b=self.p.communicate(timeout=20)
  c.save('tool-wait.json',dict(pid=self.p.pid,exit=self.p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
  self.assertEqual(self.p.returncode,0)
  for name in ('native-wait.json','watchdog-wait.json','outer-child-wait.json','outer-wait.json'):
   w=c.read(name);self.assertEqual(w['exit'],0);self.assertTrue(w['actualWait'] and w['stdoutEOF'] and w['stderrEOF'])
  phases=c.read('phases.json');self.assertTrue(any(r['phase']=='queued-png-complete' for r in phases))
  if os.environ.get('LMARBLES_SETTLE_DRIVER')=='directx':
   self.assertTrue(any(r['phase']=='dirty-present-enter' and r['force'] is True for r in phases))
   for i,row in enumerate(phases):
    if row['phase']=='encode-enter':
     start=max(j for j in range(i) if phases[j]['phase']=='queued-png-enter')
     self.assertIn('dirty-present-return',[r['phase'] for r in phases[start:i]])
  c.save('assertions.json',dict(fullController=True,productionQueuedPNG=True,normalGuestBatches=True,wholeLosslessPixels=(self.out/'pixels.json').exists(),
   stickyClosed=(self.out/'terminal-input-failure.json').exists(),release=c.read(self.intent+'-up.json')['state'] if (self.out/(self.intent+'-up.json')).exists() else 'NOT_SENT',phaseCount=len(phases)))
 def pulse(self):
  review='fresh'
  for attempt in range(4):
   self.intent='press' if attempt==0 else 'press'+str(attempt)
   result=c.pulse(self.intent,['keydown:13'],100,review,'authored SDL Enter changes full native surface')
   if not result.startswith('NOT_SENT'):return result
   self.assertFalse((self.out/(self.intent+'-dispatch.json')).exists())
   review='retry'+str(attempt);c.capture(review);r=c.read(review+'.json')
   c.save(review+'-review.json',dict(at=time.time(),pngSHA256=r['pngSHA256'],scene='game',observation='Fresh automated authored fixture review after local NOT_SENT'))
  self.fail('four local NOT_SENT admissions; no delivery attempted')
 def closed(self):
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  with self.assertRaisesRegex(AssertionError,'sticky UNKNOWN'):c.opened()
 def test_positive(self):
  self.start('positive');self.pulse()
  op=c.read(self.intent+'-operation.json');result=c.read(self.intent+'.json');up=c.read(self.intent+'-up.json')
  self.assertLess(result['completedAt'],op['deadline']);self.assertEqual(op['deadline'],op['startedAt']+3)
  self.assertEqual(up['state'],'ACK');self.assertTrue(up['reply']['released'])
  self.assertLessEqual(up['at']-c.read(self.intent+'-dispatch.json')['at'],1.75)
  s=c.call({'action':'snapshot'});self.assertTrue(s['physicalUp']);self.assertEqual(s['capture'],'0x0')
  pixels=json.loads(subprocess.check_output(['node','-e',"const fs=require('fs'),{PNG}=require('pngjs');console.log(JSON.stringify(process.argv.slice(1).map(p=>{const v=PNG.sync.read(fs.readFileSync(p)),i=(200*v.width+400)*4;return {w:v.width,h:v.height,pixel:[...v.data.slice(i,i+4)]}})))",str(self.out/'fresh.png'),str(self.out/(self.intent+'.png'))],cwd=ROOT))
  self.assertEqual(pixels,[dict(w=1024,h=712,pixel=[0,0,0,255]),dict(w=1024,h=712,pixel=[0,255,0,255])]);c.save('pixels.json',pixels)
 def test_late(self):
  self.start('late')
  with self.assertRaises(Exception):self.pulse()
  self.assertEqual(c.read(self.intent+'-up.json')['state'],'ACK');self.closed()
 def test_no_presentation(self):
  self.start('no-presentation')
  with self.assertRaises(FileNotFoundError):self.pulse()
  self.assertFalse((self.out/(self.intent+'.png')).exists());self.assertEqual(c.read(self.intent+'-up.json')['state'],'ACK');self.closed()
 def test_refusal(self):
  self.start('refusal')
  with self.assertRaises(AssertionError):self.pulse()
  self.assertFalse(c.read(self.intent+'-receipt.json')['consumed']);self.assertEqual(c.read(self.intent+'-up.json')['state'],'ACK');self.closed()
if __name__=='__main__':unittest.main(verbosity=2)
