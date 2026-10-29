#!/usr/bin/env python3
"""Stage retained original 0.61a files; never extract, download or execute Tcl.

Usage: python3 tools/recovery/stage-tuxracer-original.py EXTRACTED_ROOT
Writes test/binaries/candidates/tuxracer-original-061a in this repository.
Computed Tcl/full-media closure and runtime acceptance remain UNKNOWN.
"""
import hashlib,json,pathlib,shutil,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
INVENTORY=REPO/'test/candidate-corpus/tuxracer-original-files.json'
DEST=REPO/'test/binaries/candidates/tuxracer-original-061a'
# Inventory identity is also pinned by the shared registry loader.
INVENTORY_SHA='2c2d29a9dc7e5f9bc9e972b408fd83dbb17e8ca48a6aed09ffd375830284d8d8'
def verified_source(source, row):
    rel=pathlib.PurePosixPath(row['path'])
    if rel.is_absolute() or any(p in ('..','.') for p in rel.parts):
        raise ValueError('unsafe inventory path')
    file=source.joinpath(*rel.parts)
    if any(p.is_symlink() for p in [file,*file.parents] if p != source.parent):
        raise ValueError('symlink input rejected')
    if not file.resolve().is_relative_to(source) or not file.is_file():
        raise ValueError('missing or escaping required original: '+row['path'])
    data=file.read_bytes()
    if len(data)!=row['bytes'] or hashlib.sha256(data).hexdigest()!=row['sha256']:
        raise ValueError('corrupt required original: '+row['path'])
    return data

def stage(source):
    raw=INVENTORY.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=INVENTORY_SHA:raise ValueError('inventory identity')
    rows=json.loads(raw)['files']; source=pathlib.Path(source).resolve(strict=True)
    if DEST.exists() or DEST.is_symlink():raise ValueError('destination already exists')
    if not DEST.resolve().is_relative_to(REPO):raise ValueError('destination escape')
    # First validate the entire payload without writing or publishing any asset.
    for row in rows:verified_source(source,row)
    DEST.mkdir(parents=True)
    try:
        manifest=[]
        for row in rows:
            data=verified_source(source,row)
            rel=row['path']; target=DEST/'game'/rel
            target.parent.mkdir(parents=True,exist_ok=True)
            with target.open('xb') as f:f.write(data)
            if not rel.lower().endswith('.exe'):
                manifest.append({'url':'game/'+rel,'vfsPath':'c:\\'+rel.replace('/','\\'),'size':row['bytes']})
        (DEST/'.wine-assembly-browser.json').write_text(json.dumps({'schemaVersion':1,'files':manifest},indent=2)+'\n')
    except BaseException:
        shutil.rmtree(DEST)
        raise
    return {'destination':str(DEST),'files':len(rows),'bytes':sum(r['bytes'] for r in rows),
            'computedTclClosure':'UNKNOWN','runtime':'NOT RUN'}
if __name__=='__main__':
    if len(sys.argv)!=2:raise SystemExit(__doc__)
    print(json.dumps(stage(sys.argv[1])))
