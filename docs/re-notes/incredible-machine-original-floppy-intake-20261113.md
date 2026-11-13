# The Incredible Machine original floppy candidate intake (2026-11-13)

The complete candidate floppy was inspected read-only in RAM, extending owner187's
initial TIM.EXE/READ.ME check. All 11 ordinary files are complete and hashed below.
This is a byte-level intake result, not publisher authentication, proof of a retail
or full-version release, an installed corpus entry, or a gameplay result.

Evidence: `scratch/runs/20261113-tim-floppy-manifest-0825/` contains
`manifest.json`, the exact `inspect-floppy.py` reader reproduced below, validation
and provenance metadata. Initial source context was main
`702488f93a294b25917784c79a108620179bea5d`; the evidence records the exact final
Git context and owned document patch. No source tree or media is archived there.

## Observed media identity

- Source: <https://archive.org/details/000821-TheIncredibleMachine>
- Exact archive: <https://archive.org/download/000821-TheIncredibleMachine/000821_the_incredible_machine.7z>
- Archive bytes: **429273**.
- Archive SHA-1: `3ca8f05a94afdf1766a99f25f5457fc9a4f4d17b`.
- Archive SHA-256: `bfd1ea462ca82384fc6dff49343aaf6c7a47df087b0eb3e79f1c8398c55d828c`.
- Sole ordinary archive member: `000821_the_incredible_machine/disk1.img`; one parent directory entry.
- Image bytes: **1474560**; CRC32 `64F15085`.
- Image SHA-1: `f0ed16b665ad2378c59c1d1d9370479ca2eb494e`.
- Image SHA-256: `d0e78876d50609b254420cdf7c0724a117a8ed714ea7c683c19e0d2094ce0657`.

The existing `/dev/shm/wine-owner187-tim.7z` and
`/dev/shm/wine-owner187-tim-disk.img` were borrowed read-only after full identity
verification. Decompressing the archive member into a subprocess pipe produced
exactly the borrowed image bytes; the archive member CRC also matched. Both
`7z t` checks passed (7-Zip 23.01). No HTTP fetch was needed for this run.

The image has a FAT12 filesystem with 512-byte sectors/clusters, 2,880 sectors,
one reserved sector, two identical nine-sector FATs and 224 root entry slots.
The root starts at byte 9,728; data starts at byte 16,896. There are 2,847 data
clusters: 1,435 allocated and 1,412 free (722,944 bytes). The `TIM 1` entry has
attribute 0x28 (volume label plus archive), zero size and no cluster. It is not
an ordinary payload, despite appearing in 7-Zip's 12-entry file listing.
There are no subdirectories, deleted entries or long-name entries in this image.

## Complete ordinary payload manifest

Paths are relative to the floppy root. Hashes cover every logical payload byte,
excluding FAT allocation slack. All ordinary file attributes are 0x20.

| Path | Bytes | Full SHA-256 |
| --- | ---: | --- |
| `CATOMATC.TIM` | 740 | `80f43e32744589070434d6341071b30c283ec39f6f67fd93782df7c0de9c0f1f` |
| `INSTALL.COM` | 30830 | `a2a609fa8aab61e950c00e3b59f98edf03a26ff183665eb813a3a60b94cfa531` |
| `MOUSE.TIM` | 3376 | `99b3ed90d08986cda5c476f448e61ee5f872e7ebb526f13bda01d9608ff04b9d` |
| `READ.ME` | 469 | `352ba57dc062e7ddcb93e3e40f06de966072afdfe39fd0e61be1e997b6aa5821` |
| `RESOURCE.001` | 196578 | `bdad526b53414c363d9f48120549da5504f4a03bba4d55258ebaff6f24a547eb` |
| `RESOURCE.002` | 163032 | `8c8a2a33371b40945735443c878005d4361a6c08dd1ae32136d2c247b9408567` |
| `RESOURCE.003` | 220123 | `102a484b8baacd1e92aed28650fed41fc7304b2b3466871d33a38ebf63e45327` |
| `RESOURCE.004` | 2815 | `44f56fe3e3cc6931683b43dab072408a7f00db2a84ffe0e58ea51e29f3bc5ca8` |
| `RESOURCE.MAP` | 1338 | `5ac303e00ce1e62222015bc6130b9cba802fa0f9e1c334b7a5ba336c327e47a4` |
| `TIM.EXE` | 111951 | `34c844ba4586f27c817442ac5ed2f5b76e35d0c6521a9a9d4e7db66404e7c51c` |
| `TONSOFUN.TIM` | 1046 | `4e2d760f92f87d200f34af8cf3f3f2acf4a139a8f3df2165250fa8b2074dab0e` |

