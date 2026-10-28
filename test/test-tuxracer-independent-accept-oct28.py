#!/usr/bin/env python3
"""Independent acceptance of pinned original recovery; never executes payloads.
Usage: SCRIPT OUT boundary|deep|stage|positive (use fresh OUT). OUT retains fixtures and separate CLI streams.
"""
import hashlib, importlib.util, json, os, pathlib, stat, struct, subprocess, sys, zipfile
P=pathlib.Path
RECIPE=P(__file__).resolve().parents[1]/'tools/recovery/tuxracer-original-win32-recovery-oct28.py'
PIN='eeb1ebb2a1bb694842044cce4923bca60fee9e6d8497092dd6c753f21a35dcc4'
ORIGINAL=P('/home/user/wine-assembly/scratch/usage-watch/tuxracer-original-win32-recovery-oct28/payload/tuxracer-win32-0.61a.zip')
assert hashlib.sha256(RECIPE.read_bytes()).hexdigest()==PIN
OUT=P(sys.argv[1]); OUT.mkdir(exist_ok=True); mode=sys.argv[2]
spec=importlib.util.spec_from_file_location('r',RECIPE);r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
results=[]
def save(name,**kw): results.append(dict(name=name,**kw));(OUT/(mode+'-checkpoint.json')).write_text(json.dumps(dict(recipeSHA256=PIN,results=results),indent=2)+'\n')
def cli(name,args,ok,needle=None):
 cmd=[sys.executable,str(RECIPE),*map(str,args)]
 with (OUT/(name+'.stdout')).open('wb') as o,(OUT/(name+'.stderr')).open('wb') as e:
  c=subprocess.run(cmd,stdout=o,stderr=e,timeout=15)
 err=(OUT/(name+'.stderr')).read_text();assert (c.returncode==0)==ok,(name,c.returncode,err)
 if needle: assert needle in err,(name,err)
 save(name,command=cmd,exit=c.returncode,stdout=name+'.stdout',stderr=name+'.stderr',pass_=True)
def archive(name,entries):
 p=OUT/(name+'.zip')
 with zipfile.ZipFile(p,'w') as z:
  for n,b in entries:z.writestr(n,b)
 return p
def reject(name,f,needle=None):
 try:f()
 except Exception as e:
  if needle:assert needle in str(e),(name,repr(e))
  save(name,errorType=type(e).__name__,error=str(e),pass_=True)
 else:raise AssertionError(name+' unexpectedly accepted')
if mode=='boundary':
 # First behavioral action: immutable production CLI, tiny traversal ZIP, no dependent outputs.
 bad=archive('boundary-traversal',[('../escape',b'x')]);dest=OUT/'must-remain-absent'
 if not (OUT/'earliest-extract.stderr').exists():cli('earliest-extract',['extract',bad,dest,'--max-expanded-bytes',100],False,'SHA256 mismatch')
 assert not dest.exists() and not (OUT/'inventory.json').exists() and not (OUT/'closure.json').exists()
 if not (OUT/'earliest-inspect.stderr').exists():cli('earliest-inspect',['inspect',bad,'--max-expanded-bytes',100],False,'SHA256 mismatch')
 # Empty archive reaches size/type guard within the 12MiB per-file ceiling.
 big=OUT/'empty.zip'
 big.write_bytes(b'')
 cli('size-cli',['extract',big,dest,'--max-expanded-bytes',100],False,'size/type guard');big.unlink()
 assert not dest.exists()
 assert ORIGINAL.stat().st_size==8009319
 assert r.digest(ORIGINAL)==r.SHA256
 cli('success-inspect',['inspect',ORIGINAL,'--max-expanded-bytes',13225945],True)
 good=json.loads((OUT/'success-inspect.stdout').read_text());assert good['entries']==180 and good['expandedBytes']==13225945
 cli('aggregate-cli',['extract',ORIGINAL,dest,'--max-expanded-bytes',13225944],False,'aggregate')
 assert not dest.exists() and not (OUT/'inventory.json').exists() and not (OUT/'closure.json').exists()
 dest.mkdir();(dest/'keep').write_bytes(b'preexisting');(OUT/'inventory.json').write_bytes(b'old inventory');(OUT/'closure.json').write_bytes(b'old closure')
 cli('preexisting-cli',['extract',ORIGINAL,dest,'--max-expanded-bytes',13225945],False,'destination exists')
 assert (dest/'keep').read_bytes()==b'preexisting' and (OUT/'inventory.json').read_bytes()==b'old inventory' and (OUT/'closure.json').read_bytes()==b'old closure'
 save('boundary-sentinels',absentOnRejection=True,preexistingPreserved=True,fullExtraction=False,pass_=True)
