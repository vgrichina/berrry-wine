"""Offline evidence checks only. Never starts guest or contacts runtime."""
import pathlib,json,hashlib,copy
E=pathlib.Path(__file__).resolve().parent
def read(n):return json.loads((E/n).read_text())
def sha(b):return hashlib.sha256(b).hexdigest()
def validate(raw,events,observer):
 p=read('preflight.json');x=read('exit.json');c=read('cleanup.json');ctx=read('blocker-context.json')
 assert len(raw)==30158569 and sha(raw)=='3d22cf623165fa5005d57c539fed79575e8315cc81093eeb717ed30b4e2303a0'
 assert p['passAll'] and p['quotaBytes']==150994944
 assert p['fixedAllocatedBytes']==85536768 and p['fixedLogicalBytes']==85024432
 assert sum(r['allocated'] for r in p['fixed'])==p['fixedAllocatedBytes']
 assert max(p['fixedAllocatedBytes'],p['fixedLogicalBytes'])<=100663296
 assert p['fixedAllocatedBytes']+150994944+16777216<268435456
 assert x['aggregateBoundPassed'] and x['elapsedSeconds']<60 and x['parentOsExitCode']==0
 assert x['parentPid']==32431 and x['postSealCount']==243 and x['pinsPreserved']
 assert x['peakObservedQuotaUsed']==106459136<150994944 and not x['remainingLiveProcesses']
 assert c['clean'] and not c['remainingOwnedLiveProcesses'] and c['pinsPreserved'] and c['lifecycleMutations']==0
 assert c['quotaBytes']==150994944 and not c['tmpEntries']
 assert b'ENOSPC' not in raw and ctx['ENOSPC']==0
 assert raw[57914:58061].decode()=='[spawn] ShellExecute "C:\\WINDOWS\\TEMP\\_ISTMP1.DIR\\_INS5576._MP" failed: Authority deadline exceeded; operation outcome unknown; client is unusable\n'
 assert raw[30148130:30148180]==b'[max-seconds] stopping after 55s at batch 8168365\n'
 assert raw.startswith(b'PE loaded. Entry: 0x00407b43\n')
 assert len([r for r in events if r['kind']=='preload-identity'])==1
 identity=events[0];assert identity['pid']==32431 and identity['tag']=='parent'
 assert identity['exe']['sha256']=='5656e87da0641c9dcfcd0ee8949ce72b3fa6a7d0e8b1fd985a16f6bd6c34ce52'
 assert not any(r['kind']=='fork' or r['tag']=='child' for r in events)
 we=[r for r in events if r['kind']=='return' and r.get('name')=='WinExec'];assert len(we)==1 and we[0]['eax']==0
 mb=[r for r in events if r['kind']=='entry' and r.get('name')=='MessageBoxA'];assert len(mb)==1 and mb[0]['text'].endswith('Error 111.')
 assert not any(r.get('name')=='ExitProcess' for r in events)
 assert not read('log-inspection.json')['childArtifacts'] and not read('log-inspection.json')['stopRequest']
 cmd=read('raw/command.json');args=cmd['command'];assert cmd['guestAttempts']==1
 assert '--max-seconds=55' in args and args.count('--real-ticks')==1
 assert '--pipe-child-args=--real-ticks --trace-api=ShowWindow,UpdateWindow,ExitProcess' in args
 assert not any(s.startswith(('--control=','--input=','--guest-page-stats')) for s in args)
 q='/home/user/shadow-man-bounded-runtime/attempt'
 assert cmd['cwd']==q and all(cmd['environment'][k]==q+'/tmp' for k in ['TMPDIR','TMP','TEMP'])
 for arg in args:
  if arg.startswith(('--png=','--save-vfs=','--reg-export=')):assert arg.split('=',1)[1].startswith(q+'/')
 fixture=json.loads(p['fixture']['stdout']);assert fixture['pid']!=32431
 for k in ['TMP','TEMP','tmpdir']:assert fixture[k]==q+'/tmp'
 assert fixture['endpoint'].startswith(q+'/tmp/')
 relocated=read('observer-relocation.json');assert sha(observer)==relocated['relocatedSha256']
 original=observer.replace(b"ROOT='/home/user/shadow-man-tools-ready-oct22/runtime',OUT='/home/user/shadow-man-bounded-runtime/attempt'",b"ROOT='/home/user/shadow-man-original-oct22/runtime',OUT='/home/user/shadow-man-child-transport-sized-oct22'")
 assert sha(original)=='539c9fd0d23b6c539818ee9c612d33b010708af74c91f896a9f9f68988b2769d'
 assert len(p['seals'])==243
 for s in p['seals']:
  if s['path'].endswith('/build/wine-assembly.wasm'):assert s['size']==1878971 and s['sha256']=='f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
 assert read('run-api.json')['exitCode']==0 and json.loads(read('run-api.json')['stdout'])==x
 summary=read('raw/parent-32431-summary.json');png=(E/'raw/parent-32431.png').read_bytes()
 assert png.startswith(b'\x89PNG\r\n\x1a\n') and sha(png)==summary['screenshot']['sha256']=='c3659606af6bbe18edcc8a8f8d6fb1a6a338fe0f743c1a6333a6ec6d87041f37'
 assert (E/'raw/parent-final.png').read_bytes()==png
 box=read('box-final.json')['sandbox'];assert box['id']=='bx_495585da' and box['state']=='idle' and box['stop'] is None and box['health']=='ok'
 assert box['archiveAfter']=='2026-10-22T20:13:56.453Z'
 for r in read('log-inspection.json')['matches']:
  assert raw[r['offset']:r['offset']+r['bytes']].decode()==r['text']
 for r in read('raw-log-retrieval.json')['chunks']:
  b=raw[r['offset']:r['offset']+r['bytes']];assert sha(b)==r['sha256'] and r['exitCode']==0
 return True
if __name__=='__main__':
 raw=(E/'raw/output.log').read_bytes();events=[json.loads(l) for l in (E/'raw/parent-32431.jsonl').read_text().splitlines()];observer=(E/'observer.cjs').read_bytes()
 assert validate(raw,events,observer)
 forged=copy.deepcopy(events)
 next(r for r in forged if r['kind']=='return' and r.get('name')=='WinExec')['eax']=33
 checks=[]
 for name,values in [('truncated-log',(raw[:-1],events,observer)),('forged-WinExec33',(raw,forged,observer)),('changed-observer',(raw,events,observer+b'\n// mechanics drift'))]:
  try:validate(*values)
  except AssertionError:checks.append(dict(control=name,rejected=True))
  else:raise AssertionError(name+' wrongly accepted')
 print(json.dumps(dict(passAll=True,guestAttempts=1,forks=0,childPreloads=0,controls=checks)))
