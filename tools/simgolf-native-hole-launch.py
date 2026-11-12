"""SimGolf's owning canceller; current kernel custody and lossless command EOF.

RUN/lifecycle.json supplies the immutable browserDeadline. The external box
delegate must already be armed. This launcher neither allocates nor stops boxes.
Arguments after RUN are a literal executable vector, never shell source.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

COLLECTOR_SHA = 'f8e6e8be352a20f668185c907fdcf4308f5cb93f8c6b8297fada063fc8140b77'


def launch(run, command):
    run = Path(run).resolve()
    assert command, 'literal command required'
    source = Path(__file__).with_name('native_kernel_custody.py')
    assert hashlib.sha256(source.read_bytes()).hexdigest() == COLLECTOR_SHA, 'collector drift'
    for name in ('kernel-armed.json', 'kernel-drain.json', 'custody.ndjson.gz', 'kernel-command.log.gz'):
        assert not (run/name).exists(), 'custody evidence already exists'
    life = json.loads((run/'lifecycle.json').read_bytes())
    spec = importlib.util.spec_from_file_location('simgolf_kernel', source)
    kernel = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(kernel)
    kernel.supervise(run, command, deadline=life['browserDeadline']/1000,
                     cleanup_deadline=life['browserDeadline']/1000+30,
                     journal_compression='gzip', command_compression='gzip')


if __name__ == '__main__':
    launch(sys.argv[1], sys.argv[2:])