elif mode=='deep':
 # Fixed production SHA makes synthetic inputs unreachable beyond pin through CLI.
 # Test unchanged helpers separately; never present these as pinned CLI execution.
 valid=archive('valid',[('data/file',b'abc')]);assert r.metadata(valid,3)['expandedBytes']==3
 save('metadata-positive',pass_=True)
 for i,path in enumerate(('../escape','/absolute','C:/escape','a\\escape','a/../escape','con.txt','a./f','a//f')):
  p=archive('unsafe'+str(i),[(path,b'x')]);reject('path-'+str(i),lambda:r.metadata(p,100),'unsafe')
 for name,entries in [('case',[('A',b'x'),('a',b'y')]),('prefix',[('a',b'x'),('a/b',b'y')])]:
  p=archive(name,entries);reject(name,lambda:r.metadata(p,100),'collision' if name=='prefix' else 'duplicate')
 for name,kind in [('link',stat.S_IFLNK),('special',stat.S_IFIFO)]:
  z=zipfile.ZipInfo(name);z.create_system=3;z.external_attr=(kind|0o600)<<16;p=archive(name,[(z,b'x')]);reject(name,lambda:r.metadata(p,100),'special')
 reject('helper-aggregate',lambda:r.metadata(valid,2),'aggregate')
 # zipfile stream contract used verbatim by extract, independently challenge CRC/local header.
 crc=archive('bad-crc',[('file',b'abc')]);b=bytearray(crc.read_bytes());b[34]^=1;crc.write_bytes(b)
 def readzip(p):
  with zipfile.ZipFile(p) as z:
   for i in z.infolist():
    with z.open(i) as s:s.read()
 reject('crc-stream',lambda:readzip(crc),'CRC')
 mm=archive('member-mismatch',[('file',b'abc')]);b=bytearray(mm.read_bytes());b[30]=ord('X');mm.write_bytes(b);reject('member-stream',lambda:readzip(mm),'differ')
 # Minimal PE success and malformed-RVA control, plus missing direct import reporting.
 b=bytearray(1024);b[:2]=b'MZ';struct.pack_into('<L',b,60,128);b[128:132]=b'PE\0\0';struct.pack_into('<HH',b,132,0x14c,1);struct.pack_into('<H',b,148,224);opt=152
 struct.pack_into('<H',b,opt,0x10b);struct.pack_into('<L',b,opt+92,16);struct.pack_into('<LL',b,opt+104,0x1000,40);struct.pack_into('<LLLL',b,opt+224+8,512,0x1000,512,512);struct.pack_into('<5L',b,512,0,0,0,0x1080,0);b[640:652]=b'MISSING.dll\0'
 pe=OUT/'app.exe';pe.write_bytes(b);inventory={'files':[{'path':'app.exe'}]};c=r.closure(OUT,inventory);assert c['modules']['app.exe']['unresolved']==['missing.dll'];save('missing-dll-report',unresolved=c['modules']['app.exe']['unresolved'],rejects=False,pass_=True)
 # Data presence is enumerated, not validated; dynamic Tcl explicitly outside scope.
 pe.write_bytes(b'broken');reject('malformed-pe',lambda:r.closure(OUT,inventory),'MZ')
 save('helper-scope',productionSHAUnchanged=True,syntheticCLIReachable=False,dataClosureNotEnforcedByRecipe=True,dynamicTclUnverified=True,pass_=True)
else:
 # Explicit fixture-only pin seam: original production hash guard already passed
 # real-CLI rejection controls. Do not claim these ZIPs pass the production pin.
 original_pin=r.pin
 def fixture_pin(path):return original_pin(path,expected=r.digest(path))
 r.pin=fixture_pin
 def stage(name,content,script=b'source missing.tcl'):
  directory=OUT/name;directory.mkdir();dest=directory/'extracted'
  (directory/'inventory.json').write_bytes(b'PREEXISTING INVENTORY')
  (directory/'closure.json').write_bytes(b'PREEXISTING CLOSURE')
  fixture=archive(name,[('app.exe',content),('tuxracer_init.tcl',script)])
  old=sys.argv;sys.argv=[str(RECIPE),'extract',str(fixture),str(dest),'--max-expanded-bytes','4096']
  try:r.main();error=None
  except Exception as e:error=dict(type=type(e).__name__,message=str(e))
  finally:sys.argv=old
  return directory,dest,error
 # Valid PE, unresolved DLL and missing literal Tcl data: production main returns
 # success and publishes reports. This is a contract rejection, not a test crash.
 b=bytearray(1024);b[:2]=b'MZ';struct.pack_into('<L',b,60,128);b[128:132]=b'PE\0\0';struct.pack_into('<HH',b,132,0x14c,1);struct.pack_into('<H',b,148,224);opt=152
 struct.pack_into('<H',b,opt,0x10b);struct.pack_into('<L',b,opt+92,16);struct.pack_into('<LL',b,opt+104,0x1000,40);struct.pack_into('<LLLL',b,opt+224+8,512,0x1000,512,512);struct.pack_into('<5L',b,512,0,0,0,0x1080,0);b[640:652]=b'MISSING.dll\0'
 if mode=='positive':
  b[640:652]=b'KERNEL32.dll\0'
  directory,dest,error=stage('valid-closure',b,b'# no external references')
  assert error is None
  report=json.loads((directory/'closure.json').read_text());assert report['modules']['app.exe']['unresolved']==[]
  assert report['modules']['app.exe']['windows']==['kernel32.dll']
  save('healthy-stage-positive',fixtureOnlyPinSeam=True,actualMain=True,pass_=True)
  print(json.dumps({'mode':mode,'checks':len(results),'pass':True}));sys.exit(0)
 directory,dest,error=stage('missing-closure',b)
 assert error is None
 report=json.loads((directory/'closure.json').read_text());assert report['modules']['app.exe']['unresolved']==['missing.dll'];assert not (dest/'missing.tcl').exists()
 save('missing-closure-not-rejected',fixtureOnlyPinSeam=True,actualMain=True,error=error,unresolved=['missing.dll'],missingData='missing.tcl',contract='REJECT')
 directory,dest,error=stage('failed-pe',b'broken')
 assert error and error['type']=='Rejected'
 inventory=json.loads((directory/'inventory.json').read_text());assert inventory['complete'] is True
 assert (directory/'closure.json').read_bytes()==b'PREEXISTING CLOSURE'
 assert (dest/'app.exe').read_bytes()==b'broken'
 save('failed-stage-publication',fixtureOnlyPinSeam=True,actualMain=True,error=error,inventoryOverwrittenAndComplete=True,oldClosurePreserved=True,partialDestinationRetained=True,contract='REJECT')
print(json.dumps({'mode':mode,'checks':len(results),'pass':True}))
