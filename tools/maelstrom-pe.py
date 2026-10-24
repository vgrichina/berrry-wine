"""Small bounded PE32 import/export reader; never executes acquired code."""
import struct

class PE:
    def __init__(self, data):
        self.b = data
        assert data[:2] == b'MZ', 'missing MZ'
        h = self.u32(0x3c)
        assert self.take(h, 4) == b'PE\0\0', 'missing PE'
        self.machine = self.u16(h + 4)
        self.timestamp = self.u32(h + 8)
        n = self.u16(h + 6)
        optional = h + 24
        assert self.machine == 0x14c and self.u16(optional) == 0x10b, 'not i386 PE32'
        self.entry_rva = self.u32(optional + 16)
        self.image_base = self.u32(optional + 28)
        self.subsystem = self.u16(optional + 68)
        self.sections = []
        for i in range(n):
            s = optional + self.u16(h + 20) + i * 40
            self.sections.append((self.u32(s + 12), self.u32(s + 16), self.u32(s + 20)))
        self.directories = []
        assert self.u32(optional + 92) <= 16, 'unexpected directory count'
        for i in range(self.u32(optional + 92)):
            self.directories.append((self.u32(optional + 96 + i * 8), self.u32(optional + 100 + i * 8)))
        assert len(self.directories) >= 14
        assert self.directories[13] == (0, 0), 'unhandled delay imports'
        self.offset(self.entry_rva)

    def take(self, at, count):
        assert 0 <= at <= len(self.b) and 0 <= count <= len(self.b) - at, 'PE range outside file'
        return self.b[at:at + count]

    def u16(self, at): return struct.unpack('<H', self.take(at, 2))[0]
    def u32(self, at): return struct.unpack('<I', self.take(at, 4))[0]

    def offset(self, rva):
        for start, size, raw in self.sections:
            if start <= rva < start + size:
                off = raw + rva - start
                self.take(off, 1)
                return off
        raise AssertionError('RVA not backed by file: ' + hex(rva))

    def string(self, rva):
        at = self.offset(rva)
        end = self.b.find(b'\0', at, min(len(self.b), at + 4096))
        assert end >= at, 'unterminated PE string'
        return self.b[at:end].decode('ascii')

    def imports(self):
        rva, size = self.directories[1]
        if not rva: return {}
        result = {}
        for i in range(size // 20):
            at = self.offset(rva + i * 20)
            original, stamp, chain, name, first = struct.unpack('<5I', self.take(at, 20))
            if not any((original, stamp, chain, name, first)): return result
            dll = self.string(name).lower()
            assert dll not in result, 'duplicate import descriptor'
            symbols = []
            for j in range(8192):
                thunk = self.u32(self.offset((original or first) + 4 * j))
                if not thunk: break
                symbols.append('#' + str(thunk & 0xffff) if thunk & 0x80000000 else self.string(thunk + 2))
            else: raise AssertionError('unterminated import thunk')
            result[dll] = symbols
        raise AssertionError('unterminated import directory')

    def exports(self):
        rva, size = self.directories[0]
        if not rva: return {}
        at = self.offset(rva)
        base, functions, names, addr, nameaddr, ordaddr = struct.unpack('<6I', self.take(at + 16, 24))
        assert names <= functions <= 8192
        result = {}
        for i in range(functions):
            target = self.u32(self.offset(addr + i * 4))
            if target:
                result['#' + str(base + i)] = self.string(target) if rva <= target < rva + size else None
                if not rva <= target < rva + size: self.offset(target)
        for i in range(names):
            name = self.string(self.u32(self.offset(nameaddr + i * 4)))
            ordinal = base + self.u16(self.offset(ordaddr + i * 2))
            assert '#' + str(ordinal) in result
            result[name] = result['#' + str(ordinal)]
        return result

    def record(self):
        return {'machine': self.machine, 'entry_rva': self.entry_rva, 'image_base': self.image_base,
                'entry_va': self.image_base + self.entry_rva, 'timestamp': self.timestamp,
                'subsystem': self.subsystem, 'imports': self.imports(), 'exports': self.exports()}