The payload total is **732,298 bytes**, occupying 734,720 allocated bytes. The
reader walks every live FAT root entry, follows every file cluster through its
end marker, checks exact ceiling(size/512) chain lengths and bounds, rejects
cycles/crosslinks, compares both FATs, and accounts for every allocated data
cluster. There are no orphan, bad or reserved-valued data clusters. It compares
the ordinary path/size set against an independent 7-Zip listing and every complete
file against `7z x -so`. `manifest.json` additionally retains each file's SHA-1,
cluster chain and allocation size. The full image hashes cover boot/FAT/root,
free space and slack as well as payloads.

The prior `tim-package-listing.json`, `tim-floppy-layout.json` and
`tim-executable-identity.json` in
`scratch/runs/20261113-coordinator-owner186-corpus/` agree with the archive,
image, ordinary path/size set, complete TIM.EXE and complete READ.ME identities.
The prior README spelling denotes the actual file `READ.ME`.

## Release identification, controls and execution route

The 469-byte READ.ME self-identifies as **The Incredible Machine, Release Notes,
version 1.0**. It documents keyboard input: 1–9 and a–g change Freeform music;
Alt-V displays the version from the Control Panel; Tab moves between hotspots;
arrow keys move the cursor; Space/Enter act as the left mouse button; Esc opens
the Control Panel; X/Y flip a shape; plus/minus resize a shape. These are observed
release-note input requirements for future testing; none were exercised.
The notes do not establish hardware, installation or complete retail requirements.

TIM.EXE is an MZ executable. Interpreting offset 0x3c as a new-header pointer gives
2,416,348,160, beyond its 111,951-byte length; there is no PE signature there.
This supports the **DOS MZ candidate route**, rather than a Windows PE registry
entry. It does not prove runtime compatibility. INSTALL.COM and all resource
and puzzle companions are preserved by the manifest; no installer or game ran.

Publisher authenticity remains **unknown**. A hash match proves repeatable bytes
from this candidate, not an authentic publisher master or retail/full-version
completeness. The manifest establishes all ordinary files on this single supplied
floppy, not that no other original media was required. No binaries were staged on
/home or added to Git, no corpus/app entry was created, and installed availability
and original puzzle gameplay remain unverified.

## Exact intake and recovery recipe

Prerequisites: Bash, Python 3 and 7-Zip (this run used 23.01). Run the shell blocks
in one shell. Save the Python block below as `"$tim_ram/inspect-floppy.py"`.
The shell trap removes only this newly created private RAM directory. Bounded
HTTP is a fresh recovery option; this run borrowed the verified existing RAM
paths instead. A failed fetch/identity check stops; do not bypass it or retry a
denied operation. No game execution, mounting, emulator, browser or box is needed.

```bash
set -euo pipefail
tim_ram=$(mktemp -d /dev/shm/wine-tim-intake.XXXXXXXX)
trap 'rm -rf -- "$tim_ram"' EXIT
curl --fail --location --max-redirs 5 --retry 0 --connect-timeout 15 \
  --max-time 60 --max-filesize 429273 \
  'https://archive.org/download/000821-TheIncredibleMachine/000821_the_incredible_machine.7z' \
  --output "$tim_ram/tim.7z"
python3 - "$tim_ram/tim.7z" <<'PY'
import hashlib, pathlib, sys
b = pathlib.Path(sys.argv[1]).read_bytes()
assert len(b) == 429273
assert hashlib.sha1(b).hexdigest() == '3ca8f05a94afdf1766a99f25f5457fc9a4f4d17b'
assert hashlib.sha256(b).hexdigest() == 'bfd1ea462ca82384fc6dff49343aaf6c7a47df087b0eb3e79f1c8398c55d828c'
PY
7z x -so "$tim_ram/tim.7z" \
  '000821_the_incredible_machine/disk1.img' > "$tim_ram/disk1.img"
# Save the Python block below as "$tim_ram/inspect-floppy.py", then continue.
```

