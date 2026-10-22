import pathlib,sys,json,hashlib,os,datetime
O=pathlib.Path('/home/user/shadow-man-child-installer-handoff-oct22');R=pathlib.Path('/home/user/shadow-man-original-oct22')
sys.path.insert(0,'/home/user/shadow-man-real-clock-extraction-oct22');import preflight as old
before=json.loads((O/'preflight.json').read_text());assert old.seals()==before['seals']
for row in before['previous']:
 p=pathlib.Path(row['path']);assert p.stat().st_size==row['size'] and old.sha(p)==row['sha256'],str(p)
assert not (O/'attempt.json').exists()
source=R/'runtime/lib/filesystem.js';(O/'source-lib_filesystem.js').write_bytes(source.read_bytes())
fixture=json.loads((O/'transport-check.stdout').read_text());assert fixture['passAll'] and fixture['guestAttempts']==0
members=json.loads((R/'recovery/extracted-members.json').read_text())['extractedMembers'];media=sum(x['bytes'] for x in members);assert media==73339636
outputs=json.loads(pathlib.Path('/home/user/shadow-man-real-clock-extraction-oct22/outputs.json').read_text());payload=sum(x['length'] for x in outputs);assert payload==656970
projected=2*(media+payload);cap=128*1024**2;reserve=16*1024**2
out=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),result='BLOCKED_OFFLINE_NO_MEDIA_COPY_TRANSPORT',guestAttempts=0,childAttempts=0,retries=0,originalSeals=len(before['seals']),previousSeals=len(before['previous']),preserved=True,mediaBytes=media,extractedPayloadBytes=payload,defaultTwoSnapshotLowerBound=projected,cap=cap,reserve=reserve,withReserve=projected+reserve,excessBeforeReserve=projected-cap,noMediaCopyViolationAtFirstInputSnapshot=True,fixture=fixture,cleanup=old.conflicts(),remoteFree=os.statvfs(O).f_bavail*os.statvfs(O).f_frsize,module=dict(path=str(R/'runtime/build/wine-assembly.wasm'),bytes=(R/'runtime/build/wine-assembly.wasm').stat().st_size,sha256=old.sha(R/'runtime/build/wine-assembly.wasm')),newBytes=sum(p.stat().st_size for p in O.rglob('*') if p.is_file()))
(O/'analysis.json').write_text(json.dumps(out,indent=2));
manifest=[dict(path=p.relative_to(O).as_posix(),size=p.stat().st_size,sha256=old.sha(p)) for p in sorted(O.rglob('*')) if p.is_file()]
(O/'manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps(out))
