#!/usr/bin/env python3
"""Independent direct-handler rename acceptance. Never mounts a filesystem."""
import copy
import errno
import hashlib
import importlib.util
import itertools
import json
from pathlib import Path
import stat
import struct

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent / 'toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
PIN = 'cc2dc7ab2f9b5d1b84b755c61e7a6ffc3e226d52ffe008edf7ace5310cbdc105'


def wire(op, destination_parent, old=b'from', new=b'to', flags=0):
    prefix = struct.pack('<Q', destination_parent)
    if op == 45:
        prefix += struct.pack('<II', flags, 0)
    return prefix + old + b'\0' + new + b'\0'


def saved(b):
    values = copy.deepcopy(b.__dict__)
    del values['operations']
    identities = {i: (id(n), id(n['data']), id(n['names'])) for i, n in b.nodes.items()}
    return values, identities


def unchanged(b, before, operations):
    assert saved(b) == before, 'state or object identity changed'
    assert b.operations == operations + 1, 'operation count'


def denied(b, op, parent, request, expected):
    before, operations = saved(b), b.operations
    try:
        b.handle(op, parent, request)
    except OSError as e:
        assert e.errno == expected, ('errno', e.errno, expected)
    else:
        raise AssertionError(('unexpected success', expected))
    unchanged(b, before, operations)


def node(b, parent, name, directory):
    # Set up through the production protocol, not predecessor fixtures.
    if directory:
        reply = b.handle(9, parent, struct.pack('<II', 0o700, 0) + name + b'\0')
    else:
        reply = b.handle(35, parent, struct.pack('<IIII', 0, 0o600, 0, 0) + name + b'\0')
    ino = struct.unpack_from('<Q', reply)[0]
    if not directory:
        b.handle(18, ino, struct.pack('<Q', ino))
    return ino


def write(b, ino, payload):
    b.handle(14, ino, b'')
    b.handle(16, ino, struct.pack('<QQI', ino, 0, len(payload)) + bytes(20) + payload)
    b.handle(18, ino, struct.pack('<Q', ino))


def fixture(cls, cross, source_dir, dest_dir, content, victim_open, source_open):
    b = cls('/tmp/unused-independent-rename-accept', live_limit=262144,
            file_limit=16384, write_limit=65536)
    left = node(b, 1, b'left', True)
    right = node(b, 1, b'right', True) if cross else left
    source = node(b, left, b'from', source_dir)
    victim = node(b, right, b'to', dest_dir)
    if source_dir:
        node(b, source, b'source-child', False)
    else:
        write(b, source, b'source\0payload' * 330)
    if content:
        if dest_dir:
            child = node(b, victim, b'victim-child', False)
            write(b, child, b'child-content')
        else:
            write(b, victim, b'victim\xff' * 600)
    if source_open:
        b.handle(27 if source_dir else 14, source, b'')
    if victim_open:
        # Two handles exercise exact opens/handles preservation and final collect.
        for _ in range(2):
            b.handle(27 if dest_dir else 14, victim, b'')
    spare = node(b, 1, b'unrelated', False)
    write(b, spare, b'untouched')
    return b, left, right, source, victim


