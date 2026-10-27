"""Exact donor-to-candidate recipe; does not start a process or alter a cutoff.

Call transform on the pinned supervisor and stage runtime-accounting.py beside it.
The next runtime owner must supply verified immutable input hashes and a fresh
lifecycle; this recipe intentionally leaves all original resource caps unchanged.
"""
import hashlib

SOURCE_SHA256 = 'eebc983956aa092b71a527f41f5516c51376c1acf19872cb808025833953ba63'
OLD = " files=[p for root in [H,pathlib.Path('/tmp/ricochet-cleanup-round-play-oct27')] for p in root.rglob('*') if p.is_file()];allocated=sum(p.stat().st_blocks*512 for p in files);streams=sum(p.stat().st_size for p in E.glob('*.stdout'))+sum(p.stat().st_size for p in E.glob('*.stderr'));pngs=list((H/'serial').glob('*.png')) if (H/'serial').exists() else []"
NEW = """ sample=ledger.sample();allocated=sample['bytes'];sizes=sample['sizes']
 streams=sum(n for p,n in sizes.items() if p.parent==E and p.suffix in ('.stdout','.stderr'))
 pngs=[p for p in sizes if p.parent==H/'serial' and p.suffix=='.png']"""
OLD_PNG = " if len(pngs)>6 or sum(p.stat().st_size for p in pngs)>12582912 or any(p.stat().st_size>2097152 for p in pngs):return 'capture-budget'"
NEW_PNG = " if len(pngs)>6 or sum(sizes[p] for p in pngs)>12582912 or any(sizes[p]>2097152 for p in pngs):return 'capture-budget'"


def transform(source, immutable_files, secondary_root='/tmp/ricochet-cleanup-round-play-oct27'):
    assert hashlib.sha256(source).hexdigest() == SOURCE_SHA256, 'source pin mismatch'
    assert immutable_files, 'next owner must provide the immutable input closure'
    assert secondary_root.startswith('/') and '..' not in secondary_root.split('/')
    helpers=[h for p,h in immutable_files.items() if str(p).endswith('/runtime-accounting.py')]
    assert len(helpers)==1, 'exact staged accounting helper pin required'
    text = source.decode()
    assert text.count(OLD) == text.count(OLD_PNG) == 1
    setup = ("p=H/'runtime-accounting.py'\n"
             "assert hashlib.sha256(p.read_bytes()).hexdigest()=="+repr(helpers[0])+"\n"
             "s=importlib.util.spec_from_file_location('runtime_accounting',p);a=importlib.util.module_from_spec(s);s.loader.exec_module(a)\n"
             "ledger=a.RuntimeAccounting([H,pathlib.Path("+repr(secondary_root)+")],"
             "ephemeral_files={H/'serial/continue.json':25165824},"
             "immutable_files={pathlib.Path(p):h for p,h in " + repr(dict(immutable_files)) + ".items()},ceiling=268435456)\n")
    # 24 MiB is the EXISTING enforced writer RLIMIT_FSIZE; always charged within
    # the existing 256 MiB allocation, never extra allowance. Publishers must
    # enforce both logical and allocated bytes <= this reservation before use.
    text = text.replace('def check():\n', setup+'def check():\n', 1)
    text = text.replace(OLD, NEW).replace(OLD_PNG, NEW_PNG)
    text = text.replace("r['output']=r['output'].decode", "r['accounting']=ledger.receipt\nr['output']=r['output'].decode", 1)
    return text.encode()
