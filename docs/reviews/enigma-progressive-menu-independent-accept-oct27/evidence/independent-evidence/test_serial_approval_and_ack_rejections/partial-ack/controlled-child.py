"""Offline child transport: actual launched PID serves its own controlled state.

Not an Enigma/Node execution. Two listening sockets intentionally share ONE
handler/state; a sleeping descendant holds only the alternate descriptor.
"""
import argparse
import hashlib
import http.server
import json
import os
from pathlib import Path
import socket
import struct
import subprocess
import sys
import threading
import time
import zlib

q = argparse.ArgumentParser()
q.add_argument('--port', type=int, required=True)
q.add_argument('--root', type=Path, required=True)
q.add_argument('--fault', default='')
a = q.parse_args()
if a.fault == 'output':
    os.write(1, b'x'*4096)
batch = 0
credits = 0
captures = 0
wire = (a.root/'wire.jsonl').open('x')


def chunk(kind, data):
    return struct.pack('>I', len(data))+kind+data+struct.pack('>I', zlib.crc32(kind+data))


png = b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR', struct.pack('>IIBBBBB', 640,480,8,2,0,0,0))+chunk(b'IDAT',zlib.compress((b'\0'+b'\0'*1920)*480))+chunk(b'IEND',b'')


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        global batch, credits, captures
        c = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        wire.write(json.dumps(dict(command=c,pid=os.getpid(),batch=batch))+'\n')
        wire.flush()
        op = c.get('action')
        if op == 'step':
            credits = c['n']
            if a.fault == 'timeout' or (a.fault == 'loading-timeout' and captures):
                time.sleep(2)
            if a.fault == 'die':
                os._exit(7)
            batch += c['n']
            credits = 0
            v = dict(ran=c['n'],steps=0,batch=batch,frozen=True)
            if a.fault == 'wrong-ack':
                v['ran'] -= 1
        elif op == 'snapshot':
            v = dict(batch=batch,quit=False,yieldReason=0,
                     frozen=dict(frozen=True,credits=credits,recording=False))
            if batch and a.fault == 'credits':
                v['frozen']['credits'] = 1
        elif op == 'png':
            captures += 1
            # Distinct offline loading/menu states, not real Enigma images.
            image = png
            if a.fault in ('loading-review', 'loading-timeout', 'never-ready'):
                image = png[:-12]+chunk(b'tEXt', b'state\0'+(b'loading' if captures == 1 or a.fault == 'never-ready' else b'menu'))+png[-12:]
            Path(c['path']).write_bytes(image)
            v = dict(batch=batch,frozen=True,path=c['path'],bytes=len(image))
            frame = dict(safeStartGame=True,reviewed=True,frameSHA256=hashlib.sha256(image).hexdigest(),batch=batch,x=10,y=20)
            if a.fault in ('never-ready','loading-timeout') or (a.fault == 'loading-review' and captures == 1):
                frame.pop('safeStartGame')
                frame['continueLoading'] = True
            if a.fault == 'stale-review':
                frame['batch'] += 1
            if a.fault in ('review','stale-review','loading-review','loading-timeout','never-ready') and 'menu-candidate' in c['path']:
                (a.root/'decision.json').write_text(json.dumps(frame))
        elif op == 'quit':
            v = dict(quitting=True)
        elif 'cmd' in c:
            assert credits == 0
            v = dict(queued=True,batch=batch)
        else:
            raise AssertionError(c)
        b = json.dumps(dict(ok=True,value=v)).encode()
        self.send_response(200)
        self.send_header('Content-Length',str(len(b)))
        self.end_headers()
        self.wfile.write(b)


s = http.server.HTTPServer(('127.0.0.1',a.port),Handler)
alias = http.server.HTTPServer(('127.0.0.1',0),Handler)
idle = subprocess.Popen([sys.executable,'-S','-c','import time;time.sleep(120)'],
    pass_fds=(alias.fileno(),),stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
(a.root/'child.json').write_text(json.dumps(dict(pid=os.getpid(),alternate_port=alias.server_port,idle_pid=idle.pid)))
threading.Thread(target=alias.serve_forever,daemon=True).start()
s.serve_forever(poll_interval=.01)
