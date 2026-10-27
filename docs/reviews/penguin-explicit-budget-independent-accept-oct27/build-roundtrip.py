import importlib.util,json,hashlib
from pathlib import Path
R=Path('/tmp/penguin-explicit-budget-independent-accept-oct27');D=Path('/tmp/penguin-explicit-capture-budget-repair-oct27/repo')
s=importlib.util.spec_from_file_location('candidate',D/'tools/penguin_capture_contract.py');c=importlib.util.module_from_spec(s);s.loader.exec_module(c)
root=R/'ops/evidence/production';root.mkdir()
original=Path('/tmp/penguin-visible-projectile-gameplay-oct27/repo/docs/re-notes/penguin-visible-projectile-gameplay-20261027/decision')
images=[original/'b39999.png',original/'b40060.png']
env=json.loads((D/'test/fixtures/penguin-wire-envelope.json').read_bytes())
plan=c.plan_provider_images(images,used=333,tail_reserve=1048576,capture_budget=8388608)
entries=[];frames=[]
for i,record in enumerate(plan['records']):
 e=dict(env,stdout=c.wire(record).decode()+'\n',commandId='cmd_offline_'+str(i),startMs=i,noticedMs=i+1)
 raw=json.dumps(dict(reversed(list(e.items()))),indent=1).encode()
 (root/f'{i}.json').write_bytes(raw);entries.append(dict(kind='capture',path=f'{i}.json'));frames.append(raw)
terminal=b'{"terminal":"'+b'x'*(1048576-15)+b'"}'
(root/'terminal.json').write_bytes(terminal);entries.append(dict(kind='account',path='terminal.json'))
(root/'transcript.json').write_bytes(c.wire(entries))
assert len(frames)==191 and sum(map(len,frames))==2130054 and len(terminal)==1048576
receipt=dict(previous=333,rawCaptureBytes=sum(map(len,frames)),terminal=len(terminal),total=333+sum(map(len,frames))+len(terminal),planTotal=plan['total'],images=plan['canonical']['images'],frames=[dict(path=f'{i}.json',size=len(raw),sha256=c.sha(raw)) for i,raw in enumerate(frames)],terminalSHA256=c.sha(terminal))
assert receipt['total']==3178963
(root/'expected.json').write_text(json.dumps(receipt,indent=2));print('PASS exact offline production fixture 191 full envelopes; 3178963 bytes incl previous and terminal')
