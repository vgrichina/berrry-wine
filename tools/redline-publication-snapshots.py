#!/usr/bin/env python3
"""Memory-only adapter for the pinned launcher's path-shaped validator API."""
import base64
import gzip
import io
import json
import sys
import types

import native_publication_launch as launcher


def validate(snapshots, cap):
    if not 0 < cap <= 64*1024*1024:
        raise ValueError('decoded custody cap')
    # Reading cap+1 detects expansion overflow; reaching EOF checks every member's
    # CRC/trailer, including concatenated gzip members. Never decompress again.
    compressed = snapshots['custody.ndjson.gz']
    with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as stream:
        decoded = stream.read(cap+1)
    if len(decoded) > cap:
        raise ValueError('decoded custody cap')
    if not decoded:
        raise ValueError('empty custody evidence INVALID')

    class Snapshot:
        def __init__(self, name=None):
            self.name = name
            self.suffix = '.gz' if name and name.endswith('.gz') else ''

        def __truediv__(self, name):
            # Only the captured fixed names can be addressed by drain metadata.
            if self.name is not None or name not in snapshots:
                raise ValueError('uncaptured evidence path')
            return Snapshot(name)

        def read_bytes(self):
            return snapshots[self.name]

        def read_text(self):
            return self.read_bytes().decode('utf-8')

    def expanded(raw):
        if raw != compressed:
            raise ValueError('uncaptured gzip')
        return decoded

    # Private module instance: retain the published validator's checks verbatim,
    # adapting only its file interface and gzip expansion to captured memory.
    memory = types.FunctionType(launcher.validate_run.__code__,
                               dict(launcher.__dict__, gzip=types.SimpleNamespace(decompress=expanded)),
                               'validate_run')
    memory.__globals__['artifact'] = types.FunctionType(
        launcher.artifact.__code__, memory.__globals__, 'artifact')
    drain = json.loads(snapshots['kernel-drain.json'])
    if drain['journal']['path'] != 'custody.ndjson.gz':
        raise ValueError('uncaptured custody journal')
    helper, _ = launcher.load_providers()
    return memory(Snapshot(), helper, True)


if __name__ == '__main__':
    values = json.load(sys.stdin)
    snapshots = {name: base64.b64decode(value, validate=True) for name, value in values.items()}
    print(json.dumps(validate(snapshots, int(sys.argv[1]))))
