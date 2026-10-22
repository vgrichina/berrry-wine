"""Offline only: validate run artifacts and known instrumentation failure."""
import gzip,hashlib,io,json,pathlib,re,subprocess,tarfile
E=pathlib.Path(__file__).resolve().parent
def sha(b):return hashlib.sha256(b).hexdigest()
def read(n):return json.loads((E/n).read_text())
def inspect_log(data):
 lines=data.splitlines();messages=[]
 for i,line in enumerate(lines):
  if re.search(rb'SendMessageW\(0x000100(?:0f|1[0-5]), 0x0000000c,',line):
   window=lines[max(0,i-5):i]
   first=next((x for x in window if re.search(rb'0x092f(?:e7d0|0c10):',x)),None)
   assert first and first.split(b': ',1)[1].startswith(b'00 00 '),line
   messages.append(line)
 assert len(messages)==7,len(messages)
 return messages
def main():
 if (E/'seals.json').exists():
  for x in read('seals.json'):
   b=(E/x['path']).read_bytes();assert len(b)==x['size'] and sha(b)==x['sha256'],x['path']
 meta=read('archive-metadata.json');archive=(E/'evidence.tar.gz').read_bytes();assert len(archive)==meta['bytes'] and sha(archive)==meta['sha256']
 with tarfile.open(fileobj=io.BytesIO(archive)) as t:
  for x in meta['manifest']:
   a=t.extractfile(x['path']).read();assert a==(E/'raw'/x['path']).read_bytes();assert len(a)==x['size'] and sha(a)==x['sha256']
 data=gzip.decompress((E/'raw/output.log.gz').read_bytes());summary=read('raw/trace-summary.json')
 assert len(data)==summary['rawBytes'] and sha(data)==summary['rawSha256'];lines=data.splitlines(keepends=True)
 offsets=[];pos=0
 for line in lines:offsets.append(pos);pos+=len(line)
 for line in (E/'raw/focused-trace.log').read_bytes().splitlines():
  m=re.match(rb'(\d+) byte=(\d+): (.*)',line);assert m,line
  n,off=int(m[1])-1,int(m[2]);assert off==offsets[n] and lines[n].rstrip(b'\r\n')==m[3]
 events=[json.loads(x[len(b'[BOUNDARY] '):]) for x in lines if x.startswith(b'[BOUNDARY] ')]
 assert len(events)==1600 and not any(x['kind']=='block' for x in events)
 assert events[-1]['name']=='ReadFile' and events[-1]['file']==r'c:\art\art1.bar'
 messages=inspect_log(data)
 changed=data.replace(b'0x092fe7d0: 00 00',b'0x092fe7d0: 45 00',1)
 try:inspect_log(changed)
 except AssertionError:pass
 else:raise AssertionError('nonempty-buffer negative control escaped')
 try:inspect_log(data.replace(messages[-1],b'removed',1))
 except AssertionError:pass
 else:raise AssertionError('missing-message negative control escaped')
 state=json.loads(read('control-state.json')['stdout'])['value'];assert state['manager']==dict(pointer=0x8ac9e6c,count=1)
 assert state['result']['words'][1]==0x92f0c10 and state['result']['text']==''
 children=[x for x in state['windows'] if x['id'] in [2,1032,1034,1035,1036]];assert len(children)==5
 assert all(x['textPtr']==0 and x['textLen']==0 for x in children)
 assert read('raw/exit.json')['exitCode']==0 and not read('raw/exit.json')['signals']
 assert read('raw/launch.json')['guard']==dict(guest=240,TERM=255,KILL=260)
 assert all(read('raw/'+n)['pins']==373 and read('raw/'+n)['passAll'] for n in ['preflight.json','postflight.json'])
 proc=read('raw/process-state.json');assert not proc['processGroupPresent'] and all(x==111 for x in proc['portsConnectEx'].values())
 pins=read('input/runtime-pins.json');assets=read('input/installed-manifest.json')['files'];assert len(pins)==199 and len(assets)==174
 expected={'runtime/build/wine-assembly.wasm':'f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7','installed/Age of Empires III/age3.exe':'5d7fb9a8ae28e3e3758cee1346b2960f20ba7b4feaa511fa7f52ceffeeeca256','installed/Age of Empires III/data/stringtable.xml':'62fa66202af9e6ea6b98a7bb4b429a6fc724f51b57831c2b3062253ddb249f17'}
 identities={x['path']:x for x in read('identities.json')}
 for n,h in expected.items():assert identities[n]['sha256']==h
 assert sha((E/'historical-run.js').read_bytes())==identities['runtime/test/run.js']['sha256']
 result=subprocess.run(['node',str(E/'control-test.js')],capture_output=True,text=True,check=True);controls=json.loads(result.stdout);assert controls['pass'] and controls['knownStarvationReproduced']
 (E/'observer-controls.json').write_text(result.stdout)
 checks=dict(passAll=True,archiveFiles=len(meta['manifest']),rawBytes=len(data),rawLines=len(lines),emptyTextMessages=len(messages),postStateChildren=len(children),observerEvents=len(events),observerBlocks=0,knownInstrumentationFailureReproduced=True,negativeControls=2,prepostPins=373)
 (E/'checks.json').write_text(json.dumps(checks,indent=2)+'\n');print(json.dumps(checks))
if __name__=='__main__':main()
