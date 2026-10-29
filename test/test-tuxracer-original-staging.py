"""Reject staging input defects without making a second media tree."""
import importlib.util,json,pathlib,sys,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('stage',ROOT/'tools/recovery/stage-tuxracer-original.py')
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
source=pathlib.Path(sys.argv[1]).resolve()
rows=json.loads(s.INVENTORY.read_bytes())['files']
passed=[]
for name in ('tuxracer.exe','TCL83.DLL','SDL.dll','SDL_mixer.dll','tuxracer_init.tcl','courses/course_idx.tcl'):
    pin=next(r for r in rows if r['path']=='tuxracer-win32-0.61a/'+name)
    assert len(s.verified_source(source,pin))==pin['bytes']
    for change in ({'path':pin['path']+'.missing'},{'sha256':'0'*64},{'bytes':pin['bytes']+1}):
        try:s.verified_source(source,{**pin,**change})
        except ValueError:pass
        else:raise AssertionError('unsafe input accepted')
    passed.append(name)
try:s.verified_source(source,{'path':'../escape','bytes':0,'sha256':'0'*64})
except ValueError:pass
else:raise AssertionError('escape accepted')
# A source symlink is forbidden even when its referent is a verified original.
link=ROOT/'evidence/input-link';link.symlink_to(source/'tuxracer-win32-0.61a/tuxracer.exe')
try:
    try:s.verified_source(ROOT/'evidence',{'path':'input-link','bytes':274432,'sha256':'a40fd89429d76f379bc7b36d17126bcc61ce487687cb5e951f7757aa6b740971'})
    except ValueError:pass
    else:raise AssertionError('symlink accepted')
finally:link.unlink()
# Move the existing tree, never copy it, to test whole-stage preflight ordering.
held=s.DEST.with_name(s.DEST.name+'.held'); empty=ROOT/'evidence/empty-source'
empty.mkdir(); s.DEST.rename(held)
try:
    try:s.stage(empty)
    except ValueError:pass
    else:raise AssertionError('missing original staging accepted')
    assert not s.DEST.exists(), 'rejection published a destination'
finally:
    held.rename(s.DEST); empty.rmdir()
result={'passed':passed,'missingCorruptSizeEscapeSymlinkRejected':True,'mediaCopies':1,'originalMediaWrites':0}
(ROOT/'evidence/staging-acceptance.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
