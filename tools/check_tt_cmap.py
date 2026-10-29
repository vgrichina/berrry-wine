#!/usr/bin/env python3
"""Assert that a TTF's cmap resolves characters the way the emulator will.

The WAT TrueType layer (src/10c-truetype.wat, $tt_cmap_best /
$tt_cmap_lookup_at) consults exactly one cmap subtable — the first found
in the preference order (3,1), (3,0), (0,3), (0,0), (1,0) — and understands
only formats 4, 0 and 6. A font whose (3,1) subtable is format 12 (the
usual layout for full CJK fonts) therefore resolves *nothing* through the
emulator even though desktop tools read it fine: the preferred subtable
shadows every other one and its format is unimplemented.

This checker replays the WAT algorithm byte-for-byte over a font and a
character list, and fails if the preferred subtable has an unsupported
format or any listed character resolves to glyph 0. It exists so the font
generation flow (tools/gen-font-subsets.sh, tools/gen-noto-tc.py) proves
"$tt_cmap_best can hit this font" instead of eyeballing it.

Usage: check_tt_cmap.py <font.ttf> <chars.txt>
chars.txt holds one U+XXXX code point per line (# comments allowed).
"""

import struct
import sys


def u16(buf, off):
    return struct.unpack_from('>H', buf, off)[0]


def u32(buf, off):
    return struct.unpack_from('>I', buf, off)[0]


def table_dir(buf, tag):
    num = u16(buf, 4)
    for i in range(num):
        rec = 12 + i * 16
        if buf[rec:rec + 4] == tag:
            return u32(buf, rec + 8), u32(buf, rec + 12)
    return None, None


PREFERENCE = [(3, 1), (3, 0), (0, 3), (0, 0), (1, 0)]


def cmap_best(buf):
    """Offset of the subtable $tt_cmap_best picks, and its format."""
    off, _ = table_dir(buf, b'cmap')
    if off is None:
        return None, None
    count = u16(buf, off + 2)
    subs = {}
    for i in range(count):
        rec = off + 4 + i * 8
        key = (u16(buf, rec), u16(buf, rec + 2))
        subs.setdefault(key, off + u32(buf, rec + 4))
    for key in PREFERENCE:
        if key in subs:
            return subs[key], u16(buf, subs[key])
    return None, None


def lookup_f4(buf, sub, code):
    seg_x2 = u16(buf, sub + 6)
    if seg_x2 == 0 or seg_x2 & 1:
        return 0
    index = 0
    end = 0
    while index < seg_x2:
        end = u16(buf, sub + 14 + index)
        if end >= code:
            break
        index += 2
    if index >= seg_x2:
        return 0
    start = u16(buf, sub + 16 + seg_x2 + index)
    if start > code:
        return 0
    delta = u16(buf, sub + 16 + seg_x2 * 2 + index)
    range_slot = sub + 16 + seg_x2 * 3 + index
    range_off = u16(buf, range_slot)
    if range_off == 0:
        return (code + delta) & 0xFFFF
    gid = u16(buf, range_slot + range_off + (code - start) * 2)
    if gid == 0:
        return 0
    return (gid + delta) & 0xFFFF


def lookup(buf, sub, fmt, code):
    if fmt == 4:
        return lookup_f4(buf, sub, code)
    if fmt == 0:
        if code > 0xFF:
            return 0
        return buf[sub + 6 + code]
    if fmt == 6:
        first = u16(buf, sub + 6)
        count = u16(buf, sub + 8)
        if code < first or code - first >= count:
            return 0
        return u16(buf, sub + 10 + (code - first) * 2)
    return 0  # format the WAT lookup does not implement


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    font_path, chars_path = sys.argv[1], sys.argv[2]
    buf = open(font_path, 'rb').read()
    chars = []
    for line in open(chars_path, encoding='utf-8'):
        line = line.strip()
        if line.startswith('U+'):
            chars.append(int(line[2:], 16))
    sub, fmt = cmap_best(buf)
    if sub is None:
        print(f'{font_path}: no cmap subtable in the WAT preference order')
        return 1
    if fmt not in (0, 4, 6):
        print(f'{font_path}: $tt_cmap_best picks a format {fmt} subtable, '
              'which $tt_cmap_lookup_at does not implement — every '
              'character would resolve to glyph 0')
        return 1
    missing = [cp for cp in chars if lookup(buf, sub, fmt, cp) == 0]
    if missing:
        shown = ', '.join(f'U+{cp:04X}' for cp in missing[:16])
        print(f'{font_path}: {len(missing)} of {len(chars)} characters do '
              f'not resolve through the WAT cmap path: {shown}' +
              ('…' if len(missing) > 16 else ''))
        return 1
    print(f'  ok   cmap (format {fmt}) resolves all {len(chars)} characters '
          f'of {chars_path} in {font_path}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
