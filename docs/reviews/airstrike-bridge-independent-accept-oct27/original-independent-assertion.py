#!/usr/bin/env python3
"""Independent stdlib-only fake transport acceptance; never gameplay evidence."""
import hashlib,importlib.util,json,os,pathlib,sys,threading,time,unittest
P=pathlib.Path
ROOT=P(__file__).resolve().parents[1]
PINS={'tools/airstrike-observation-bridge.py':'72df7a6e70d41bb3bb6c659e43b73f053bea1269c1b1a134f4060976a7d5f65f','test/test-airstrike-observation-bridge.py':'c562351c185554f174a3c48cbc36199133586bda2c72414b44df670b88f888dc','tools/airstrike-menu-controller.py':'e96344c2a89dba87c28eba0aba9cd3ea5b400cc0245734b2bbc9248e110e7ebb','test/test-airstrike-menu-controller.py':'0dbcef01a53836b7acd2127d93087ae154225b519d16fe4cca1172b964f8bfb6'}
for path,digest in PINS.items():assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest,path

def runner(base,mode):
 base=P(base);row=None;captures=0;keys=0
 print('independent stdout startup',flush=True)
 print('independent stderr startup',file=sys.stderr,flush=True)
 if mode=='review-terminal':
  def end():
   time.sleep(.15);print('[Exit] code=0',flush=True);os._exit(0)
  threading.Thread(target=end,daemon=True).start()
 for line in sys.stdin:
  c=json.loads(line)
  with (base/'commands.jsonl').open('a') as f:f.write(json.dumps(c)+'\n')
  action=c.get('action')
  if action=='snapshot':
   v=dict(focus='0x10001',mainHwnd='0x10001',quit=False,batch=13,screen=dict(w=800,h=600),windows=[dict(hwnd='0x10001',visible=True,title='Airstrike independent FAKE')])
   if mode=='window-identity' and captures>=2:v['windows'][0]['title']='Airstrike replacement FAKE'
  elif action=='png':
   captures+=1;data=('FAKE pixels row='+str(row)).encode();P(c['path']).write_bytes(data);v=dict(path=c['path'],bytes=len(data),batch=13)
   if mode=='capture-ack':v['bytes']+=1
  else:
   keys+=1;kind,key=c['cmd'].split(':')
   if mode=='partial-ack':
    print('[ctl] {"id":',end='',flush=True)
    continue
   if mode=='late-stderr' and keys==1:
    print('Fatal error: independent post-input failure',file=sys.stderr,flush=True)
   if mode=='stream-cap' and keys==1:
    sys.stderr.write('s'*(2*1024*1024));sys.stderr.flush()
   if kind=='keydown':
    if key=='27':row=0
    elif key=='40':row+=1
    elif key=='13':
     assert row==6
     if mode!='no-host-exit':print('[Exit] code=0',flush=True)
     print('independent stderr terminal',file=sys.stderr,flush=True)
     return
   v=dict(batch=13,logs=[f'[input] {kind} vk={key} at batch 13'])
   if mode=='queued-ack' and keys==1:v['queued']=True
   if mode=='wrong-log' and keys==1:v['logs']=['[input] keydown vk=13 at batch 13']
  ack=dict(id=c['id'],ok=True,value=v)
  print('[ctl] '+json.dumps(ack),flush=True)
  if mode=='duplicate-ack' and keys==1:print('[ctl] '+json.dumps(ack),flush=True)

if len(sys.argv)>1 and sys.argv[1]=='--runner':
 runner(sys.argv[2],sys.argv[3]);raise SystemExit

s=importlib.util.spec_from_file_location('actual_bridge',ROOT/'tools/airstrike-observation-bridge.py');bridge=importlib.util.module_from_spec(s);s.loader.exec_module(bridge)
BASE=P(os.environ['AIRSTRIKE_INDEPENDENT_FIXTURES']);BASE.mkdir(exist_ok=True)

