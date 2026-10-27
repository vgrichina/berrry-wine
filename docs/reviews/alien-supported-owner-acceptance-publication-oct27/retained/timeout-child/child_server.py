"""Offline child state server, launched ONLY by the production supervisor.

Two sockets share one handler/state; the sleeping descendant inherits ONLY
the alternate listener. A ready receipt reports who actually serves requests.
"""
import http.server
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time

home = Path(sys.argv[1])
port = int(sys.argv[2])
mode = sys.argv[3]
batch = 0 if mode == 'startup' else 4722
rows = []
lock = threading.Lock()


def save(name, value):
    p = home / name
    tmp = p.with_suffix('.new')
    tmp.write_text(json.dumps(value))
    os.replace(tmp, p)


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        global batch
        raw = self.rfile.read(int(self.headers['Content-Length']))
        command = json.loads(raw)
        row = dict(command=command, raw=raw.decode(), serverPID=os.getpid(), socketPort=self.server.server_port)
        with lock:
            rows.append(row)
            save('wire.json', rows)
        action = command.get('action')
        if 'cmd' in command:
            if mode == 'hold':
                (home / 'input-pending').touch()
                until = time.monotonic() + 12
                while not (home / 'release-input').exists() and time.monotonic() < until:
                    time.sleep(.01)
            if mode == 'timeout':
                time.sleep(22)
            if mode == 'uncertain':
                self.close_connection = True
                return
            value = dict(batch=batch, queued=True)
        elif action == 'snapshot':
            value = dict(batch=batch, quit=False, frozen=dict(frozen=True, credits=1 if mode == 'credits' else 0))
            if mode == 'terminal':
                value['quit'] = True
        elif action == 'step':
            batch += command['n']
            value = dict(batch=batch, ran=command['n']-(mode == 'partial'), steps=command['n'], frozen=True)
        elif action == 'png':
            Path(command['path']).write_bytes(b'offline evidence only')
            value = dict(batch=batch, frozen=True, path=command['path'], bytes=21)
        else:
            assert action == 'quit'
            value = dict(quitting=True)
        response = json.dumps(dict(ok=True, value=value)).encode()
        row['response'] = response.decode()
        save('wire.json', rows)
        self.send_response(200)
        self.send_header('Content-Length', str(len(response)))
        self.end_headers()
        self.wfile.write(response)


server = http.server.HTTPServer(('127.0.0.1', port), Handler)
alias = http.server.HTTPServer(('127.0.0.1', 0), Handler)
idle = subprocess.Popen([sys.executable, '-S', '-c', 'import time; time.sleep(115)'],
    pass_fds=(alias.fileno(),), stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
threading.Thread(target=alias.serve_forever, kwargs={'poll_interval':.01}, daemon=True).start()
save('ready.json', dict(serverPID=os.getpid(), alternatePort=alias.server_port,
    idlePID=idle.pid, primaryFD=server.fileno(), alternateFD=alias.fileno(), batch=batch))
server.serve_forever(poll_interval=.01)
