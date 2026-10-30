"""Ordinary input only. All decisions consume time and rendered observations."""
ZERO='41368638b2f28648a56ae98a8131dbeda4e8175e63349045f3a53c79d21b4c2b'
class Controller:
 def __init__(self):
  self.queue=[(6,{'cmd':'keydown:13'}),(6.2,{'cmd':'keyup:13'}),(8,{'cmd':'mousemove:320:400'}),(11,{'cmd':'keydown:32'}),(11.2,{'cmd':'keyup:32'})]
  self.phase='catch';self.scored=False;self.ended=False;self.zeroAt=None;self.lastSpace=11;self.transition=None;self.lastAim=None
 def tick(self,t,obs=None):
  out=[]
  if obs and t>=12 and self.transition is None:
   if self.phase=='catch':
    if obs['buckets']>0 and obs['scorePixelsSHA256']!=ZERO:
     self.scored=True;self.phase='miss';out+=[{'save':'scored.png'},{'cmd':'mousemove:0:400'}]
    elif t>=50:self.phase='miss';out.append({'cmd':'mousemove:0:400'})
    elif obs['bombs']:
     aim=max(30,min(610,obs['bombs'][0]['x']))
     if aim!=self.lastAim:out.append({'cmd':f'mousemove:{aim}:400'});self.lastAim=aim
   if (self.phase=='miss' or (t>=20 and not obs['bombs'])) and t-self.lastSpace>=7:
    out.append({'cmd':'keydown:32'});self.queue.append((t+.2,{'cmd':'keyup:32'}));self.lastSpace=t
   if obs['buckets']==0:self.zeroAt=self.zeroAt or t
   else:self.zeroAt=None
   if (self.zeroAt is not None and t-self.zeroAt>=5 and t>=30) or t>=112:
    self.transition=t;self.ended=self.zeroAt is not None and t-self.zeroAt>=5
    out.append({'save':'gameover.png'})
    for dt,key in [(1,27),(4,13),(9,27),(11,40),(11.6,40),(12.2,40),(12.8,40),(13.4,40),(17,13)]:
     self.queue.extend([(t+dt,{'cmd':f'keydown:{key}'}),(t+dt+.2,{'cmd':f'keyup:{key}'})])
    self.queue.extend([(t+3,{'capture':'title.png'}),(t+6,{'capture':'newgame.png'}),(t+16,{'capture':'exit-selected.png'})])
  self.queue.sort(key=lambda x:x[0])
  while self.queue and self.queue[0][0]<=t:out.append(self.queue.pop(0)[1])
  assert t<=150,'guest deadline exceeded'
  return out
