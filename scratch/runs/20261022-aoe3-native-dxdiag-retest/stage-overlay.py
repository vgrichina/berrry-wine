from pathlib import Path
import json,hashlib,gzip,shutil,difflib
E=Path('/home/user/aoe3-native-dxdiag-retest-oct22');P=Path('/home/user/aoe3-canonical-c7fae5ac-evidence');R=Path('/home/user/aoe3-original-oct22')
assert not (E/'overlay').exists();O=E/'overlay';O.mkdir()
parts=sorted(E.glob('provider.part*'),key=lambda p:int(p.name.split('part')[1]));b=gzip.decompress(b''.join(p.read_bytes() for p in parts));assert len(b)==1720320 and hashlib.sha256(b).hexdigest()=='50e31067ca6872ae0b7b35a65bf2a9d07c1de539b2d603a9472a48f5375c8307'
(O/'dxdiagn.dll').write_bytes(b)
for p in parts:p.unlink()
original=P/'guest/original-run-relocated.js';shutil.copyfile(original,O/'run.js');assert (O/'run.js').read_bytes()==original.read_bytes()
base=R/'installed-audit/launch-registry.json';reg=json.loads(base.read_text());before=dict(reg)
key='reg:HKCR\\CLSID\\{A65B8071-3BFE-4213-9A5B-491DA4461CA7}\\InprocServer32';assert key not in reg
reg[key]=json.dumps(dict(values={'':dict(type=1,data='c:\\windows\\system\\dxdiagn.dll')}),separators=(',',':'))
(O/'registry.json').write_text(json.dumps(reg,indent=2)+'\n');assert {k:v for k,v in reg.items() if k!=key}==before
delta=dict(registryAdded={key:json.loads(reg[key])},registryRemoved=[],registryModified=[],vfsAdded={'c:\\windows\\system\\dxdiagn.dll':dict(host=str(O/'dxdiagn.dll'),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())},runnerBytesIdentical=True,originalRegistrySHA256=hashlib.sha256(base.read_bytes()).hexdigest(),guardedImports='OpenServiceA and QueryServiceConfigA occur only after native 0x440a9d OpenSCManagerA call; 0x440a85 zeros EBX; accepted API always returns NULL; 0x440aa8 skips both. System import loader defers unknown names; no guaranteed loader failure. Runtime actual provider calls remain UNKNOWN until run.',closure='PASS for controlled retained runtime path; two unsupported service APIs explicitly guarded and not supplied or fabricated',stagingCount=1)
(E/'overlay-diff.json').write_text(json.dumps(delta,indent=2)+'\n')
print(json.dumps(delta))
