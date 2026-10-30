import pathlib,json,hashlib,sys
from controller import Controller,ZERO
from feedback import observe
R=pathlib.Path(__file__).parent
aim=observe('/tmp/madbomber-original-gameover-restart-runtime-oct30/images/aim.png')
score=observe('/tmp/madbomber-original-gameover-restart-runtime-oct30/images/scored80.png')
assert aim['bombs'][0]['x']==305 and aim['buckets']==2 and aim['scorePixelsSHA256']==ZERO
assert score['scorePixelsSHA256']!=ZERO
traces={}
for case in ['catch-reset','no-catch-deadline']:
 c=Controller();sent=[]
 for n in range(1491):
  t=n/10;obs=None
  if n%7==0 and t>=12:
   obs=aim if t<20 or case=='no-catch-deadline' else score if t<25 else dict(score,buckets=0)
  for e in c.tick(t,obs):sent.append({'at':t,**e})
 assert all(e.get('cmd','').split(':')[0] in ('','keydown','keyup','mousemove') for e in sent)
 assert not any('eval' in e or e.get('action')=='quit' for e in sent)
 assert max(e['at'] for e in sent)<150
 assert any(e.get('cmd')=='mousemove:305:400' for e in sent)
 if case=='catch-reset':assert c.scored and c.ended
 else:assert not c.scored and not c.ended and c.transition>=112
 traces[case]={'scored':c.scored,'gameover':c.ended,'transition':c.transition,'dispatch':sent}
receipt={'PASS':True,'clock':'virtual 0..149 in0.1s ticks; actual image decoder, production Controller','traces':traces,'pins':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [R/'controller.py',R/'feedback.py',R/'adaptive-runtime.py']}}
(R/'controller-dryrun.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
