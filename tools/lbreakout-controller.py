"""Manual original LBreakout input with an irreversible 150-second Quit reserve.

Uses the shared permanent-owner/independent-release controller. This adapter
does not choose moves, inspect ball coordinates or deliver gameplay loops.
"""
import importlib.util, pathlib, os, sys, time

spec=importlib.util.spec_from_file_location('controller',pathlib.Path(__file__).with_name('forsaken-controller.py'))
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
ROUTES={'leave-game':'keydown:27','confirm-leave':'keydown:89',
        'leave-submenu':'keydown:27','highlight-quit':'keydown:40',
        'highlight-quit-up':'keydown:38','main-quit':'keydown:13'}

def cutoff():
 launch=c.read('launch.json')
 end=launch['deadline']-150
 assert launch['at']<end,'150-second reserve must precede original launch'
 return end

def policy(keys,review,route=None,beforeArm=False):
 end=cutoff()
 if route is not None or time.time()>=end:
  if not (c.R/'quit-phase.json').exists():
   c.save('quit-phase.json',dict(at=time.time(),cutoff=end,irreversible=True,reserveSeconds=150))
 if route is not None:
  assert route in ROUTES and keys==[ROUTES[route]],'ordinary Escape/Y/submenu/main Quit route only'
  assert c.read(review+'-review.json').get('quitRoute')==route,'personal review must bind Quit route'
 else:
  assert len(keys)==1 and keys[0] in {'keydown:13','keydown:32','keydown:37','keydown:38','keydown:39','keydown:40','keydown:80'},'manual LBreakout menu/paddle/serve/P only'
  assert not (c.R/'quit-phase.json').exists(),'irreversible Quit phase; no gameplay'
  assert time.time()+(8 if beforeArm else 0)<end,'gameplay cutoff; retain Quit reserve'
 return end

def pulse(name,keys,ms,review,observation,route=None,aim=False,final=False):
 policy(keys,review,route,True)
 original=c.call
 def checked(command,timeout=10):
  if command.get('action')=='guarded-input':
   end=policy(keys,review,route)
   if route is None:
    command={**command,'guard':{**command['guard'],'deadline':min(command['guard']['deadline'],int(end*1000))}}
  return original(command,timeout)
 c.call=checked
 try:return c.pulse(name,keys,ms,review,observation,final=final,maxSceneAge=5 if aim else 30)
 finally:c.call=original

if __name__=='__main__':
 mode=sys.argv[1]
 if mode=='capture':print(c.capture(sys.argv[2]))
 elif mode=='bind':cutoff();c.bind()
 elif mode in ('act','quit'):
  _,_,name,key,ms,review,observation,*flags=sys.argv
  route=flags[0] if mode=='quit' else None
  rr=c.read(review+'.json')
  c.save(review+'-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],observation=observation,quitRoute=route))
  print(pulse(name,[key],int(ms),review,observation,route=route,aim='aim' in flags,final='final' in flags))
 else:raise ValueError(mode)
