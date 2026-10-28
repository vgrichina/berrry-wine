#!/usr/bin/env python3
"""Generate the vendored Noto Sans TC statics under fonts/noto-sans-tc/.

The browser and CLI hosts mount these (or their deployed subsets, cut by
tools/gen-font-subsets.sh) at C:\\WINDOWS\\FONTS\\MINGLIU.TTF /
MINGLIUB.TTF, where they stand in for the Traditional Chinese faces of a
Big5 Win98 (fonts/substitutions.json). Noto Sans TC is SIL OFL 1.1 and
glyf-outlined, which is what the WAT TrueType parser requires.

Source: the google/fonts variable font NotoSansTC[wght].ttf, pinned by
SHA-256 below (the branch URL moves; the hash is the pin — a mismatch
aborts rather than vendoring whatever upstream serves that day). The
variable font's default instance is Thin (wght 100), so both statics are
explicit instantiations: wght 400 -> NotoSansTC-Regular.ttf, wght 700 ->
NotoSansTC-Bold.ttf. The statics are vendored complete, like every other
vendored source in fonts/; the payload decision lives where it lives for
the other faces, in the deployed subset (tools/gen-font-subsets.sh cuts
them to fonts/noto-sans-tc/subset-chars.txt).

The variable font ships a (3,1) format 4 cmap, the one subtable shape
the WAT parser resolves CJK through; the script asserts with
tools/check_tt_cmap.py that the deployed subset list resolves in full
through that path.

One repertoire decision lives here rather than in big5_charset.js: the
subset list is intersected with the pinned font's actual coverage. The
semantic derivation names a few dozen characters Noto Sans TC has no
glyph for — CP1252 control codes and Latin Extended letters a Big5 face
is never asked for in practice, two Big5 symbols, and the private-use
code points the WHATWG Big5 index assigns to vendor extensions, which
no shipping font covers by definition. Keeping them would promise the
subsetter glyphs that do not exist; they are dropped from
subset-chars.txt with the drop recorded in its header, and a guest that
asks the TC face for one gets .notdef, as it would on a real Big5
system without a vendor font. Repertoire coverage beyond the subset is
reported, not asserted: the vendored statics carry the whole Big5
repertoire the font covers (~93%).

Usage: python3 tools/gen-noto-tc.py
Needs fontTools (pip install fonttools) and network access for the
pinned download (or a local copy at $NOTO_TC_VARIABLE_FONT).
"""

import hashlib
import os
import subprocess
import sys
import tempfile
import urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FONT_DIR = os.path.join(ROOT, 'fonts', 'noto-sans-tc')
URL = ('https://github.com/google/fonts/raw/main/ofl/notosanstc/'
       'NotoSansTC%5Bwght%5D.ttf')
SHA256 = '864727d210d54f2537bbe23b3a839436c3992af72de9322af5270897246bd44f'
OFL_URL = ('https://github.com/google/fonts/raw/main/ofl/notosanstc/'
           'OFL.txt')

INSTANCES = [(400, 'NotoSansTC-Regular.ttf'), (700, 'NotoSansTC-Bold.ttf')]


def read_chars(name):
    cps = set()
    with open(os.path.join(FONT_DIR, name), encoding='utf-8') as fh:
        for line in fh:
            line = line.strip()
            if line.startswith('U+'):
                cps.add(int(line[2:], 16))
    return cps


def obtain_variable_font(tmp):
    local = os.environ.get('NOTO_TC_VARIABLE_FONT')
    if local:
        data = open(local, 'rb').read()
        origin = local
    else:
        print(f'downloading {URL}')
        with urllib.request.urlopen(URL) as resp:
            data = resp.read()
        origin = URL
    digest = hashlib.sha256(data).hexdigest()
    if digest != SHA256:
        raise SystemExit(
            f'SHA-256 mismatch for the variable font from {origin}:\n'
            f'  got      {digest}\n  expected {SHA256}\n'
            'Upstream changed the font; review and re-pin deliberately.')
    path = os.path.join(tmp, 'NotoSansTC[wght].ttf')
    with open(path, 'wb') as fh:
        fh.write(data)
    return path


