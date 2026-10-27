"""Execute unchanged historical phase/drive code against offline HTTP only."""
import contextlib
import hashlib
import http.server
import json
import os
from pathlib import Path
import runpy
import shutil
import subprocess
import sys
import threading
import types

ROOT = Path(__file__).resolve().parents[3]
FIX = Path(__file__).parent


def reproduce(output):
    output.mkdir(parents=True, exist_ok=False)
    home = output / 'historical-owner'
    home.mkdir()
    (home / 'guest').mkdir()
    (home / 'runner/test/helpers').mkdir(parents=True)
    for rel in ['test/alien-gameplay-sequence.py', 'test/helpers/alien-control-sequence.py']:
        shutil.copyfile(ROOT / rel, home / 'runner' / rel)
    shutil.copyfile(FIX / 'historical/phase.py', home / 'phase.py')
    state = dict(batch=4722, elapsed=98.47251607, requests=[])

    class Server(http.server.BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_POST(self):
            raw = self.rfile.read(int(self.headers['Content-Length']))
            command = json.loads(raw)
            action = command.get('action')
            if action == 'step':
                state['batch'] += command['n']
                state['elapsed'] += 19.6748 / 4
                value = dict(batch=state['batch'], ran=command['n'], steps=command['n'], frozen=True)
            elif action == 'png':
                value = dict(batch=state['batch'], path=command['path'], bytes=20, frozen=True)
                (home / 'guest/terminal.json').write_text('{"reason":"guest-wall-or-cutoff","returncode":0}')
            else:
                assert action == 'snapshot', command
                value = dict(batch=state['batch'], quit=False, frozen=dict(frozen=True, credits=0))
            response = json.dumps(dict(ok=True, value=value)).encode()
            state['requests'].append(dict(commandRaw=raw.decode(), responseRaw=response.decode(), elapsed=state['elapsed']))
            self.send_response(200)
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)

    # phase.py's original loopback endpoint is deliberately unchanged.
    with http.server.HTTPServer(('127.0.0.1', 18129), Server) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        work = types.ModuleType('work')
        work.R = str(home)
        work.O = output
        work.shlex = __import__('shlex')
        work.json = json
        work.sys = sys
        work.save = lambda name, value: (output / name).write_text(json.dumps(value, indent=2))

        def remote(command, timeout):
            result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=timeout)
            return dict(stdout=result.stdout, stderr=result.stderr, exit=result.returncode)

        work.remote = remote
        previous = sys.modules.get('work')
        sys.modules['work'] = work
        try:
            drive = runpy.run_path(str(FIX / 'historical/drive.py'))
            settled = drive['phase']('settled', drive['steps'](1024) + [drive['frame']('settled')])
            original_phase = drive['phase']
            attempted = {}

            def phase(name, commands):
                attempted['commands'] = commands
                attempted['result'] = original_phase(name, commands)
                return attempted['result']

            # Execute the original newgame.py plan too. Only its out-of-band
            # remote image fetch is replaced by an offline collection marker;
            # there is no response frame after terminal refusal.
            drive_module = types.ModuleType('drive')
            drive_module.__dict__.update(drive)
            drive_module.phase = phase
            drive_module.fetch = lambda name: attempted.update(fetchRequested=name)
            previous_drive = sys.modules.get('drive')
            sys.modules['drive'] = drive_module
            try:
                runpy.run_path(str(FIX / 'historical/newgame.py'))
            finally:
                if previous_drive is None:
                    del sys.modules['drive']
                else:
                    sys.modules['drive'] = previous_drive
            refused = attempted['result']
        finally:
            if previous is None:
                del sys.modules['work']
            else:
                sys.modules['work'] = previous
            server.shutdown()
            thread.join()
    assert settled['exit'] == 0 and refused['exit'] != 0
    assert state['batch'] == 5746
    assert abs(state['elapsed'] - 118.14731607) < 1e-8
    assert not any('cmd' in json.loads(row['commandRaw']) for row in state['requests'])
    result = dict(offlineOnly=True, guestAcceptance='unqualified', initialBatch=4722,
                  finalBatch=5746, redundantBatches=1024, redundantSeconds=19.6748,
                  finalElapsed=state['elapsed'], newGameSends=0, duplicateCapture=True,
                  commandsAndRawResponses=state['requests'], settled=settled, refused=refused,
                  originalNewGamePlan=attempted['commands'], offlineFetchMarker=attempted['fetchRequested'],
                  historicalPins={p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                                  for p in (FIX / 'historical').glob('*.py')})
    (output / 'before.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


if __name__ == '__main__':
    print(json.dumps(reproduce(Path(sys.argv[1])), indent=2))
