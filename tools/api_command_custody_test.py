#!/usr/bin/env python3
"""Local real-process/HTTP checks; no remote allocation or gameplay."""
import hashlib
import http.server
import json
import os
from pathlib import Path
import shlex
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from urllib.parse import parse_qs, quote, urlsplit

from api_command_custody import Transport, CommandObservationError

HERE = Path(__file__).resolve().parent
CALLER = HERE/'api_command_custody.py'
EVIDENCE = os.environ.get('API_CUSTODY_EVIDENCE')


def retain(name, value):
    if EVIDENCE:
        Path(EVIDENCE, name+'.json').write_text(json.dumps(value, indent=2))


class Control:
    """Documented API shapes backed by actual local commands, not fake exits."""
    def __init__(self, mode='normal'):
        self.mode = mode
        self.posts = []
        self.gets = []
        self.uploads = []
        self.children = []
        self.readers = []
        self.states = {}
        self.lock = threading.Lock()
        control = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def reply(self, value):
                data = json.dumps(value).encode()
                self.send_response(200)
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def disconnect(self):
                self.connection.shutdown(socket.SHUT_RDWR)
                self.connection.close()

            def do_POST(self):
                assert self.headers['Authorization'] == 'Bearer local-test'
                value = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                if self.path.endswith('/files/upload-url'):
                    control.uploads.append(value['path'])
                    self.reply(dict(method='PUT', path=value['path'], url=control.base+'/put?'+
                                    'path='+quote(value['path'])))
                    return
                control.posts.append(value)
                p = subprocess.Popen(['/bin/sh', '-c', value['command']], stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE, start_new_session=True)
                control.children.append(p)
                state = dict(success=True, type='command.started', processId=p.pid,
                             command=value['command'], startedAt=str(time.monotonic_ns()))
                control.states[p.pid] = dict(state, known=True, status='running')

                def consume():
                    so, se = p.communicate()
                    with control.lock:
                        control.states[p.pid].update(status='exited', exitCode=p.returncode,
                            stdout=so.decode(), stderr=se.decode(), stdoutTruncated=False,
                            stderrTruncated=False, signal=None, oomKilled=False)
                t = threading.Thread(target=consume)
                control.readers.append(t)
                t.start()
                if control.mode == 'post-disconnect':
                    self.disconnect()
                elif control.mode == 'ack-mismatch':
                    self.reply(dict(state, command='different command'))
                else:
                    self.reply(state)

            def do_GET(self):
                control.gets.append(self.path)
                if control.mode in ('disconnect', 'nonzero', 'mismatch', 'unknown', 'truncated') and len(control.gets) == 1:
                    self.disconnect()
                    return
                if control.mode == 'always-disconnect':
                    self.disconnect()
                    return
                if control.mode == 'hang':
                    time.sleep(.4)
                    self.disconnect()
                    return
                pid = int(self.path.split('/')[-1].split('?')[0])
                with control.lock:
                    state = dict(control.states[pid])
                if control.mode == 'mismatch':
                    state['startedAt'] = 'different identity'
                if control.mode == 'unknown':
                    state['known'] = False
                if control.mode == 'truncated':
                    state['stdoutTruncated'] = True
                self.reply(state)

            def do_PUT(self):
                path = Path(parse_qs(urlsplit(self.path).query)['path'][0])
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(self.rfile.read(int(self.headers['Content-Length'])))
                self.send_response(200)
                self.send_header('Content-Length', '0')
                self.end_headers()

        self.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.base = 'http://127.0.0.1:'+str(self.server.server_port)
        self.thread = threading.Thread(target=self.server.serve_forever)
        self.thread.start()

    def transport(self, rows, **kw):
        return Transport(self.base, 'local-test', 'local', rows.append, **kw)

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        for p in self.children:
            if p.poll() is None:
                os.killpg(p.pid, signal.SIGKILL)
        for t in self.readers:
            t.join(timeout=3)
            assert not t.is_alive()
        assert all(p.wait() is not None for p in self.children)


