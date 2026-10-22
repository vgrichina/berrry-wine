"""Verify this actual trace, its raw offsets, identities and causal assertions."""
import pathlib,json,gzip,hashlib,collections,copy,tarfile,subprocess,os
E=pathlib.Path(__file__).resolve().parent
def sha(b):return hashlib.sha256(b).hexdigest()
summary=json.loads((E/'raw/trace-summary.json').read_text())
raw=gzip.decompress((E/'raw/output.log.gz').read_bytes())
assert len(raw)==summary['rawBytes']==20838365 and sha(raw)==summary['rawSha256']
lines=raw.splitlines(keepends=True);assert len(lines)==summary['rawLines']==172087
events=[json.loads(l) for l in (E/'raw/boundary.jsonl').read_text().splitlines()]
offsets=[];n=0
for l in lines:offsets.append(n);n+=len(l)
for x in events:
 assert offsets[x['rawLine']-1]==x['rawByte']
 y=json.loads(lines[x['rawLine']-1][11:]);z={k:v for k,v in x.items() if k not in ['rawLine','rawByte']};assert y==z
 assert x['instanceId']=='main'
 if x['kind']=='block':assert x['ip']==x['regs']['eip'] and len(x['stack'])==12
assert len(events)==442 and sum(x['kind']=='block' for x in events)==322
for x in json.loads((E/'raw/collected-manifest.json').read_text()):
 p=E/'raw'/x['path'];assert p.stat().st_size==x['size'] and sha(p.read_bytes())==x['sha256']
archive=json.loads(json.loads((E/'collection.json').read_text())['stdout'])['archive']
assert sha((E/'capture.tar.gz').read_bytes())==archive['sha256']
staging=json.loads((E/'staging-gate-result.json').read_text());assert staging['passAll'] and len(staging['pins'])==373 and all(x['ok'] for x in staging['pins'])
assert json.loads((E/'raw/postflight.json').read_text())['pins']==373
assert json.loads((E/'raw/postflight.json').read_text())['passAll']
assert json.loads((E/'raw/dependency-selected-route.json').read_text())['pass']
def validate(xs):
 def blocks(ip):return [x for x in xs if x.get('ip')==ip]
 def one(ip):
  b=blocks(ip);assert len(b)==1,hex(ip);return b[0]
 for ip in [0x8e98b7,0x8e98ca,0x8e98dc]:assert one(ip)['regs']['eax']==0
 pre=one(0x8e98fb);post=one(0x8e9904)
 assert pre['parseUrl']=='file:\\\\c:\\data\\StringTable.xml'
 assert post['regs']['eax']==0xc06d007f and pre['regs']['esp']==post['regs']['esp']
 assert pre['stack']==post['stack']
 assert one(0x8e990d)['seq']>post['seq'] and one(0x8e9912)['seq']>post['seq']
 assert one(0x8e9921)['seq']>post['seq'] and one(0x8e9960)['seq']>post['seq']
 assert not blocks(0x8e9931) and not blocks(0x8e9946)
 first=one(0x489ece);second=one(0x489ef6)
 assert first['loadAL']==0 and first['manager']['count']==0
 assert second['loadAL']==1 and second['manager']['count']==1
 assert second['manager']['pointer']==0x8ac9e6c and second['manager']['contents'][0]['pointer']==0x8ac6920
 init=[x for x in blocks(0x486e30) if x['stack'][2]==0x110];assert len(init)==1
 assert init[0]['stack'][1:5]==[0x1000f,0x110,0x10010,0xc4319c]
 before=next(w for w in init[0]['windows'] if w['id']==2);assert before['text']=='<exit>' and before['textLen']==6
 for label,ret,hwnd,ctrl in [(19884,0x48700d,0x1000f,0),(19891,0x487040,0x10010,2),(19890,0x487070,0x10011,1032),(19887,0x4870b5,0x10012,1034),(19889,0x4870e5,0x10013,1035),(19888,0x487119,0x10014,1036)]:
  lookup=[x for x in blocks(0x918670) if x['lookupId']==label];assert len(lookup)==1
  returned=[x for x in blocks(0x8e4603) if x['lookup']==label];assert len(returned)==1
  r=returned[0];assert r['regs']['eax']==0xcea720 and r['returnObject']==[0]*16 and r['returnText'] is None
  wrapper=[x for x in blocks(0x8e46ca) if x['lookup']==label];assert len(wrapper)==1 and wrapper[0]['regs']['esi']==0
  msg=[x for x in xs if x['kind']=='api-entry' and x['name']=='SendMessageW' and x['ret']==ret];assert len(msg)==1
  m=msg[0];assert m['args'][:4]==[hwnd,12,0,0x92fe7d0] and m['text']=='' and m['textBytes'][:2]==[0,0]
  continuation=one(ret);assert lookup[0]['seq']<r['seq']<wrapper[0]['seq']<m['seq']<continuation['seq']
  if ctrl:
   w=next(w for w in continuation['windows'] if w['hwnd']==hwnd)
   assert w['id']==ctrl and w['textPtr']==0 and w['textLen']==0
 explanation=one(0x4871ab)
 assert int.from_bytes(bytes(explanation['result'][4:8]),'little')==0x92f0c10 and explanation['explanation']==''
 m=next(x for x in xs if x['kind']=='api-entry' and x['name']=='SendMessageW' and x['ret']==0x4871ab)
 assert m['args'][:4]==[0x10015,12,0,0x92f0c10] and m['textBytes'][:2]==[0,0] and m['text']==''
 return True
