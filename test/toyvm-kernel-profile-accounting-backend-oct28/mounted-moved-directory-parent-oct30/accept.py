from supervisor import *
from objects import pin,path
import struct,hashlib
BASE='504a581dbab06dfb3f17997186825c02ddc9017b'
r=json.loads((E/'runtime-guards.json').read_text())
m=json.loads((E/'runtime-manifest-base.json').read_text())
life=json.loads((E/'lifecycle-proof.json').read_text())
assert life['state']=='stopped' and life['snapshotAvailable'] and life['lastSnapshotStatus']=='completed' and life['stop']['status']=='completed'
assert life['snapshotCompletedAt']>r['finishedAt']
assert r['exit']==0 and r['violation'] is None and r['mountOwnership']
assert r['observerCleanup']==dict(remainingMounts=[],processes=[])
report=r['report'];b=report['backendReceipt'];fs=b['filesystem']
assert all(report[k] for k in ['accepted','childSucceeded','accountingAccepted','cleanupComplete'])
assert b['exit']==0 and b['stopReason'] is None and b['cleanupComplete']
assert b['filesystemCleanup']['remainingMounts']==[] and b['filesystemCleanup']['unmountExit']==0
assert (fs['live'],fs['inodes'],fs['openHandles'])==(4096,1,0) and fs['failure'] is None
assert fs['written']==len(b'parent-coherence\x00exact\xff')+len(b'fresh-nested-roundtrip\x00')
steps=r['syscalls'];assert [s['step'] for s in steps]==['original','moved','moved-back','fresh-original','fresh-moved','fresh-moved-back','cleanup']
original,moved,back,fresh,fm,fb,clean=steps
left,right,ino=original['left'],original['right'],original['inode']
assert len({left,right,ino,fresh['inode'],fresh['leaf']})==5
assert moved['inode']==back['inode']==ino and moved['parent']==right and back['parent']==left
assert moved['oldAbsent'] and back['oldAbsent'] and fm['oldAbsent'] and fb['oldAbsent'] and clean['empty']
assert moved['sha256']==back['sha256']==hashlib.sha256(b'parent-coherence\x00exact\xff').hexdigest()
assert fm['sha256']==fb['sha256']==hashlib.sha256(b'fresh-nested-roundtrip\x00').hexdigest()
wire=r['rawWire'];assert 0<len(wire)<=64 and len({v['unique'] for v in wire})==len(wire)
for i,v in enumerate(wire,1):
    assert v['sequence']==i and v['errno']==0
    request=bytes.fromhex(v['requestHex']);response=bytes.fromhex(v['responseHex'])
    length,op,unique,node,uid,gid,pid,padding=struct.unpack_from('<IIQQIIII',request)
    assert (length,op,unique,node)==(len(request),v['opcode'],v['unique'],v['inode'])
    length,error,unique=struct.unpack_from('<IiQ',response)
    assert (length,error,unique)==(len(response),0,v['unique'])
    assert v['observedBoundary']=='successful os.write c_return in pinned production serve'
    if op==28:
        out=[];off=16
        while off<len(response):
            n,cookie,size,kind=struct.unpack_from('<QQII',response,off)
            name=response[off+24:off+24+size].decode();out.append(dict(inode=n,cookie=cookie,type=kind,name=name));off+=(24+size+7)&~7
        assert off==len(response) and out==v['entries']
renames=[v for v in wire if v['opcode'] in (12,45)]
assert len(renames)==4
retained=fs['renameEvidence'];assert retained['callbackCount']==4 and len(retained['records'])==4
assert [(v['opcode'],v['unique'],v['inode'],v['errno']) for v in retained['records']]==[(v['opcode'],v['unique'],v['inode'],v['errno']) for v in renames]
coverage=[]
for rename,start,end,node,parent,oldparent,oldname,newname,child in zip(renames,[original['at'],moved['at'],fresh['at'],fm['at']],[moved['at'],back['at'],fm['at'],fb['at']],[ino,ino,fresh['inode'],fresh['inode']],[right,left,right,left],[left,right,left,right],['moved,directory','new,name','fresh,nested','fresh,roundtrip'],['new,name','moved,directory','fresh,roundtrip','fresh,nested'],['child,data','child,data','leaf,dir','leaf,dir']):
    assert start<rename['at']<end and rename['inode']==oldparent
    raw=bytes.fromhex(rename['requestHex']);newdir=struct.unpack_from('<Q',raw,40)[0]
    names=raw[48 if rename['opcode']==12 else 56:].rstrip(b'\0').split(b'\0')
    assert newdir==parent and names==[oldname.encode(),newname.encode()]
    reads=[v for v in wire if v['opcode']==28 and v['inode']==node and rename['at']<v['at']<end and v['entries']]
    assert reads,'actual READDIR parent callback absent'
    matching=[]
    for v in reads:
        entries={e['name']:e for e in v['entries']}
        assert set(entries)=={'.','..',child}
        assert entries['.']['inode']==node and entries['..']['inode']==parent
        matching.append(dict(unique=v['unique'],opcode=28,inode=node,parent=parent,entries=v['entries']))
    coverage.append(dict(rename=rename,actualReadDir=matching,stableTarget=node,newParent=parent))
for step in [fm,fb]:
    reads=[v for v in wire if v['opcode']==28 and v['inode']==fresh['leaf'] and v['at']<step['at'] and v['at']>next(c['rename']['at'] for c in coverage if c['stableTarget']==fresh['inode'] and c['newParent']==step['parent']) and v['entries']]
    assert reads and all({e['name']:e['inode'] for e in v['entries']}['..']==fresh['inode'] for v in reads)
assert json.loads((E/'remote-allocation-cleanup.json').read_text())['PASS']
for rel,want in m['sourcePins'].items():assert pin((E/'stage/repo'/rel).read_bytes())==pin(path(BASE,rel)[1])==want
result=dict(status='ACTUAL_MOUNTED_MOVED_DIRECTORY_PARENT_PASS',objectiveQualified=True,qualifiedSource=BASE,productionMountedInvocations=1,rawObservation='Unchanged production CLI and backend files. Read-only sys.setprofile hook observes successful os.write c_return; response reconstructed byte-exactly from that active serve frame, independently decoded and paired to raw request. No backend invocation, result mutation, forced gueststate, or path-only parent inference.',moves=coverage,fixtureMarkers=steps,finalFilesystem=fs,actualWireCallbacks=wire,lifecycle=life,production=dict(exit=r['exit'],startedAt=r['startedAt'],finishedAt=r['finishedAt'],wall=r['wall'],groupPeakRSS=r['groupPeakRSS']),sourcePins=m['sourcePins'],scope='One mounted qualification of exact Python production closure at pinned source; unchanged accepted RELEASE-WRITE and broad source/mutant groups reused.')
(E/'mounted-result.json').write_text(json.dumps(result,indent=2))
print(json.dumps(dict(PASS=True,moves=len(coverage),READDIRResponses=sum(v['opcode']==28 for v in wire),wireCallbacks=len(wire),box=life['id'])))
