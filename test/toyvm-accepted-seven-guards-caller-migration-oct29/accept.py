#!/usr/bin/python3
"""Focused source-only caller migration tests. Never invoke the returned adapter."""
import copy
import errno
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import py_compile
import subprocess
import tempfile
import types
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
CALLER = ROOT / 'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'
BACKEND = 'toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
ADAPTER = 'toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py'
OLD = 'cc2dc7ab2f9b5d1b84b755c61e7a6ffc3e226d52ffe008edf7ace5310cbdc105'
NEW = 'b8201b2c4a1d0e1fd653bb02fda7870f626d3781bed014657fb974cc24e41c40'
results = []
def module(source, path):
    m = types.ModuleType('private_source_test')
    m.__file__ = str(path)
    exec(compile(source, str(path), 'exec', dont_inherit=True), m.__dict__)
    return m

def reject(fn, expected):
    try:
        fn()
    except RuntimeError as error:
        assert expected in str(error), repr(error)
    else:
        raise AssertionError('expected rejection: ' + expected)

def test_callers():
    # Earliest production boundary first: exact source and real pinned paths.
    source = CALLER.read_bytes()
    c = module(source, CALLER)
    assert c.BACKEND_PINS[BACKEND] == NEW
    loaded = c.load_backend()
    expected = module((ROOT/'test'/ADAPTER).read_bytes(), ROOT/'test'/ADAPTER)
    assert loaded.__code__ == expected.supervise_accounted.__code__
    assert loaded.__globals__['HERE'] == (ROOT/'test'/ADAPTER).parent
    results.append('production load_backend binds accepted adapter with namespace pin')
    with tempfile.TemporaryDirectory(prefix='caller-', dir=HERE) as name:
        root = Path(name)
        originals = {key: (ROOT/'test'/key).read_bytes() for key in c.BACKEND_PINS}
        def reset():
            for key, value in originals.items():
                p = root/'test'/key
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_bytes(value)
                cache = Path(importlib.util.cache_from_source(str(p)))
                if cache.exists():
                    cache.unlink()
        reset()
        c.ROOT = root
        for key in c.BACKEND_PINS:
            p = root/'test'/key
            p.write_bytes(originals[key]+b'\n# tampered\n')
            reject(c.load_backend, 'accepted backend identity mismatch: ' + key)
            p.write_bytes(originals[key])
        results.append('tampered backend, adapter, confine, pinned-supervisor rejected')
        c.BACKEND_PINS[BACKEND] = OLD
        reject(c.load_backend, 'accepted backend identity mismatch: ' + BACKEND)
        c.BACKEND_PINS[BACKEND] = NEW
        results.append('private stale backend pin rejects accepted namespace bytes')

        # Legacy loader control must consume the crafted timestamp/size-valid pyc.
        adapter = root/'test'/ADAPTER
        malicious = b"raise RuntimeError('PRIVATE_STALE_ADAPTER_EXECUTED')\n"
        malicious += b'#' * (len(originals[ADAPTER])-len(malicious))
        adapter.write_bytes(malicious)
        timestamp = 1700000000
        os.utime(adapter, (timestamp, timestamp))
        py_compile.compile(str(adapter), doraise=True,
                           invalidation_mode=py_compile.PycInvalidationMode.TIMESTAMP)
        adapter.write_bytes(originals[ADAPTER])
        os.utime(adapter, (timestamp, timestamp))
        def legacy_load():
            spec = importlib.util.spec_from_file_location('private_legacy', adapter)
            m = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(m)
        reject(legacy_load, 'PRIVATE_STALE_ADAPTER_EXECUTED')
        actual = c.load_backend()
        assert actual.__code__ == module(originals[ADAPTER], adapter).supervise_accounted.__code__
        results.append('exact loader ignores stale cached adapter; private legacy control executes it')

        reset()
        # Replace on disk immediately after the checked read returns its bytes.
        original_read = Path.read_bytes
        replacement = b"raise RuntimeError('PRIVATE_REPLACED_ADAPTER_EXECUTED')\n"
        fired = []
        def checked_read(path):
            data = original_read(path)
            if path == adapter:
                adapter.write_bytes(replacement)
                fired.append(True)
            return data
        with patch.object(Path, 'read_bytes', checked_read):
            actual = c.load_backend()
        assert fired == [True]
        assert actual.__code__ == module(originals[ADAPTER], adapter).supervise_accounted.__code__
        reset()
        # Same validation loop, private control switches only execution to reread.
        start = source.index(b'    code = compile(validated_sources[relative]')
        end = source.index(b'    return module.supervise_accounted', start)
        private = source[:start]+b'    spec.loader.exec_module(module)\n'+source[end:]
        control = module(private, CALLER)
        control.ROOT = root
        with patch.object(Path, 'read_bytes', checked_read):
            reject(control.load_backend, 'PRIVATE_REPLACED_ADAPTER_EXECUTED')
        results.append('checked bytes survive replacement; private reread control executes replacement')