class Acceptance(unittest.TestCase):
 def exercise(self,name,mode='normal',review='normal',seconds=30):
  d=BASE/name;d.mkdir()
  obj=bridge.Bridge([sys.executable,'-B',str(P(__file__).resolve()),'--runner',str(d),mode],ROOT/'tools/airstrike-menu-controller.py',d/'evidence',guest_seconds=seconds)
  done=threading.Event();errors=[]
  def reviewer():
   seen=set()
   try:
    while not done.wait(.005):
     req=obj.root/'review-request.json'
     if not req.exists():continue
     q=json.loads(req.read_text());token=q['token']
     if token in seen:continue
     seen.add(token)
     if review=='none':continue
     if review=='delay-menu' and q['after']=='airstrike-2':
      if done.wait(11):return
     if review=='deadline-menu' and q['after']=='airstrike-2':
      if done.wait(.8):return
     idx=None if q['after'] is None else int(q['after'].split('-')[-1])//2-1
     o=dict(after=q['after'],focus='airstrike',keysReleased=True,unobscured=True,state='gameplay' if idx is None else 'menu',evidence='independent FAKE '+q['sha256'])
     if idx is not None:o.update(header='Airstrike menu',items=list(obj.module.ITEMS),selected=idx)
     if review=='labels' and idx is not None:o['items'][5]='Quit game'
     reply={k:q[k] for k in ('session','token','sha256','after')};reply['observation']=o
     if review=='stale-inner' and idx is not None:o['after']='airstrike-0'
     if review=='session':reply['session']='old-session'
     bridge.save(obj.root/('review-'+token+'.json'),reply)
   except Exception as e:errors.append(repr(e))
  t=threading.Thread(target=reviewer);t.start()
  try:r=obj.run()
  finally:done.set();t.join(2)
  self.assertFalse(t.is_alive());self.assertEqual(errors,[]);self.assertTrue(r['cleanup']['complete']);self.assertEqual(r['cleanup']['remaining'],[])
  commands=[json.loads(x) for x in (d/'commands.jsonl').read_text().splitlines()]
  inputs=[x['cmd'] for x in commands if 'cmd' in x]
  self.assertEqual(r['controllerSHA256'],PINS['tools/airstrike-menu-controller.py']);self.assertEqual(r['responseSeconds'],10)
  self.assertIn(b'stdout startup',(obj.root/'runner.stdout').read_bytes());self.assertIn(b'stderr startup',(obj.root/'runner.stderr').read_bytes())
  self.assertNotIn(b'stderr startup',(obj.root/'runner.stdout').read_bytes());self.assertNotIn(b'stdout startup',(obj.root/'runner.stderr').read_bytes())
  return obj,r,inputs
 def test_00_boundary_delayed_review_serial_input_exit_zero_rejected(self):
  o,r,inputs=self.exercise('boundary',mode='no-host-exit',review='delay-menu')
  self.assertEqual(r['status'],'refused');self.assertIn('normal Quit unproven',r['reason'])
  self.assertEqual(inputs,['keydown:27','keyup:27']+['keydown:40','keyup:40']*6+['keydown:13'])
  starts={e['token']:e['elapsed'] for e in o.events if e['kind']=='review-start'}
  gaps=[e['elapsed']-starts[e['token']] for e in o.events if e['kind']=='response-start']
  self.assertGreater(max(gaps),10);self.assertEqual(r['cleanup']['signals'],[])
 def test_deadline_after_successful_escape_no_reset(self):
  _,r,inputs=self.exercise('deadline',review='deadline-menu',seconds=.5)
  self.assertEqual(inputs,['keydown:27','keyup:27']);self.assertEqual(r['status'],'refused');self.assertIn('overall guest deadline',r['reason']);self.assertLess(r['elapsed'],2)
 def test_exit_zero_pending_review_is_not_quit(self):
  _,r,inputs=self.exercise('terminal',mode='review-terminal',review='none')
  self.assertEqual(inputs,[]);self.assertEqual(r['status'],'refused');self.assertIn('exited during factual review',r['reason'])
 def test_partial_input_ack_deadline_without_replay(self):
  _,r,inputs=self.exercise('partial',mode='partial-ack',seconds=.5)
  self.assertEqual(inputs,['keydown:27']);self.assertEqual(r['status'],'refused');self.assertIn('overall guest deadline',r['reason'])
 def test_queued_input_ack_no_key_release(self):
  _,r,inputs=self.exercise('queued',mode='queued-ack');self.assertEqual(inputs,['keydown:27']);self.assertIn('uncertain/rejected',r['reason'])
 def test_wrong_input_log_no_key_release(self):
  _,r,inputs=self.exercise('log',mode='wrong-log');self.assertEqual(inputs,['keydown:27']);self.assertIn('uncertain/rejected',r['reason'])
 def test_duplicate_ack_stops_stream(self):
  _,r,inputs=self.exercise('duplicate',mode='duplicate-ack');self.assertEqual(inputs,['keydown:27']);self.assertIn('unmatched/duplicate',r['reason'])
 def test_window_identity_same_focus_and_pixels_rejected(self):
  _,r,inputs=self.exercise('identity',mode='window-identity');self.assertEqual(inputs,[]);self.assertIn('changed across capture',r['reason'])
 def test_matching_outer_stale_inner_after_rejected(self):
  _,r,inputs=self.exercise('inner',review='stale-inner');self.assertEqual(inputs,['keydown:27','keyup:27']);self.assertIn('stale/unmatched',r['reason'])
 def test_full_labels_required_after_escape(self):
  _,r,inputs=self.exercise('labels',review='labels');self.assertEqual(inputs,['keydown:27','keyup:27']);self.assertIn('insufficient-observation',r['reason'])
 def test_wrong_session_rejected(self):
  _,r,inputs=self.exercise('session',review='session');self.assertEqual(inputs,[]);self.assertIn('stale/unmatched',r['reason'])
 def test_capture_ack_size_mismatch_rejected(self):
  _,r,inputs=self.exercise('capture',mode='capture-ack');self.assertEqual(inputs,[]);self.assertIn('capture file/ACK mismatch',r['reason'])
 def test_stderr_fault_after_input_rejected(self):
  _,r,inputs=self.exercise('stderr',mode='late-stderr');self.assertEqual(r['status'],'refused');self.assertEqual(inputs,['keydown:27']);self.assertIn('runner fault/timeout',r['reason'])
 def test_distinct_stream_cumulative_cap(self):
  o,r,inputs=self.exercise('cap',mode='stream-cap');self.assertEqual(r['status'],'refused');self.assertEqual(inputs,['keydown:27']);self.assertIn('aggregate output bound',r['reason']);self.assertEqual(sum((o.root/('runner.'+s)).stat().st_size for s in ('stdout','stderr')),2*1024*1024)

if __name__=='__main__':unittest.main(verbosity=2)
