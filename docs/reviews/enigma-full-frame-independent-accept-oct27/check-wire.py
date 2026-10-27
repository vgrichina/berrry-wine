import pathlib,json,hashlib
H=pathlib.Path(__file__).parent;results=[]
for root in sorted((H/'independent').iterdir()):
 if not root.is_dir():continue
 rows=[json.loads(x) for x in (root/'launch/controller/requests.jsonl').read_text().splitlines()]
 steps=0;inputs=0
 for i,r in enumerate(rows):
  if i:assert rows[i-1]['ended']<=r['at'],(root,'overlap')
  cmd=r['request'];v=json.loads(r['originalResponse'])['value']
  if cmd.get('action')=='step':
   steps+=1;n=cmd['n'];assert v['ran']==v['steps']==n and v['batch']==r['startingBatch']+n and v['frozen'] is True
   following=rows[i+1];assert following['request']==dict(action='snapshot')
   f=json.loads(following['originalResponse'])['value'];assert f['batch']==v['batch'] and f['frozen']['frozen'] is True and f['frozen']['credits']==0
  if 'cmd' in cmd:
   inputs+=1
   prev=rows[i-1];assert prev['request']==dict(action='snapshot')
   f=json.loads(prev['originalResponse'])['value'];assert f['frozen']['credits']==0 and f['frozen']['frozen'] is True
 assert inputs==int(root.name.startswith('positive-'))
 results.append(dict(case=root.name,steps=steps,inputs=inputs,serial=True,fullACK=True,followingFrozenZero=True,traceSHA256=hashlib.sha256((root/'launch/controller/requests.jsonl').read_bytes()).hexdigest()))
o=json.loads((H/'first-boundary/boundary.json').read_text())
assert not o['outcome']['clicked'] and o['outcome']['reviewSecondsUsed']>=2 and len(o['reviews'])==1 and not o['supervisor']['remainingOwnedLive']
(H/'wire-check.json').write_text(json.dumps(dict(originalFirstBoundary='PASS unchanged oracle interpretation: zero inputs; slot exhausted',independent=results),indent=2))
print('All twelve raw request/response traces: serial full ACK and subsequent frozenzero; both positives exactly one input; original unchanged boundary zero input')
