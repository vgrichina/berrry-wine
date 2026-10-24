from work import *
import struct
raw=(E/'output.log').read_bytes();lines=raw.decode().splitlines()
hits=[x for x in lines if x.startswith('[EIP]')]
assert len(hits)==6 and all('406eb0' not in x for x in hits)
assert ['0x00406ec4','0x00406ed8','0x00406efb','0x00406f00','0x00406f40','0x00406f40']==[x.split()[1] for x in hits]
def dump(line,addr,n):return bytes.fromhex(line.split(f'mem[0x{addr:08x}:{n}]=')[1].split(' mem[')[0])
states=[dict(block=x.split()[1],reverseCount=struct.unpack('<II',dump(x,0x4130a0,8)),ammo=struct.unpack('<iii',dump(x,0x410110,12)),record=dump(x,0x4d0750,32).hex()) for x in hits]
assert states[0]['reverseCount']==(0,0) and states[0]['ammo']==(10,10,10)
assert states[1]['reverseCount']==(0,1) and states[1]['ammo']==(10,10,10)
assert states[2]['reverseCount']==(0,1) and states[2]['ammo']==(9,10,10)
assert 'EDI=0x00000001' in hits[0] and 'ECX=0x00000000' in hits[0]
assert 'EDX=0x0000000a' in hits[1] and 'a=0x0000000a b=0x0000000a res=0x00000000' in hits[1]
down=[x for x in lines if x.startswith('[dispatch-input]') and 'msg=0x100 wParam=0x41 lParam=0x1e0001' in x]
up=[x for x in lines if x.startswith('[dispatch-input]') and 'msg=0x101 wParam=0x41 lParam=0xc01e0001' in x]
assert len(down)==len(up)==1 and 'batch=40033 ' in down[0] and 'batch=40295 ' in up[0]
assert '43000 batches' in raw.decode() and raw.endswith(b'\n') and len(raw)<524288
terminal=json.load(open(E/'terminal.json'));assert terminal['returncode']==0 and terminal['reason']=='natural' and not terminal['remainingGroup']
failed=[x for x in lines if 'png FAILED' in x];assert len(failed)==2 and all('EFBIG' in x for x in failed)
for n in ['b39999.png','b40100.png']:assert (E/n).stat().st_size==524288
v=dict(passAcceptance=True,gameShotAccepted=True,visibleProjectile='UNPROVEN: both optional PNG writes EFBIG and incomplete; never decoded as complete evidence',states=states,actualADispatch=down[0],actualAKeyup=up[0],traceLines=len(hits),maxTraceLineBytes=max(len(x.encode())+1 for x in hits),completeOutputBytes=len(raw),completeOutputLines=len(lines),terminal=terminal,failedPNGs=failed,exactBinding=dict(count='406ecb lea eax,[ecx+1];406ece mov [4130a4],eax;ECX0 -> count1 at406ed8',ammo='406ec4 loads [41010c+EDI*4] withEDI1 ->410110=10;406ed3 cmp10;fallthrough406ed8;406ee4 lea eax,[edx-1];406ee7 edx410110;406eec [edx+EDI*4-4]=eax ->410110=9;witness406efb',postReturn='406f00 count1/ammo9',later='406f40 later ammo=-1 is retained, outside this immediate-store acceptance; no wave/score inference'))
save('verification.json',v)
for n in ['admission.json','resource-preguest.json','manifest.json','remote-rehash.json','preflight-api.json','fresh-identity-process-api.json','reused-checkpoint.json','bounded-command-calculation.json','decision-args.json','preflight-path-correction.json','verification.json','supervise.py','work.py','stage.py','execute.py','finish.py']:
 shutil.copyfile(H/n,E/n)
for n in ['static-checkpoint.json']:
 shutil.copyfile(PRE/n,E/('predecessor-'+n))
pe=PRE/'repo/docs/re-notes/penguin-command-cannon-block-decision-20261024'
for n in ['artifact-seals.json','penguin-command.exe-0x406ec4.asm.txt']:
 shutil.copyfile(pe/n,E/('predecessor-'+n))
save('predecessor-references.json',dict(commit='164e406b3481e62c5713eed12821e312421ee082',coordinatorIndependentlyVerifiedArtifactCount=42,sealFile=str(pe/'artifact-seals.json'),sealFileSHA256=sha((pe/'artifact-seals.json').read_bytes()),reuse='exact-revision accepted trace support/blob/excerpts; no repeated full audit'))
shutil.copyfile(H/'predecessor-references.json',E/'predecessor-references.json')
cleanup=py('''import pathlib,json,os
H=pathlib.Path(ROOT);pids=[]
for p in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  a=(p/'cmdline').read_bytes().decode(errors='replace').split('\\0')
  if a and pathlib.Path(a[0]).name=='node' and str(H/'runner/test/run.js') in a:pids.append(int(p.name))
 except (FileNotFoundError,PermissionError,ProcessLookupError):pass
assert not pids,pids
files=[p for p in H.rglob('*') if p.is_file()]
print(json.dumps(dict(noOwnedNodePids=True,files=len(files),bytes=sum(p.stat().st_size for p in files),maxFile=max(p.stat().st_size for p in files),free=os.statvfs('/tmp').f_bavail*os.statvfs('/tmp').f_frsize,stagedClosureBytes=15760340,retained=True)))
'''.replace('ROOT',repr(str(H))))
save('cleanup-api.json',cleanup);shutil.copyfile(H/'cleanup-api.json',E/'cleanup-api.json')
state=json.loads(subprocess.check_output([B,'--no-update','--json','info',BOX]));save('box-final.json',state);assert state['sandbox']['state']=='idle'
shutil.copyfile(H/'box-final.json',E/'box-final.json')
print(json.dumps(dict(acceptance=True,outputBytes=len(raw),traceLines=len(hits),remoteFootprint=json.loads(cleanup['stdout']),boxState=state['sandbox']['state'],expiry=state['sandbox']['archiveAfter'])))
