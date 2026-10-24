"""Inventory original raw Mac resource forks and external image containers."""
import struct

def fork(data):
    def get(fmt, at):
        n = struct.calcsize(fmt)
        assert 0 <= at <= len(data) - n, 'resource range outside file'
        return struct.unpack_from(fmt, data, at)
    offset, map_at, length, map_length = get('>4I', 0)
    assert offset + length <= len(data) and map_at + map_length == len(data), 'bad resource header'
    type_offset, name_offset = get('>2H', map_at + 24)
    types_at = map_at + type_offset
    count = get('>H', types_at)[0] + 1
    assert 0 < count < 256
    types = {}
    for i in range(count):
        at = types_at + 2 + i * 8
        kind = data[at:at+4].decode('ascii')
        n, refs = get('>2H', at + 4)
        ids = []
        assert n < 8192
        for j in range(n + 1):
            ref = types_at + refs + j * 12
            ident = get('>h', ref)[0]
            relative = int.from_bytes(data[ref+5:ref+8], 'big')
            assert relative + 4 <= length, 'resource outside data area'
            size = get('>I', offset + relative)[0]
            assert relative + 4 + size <= length, 'resource payload outside data area'
            ids.append(ident)
        assert len(ids) == len(set(ids)), 'duplicate resource ID'
        assert kind not in types, 'duplicate resource type'
        types[kind] = ids
    return types

def inventory(root):
    result = {}
    for name in ['Maelstrom_Fonts', 'Maelstrom_Sounds', 'Maelstrom_Sprites']:
        result[name] = fork((root/name).read_bytes())
    images = {}
    for p in sorted((root/'Images').iterdir()):
        b = p.read_bytes()
        if p.suffix == '.cicn':
            w, h = struct.unpack('>HH', b[:4])
            assert len(b) == 4 + w*h + (w//8)*h, 'bad CICN extent'
            images[p.name] = {'format': 'CICN', 'width': w, 'height': h}
        elif p.suffix == '.bmp':
            assert b[:2] == b'BM' and int.from_bytes(b[2:6], 'little') == len(b), 'bad BMP extent'
            w, h = struct.unpack_from('<ii', b, 18)
            images[p.name] = {'format': 'BMP', 'width': w, 'height': h}
        else: raise AssertionError('unknown image container')
    result['Images'] = images
    return result
