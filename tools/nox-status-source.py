"""Wait for Nox's existing startup ACK using read-only status queries.

This caller barrier never fetches an image or sends game protocol. It uses the
original browser deadline and cancels owning custody on the first failed query,
terminal status, malformed reply or deadline. READY permits a separate image
fetch and model review; it does not certify that the image is usable.
"""
import json
import math
from pathlib import Path
import re
import subprocess
import sys
import time


def startup_state(status):
    if not isinstance(status, dict):
        raise ValueError('Nox startup status must be an object')
    failure, files = status['failure'], status['files']
    latest, parent = status['latest'], status['parentWait']
    if not isinstance(failure, dict) or not isinstance(files, list) or not all(isinstance(n, str) for n in files):
        raise ValueError('malformed Nox startup status')
    if failure or parent is not None:
        raise RuntimeError('Nox startup terminal status')
    if latest is not None and (not isinstance(latest, dict) or latest.get('label') != 'startup'):
        raise ValueError('unexpected Nox startup image')
    if 'ready.json' not in files:
        return 'WAIT'
    if not latest or not re.fullmatch(r'[0-9a-f]{64}', latest.get('sha256', '')) or not isinstance(latest.get('identity'), dict) or not latest['identity']:
        raise ValueError('Nox ready ACK lacks startup image identity')
    return 'READY'


def await_startup(read_status, cancel, *, deadline, now=time.time, sleep=time.sleep, observe=lambda _: None):
    """Return one READY reply. WAIT renews neither the deadline nor any cap."""
    try:
        if not isinstance(deadline, (int, float)) or not math.isfinite(deadline):
            raise ValueError('original Nox browser deadline required')
        while True:
            if now() >= deadline:
                raise TimeoutError('original Nox browser deadline reached')
            status = read_status()
            observe(status)
            # A late reply cannot revive an expired execution window.
            if now() >= deadline:
                raise TimeoutError('Nox status returned after original deadline')
            if startup_state(status) == 'READY':
                return status
            sleep(min(.25, max(0, deadline-now())))
    except BaseException:
        cancel('first Nox startup query failure, terminal reply or original deadline')
        raise


def main():
    root = Path(__file__).resolve().parents[1]
    run = Path(sys.argv[1]).resolve()
    if not run.is_relative_to(root/'scratch/runs'):
        raise ValueError('owned run directory required')
    cfg = json.loads((run/'runtime-config.json').read_text())
    deadline = cfg['browserDeadline']/1000
    result = run/'startup-status.json'
    # Never replace a prior attempt or continue after an owning cancellation.
    if result.exists() or (run/'first-runtime-failure.json').exists() or (run/'first-error.json').exists():
        raise RuntimeError('Nox startup caller already used or terminal')

    def read_status():
        if (run/'first-runtime-failure.json').exists() or (run/'first-error.json').exists():
            raise RuntimeError('Nox startup caller terminal; no later query')
        remaining = deadline-time.time()
        if remaining <= 0:
            raise TimeoutError('original Nox browser deadline reached')
        p = subprocess.run([sys.executable, str(run/'status.py'), 'original'],
                           capture_output=True, text=True, check=True,
                           timeout=min(45, remaining))
        if (run/'first-runtime-failure.json').exists() or (run/'first-error.json').exists():
            raise RuntimeError('Nox startup became terminal during query')
        return json.loads(p.stdout)

    def cancel(reason):
        # status.py already owns cancellation when its query fails. Do not
        # issue another cancel attempt, much less another status query.
        if not (run/'first-runtime-failure.json').exists():
            subprocess.run([sys.executable, str(run/'terminal-cancel.py'), 'original', reason], check=True)

    try:
        with (run/'startup-status-observations.jsonl').open('x') as log:
            def observe(status):
                log.write(json.dumps(dict(observedAt=time.time(), status=status))+'\n')
                log.flush()
            ready = await_startup(read_status, cancel, deadline=deadline, observe=observe)
        with result.open('x') as stream:
            json.dump(ready, stream, indent=2)
    except BaseException:
        cancel('first Nox startup caller failure')
        raise
    print(json.dumps(dict(ready=True, label=ready['latest']['label'],
                          sha256=ready['latest']['sha256'], deadline=deadline,
                          imageFetchPerformed=False, modelReviewRequired=True)))


if __name__ == '__main__':
    main()
