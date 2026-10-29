#!/usr/bin/env python3
"""Direct Backend.handle contract; no mount, kernel, browser or guest claim."""
import copy
import errno
import hashlib
import importlib.util
import json
from pathlib import Path
import stat
import struct
import sys

BACKEND = Path(__file__).resolve().parents[1] / 'toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'


def load(path):
    spec = importlib.util.spec_from_file_location('tested_backend', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.Backend


def request(op, parent, old=b'S', new=b'T', flags=0):
    return (struct.pack('<Q', parent) if op == 12 else
            struct.pack('<QII', parent, flags, 0)) + old + b'\0' + new + b'\0'


def snapshot(b):
    # Include namespace, inode numbers, links, data, opens, next inode and every
    # accounting field. Also catch replacement of otherwise equal node objects.
    values = copy.deepcopy(vars(b))
    values.pop('operations')
    identities = {i: (id(n), id(n['names']), id(n['data'])) for i, n in b.nodes.items()}
    return values, identities


def reject(b, op, parent, data, expected):
    before = snapshot(b)
    operations = b.operations
    try:
        b.handle(op, parent, data)
    except OSError as e:
        assert e.errno == expected, (op, e.errno, expected)
    else:
        raise AssertionError(('unexpected success', op, expected))
    assert snapshot(b) == before, 'rejected rename mutated state or inode identity'
    assert b.operations == operations + 1


def fixture(Backend, source_dir, dest_dir, cross=False, nonempty=False, opened=False, payload=False):
    b = Backend('/tmp/unused-rename-type-reproducer', live_limit=65536)
    parent = b.create(1, b'P', stat.S_IFDIR | 0o700) if cross else 1
    s = b.create(1, b'S', (stat.S_IFDIR if source_dir else stat.S_IFREG) | 0o700)
    t = b.create(parent, b'T', (stat.S_IFDIR if dest_dir else stat.S_IFREG) | 0o700)
    if nonempty:
        assert dest_dir
        b.create(t, b'child', stat.S_IFREG | 0o600)
    if payload:
        for i, isdir in [(s, source_dir), (t, dest_dir)]:
            if not isdir:
                b.handle(16, i, struct.pack('<QQI', i, 0, 3) + bytes(20) + b'abc')
    if opened:
        b.handle(27 if source_dir else 14, s, b'')
        b.handle(27 if dest_dir else 14, t, b'')
    return b, parent, s, t


def suite(Backend):
    count = 0
    for op in (12, 45):
        for cross in (False, True):
            for source_dir, dest_dir in ((False, True), (True, False)):
                for opened in (False, True):
                    for nonempty in ((False, True) if dest_dir else (False,)):
                        b, p, s, t = fixture(Backend, source_dir, dest_dir, cross, nonempty, opened, True)
                        reject(b, op, 1, request(op, p), errno.ENOTDIR if source_dir else errno.EISDIR)
                        count += 1
            for isdir in (False, True):
                # Replacement collects only closed destinations; an open one
                # retains its identity and storage until its final release.
                for opened in (False, True):
                    b, p, s, t = fixture(Backend, isdir, isdir, cross, opened=opened, payload=True)
                    written, peak, live = b.written, b.peak, b.live
                    assert b.handle(op, 1, request(op, p)) == b''
                    assert b.nodes[p]['names'][b'T'] == s and b'S' not in b.nodes[1]['names']
                    assert b.nodes[s]['links'] == 1 and b.written == written and b.peak == peak
                    if opened:
                        assert b.nodes[t]['links'] == 0 and b.nodes[t]['opens'] == 1 and b.live == live
                        assert b.handles == 2
                        b.handle(29 if isdir else 18, t, struct.pack('<Q', t))
                    assert t not in b.nodes
                    assert b.live == live - (4096 if isdir else 8192)
                    count += 1
            b, p, s, t = fixture(Backend, True, True, cross, nonempty=True, opened=True)
            reject(b, op, 1, request(op, p), errno.ENOTEMPTY)
            count += 1
            # A previously absent name accepts either source type.
            for isdir in (False, True):
                b, p, s, t = fixture(Backend, isdir, not isdir, cross)
                old_live = b.live
                assert b.handle(op, 1, request(op, p, new=b'absent')) == b''
                assert b.nodes[p]['names'][b'absent'] == s and b.nodes[p]['names'][b'T'] == t
                assert b.live == old_live
                count += 1
        # Same-path no-op includes nonempty directories and open handles.
        for isdir in (False, True):
            b, p, s, t = fixture(Backend, isdir, isdir, opened=True, payload=True)
            if isdir:
                b.create(s, b'child', stat.S_IFREG | 0o600)
            before, operations = snapshot(b), b.operations
            assert b.handle(op, 1, request(op, 1, new=b'S')) == b''
            assert snapshot(b) == before and b.operations == operations + 1
            count += 1
        b, p, s, t = fixture(Backend, False, True, nonempty=True)
        reject(b, op, 1, request(op, p, old=b'missing'), errno.ENOENT)
        count += 1
    # RENAME2 flags still reject before missing-source/name/type/emptiness checks.
    for flags in (1, 2, 4, 0xffffffff):
        for old in (b'S', b'missing', b'.'):
            b, p, s, t = fixture(Backend, False, True, nonempty=True, opened=True, payload=True)
            reject(b, 45, 1, request(45, p, old=old, flags=flags), errno.EOPNOTSUPP)
            count += 1
    return count


def mutation_controls(source):
    start = source.index('                source_is_dir=')
    end = source.index("                if self.nodes[previous]['names']", start)
    guard = source[start:end]
    empty = "                if self.nodes[previous]['names']:raise OSError(errno.ENOTEMPTY,'replacement directory')\n"
    collect = "                self.nodes[previous]['links']-=1;self.collect(previous)\n"
    mutants = {
        'remove_guard': source[:start] + source[end:],
        'swap_errnos': source[:start] + guard.replace('errno.EISDIR', 'errno.TEMP').replace('errno.ENOTDIR', 'errno.EISDIR').replace('errno.TEMP', 'errno.ENOTDIR') + source[end:],
        'guard_after_emptiness': source.replace(guard + empty, empty + guard, 1),
        'guard_after_collection': source.replace(guard + empty + collect, empty + collect + guard, 1),
        'guard_after_namespace_pop': source.replace(guard, '', 1).replace('            dest[new]=source.pop(old)\n', '            dest[new]=source.pop(old)\n' + guard.replace('                ', '            '), 1),
    }
    result = {}
    for name, mutated in mutants.items():
        assert mutated != source
        namespace = {'__name__': 'mutation_backend'}
        exec(compile(mutated, '<' + name + '>', 'exec'), namespace)
        try:
            suite(namespace['Backend'])
        except (AssertionError, KeyError) as e:
            result[name] = {'rejected': True, 'reason': str(e)[:180]}
        else:
            raise AssertionError('surviving mutation: ' + name)
    return result


if __name__ == '__main__':
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else BACKEND
    source = path.read_bytes()
    cases = suite(load(path))
    print(json.dumps({'PASS': True, 'scope': 'direct Backend.handle only; no mount',
                      'backendSha256': hashlib.sha256(source).hexdigest(),
                      'cases': cases, 'mutations': mutation_controls(source.decode())}, indent=2))