def test_backend():
    b = module((ROOT/'test'/BACKEND).read_bytes(), ROOT/'test'/BACKEND)
    backend = b.Backend(str(HERE/'never-mounted'), live_limit=65536)
    pack = b.pack
    backend.handle(26, 1, pack('2I', 7, 31))
    assert backend.operations == 1
    def denied(op, ino, data, code):
        before = copy.deepcopy(vars(backend))
        try:
            backend.handle(op, ino, data)
        except OSError as error:
            assert error.errno == code, (error, code)
        else:
            raise AssertionError('request unexpectedly accepted')
        before['operations'] += 1
        assert vars(backend) == before, 'rejection changed full backend state'
    # CREATE, MKDIR, and valid cross-directory RENAME establish real topology.
    backend.handle(35, 1, pack('4I', 0, 0o600, 0, 0)+b'file\0')
    file_ino = backend.nodes[1]['names'][b'file']
    backend.handle(9, 1, pack('2I', 0o700, 0)+b'dir\0')
    directory = backend.nodes[1]['names'][b'dir']
    denied(9, file_ino, pack('2I', 0o700, 0)+b'bad\0', errno.ENOTDIR)
    denied(35, 999, pack('4I', 0, 0o600, 0, 0)+b'bad\0', errno.ENOENT)
    denied(12, 1, pack('Q', file_ino)+b'file\0new\0', errno.ENOTDIR)
    denied(12, 999, pack('Q', 1)+b'file\0new\0', errno.ENOENT)
    denied(12, 1, pack('Q', directory)+b'dir\0cycle\0', errno.EINVAL)
    denied(10, 1, b'dir\0', errno.EISDIR)
    denied(11, 1, b'file\0', errno.ENOTDIR)
    backend.handle(12, 1, pack('Q', directory)+b'file\0moved\0')
    assert backend.nodes[directory]['names'] == {b'moved': file_ino}
    assert backend.nodes[1]['names'] == {b'dir': directory}
    denied(11, 1, b'dir\0', errno.ENOTEMPTY)
    results.append('INIT-first Backend.handle: 4 positives and 8 full-state-preserving rejections')
    assert backend.operations == 12

def main():
    with patch.object(subprocess, 'Popen', side_effect=AssertionError('FORBIDDEN_CHILD_BOUNDARY')) as sentinel:
        test_callers()
        # Prove sentinel is armed without starting any process.
        try:
            subprocess.Popen(['must-never-run'])
        except AssertionError as error:
            assert str(error) == 'FORBIDDEN_CHILD_BOUNDARY'
        else:
            raise AssertionError('sentinel not armed')
        assert sentinel.call_count == 1
        sentinel.reset_mock()
        test_backend()
        assert sentinel.call_count == 0
    out = dict(passed=True, groups=results, actualSubprocessCalls=0,
               sentinelPrivateControlCalls=1, scope='source-only; adapter returned, never called')
    (HERE/'results.json').write_text(json.dumps(out, indent=2)+'\n')
    print(json.dumps(out))
if __name__ == '__main__':
    main()