class Checks(unittest.TestCase):
    def control(self, mode='normal'):
        c = Control(mode)
        self.addCleanup(c.close)
        return c

    def test_normal_real_command(self):
        c = self.control()
        rows = []
        t = c.transport(rows)
        self.assertEqual(t.remote('one', "print('real result')", 2), 'real result\n')
        self.assertIsNone(t.failure)
        self.assertEqual(len(c.posts), 1)

    def test_disconnect_recovers_same_identity_but_remains_terminal(self):
        c = self.control('disconnect')
        rows = []
        t = c.transport(rows)
        with self.assertRaises(CommandObservationError) as caught:
            t.remote('capture', "print('read-only capture result')", 2)
        error = caught.exception
        self.assertEqual(error.first_failure['error'], 'RemoteDisconnected')
        self.assertEqual(error.result['stdout'], 'read-only capture result\n')
        self.assertTrue(t.cancel.is_set())
        for operation in [lambda: t.remote('input', "print('MUST NOT RUN')", 2),
                          lambda: t.api('POST', 'anything', {}),
                          lambda: t.url('/anything')]:
            with self.assertRaises(InterruptedError):
                operation()
        self.assertEqual(len(c.posts), 1)
        self.assertEqual(len(set(c.gets)), 1)
        self.assertEqual(len([r for r in rows if r['event'] == 'api-terminal']), 1)
        retain('disconnected-poll', dict(firstFailure=error.first_failure,
               result=error.result, events=rows, posts=c.posts, gets=c.gets, inputTerminal=True))

    def test_ambiguous_post_and_ack_never_replayed(self):
        for mode in ('post-disconnect', 'ack-mismatch'):
            with self.subTest(mode=mode):
                c = self.control(mode)
                t = c.transport([])
                with self.assertRaises(CommandObservationError) as caught:
                    t.remote('one', "print('once')", 1)
                self.assertIsNone(caught.exception.result)
                self.assertEqual(len(c.posts), 1)
                self.assertEqual(c.gets, [])

    def test_recovery_refuses_bad_outcomes_and_identity(self):
        for mode in ('nonzero', 'mismatch', 'unknown', 'truncated'):
            with self.subTest(mode=mode):
                c = self.control(mode)
                t = c.transport([])
                code = "import sys; print('evidence'); sys.exit(9)" if mode == 'nonzero' else "print('ok')"
                with self.assertRaises(CommandObservationError) as caught:
                    t.remote('one', code, 2)
                self.assertIsNone(caught.exception.result)
                self.assertEqual(caught.exception.first_failure['error'], 'RemoteDisconnected')
                self.assertEqual(len(c.posts), 1)

    def test_recovery_attempt_and_absolute_deadline_bounds(self):
        for mode in ('always-disconnect', 'hang'):
            with self.subTest(mode=mode):
                c = self.control(mode)
                rows = []
                start = time.monotonic()
                t = c.transport(rows, deadline=start+.25)
                with self.assertRaises(CommandObservationError):
                    t.remote('one', "print('ok')", 10)
                self.assertLess(time.monotonic()-start, .6)
                self.assertLessEqual(len(c.gets), 4)
                self.assertEqual(len(c.posts), 1)
        c = self.control('always-disconnect')
        t = c.transport([])
        with self.assertRaises(CommandObservationError):
            t.remote('one', "print('ok')", 10)
        self.assertEqual(len(c.gets), 4)

    def test_actual_production_upload_and_remote_reread_composition(self):
        for mode in ('normal', 'disconnect'):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)/'source'
                root.mkdir()
                dest = Path(temp)/'remote'
                data = b'bounded small production provider\n'
                (root/'pin').write_bytes(data)
                pins = [dict(path='pin', size=len(data), sha256=hashlib.sha256(data).hexdigest())]
                c = self.control(mode)
                rows = []
                t = c.transport(rows, timeout=2)
                if mode == 'normal':
                    t.provision(root, pins, str(dest))
                    self.assertEqual(rows[-1]['event'], 'all-remote-verified')
                else:
                    with self.assertRaises(CommandObservationError):
                        t.provision(root, pins, str(dest))
                    self.assertFalse(any(r['event'] == 'all-remote-verified' for r in rows))
                    with self.assertRaises(InterruptedError):
                        t.provision(root, pins, str(dest))
                self.assertEqual((dest/'pin').read_bytes(), data)
                self.assertEqual(len(c.posts), 1)
                self.assertEqual(len(c.uploads), 1)
                retain('production-provider-'+mode, dict(events=rows, posts=c.posts,
                       gets=c.gets, finalSHA256=hashlib.sha256((dest/'pin').read_bytes()).hexdigest()))

    def test_mw3_production_command_ack_route_without_gameplay(self):
        # Same shell/Node request shape as native.request, with the unchanged
        # production numbered-ACK transport. Local consumer only acknowledges a
        # passive capture; there is no game, browser or input executor.
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp)/'case-webgl'
            (out/'commands').mkdir(parents=True)
            (out/'execution-window.json').write_text(json.dumps(dict(
                browserStop=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time()+120)))))
            helper = str(HERE/'mw3-run-transport.cjs')
            js = ("const t=require("+json.dumps(helper)+");const out="+json.dumps(str(out))+";"
                  "t.request(out,'deployment-wait',{id:'deployment-wait',action:'capture',"
                  "waitMs:0,label:'deployment-wait'},20000).then(v=>console.log(JSON.stringify(v)))"
                  ".catch(e=>{console.error(e);process.exitCode=1});")
            command = 'cd '+shlex.quote(temp)+' && '+shlex.join(['node', '-e', js])
            consume = ("const fs=require('fs'),t=require("+json.dumps(helper)+");"
                       "const out="+json.dumps(str(out))+";const due=Date.now()+3000;"
                       "(async()=>{while(Date.now()<due){if(await t.consume(out,0,async c=>{"
                       "if(c.action!=='capture')throw Error('input forbidden');"
                       "fs.writeFileSync(out+'/passive-observed',c.id,{flag:'wx'});"
                       "}))return;await new Promise(r=>setTimeout(r,10));}throw Error('no command');"
                       "})().catch(e=>{console.error(e);process.exitCode=1});")
            consumer = subprocess.Popen(['node', '-e', consume], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            try:
                c = self.control('disconnect')
                t = c.transport([])
                with self.assertRaises(CommandObservationError) as caught:
                    t.execute('deployment-wait', command, timeout=60, deadline=time.monotonic()+3)
                self.assertEqual(json.loads(caught.exception.result['stdout']),
                                 dict(number=0, id='deployment-wait', ok=True))
                self.assertEqual(c.posts[0]['command'], command)
                self.assertEqual(len(c.posts), 1)
                self.assertEqual(len(list((out/'commands').iterdir())), 1)
                self.assertEqual((out/'passive-observed').read_text(), 'deployment-wait')
                with self.assertRaises(InterruptedError):
                    t.execute('no-rearm', command, timeout=60, deadline=time.monotonic()+3)
                retain('production-mw3-ack-route', dict(command=command, posts=c.posts,
                       gets=c.gets, result=caught.exception.result, inputTerminal=True))
            finally:
                so, se = consumer.communicate(timeout=4)
                self.assertEqual((consumer.returncode, so, se), (0, b'', b''))

    def test_expired_caller_deadline_prevents_post(self):
        c = self.control()
        t = c.transport([])
        with self.assertRaises(CommandObservationError):
            t.execute('expired', 'true', timeout=60, deadline=time.monotonic()-1)
        self.assertEqual(c.posts, [])

    def run_caller(self, temp, mode, base='', term=False, timeout=4):
        run = Path(temp)/'caller'
        ready = Path(temp)/'ready'
        argv = [sys.executable, '-B', str(CALLER), '--run', str(run),
                '--timeout', str(timeout), '--grace', '.2', '--',
                sys.executable, '-B', __file__, '--child', mode, str(ready), base]
        p = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if term:
            due = time.monotonic()+3
            while not ready.exists():
                self.assertIsNone(p.poll())
                self.assertLess(time.monotonic(), due)
                time.sleep(.01)
            p.send_signal(signal.SIGTERM)
        so, se = p.communicate(timeout=timeout+4)
        self.assertEqual(so, b'')
        self.assertEqual(se, b'')
        receipt = json.loads((run/'manager-actual-wait.json').read_text())
        self.assertTrue(receipt['actualWait'])
        self.assertEqual(receipt['separateEOF'], dict(stdout=True, stderr=True))
        self.assertEqual(receipt['errors'], [])
        self.assertEqual(json.loads((run/'watchdog-actual-wait.json').read_text())['status'], 0)
        for name in ('stdout', 'stderr'):
            data = (run/(name+'.log')).read_bytes()
            self.assertEqual(len(data), receipt['bytes'][name])
            self.assertEqual(hashlib.sha256(data).hexdigest(), receipt['sha256'][name])
        retain('caller-'+mode, dict(outer=dict(status=p.returncode, actualWait=True,
               stdoutEOF=True, stderrEOF=True), child=receipt,
               watchdog=json.loads((run/'watchdog-actual-wait.json').read_text()),
               watchdogObserved=json.loads((run/'watchdog-observed.json').read_text()),
               watchdogTerminal=json.loads((run/'watchdog-terminal.json').read_text())))
        return p.returncode, receipt

    def test_actual_caller_normal_term_and_deadline(self):
        for mode, term, expected in [('normal', False, 0), ('term', True, 143),
                                      ('ignore-term', False, 137), ('pipe-holder', False, 1),
                                      ('exit143', False, 143)]:
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as temp:
                rc, receipt = self.run_caller(temp, mode, term=term, timeout=1.3)
                self.assertEqual(rc, expected)
                self.assertGreaterEqual(receipt['bytes']['stdout'], 131072)
                self.assertGreaterEqual(receipt['bytes']['stderr'], 131072)
                if mode == 'term':
                    self.assertEqual(receipt['status'], 7)
                if mode == 'pipe-holder':
                    self.assertEqual(receipt['status'], 0)
                    self.assertEqual(receipt['reason'], 'deadline')

    def test_actual_caller_transport_failure_retains_child_nonzero_and_pipes(self):
        c = self.control('disconnect')
        with tempfile.TemporaryDirectory() as temp:
            rc, receipt = self.run_caller(temp, 'transport', c.base)
            self.assertEqual(rc, 23)
            self.assertEqual(receipt['status'], 23)
            recovered = json.loads((Path(temp)/'ready').read_text())
            self.assertEqual(recovered['error'], 'RemoteDisconnected')
            self.assertEqual(recovered['result']['stdout'], 'terminal evidence\n')
            self.assertEqual(len(c.posts), 1)


def child(mode, ready, base):
    # Fill one pipe before the other: a sequential stdout-then-stderr reader
    # deadlocks here while waiting for stdout EOF.
    os.write(2, b'e'*131072)
    os.write(1, b'o'*131072)
    if mode == 'transport':
        t = Transport(base, 'local-test', 'local', lambda r: None)
        try:
            t.remote('capture', "print('terminal evidence')", 2)
        except CommandObservationError as e:
            Path(ready).write_text(json.dumps(dict(error=e.first_failure['error'], result=e.result)))
            try:
                t.remote('input', "print('FORBIDDEN')", 2)
            except InterruptedError:
                sys.exit(23)
        sys.exit(99)
    if mode == 'term':
        def terminate(sig, frame):
            os.write(1, b'final stdout')
            os.write(2, b'final stderr')
            sys.exit(7)
        signal.signal(signal.SIGTERM, terminate)
    if mode == 'ignore-term':
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
    if mode == 'pipe-holder':
        # The actual child exits but a descendant retains both inherited FDs.
        # Caller must not infer EOF from that child's exit.
        subprocess.Popen([sys.executable, '-B', '-c', 'import time; time.sleep(10)'])
        return
    if mode == 'exit143':
        sys.exit(143)
    Path(ready).write_text('ready')
    if mode != 'normal':
        while True:
            time.sleep(.01)


if __name__ == '__main__':
    if sys.argv[1:2] == ['--child']:
        child(*sys.argv[2:])
    else:
        unittest.main()