def main():
    try:
        import fontTools  # noqa: F401
        from fontTools import ttLib
        from fontTools.varLib import instancer
    except ImportError:
        raise SystemExit('fontTools not installed: pip install fonttools')

    with tempfile.TemporaryDirectory() as tmp:
        var_path = obtain_variable_font(tmp)
        for wght, out_name in INSTANCES:
            font = ttLib.TTFont(var_path)
            instancer.instantiateVariableFont(font, {'wght': wght}, inplace=True)
            out = os.path.join(FONT_DIR, out_name)
            font.save(out)
            size = os.path.getsize(out)
            print(f'  {out_name:26s} {size:9d} bytes (wght {wght})')

    ofl = os.path.join(FONT_DIR, 'OFL.txt')
    if not os.path.exists(ofl):
        print(f'downloading {OFL_URL}')
        with urllib.request.urlopen(OFL_URL) as resp:
            data = resp.read()
        with open(ofl, 'wb') as fh:
            fh.write(data)

    filter_subset_to_coverage()

    # Prove the statics resolve through the WAT cmap path, not just in
    # desktop tools: every character the deployed subset promises,
    # glyph != 0, in both statics.
    subset_chars = os.path.join(FONT_DIR, 'subset-chars.txt')
    for _, out_name in INSTANCES:
        subprocess.run(
            [sys.executable, os.path.join(ROOT, 'tools', 'check_tt_cmap.py'),
             os.path.join(FONT_DIR, out_name), subset_chars],
            check=True)

    # Repertoire coverage of the vendored statics: reported, not asserted
    # (see the header note — PUA vendor codes are uncoverable by design).
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    from check_tt_cmap import cmap_best, lookup
    buf = open(os.path.join(FONT_DIR, INSTANCES[0][1]), 'rb').read()
    sub, fmt = cmap_best(buf)
    rep = read_chars('repertoire-chars.txt')
    missing = [cp for cp in rep if lookup(buf, sub, fmt, cp) == 0]
    pua = [cp for cp in missing if 0xE000 <= cp <= 0xF8FF]
    print(f'repertoire coverage: {len(rep) - len(missing)}/{len(rep)} '
          f'({len(pua)} of the {len(missing)} misses are private-use)')


def filter_subset_to_coverage():
    """Drop subset-chars.txt entries the pinned font has no glyph for.

    Idempotent: a previous run's coverage note is replaced, not stacked.
    """
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    from check_tt_cmap import cmap_best, lookup
    path = os.path.join(FONT_DIR, 'subset-chars.txt')
    lines = open(path, encoding='utf-8').read().split('\n')
    header = [l for l in lines
              if l.startswith('#') and not l.startswith('# Coverage:')]
    chars = [int(l[2:], 16) for l in lines if l.startswith('U+')]
    bufs = []
    for _, out_name in INSTANCES:
        buf = open(os.path.join(FONT_DIR, out_name), 'rb').read()
        sub, fmt = cmap_best(buf)
        bufs.append((buf, sub, fmt))
    dropped = [cp for cp in chars
               if any(lookup(b, s2, f2, cp) == 0 for b, s2, f2 in bufs)]
    if dropped:
        kept = [cp for cp in chars if cp not in set(dropped)]
        note = ('# Coverage: intersected with the pinned Noto Sans TC cmap '
                'by tools/gen-noto-tc.py; the following derived characters '
                'have no glyph there and are dropped: ' +
                ' '.join(f'U+{cp:04X}' for cp in dropped) + '.')
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write('\n'.join(header + [note] +
                               [f'U+{cp:04X}' for cp in kept]) + '\n')
    print(f'subset-chars.txt: {len(chars) - len(dropped)} characters '
          f'({len(dropped)} dropped as uncovered)')


if __name__ == '__main__':
    main()
