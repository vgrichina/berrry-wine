#!/usr/bin/env python3
"""Tiny lexical API/production CLI regressions; never evaluates Tcl."""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys

SOURCE = Path(__file__).resolve().parents[1] / 'tools/recovery/tuxracer-original-win32-recovery-oct28.py'
spec = importlib.util.spec_from_file_location('production', SOURCE)
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
OUT = Path(sys.argv[1]); OUT.mkdir()
rows = []
CASES = [
    ('inert-braces', b'set description {\nsource ../common/absent.tcl\n}\n', 'inert'),
    ('nested-braces', b'set x {{\nsource ../common/absent.tcl\n}}\n', 'inert'),
    ('inert-quotes', b'set x "\nsource ../common/absent.tcl\n"\n', 'inert'),
    ('comment', b'# comment; source ../common/absent.tcl\n', 'inert'),
    ('continued-comment', b'# comment \\\nsource ../common/absent.tcl\n', 'inert'),
    ('escaped-newline-data', b'set x one\\\nsource ../common/absent.tcl\n', 'inert'),
    ('escaped-semicolon', b'set x foo\\;source ../common/absent.tcl\n', 'inert'),
    ('escaped-brace', b'set x {\\}\nsource ../common/absent.tcl\n}\n', 'inert'),
    ('real-after-braces', b'set x {\nsource absent.tcl\n}\nsource ../common/walk.tcl\n', 'checked'),
    ('real-after-quotes', b'set x "\nsource absent.tcl\n"; source ../common/walk.tcl\n', 'checked'),
    ('real-after-comment', b'# comment \\\nsource absent.tcl\nsource ../common/walk.tcl\n', 'checked'),
    ('real-missing-after-data', b'set x {\nsource absent.tcl\n}; source ../common/missing.tcl\n', 'reject'),
    ('missing', b'source ../common/missing.tcl\n', 'reject'),
    ('parent', b'source ../common/walk.tcl\n', 'checked'),
    ('braced-parent', b'source {../common/walk.tcl}\n', 'checked'),
    ('quoted-parent', b'source "../common/walk.tcl"\n', 'checked'),
    ('encoding-parent', b'source -encoding utf-8 ../common/walk.tcl\n', 'checked'),
    ('root-escape', b'source ../../../escape.tcl\n', 'unknown'),
    ('computed', b'source $path\n', 'unknown'),
    ('substitution', b'set x [list "\nsource absent.tcl\n"]\n', 'unknown'),
    ('control-body', b'if {$ready} {\nsource absent.tcl\n}\n', 'unknown'),
    ('continued-source', b'source \\\n../common/walk.tcl\n', 'unknown'),
    ('unclosed-data', b'set x {\nsource absent.tcl\n', 'unknown'),
]
for label, script, expected in CASES:
    root = OUT/label; (root/'courses/common').mkdir(parents=True)
    (root/'courses/common/moon.tcl').write_bytes(script)
    (root/'courses/common/walk.tcl').write_text('# leaf\n')
    inventory = {'files': [{'path': 'courses/common/moon.tcl'}, {'path': 'courses/common/walk.tcl'}]}
    ip = root/'inventory.json'; ip.write_text(json.dumps(inventory))
    try:
        result = r.literal_sources(root, inventory)
    except r.Rejected as error:
        assert expected == 'reject', (label, str(error))
        result = None
    else:
        assert expected != 'reject', label
        assert len(result['checked']) == (1 if expected == 'checked' else 0), (label, result)
        if expected == 'unknown':
            assert result['unknown'], (label, result)
        if expected == 'checked':
            assert result['checked'][0]['candidatesPresent'] == ['courses/common/walk.tcl']
        if label == 'root-escape':
            assert 'all lexical candidates escape' in result['unknown'][0]['reason']
    cli = subprocess.run([sys.executable, str(SOURCE), 'literal-sources', str(root), str(ip)], capture_output=True, timeout=10)
    (root/'cli.stdout').write_bytes(cli.stdout); (root/'cli.stderr').write_bytes(cli.stderr)
    if expected == 'reject':
        assert cli.returncode != 0 and b'missing literal Tcl source' in cli.stderr, label
    else:
        assert cli.returncode == 0, (label, cli.stderr)
        assert json.loads(cli.stdout) == result, label
    rows.append({'case': label, 'API': 'PASS', 'CLI': 'PASS', 'expected': expected})
# Rejecting regression mutation: restore the old boundary search only. This
# must resurrect the exact independently reported inert-data false positive.
original = r.lexical_commands
def old_commands(text):
    for m in re.finditer(r'(?:^|[;\n])[ \t]*source[ \t]+([^;\n]*)', text):
        yield ['source', m.group(1).strip()], None
r.lexical_commands = old_commands
try:
    root = OUT/'inert-braces'
    r.literal_sources(root, json.loads((root/'inventory.json').read_text()))
except r.Rejected as error:
    assert '../common/absent.tcl' in str(error)
    rows.append({'case': 'old-boundary-mutation', 'outcome': 'KILLED', 'error': str(error)})
else:
    raise AssertionError('prior false-positive mutant survived')
finally:
    r.lexical_commands = original
(OUT/'results.json').write_text(json.dumps({'sourceSHA256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'results': rows}, indent=2)+'\n')
print('PASS: 23 API + 23 production CLI cases; old-boundary mutation killed')
