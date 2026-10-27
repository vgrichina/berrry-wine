#!/usr/bin/env python3
"""Offline transport fixtures only: no game, Node, image decoder or assets.

Runs the actual hash-pinned accepted Controller, with deterministic fake runner
NDJSON. Fake image bytes and menus are explicitly fixtures, never guest evidence.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]


def fake_runner(directory, mode):
    root = Path(directory)
    selected = None
    capture = 0
    print('FAKE RUNNER stdout diagnostic', flush=True)
    print('FAKE RUNNER stderr diagnostic', file=sys.stderr, flush=True)
    if mode == 'exit':
        def quit_later():
            time.sleep(.3)
            os._exit(7)
        threading.Thread(target=quit_later, daemon=True).start()
    for line in sys.stdin:
        cmd = json.loads(line)
        with (root/'received.jsonl').open('a') as output:
            output.write(json.dumps(cmd)+'\n')
        action = cmd.get('action')
        if action == 'snapshot':
            value = dict(batch=12, focus='0x10001', mainHwnd='0x10001', quit=False,
                         screen=dict(w=800, h=600),
                         windows=[dict(hwnd='0x10001', title='Airstrike FAKE', visible=True)])
            if mode == 'focus' and capture >= 2:
                value['focus'] = '0x10002'
        elif action == 'png':
            capture += 1
            data = ('FAKE IMAGE NOT PNG '+str(selected)).encode()
            if mode == 'image' and capture >= 2:
                data += b' changed'
            Path(cmd['path']).write_bytes(data)
            value = dict(path=cmd['path'], bytes=len(data), batch=12)
        else:
            if mode == 'missing-ack':
                continue
            kind, vk = cmd['cmd'].split(':')
            if kind == 'keydown':
                if vk == '27':
                    selected = 0
                elif vk == '40':
                    selected += 1
                elif vk == '13':
                    assert selected == 6
                    if mode != 'runner-zero':
                        print('[Exit] code=0', flush=True)
                    return
            value = dict(batch=12, logs=[f'[input] {kind} vk={vk} at batch 12'])
        ident = 'wrong-id' if mode == 'bad-ack' else cmd['id']
        print('[ctl] '+json.dumps(dict(id=ident, ok=True, value=value)), flush=True)


if __name__ == '__main__' and len(sys.argv) > 1 and sys.argv[1] == '--fake-runner':
    fake_runner(sys.argv[2], sys.argv[3])
    sys.exit(0)

spec = importlib.util.spec_from_file_location('bridge', ROOT/'tools/airstrike-observation-bridge.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)
CONTROLLER = ROOT/'tools/airstrike-menu-controller.py'


class Integration(unittest.TestCase):
    def exercise(self, name, *, review='normal', mode='normal', seconds=30):
        base = Path(os.environ.get('AIRSTRIKE_BRIDGE_FIXTURES', tempfile.gettempdir()))
        directory = Path(tempfile.mkdtemp(prefix=name+'-', dir=base))
        obj = bridge.Bridge([sys.executable, '-B', __file__, '--fake-runner', str(directory), mode],
                            CONTROLLER, directory/'evidence', guest_seconds=seconds)
        done = threading.Event()
        errors = []

        def reviewer():
            seen = set()
            try:
                while not done.is_set():
                    request = obj.root/'review-request.json'
                    if not request.exists():
                        done.wait(.01)
                        continue
                    value = json.loads(request.read_text())
                    if value['token'] in seen:
                        done.wait(.01)
                        continue
                    seen.add(value['token'])
                    after = value['after']
                    if review == 'none':
                        continue
                    # The historical failure was after Esc release. Delay that
                    # exact phase past BOTH old8s and controller10s, unchanged.
                    if review == 'delayed' and after == 'airstrike-2':
                        if done.wait(11):
                            return
                    index = None if after is None else int(after.rsplit('-', 1)[1])//2-1
                    observation = dict(focus='airstrike', unobscured=True, keysReleased=True,
                                       state='gameplay' if index is None else 'menu',
                                       after=after, evidence='FAKE fixture '+value['sha256'])
                    if index is not None:
                        observation.update(header='Airstrike menu', items=obj.module.ITEMS,
                                           selected=index)
                    reply = {k: value[k] for k in ('session', 'token', 'sha256', 'after')}
                    reply['observation'] = observation
                    if review == 'stale':
                        reply['after'] = 'old-run-2'
                    elif review == 'unmatched':
                        reply['token'] = 'another-capture'
                    elif review == 'wrong-selected' and index is not None:
                        observation['selected'] = 6
                    bridge.save(obj.root/('review-'+value['token']+'.json'), reply)
            except Exception as error:
                errors.append(str(error))

        thread = threading.Thread(target=reviewer)
        thread.start()
        try:
            result = obj.run()
        finally:
            done.set()
            thread.join(timeout=2)
        self.assertFalse(thread.is_alive())
        self.assertEqual(errors, [])
        self.assertTrue(result['cleanup']['complete'])
        self.assertEqual(result['cleanup']['remaining'], [])
        self.assertEqual(result['controllerSHA256'], bridge.CONTROLLER_SHA256)
        self.assertEqual(result['responseSeconds'], 10)
        commands = [json.loads(line) for line in (directory/'received.jsonl').read_text().splitlines()]
        inputs = [x for x in commands if 'cmd' in x]
        stdout = (obj.root/'runner.stdout').read_text()
        stderr = (obj.root/'runner.stderr').read_text()
        self.assertIn('stdout diagnostic', stdout)
        self.assertNotIn('stderr diagnostic', stdout)
        self.assertIn('stderr diagnostic', stderr)
        self.assertNotIn('stdout diagnostic', stderr)
        return obj, result, inputs

    def test_delayed_menu_review_before_response_window(self):
        obj, result, inputs = self.exercise('delayed-menu', review='delayed')
        self.assertEqual(result['status'], 'normal-quit-observed', result)
        self.assertEqual([x['cmd'] for x in inputs],
                         ['keydown:27', 'keyup:27']+['keydown:40', 'keyup:40']*6+['keydown:13'])
        starts = {e['token']:e['elapsed'] for e in obj.events if e['kind']=='review-start'}
        times = [e['elapsed']-starts[e['token']] for e in obj.events if e['kind']=='response-start']
        self.assertGreater(max(times), 10)
        self.assertEqual(result['cleanup']['signals'], [])

    def test_process_exit_during_review(self):
        _, result, inputs = self.exercise('exit-review', review='none', mode='exit')
        self.assertEqual(result['status'], 'refused')
        self.assertIn('exited during factual review', result['reason'])
        self.assertEqual(inputs, [])

    def test_stale_observation(self):
        _, result, inputs = self.exercise('stale', review='stale')
        self.assertIn('stale/unmatched', result['reason'])
        self.assertEqual(inputs, [])

    def test_unmatched_observation(self):
        _, result, inputs = self.exercise('unmatched', review='unmatched')
        self.assertIn('stale/unmatched', result['reason'])
        self.assertEqual(inputs, [])

    def test_changed_current_image(self):
        _, result, inputs = self.exercise('image-change', mode='image')
        self.assertIn('no longer current', result['reason'])
        self.assertEqual(inputs, [])

    def test_current_focus_before_input(self):
        _, result, inputs = self.exercise('focus-change', mode='focus')
        self.assertIn('focus absent', result['reason'])
        self.assertEqual(inputs, [])

    def test_actual_controller_rejects_wrong_selected(self):
        _, result, inputs = self.exercise('wrong-selected', review='wrong-selected')
        self.assertIn('insufficient-observation', result['reason'])
        self.assertEqual([x['cmd'] for x in inputs], ['keydown:27', 'keyup:27'])

    def test_runner_zero_without_host_exit_is_refused(self):
        _, result, inputs = self.exercise('runner-zero', mode='runner-zero')
        self.assertEqual(result['status'], 'refused')
        self.assertIn('normal Quit unproven', result['reason'])
        self.assertEqual(inputs[-1]['cmd'], 'keydown:13')
        self.assertEqual(result['cleanup']['signals'], [])

    def test_missing_ack_never_replayed(self):
        _, result, inputs = self.exercise('missing-ack', mode='missing-ack')
        self.assertIn('missing ACK within ten-second', result['reason'])
        self.assertEqual([x['cmd'] for x in inputs], ['keydown:27'])

    def test_unmatched_ack(self):
        _, result, inputs = self.exercise('bad-ack', mode='bad-ack')
        self.assertIn('unmatched/duplicate ACK', result['reason'])
        self.assertEqual(inputs, [])

    def test_overall_deadline_during_review_cleans_up(self):
        _, result, inputs = self.exercise('overall', review='none', seconds=.4)
        self.assertIn('overall guest deadline', result['reason'])
        self.assertEqual(inputs, [])
        self.assertEqual(result['cleanup']['signals'], ['SIGTERM'])
        self.assertLess(result['elapsed'], 2)

    def test_failed_spawn_distinct_diagnostics(self):
        base = Path(os.environ.get('AIRSTRIKE_BRIDGE_FIXTURES', tempfile.gettempdir()))
        directory = Path(tempfile.mkdtemp(prefix='failed-spawn-', dir=base))
        obj = bridge.Bridge(['/no/such/executable'], CONTROLLER, directory/'evidence')
        result = obj.run()
        self.assertEqual(result['status'], 'refused')
        self.assertEqual((obj.root/'runner.stdout').read_bytes(), b'')
        self.assertIn('No such file', (obj.root/'runner.stderr').read_text())
        self.assertEqual(json.loads((obj.root/'spawn-status.json').read_text())['state'], 'spawn-failed')
        self.assertTrue(result['cleanup']['complete'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
