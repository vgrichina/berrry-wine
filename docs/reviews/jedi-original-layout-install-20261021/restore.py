"""Restore exact observed VFS files on an authorized runtime; does not run a guest.
Usage: restore.py EVIDENCE_DIR EXACT_SOURCE ORIGINAL_FILES DESTINATION
EVIDENCE_DIR is the extracted evidence.tgz. ORIGINAL_FILES contains the 39
verified files from the pinned recovery recipe. Destination must not exist.
"""
import pathlib,json,sys,hashlib
e,s,o,d=map(pathlib.Path,sys.argv[1:]);assert not d.exists()
trees=json.loads((e/'recovery-trees.json').read_text())['trees']
for tree,files in trees.items():
    for x in files:
        rec=x['recovery'];base={'source':s,'original':o,'payload':e/'recovery-payload'}[rec['kind']]
        b=(base/rec['path']).read_bytes();assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256']
        target=d/tree/x['path'];target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b)
print('Restored all observed trees with exact size/SHA256; registry exports remain in evidence stage directories.')
