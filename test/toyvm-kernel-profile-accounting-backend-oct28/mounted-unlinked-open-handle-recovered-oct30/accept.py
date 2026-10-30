import json,lzma,struct,hashlib,pathlib
R=pathlib.Path(__file__).resolve().parent;E=R if (R/'raw-runtime.json.xz').exists() else R/'evidence'
def accept():
 d=json.loads(lzma.decompress((E/'raw-runtime.json.xz').read_bytes()));assert d['exit']==0 and d['violation'] is None
 for k in ['accepted','accountingAccepted','childSucceeded','cleanupComplete']:assert d['report'][k] is True,k
 assert not d['report']['failures'] and d['mountOwnership'] and d['observerCleanup']==dict(remainingMounts=[],processes=[])
 steps={s['step']:s for s in d['syscalls']};u=steps['created']['unlinked']['inode'];b=steps['created']['ordinary']['inode'];assert u!=b
 assert steps['unlinked-open']['namespaceAbsent'] and steps['unlinked-open']['sameFD']==steps['unlinked-written-read']['sameFD']
 payload=bytes(range(128));patched=payload[:51]+b'LIVE-FD'+payload[58:];ordinary=b'B'*128+b'R'*3969
 for step,data in [('created',payload),('unlinked-open',payload),('unlinked-written-read',patched)]:
  v=steps[step]['unlinked'];assert v['inode']==u and v['length']==128 and v['sha256']==hashlib.sha256(data).hexdigest()
 assert steps['extended']['ordinary']['sha256']==hashlib.sha256(ordinary).hexdigest() and steps['extended']['ordinary']['length']==4097
 rows=d['rawWire'];decoded=[]
 for w in rows:
  req=bytes.fromhex(w['requestHex']);resp=bytes.fromhex(w['responseHex']);n,op,uniq,ino=struct.unpack_from('<IIQQ',req);size,err,runiq=struct.unpack_from('<IiQ',resp)
  assert n==len(req) and size==len(resp) and uniq==runiq==w['unique'] and op==w['opcode'] and ino==w['inode'] and err==0 and w['errno']==0
  decoded.append((w,req[40:],resp[16:]))
 unlink=next(t for t in decoded if t[0]['opcode']==10 and t[1]==b'open,unlinked\0');idx=decoded.index(unlink)
 assert unlink[0]['after']['live']==20480 and unlink[0]['nodes'][str(u)]==dict(links=0,opens=1,bytes=128)
 release=next(t for t in decoded[idx+1:] if t[0]['opcode']==18 and t[0]['inode']==u);ri=decoded.index(release)
 active=decoded[idx+1:ri];reads=[t for t in active if t[0]['opcode']==15 and t[0]['inode']==u];writes=[t for t in active if t[0]['opcode']==16 and t[0]['inode']==u]
 assert any(t[2]==payload for t in reads) and any(t[2]==patched for t in reads) and len(writes)==1
 w,request,response=writes[0];fh,offset,size=struct.unpack_from('<QQI',request);assert offset==51 and size==7 and request[40:]==b'LIVE-FD' and struct.unpack_from('<I',response)[0]==7
 assert all(t[0]['after']['live']==20480 and t[0]['nodes'][str(u)]['opens']==1 for t in active)
 assert all(struct.unpack_from('<Q',t[1])[0]==fh for t in reads+[release])
 assert release[0]['after']['live']==12288 and str(u) not in release[0]['nodes'] and release[0]['after']['openHandles']==1
 ext=next(t for t in decoded[ri+1:] if t[0]['opcode']==16 and t[0]['inode']==b);assert ext[0]['after']['live']==16384 and ext[1][40:]==b'R'*3969
 assert any(t[0]['opcode']==15 and t[0]['inode']==b and t[2]==ordinary for t in decoded[decoded.index(ext)+1:])
 assert rows[-1]['after']==dict(live=4096,peak=20480,written=4232,inodes=1,openHandles=0)
 result=dict(objectiveQualified=True,qualifiedSource='311c42abb41adc1fc16e06b4276005d15db553b2',unlinkedInode=u,ordinaryInode=b,unlinkedFD=steps['unlinked-open']['sameFD'],unlinkUnique=unlink[0]['unique'],postUnlinkReadUnique=[t[0]['unique'] for t in reads],postUnlinkWriteUnique=w['unique'],releaseUnique=release[0]['unique'],extensionUnique=ext[0]['unique'],retainedLive=20480,releasedLive=12288,reclaimed=8192,extendedLive=16384,withoutReleaseExtension=24576,liveLimit=20480,wireCallbacks=len(rows),final=rows[-1]['after'],boundary='Callback order and backend counters prove reclamation at RELEASE; close markers alone do not prove synchronous RELEASE.',cleanup=d['observerCleanup'],productionExit=d['exit'],mountOwnership=d['mountOwnership'])
 return result
if __name__=='__main__':
 result=accept();(E/'mounted-result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
