from admit import *
import re
E=H/'repo/docs/re-notes/penguin-command-scheduled-input-gameplay-20261024'
checks=[]
for x in json.loads((E/'collection-seals.json').read_text()):
 b=(E/x['path']).read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256'];checks.append(x['path'])
t=json.loads((E/'run/terminal.json').read_text());assert t['returncode']==0 and not any(t[x] for x in ['TERM','KILL','remainingGroup'])
log=(E/'run/output.log').read_text();events=json.loads((E/'scheduled-inputs.json').read_text())
for ev in events:
 batch,action,*args=ev.split(':');assert f'at batch {batch}' in log,ev
 if action=='png':assert pathlib.Path(':'.join(args)).name in log
 elif action in ['keydown','keyup']:assert f'[input] {action} vk={args[0]} at batch {batch}' in log
 else:assert f'[input] {action} {args[0]},{args[1]} at batch {batch}' in log
assert len(re.findall('DllMain returned, EAX=0x1',log))==7
assert '200000 batches in 7.136s' in log and len(log.encode())<524288
pre=json.loads((E/'preflight.json').read_text());assert pre['files']==287 and pre['bytes']==15719953 and pre['codec']['pass'] and pre['regionStamp']=='9a3bc9149d58209c'
abi=json.loads(json.loads((E/'abi-instantiation-api.json').read_text())['stdout']);assert abi['pass'] and abi['imports']==291 and abi['arenaBytes']==536870912 and abi['shared']
tr=json.loads((E/'transfer-receipts.json').read_text());assert len(tr)==431 and max(x['requestBytes'] for x in tr)<=36000
images=json.loads((E/'image-identities.json').read_text());assert images['later.png']['sha256']==images['final-scheduled.png']['sha256']==images['exit.png']['sha256']
save('validation.json',dict(passValidation=True,sealedCollectedFiles=len(checks),scheduledActions=len(events),scheduledPNGs=sum(':png:' in x for x in events),outputBytes=len(log.encode()),visualReview='menu, Score160 Wave Scoring, Score240 Starting Wave2, Hiscores and returned menu reviewed; stable last three frames byte-identical',causalFiringVerified=False,singleGuestRun=True))
print((H/'validation.json').read_text())
