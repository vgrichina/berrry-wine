import pathlib,json,hashlib,shutil,sys
from supervisor import R,E,D,run,save,admission
DEST=R/'test/binaries/candidates/tuxracer-original-061a'
held=DEST.with_name(DEST.name+'.held')
fixture=R/'fixtures/staging-input';fixture.mkdir(parents=True)
rows=json.loads((R/'test/candidate-corpus/tuxracer-original-files.json').read_text())['files']
assert rows[0]['path']=='tuxracer-win32-0.61a/TCL83.DLL'
source=pathlib.Path(D['originalExtractedRoot'])
target=fixture/rows[0]['path'];target.parent.mkdir(parents=True)
original=(source/rows[0]['path']).read_bytes()
outcomes=[]
def attempt(label,src=fixture):
 rc,out,err=run(['/usr/bin/python3','tools/recovery/stage-tuxracer-original.py',str(src)],cwd=R)
 record={'label':label,'exit':rc,'stderr':err.decode(),'stdout':out.decode(),'destinationExists':DEST.exists(),'destinationSymlink':DEST.is_symlink()}
 outcomes.append(record);save('staging-cli-progress.json',outcomes)
 assert rc!=0,label+' unexpectedly accepted'
 assert not DEST.exists() and not DEST.is_symlink(),label+' published destination'
admission('staging CLI negative fixtures')
DEST.rename(held)
try:
 attempt('required TCL DLL missing: no destination')
 target.write_bytes(bytes([original[0]^1])+original[1:]);attempt('TCL DLL same-size hash corruption')
 target.write_bytes(original[:-1]);attempt('TCL DLL size truncation')
 target.unlink();target.symlink_to(source/rows[0]['path']);attempt('symlink to valid original rejected')
 target.unlink();target.write_bytes(original);attempt('later required asset missing after valid first DLL')
 # Full source is genuine and read-only; owned inventory is disposable.
 inventory=R/'test/candidate-corpus/tuxracer-original-files.json';saved=inventory.read_bytes()
 for label,mutate in [
  ('inventory path escape',lambda x:x['files'][0].update(path='../escape')),
  ('inventory absolute path',lambda x:x['files'][0].update(path='/tmp/escape')),
  ('inventory incorrect hash',lambda x:x['files'][0].update(sha256='0'*64)),
  ('inventory incorrect size',lambda x:x['files'][0].update(bytes=1)),
  ('inventory omitted executable',lambda x:x.update(files=[r for r in x['files'] if not r['path'].endswith('.exe')]))]:
  value=json.loads(saved);mutate(value);inventory.write_text(json.dumps(value))
  try:attempt(label,source)
  finally:inventory.write_bytes(saved)
finally:
 # No successful negative operation is permitted to create this destination.
 if not DEST.exists() and not DEST.is_symlink():held.rename(DEST)
shutil.rmtree(R/'fixtures')
save('staging-cli.json',{'results':outcomes,'stagingCLI':'tools/recovery/stage-tuxracer-original.py','oneOwnedTree':True,'originalMediaWrites':0,'helperAssertionsSubstituted':False})
print(json.dumps({'stagingCLIRejections':len(outcomes),'passed':True,'ownedFixtureCleanup':True}))