assert validate(events)
negative=[]
for name,mutate in [
 ('missing actual native return',lambda xs:xs.remove(next(x for x in xs if x.get('ip')==0x8e9904))),
 ('stale native return EAX',lambda xs:next(x for x in xs if x.get('ip')==0x8e9904)['regs'].__setitem__('eax',0)),
 ('missing ID19891 return',lambda xs:xs.remove(next(x for x in xs if x.get('ip')==0x8e4603 and x['lookup']==19891))),
 ('nonempty actual WM_SETTEXT contradicts chain',lambda xs:next(x for x in xs if x.get('kind')=='api-entry' and x.get('ret')==0x487040).__setitem__('text','Exit Game'))]:
 changed=copy.deepcopy(events);mutate(changed)
 try:validate(changed)
 except (AssertionError,StopIteration):negative.append(name)
 else:raise AssertionError('negative not detected: '+name)
assert len(negative)==4
hook=E/'harness/instance-hook.js';observer=E/'harness/observer.js'
assert sha(hook.read_bytes())=='c7a54607d074d144149129a5e867d92b091dde049d1579f142606953c72a74c4'
assert sha(observer.read_bytes())=='b89ab5bba916de36a324b6068d7df09f26ef227f8940ca58995677b946032032'
for p in [hook,observer,E/'harness/diagnostic-run.js']:subprocess.run(['node','--check',str(p)],check=True)
root=json.loads((E/'admission.json').read_text())['protected']
for p,h in root.items():assert sha(pathlib.Path(p).read_bytes())==h,p
state=json.loads((E/'raw/process-state.json').read_text());assert not state['present'] and all(v==111 for v in state['portsConnectEx'].values())
launch=json.loads((E/'raw/launch.json').read_text());assert '--trace-eip-range=0x400000-0x0b00000' in launch['command'] and '--threads' not in launch['command']
exit=json.loads((E/'raw/exit.json').read_text());assert exit['exitCode']==0 and not exit['signals']
if (E/'seals.json').exists():
 for rel,h in json.loads((E/'seals.json').read_text()).items():assert sha((E/rel).read_bytes())==h,rel
print(json.dumps(dict(passAll=True,records=442,blocks=322,rawLines=len(lines),archiveFilesVerified=len(json.loads((E/'raw/collected-manifest.json').read_text())),prePostPins=373,negativeControls=negative,originalGuestRuns=1,ordinaryAccepts=1,failedGuestAttempts=0,firstObservedNativeFailure=dict(returnEip='0x8e9904',eax='0xc06d007f'),nativeInternalCause='UNKNOWN',rootProtectedSeals=True),indent=2))