def run_suite(cls):
    groups = {'mismatch': 0, 'replacement': 0, 'samepath': 0,
              'absent_destination': 0, 'error_precedence': 0}
    for op, cross, source_dir, content, opened, source_open in itertools.product(
            (12, 45), (False, True), (False, True), (False, True),
            (False, True), (False, True)):
        b, left, right, source, victim = fixture(
            cls, cross, source_dir, not source_dir, content, opened, source_open)
        denied(b, op, left, wire(op, right), errno.ENOTDIR if source_dir else errno.EISDIR)
        groups['mismatch'] += 1

    for op, cross, directory, opened, source_open in itertools.product(
            (12, 45), (False, True), (False, True), (False, True), (False, True)):
        b, left, right, source, victim = fixture(
            cls, cross, directory, directory, not directory, opened, source_open)
        before, _ = saved(b)
        source_identity = (id(b.nodes[source]), id(b.nodes[source]['data']))
        victim_charge = 4096 + ((len(b.nodes[victim]['data']) + 4095) // 4096) * 4096
        expected = copy.deepcopy(before)
        del expected['nodes'][left]['names'][b'from']
        expected['nodes'][right]['names'][b'to'] = source
        if opened:
            expected['nodes'][victim]['links'] = 0
        else:
            del expected['nodes'][victim]
            expected['live'] -= victim_charge
        assert b.handle(op, left, wire(op, right)) == b''
        assert saved(b)[0] == expected, 'valid replacement state'
        assert (id(b.nodes[source]), id(b.nodes[source]['data'])) == source_identity
        if opened:
            release = 29 if directory else 18
            b.handle(release, victim, struct.pack('<Q', victim))
            assert victim in b.nodes and b.nodes[victim]['opens'] == 1
            b.handle(release, victim, struct.pack('<Q', victim))
            assert victim not in b.nodes and b.live == before['live'] - victim_charge
            assert b.handles == before['handles'] - 2
            assert b.written == before['written'] and b.peak == before['peak']
        groups['replacement'] += 1

    for op, directory, opened in itertools.product((12, 45), (False, True), (False, True)):
        b, left, right, source, victim = fixture(cls, False, directory, directory, True, opened, True)
        before, operations = saved(b), b.operations
        assert b.handle(op, left, wire(op, left, new=b'from')) == b''
        unchanged(b, before, operations)
        groups['samepath'] += 1

    for op, cross, directory in itertools.product((12, 45), (False, True), (False, True)):
        b, left, right, source, victim = fixture(cls, cross, directory, not directory, True, True, True)
        expected = saved(b)[0]
        del expected['nodes'][left]['names'][b'from']
        expected['nodes'][right]['names'][b'new-name'] = source
        assert b.handle(op, left, wire(op, right, new=b'new-name')) == b''
        assert saved(b)[0] == expected
        groups['absent_destination'] += 1

    for op, cross, source_dir, opened in itertools.product(
            (12, 45), (False, True), (False, True), (False, True)):
        b, left, right, source, victim = fixture(cls, cross, source_dir, not source_dir, True, opened, True)
        denied(b, op, left, wire(op, right, old=b'absent'), errno.ENOENT)
        groups['error_precedence'] += 1
    for op, cross in itertools.product((12, 45), (False, True)):
        b, left, right, source, victim = fixture(cls, cross, True, True, True, True, True)
        denied(b, op, left, wire(op, right), errno.ENOTEMPTY)
        groups['error_precedence'] += 1
    for flags, old, new in itertools.product((1, 2, 4, 0xffffffff),
                                            (b'from', b'absent', b'.'), (b'to', b'from')):
        b, left, right, source, victim = fixture(cls, False, False, True, True, True, True)
        denied(b, 45, left, wire(45, right, old, new, flags), errno.EOPNOTSUPP)
        groups['error_precedence'] += 1
    return groups


def sensitivity(source):
    first = source.index('                source_is_dir=')
    last = source.index("                if self.nodes[previous]['names']", first)
    guard = source[first:last]
    empty = "                if self.nodes[previous]['names']:raise OSError(errno.ENOTEMPTY,'replacement directory')\n"
    collect = "                self.nodes[previous]['links']-=1;self.collect(previous)\n"
    variants = {
        'missing_guard': source.replace(guard, '', 1),
        'wrong_errno': source.replace(guard, guard.replace('errno.EISDIR', 'errno.EINVAL', 1), 1),
        'after_emptiness': source.replace(guard + empty, empty + guard, 1),
        'after_link_decrement': source.replace(guard + empty + collect,
            empty + "                self.nodes[previous]['links']-=1\n" + guard +
            '                self.collect(previous)\n', 1),
        'after_collection': source.replace(guard + empty + collect, empty + collect + guard, 1),
        'overbroad_file_guard': source.replace('if not source_is_dir and dest_is_dir:',
                                              'if not source_is_dir:', 1),
        'overbroad_directory_guard': source.replace('if source_is_dir and not dest_is_dir:',
                                                   'if source_is_dir:', 1),
        'op12_only': source.replace('if not source_is_dir and dest_is_dir:',
                                   'if op==12 and not source_is_dir and dest_is_dir:', 1),
        'op45_only': source.replace('if source_is_dir and not dest_is_dir:',
                                   'if op==45 and source_is_dir and not dest_is_dir:', 1),
    }
    results = {}
    for name, text in variants.items():
        assert text != source, ('mutation not applied', name)
        ns = {'__name__': 'in_memory_sensitivity_control'}
        exec(compile(text, '<' + name + '>', 'exec'), ns)
        try:
            run_suite(ns['Backend'])
        except (AssertionError, OSError, KeyError) as exc:
            results[name] = {'rejected': True, 'exception': type(exc).__name__, 'reason': str(exc)[:140]}
        else:
            raise AssertionError(('surviving mutation', name))
    return results


if __name__ == '__main__':
    raw = BACKEND.read_bytes()
    assert len(raw) == 12482 and hashlib.sha256(raw).hexdigest() == PIN
    spec = importlib.util.spec_from_file_location('exact_production_backend', BACKEND)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    groups = run_suite(module.Backend)
    print(json.dumps({'PASS': True, 'sourceSha256': PIN, 'groups': groups,
                      'cases': sum(groups.values()), 'sensitivity': sensitivity(raw.decode()),
                      'scope': 'actual Backend.handle only; no mounted/CLI/browser/gameplay claim'}, indent=2))
