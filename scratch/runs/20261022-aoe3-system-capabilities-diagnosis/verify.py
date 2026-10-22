from pathlib import Path
import json,hashlib,copy
E=Path(__file__).resolve().parent
seals=json.loads((E/'remote-seals.json').read_text())
def check(b,r):assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256']
for n,r in seals.items():
 p=E/n
 if p.exists():check(p.read_bytes(),r)
d=json.loads((E/'guest/excerpts.json').read_text())
def validate(d):
 for r in d['samples']:check(r['text'].encode(),r)
 texts=[r['text'] for r in d['samples']]
 def hit(eip,eax):assert any('[EIP] '+eip+' ' in t and 'EAX='+eax+' ' in t for t in texts)
 hit('0x01aaee99','0x80040154');hit('0x01aafc25','0x00000000')
 assert any('[EIP] 0x01aaedfb ' in t and 'EDX=0x00040008' in t and 'b=0x00040009' in t for t in texts)
 assert any('[TRACE-AT #1]' in t and 'EIP=0x00488b05 EAX=0x00000000' in t and 'prev_eip=0x01aaee0b' in t for t in texts)
 assert any('GetProcAddress(mod=h:0x01aa7000, name="Config_InitVideoCardInfo")' in t for t in texts)
validate(d)
for label,mutate in [('return',lambda d: next(r for r in d['samples'] if '[EIP] 0x01aaee99 ' in r['text']).update(text='forged S_OK')),('truncation',lambda d: d['samples'][-1].update(text=d['samples'][-1]['text'][:-1]))]:
 x=copy.deepcopy(d);mutate(x)
 try:validate(x)
 except AssertionError:print('REJECT',label)
 else:raise AssertionError('accepted mutation')
b=(E/'guest/post-accept.png').read_bytes()
try:check(b[:-1]+bytes([b[-1]^1]),seals['guest/post-accept.png'])
except AssertionError:print('REJECT changed screenshot')
else:raise AssertionError('accepted screenshot mutation')
assert json.loads((E/'guest/exit.json').read_text())['exitCode']==0
assert json.loads((E/'guest/accept.json').read_text())['ordinaryAcceptAttempts']==1
print('PASS compact remote seals, excerpt integrity, exact observed HRESULT/version/failed comparison/caller return, ordinary Accept count, clean guest exit; 3 negative controls reject')
