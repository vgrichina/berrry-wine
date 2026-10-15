#!/usr/bin/env node
'use strict';
// Hash-pinned ZIP extraction; no executable is run. Python's ZIP reader checks CRCs.
const cp = require('child_process');
if (process.argv.length !== 4) throw Error('Usage: extract-outlaws-demo.js PACKAGE NEW_DIRECTORY');
const python = String.raw`
import zipfile, pathlib, hashlib, json, sys, stat, struct
p, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
data = p.read_bytes()
assert hashlib.sha256(data).hexdigest() == '501f37aa475b6c27c87ce04e30b5207f91b81603cb376aaa9ffde1647a40e7b3'
assert not out.exists(), 'output must be new'
z = zipfile.ZipFile(p)
members = z.infolist()
assert sum(i.file_size for i in members) <= 256*1024*1024
names = set()
for i in members:
    n = pathlib.PurePosixPath(i.filename)
    assert not n.is_absolute() and '..' not in n.parts and '\\' not in i.filename and ':' not in i.filename
    assert i.filename not in names and not i.is_dir() and not (i.flag_bits & 1)
    assert not stat.S_ISLNK(i.external_attr >> 16)
    names.add(i.filename)
out.mkdir()
records = []
for i in members:
    b = z.read(i)
    assert len(b) == i.file_size
    target = out / i.filename
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('xb') as f: f.write(b)
    r = dict(path=i.filename, size=len(b), sha256=hashlib.sha256(b).hexdigest(), crc32='%08x'%i.CRC)
    if len(b) >= 64 and b[:2] == b'MZ':
        off = struct.unpack_from('<I',b,60)[0]
        if off+24 <= len(b) and b[off:off+4] == b'PE\0\0':
            r['pe'] = dict(machine=hex(struct.unpack_from('<H',b,off+4)[0]), sections=struct.unpack_from('<H',b,off+6)[0], timestamp=struct.unpack_from('<I',b,off+8)[0], characteristics=hex(struct.unpack_from('<H',b,off+22)[0]), magic=hex(struct.unpack_from('<H',b,off+24)[0]), entryRva=hex(struct.unpack_from('<I',b,off+40)[0]), imageBase=hex(struct.unpack_from('<I',b,off+52)[0]))
        else: r['nonPeMzSignature'] = b[off:off+2].hex()
    records.append(r)
result = dict(packageSha256=hashlib.sha256(data).hexdigest(), fileCount=len(records), expandedBytes=sum(r['size'] for r in records), files=records)
(out.parent / (out.name+'-inventory.json')).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
`;
process.stdout.write(cp.execFileSync('python3', ['-c', python, ...process.argv.slice(2)], {timeout: 60000, maxBuffer: 4*1024*1024, encoding:'utf8'}));
