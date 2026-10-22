from pathlib import Path
import json,hashlib,struct,copy
E=Path(__file__).resolve().parent
def check(b,r):assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256']
seals=json.loads((E/'remote-seals.json').read_text())
for n,r in seals.items():
 if (E/n).exists():check((E/n).read_bytes(),r)
d=json.loads((E/'guest/excerpts.json').read_text())
def validate(d):
 for r in d['samples']:check(r['text'].encode(),r)
 def hit(eip,eax='0x00000000'):
  t=next(r['text'] for r in d['samples'] if '[EIP] '+eip+' ' in r['text']);assert 'EAX='+eax+' ' in t;return t
 def mem(t,addr):return struct.unpack_from('<I',bytes.fromhex(t.split('mem[0x074ff900:96]=')[1]),addr-0x074ff900)[0]
 assert mem(hit('0x01aaee99'),0x074ff92c)==0x018e1ff4
 hit('0x01aaeeda');hit('0x01aaeef9');hit('0x01aaef15')
 t=hit('0x01aaef3c');assert mem(t,0x074ff934)==0x13 and mem(t,0x074ff93c)==7
 t=hit('0x01aaef81');assert mem(t,0x074ff934)==0x13 and mem(t,0x074ff93c)==0
 hit('0x01aafc0d');t=hit('0x01aaedfb');assert 'a=0x00040007 b=0x00040009 res=0xfffffffe' in t
 assert any('[TRACE-AT #1]' in r['text'] and 'EIP=0x00488b05 EAX=0x00000000' in r['text'] and 'prev_eip=0x01aaee0b' in r['text'] for r in d['samples'])
validate(d)
for label,mutate in [('forged COM result',lambda x:x['samples'][next(i for i,r in enumerate(x['samples']) if '[EIP] 0x01aaee99 ' in r['text'])].update(text='forged')),('truncated excerpt',lambda x:x['samples'][-1].update(text=x['samples'][-1]['text'][:-1]))]:
 x=copy.deepcopy(d);mutate(x)
 try:validate(x)
 except (AssertionError,StopIteration):print('REJECT',label)
 else:raise AssertionError(label)
b=(E/'guest/post-accept.png').read_bytes()
try:check(b[:-1]+bytes([b[-1]^1]),seals['guest/post-accept.png'])
except AssertionError:print('REJECT changed screenshot')
else:raise AssertionError('screenshot control')
reg=json.loads((E/'registry-proof.json').read_text());assert reg['directXOriginal']==reg['directXOverlay']==reg['directXFinal'];assert reg['directXOriginal']['values']['Version']['data']=='4.07.00.0700'
assert json.loads((E/'guest/exit.json').read_text())['exitCode']==0
assert json.loads((E/'guest/accept.json').read_text())['ordinaryAcceptAttempts']==1
assert json.loads((E/'overlay-diff.json').read_text())['runnerBytesIdentical']
print('PASS local seals, genuine native COM S_OK/nonzero ppv, Initialize/root/system/getprop S_OK, actual VARIANT UI4 major7/minor0, helper S_OK and DX7<DX9/init0, registry unchanged; 3 negative controls reject')