```python
#!/usr/bin/env python3
"""Read-only complete TIM candidate inspection. Media stays in RAM; JSON to stdout."""
import hashlib, json, math, pathlib, struct, subprocess, sys, zlib

archive_path, image_path = map(pathlib.Path, sys.argv[1:3])
def digest(b):
    return dict(bytes=len(b), sha1=hashlib.sha1(b).hexdigest(), sha256=hashlib.sha256(b).hexdigest())
def seven(*args):
    p = subprocess.run(['7z', *map(str, args)], capture_output=True, timeout=30)
    assert p.returncode == 0, (args, p.returncode, p.stderr.decode(errors='replace'))
    return p.stdout
def listing(path):
    s = seven('l', '-slt', path).decode()
    rows = []
    for block in s.split('----------\n', 1)[1].strip().split('\n\n'):
        rows.append(dict(line.split(' = ', 1) for line in block.splitlines() if ' = ' in line))
    return rows

a, d = archive_path.read_bytes(), image_path.read_bytes()
assert len(a) == 429273 and hashlib.sha1(a).hexdigest() == '3ca8f05a94afdf1766a99f25f5457fc9a4f4d17b'
assert hashlib.sha256(a).hexdigest() == 'bfd1ea462ca82384fc6dff49343aaf6c7a47df087b0eb3e79f1c8398c55d828c'
assert len(d) == 1474560 and hashlib.sha256(d).hexdigest() == 'd0e78876d50609b254420cdf7c0724a117a8ed714ea7c683c19e0d2094ce0657'
member = '000821_the_incredible_machine/disk1.img'
al = listing(archive_path)
assert [r['Path'] for r in al if 'D' not in r['Attributes']] == [member]
assert seven('x', '-so', archive_path, member) == d
assert '%08X' % zlib.crc32(d) == next(r['CRC'] for r in al if r['Path'] == member)
archive_test, image_test = [seven('t', p).decode() for p in (archive_path, image_path)]
u16 = lambda n: struct.unpack_from('<H', d, n)[0]
u32 = lambda n: struct.unpack_from('<I', d, n)[0]
bps, spc, reserved, nfats, roots = u16(11), d[13], u16(14), d[16], u16(17)
total, spf = u16(19) or u32(32), u16(22)
root_sectors = (roots * 32 + bps - 1) // bps
root_start = (reserved + nfats * spf) * bps
data_start = root_start + root_sectors * bps
cluster_bytes = bps * spc
clusters = (total * bps - data_start) // cluster_bytes
assert (bps, spc, reserved, nfats, roots, total, spf) == (512, 1, 1, 2, 224, 2880, 9)
assert total * bps == len(d) and d[510:512] == b'\x55\xaa' and clusters < 4085
fat = d[reserved*bps:(reserved+spf)*bps]
assert all(d[(reserved+i*spf)*bps:(reserved+(i+1)*spf)*bps] == fat for i in range(nfats))
def fat12(c):
    v = int.from_bytes(fat[c*3//2:c*3//2+2], 'little')
    return (v >> 4 if c & 1 else v) & 4095
assert fat12(0) == 0xf00 | d[21] and fat12(1) >= 0xff8
used, files, labels, directories, deleted, payloads = {}, [], [], [], [], {}
def chain(first, owner):
    result = []
    c = first
    while c:
        assert 2 <= c < clusters + 2 and c not in used, (owner, c, 'invalid/crosslinked/cyclic')
        used[c] = owner
        result.append(c)
        nxt = fat12(c)
        if nxt >= 0xff8:
            return result
        assert 2 <= nxt < clusters + 2, (owner, c, nxt)
        c = nxt
    return result
def bytes_for(cs):
    return b''.join(d[data_start+(c-2)*cluster_bytes:data_start+(c-1)*cluster_bytes] for c in cs)
def walk(raw, parent=''):
    for off in range(0, len(raw), 32):
        e = raw[off:off+32]
        if not e[0]:
            break
        if e[0] == 0xe5:
            deleted.append(dict(parent=parent, entryOffset=off)); continue
        assert e[11] != 0x0f, 'LFN requires another decoder'
        stem, ext = e[:8].decode('ascii').rstrip(), e[8:11].decode('ascii').rstrip()
        name = stem + ('.' + ext if ext else '')
        path = parent + name
        c, size = struct.unpack_from('<H', e, 26)[0], struct.unpack_from('<I', e, 28)[0]
        if e[11] & 8:
            assert not e[11] & 16 and c == size == 0
            labels.append(dict(label=e[:11].decode('ascii').rstrip(), attributes=e[11], bytes=size)); continue
        if name in ('.', '..'):
            continue
        cs = chain(c, path)
        if e[11] & 16:
            directories.append(path + '/')
            walk(bytes_for(cs), path + '/')
            continue
        assert len(cs) == math.ceil(size / cluster_bytes), (path, 'size/chain mismatch')
        content = bytes_for(cs)[:size]
        assert len(content) == size and path not in payloads
        assert seven('x', '-so', image_path, path) == content, (path, '7z byte mismatch')
        payloads[path] = content
        files.append(dict(path=path, **digest(content), attributes=e[11], firstCluster=c,
                          clusters=cs, allocatedBytes=len(cs)*cluster_bytes, sevenZipBytesMatch=True))
walk(d[root_start:data_start])
il = listing(image_path)
ordinary = {r['Path']: int(r['Size']) for r in il if r['Folder'] == '-' and '8' not in r['Attributes']}
assert ordinary == {r['path']: r['bytes'] for r in files}
allocated = {c for c in range(2, clusters+2) if fat12(c) != 0}
assert allocated == set(used), 'unaccounted allocated/bad/reserved cluster'
assert len(files) == 11 and not directories
prior_exe = '34c844ba4586f27c817442ac5ed2f5b76e35d0c6521a9a9d4e7db66404e7c51c'
prior_readme = '352ba57dc062e7ddcb93e3e40f06de966072afdfe39fd0e61be1e997b6aa5821'
assert digest(payloads['TIM.EXE'])['sha256'] == prior_exe and len(payloads['TIM.EXE']) == 111951
assert digest(payloads['READ.ME'])['sha256'] == prior_readme and len(payloads['READ.ME']) == 469
e = payloads['TIM.EXE']
assert e[:2] == b'MZ'
new_offset = struct.unpack_from('<I', e, 60)[0]
new_sig = e[new_offset:new_offset+4]
assert new_sig != b'PE\0\0'
out = dict(schema='tim-complete-floppy-intake-v1',
    sourceUrl='https://archive.org/download/000821-TheIncredibleMachine/000821_the_incredible_machine.7z',
    archive=dict(path=str(archive_path), **digest(a), members=al, integrityTest=archive_test),
    image=dict(path=str(image_path), member=member, **digest(d), crc32='%08X' % zlib.crc32(d), integrityTest=image_test),
    filesystem=dict(type='FAT12', bytesPerSector=bps, sectorsPerCluster=spc, reservedSectors=reserved,
        fatCopies=nfats, sectorsPerFat=spf, rootEntries=roots, totalSectors=total,
        rootOffset=root_start, dataOffset=data_start, dataClusters=clusters, fatCopiesMatch=True,
        volumeLabels=labels, directories=directories, deletedEntries=deleted,
        usedClusters=len(used), freeClusters=clusters-len(used), freeBytes=(clusters-len(used))*cluster_bytes),
    files=sorted(files, key=lambda r:r['path']),
    checks=dict(archiveIdentity=True, extractedImageEqualsBorrowedImage=True, archiveCRC=True,
        everyFileComplete=True, exactClusterCounts=True, noCrosslinksOrCycles=True,
        noUnaccountedAllocatedClusters=True, independentSevenZipFileSetSizesAndBytes=True,
        priorTimExeMatch=True, priorReadmeMatch=True, ordinaryFiles=len(files),
        payloadBytes=sum(r['bytes'] for r in files), allocatedBytes=len(used)*cluster_bytes),
    executable=dict(path='TIM.EXE', magic=e[:2].hex(), newHeaderOffset=new_offset,
        newHeaderInBounds=new_offset+4<=len(e), newHeaderHex=new_sig.hex(), isPE=False,
        route='DOS MZ candidate; no runtime tested'),
    releaseNotes=dict(path='READ.ME', text=payloads['READ.ME'].decode('ascii')),
    scope=dict(publisherAuthenticity='UNKNOWN', retailOrFullVersionProof='NOT_ESTABLISHED',
        installedCorpusAvailability='NOT_ESTABLISHED', gameplay='NOT_RUN', box='NONE_NOT_CREATED'))
print(json.dumps(out, indent=2))
```

```bash
# JSON is metadata only. Send it to a new owned evidence directory if retaining it.
python3 "$tim_ram/inspect-floppy.py" "$tim_ram/tim.7z" "$tim_ram/disk1.img"
# The Python inspector pins the full archive/image identities, verifies the archive
# CRC and all FAT/file completeness conditions, and emits every full file hash.
# Exit this shell to run its private RAM cleanup trap.
```

For the borrowed-path variant, save the same inspector under an owned small
evidence directory and invoke it with the two existing /dev/shm paths above.
Do not remove or modify those borrowed media files. This run created no temporary
RAM files and therefore removed none. The pipe outputs existed only in process
memory. No runtime/box was created: box ID NONE, state NOT_CREATED, expiry null,
stop receipt not applicable; no runtime deadline watchdog was needed.

The next work is a separately authorized complete installed DOS corpus intake
and actual original puzzle input test with captures when capacity permits.
This document creates no runnable entry and makes no startup/gameplay claim.
