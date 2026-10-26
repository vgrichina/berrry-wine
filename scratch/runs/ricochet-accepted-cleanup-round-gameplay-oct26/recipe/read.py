"""Drop-in readfile(target, local), now bounded/atomic instead of serial chunks.

Freeze the artifact first, and pass the remaining controller monotonic deadline.
The optional executor is an offline test seam; defaults to work.py's transport.
This adapter never calls ctl(), issues guest input, steps or creates captures.
"""
import json
import pathlib
import sys
import time
from work import R, O, capture, read_executor


def readfile(target, local, *, deadline=None, executor=None, concurrency=4):
    target = pathlib.PurePosixPath(target)
    if target.is_absolute() or '..' in target.parts:
        raise capture.ReadbackError('target must stay under frozen artifact root')
    return capture.readback(
        executor if executor is not None else read_executor(),
        str(pathlib.PurePosixPath(R) / target), local,
        deadline=time.monotonic()+30 if deadline is None else deadline,
        concurrency=concurrency)


if __name__ == '__main__':
    print(json.dumps(readfile(sys.argv[1], O / (sys.argv[2] if len(sys.argv)>2 else pathlib.Path(sys.argv[1]).name))))
