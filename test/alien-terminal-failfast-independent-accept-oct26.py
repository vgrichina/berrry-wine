#!/usr/bin/env python3
"""Offline production CLI challenge; no guest. Run under prescribed pool/supervisor.

Directory-fsync hook publishes an external terminal receipt after genuine durable
intent and before transport. It changes no candidate source or transport method.
A real supervisor can be scheduled during that same interval.
"""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
OPS = Path(os.environ['TMPDIR'])
def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

legacy = load(ROOT/'test/test-alien-control-sequence.py', 'retained_regression')
mode = sys.argv[1]
if mode == 'historical':
    suite = unittest.TestSuite([legacy.Production('test_historical_failure_owns_entire_recipe_and_durable_latch')])
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(not result.wasSuccessful())

class Challenge(legacy.Case):
    def test_boundary(self):
        entry = load(ROOT/'test/alien-gameplay-sequence.py', 'pinned_entry')
        plan = [dict(action='snapshot'), dict(action='png',path='/tmp/offline-only.png'),
                dict(action='eval',code='null'), dict(cmd='keypress:13'), dict(action='quit')]
        endpoint, sends = self.server([dict(value=legacy.snapshot(4650)),
            dict(value=dict(batch=4650,frozen=True,path='/tmp/offline-only.png',bytes=20)),
            dict(value=None), dict(value=dict(batch=4650,queued=True)),dict(value=dict(quitting=True))])
        path = self.home/'plan.json';path.write_text(json.dumps(dict(commands=plan)))
        argv=['--allow-control','--plan',str(path),'--ledger',str(self.ledger),
            '--run-id','independent-offline-injected','--endpoint',endpoint,'--terminal-file',str(self.terminal)]
        if mode=='early-terminal':
            with contextlib.redirect_stderr(io.StringIO()):
                try:entry.main(argv[1:])
                except SystemExit as error:self.assertEqual(error.code,2)
                else:self.fail('CLI default permitted control')
            self.assertFalse(sends.exists())
        events=[]
        original=os.fsync
        def fsync(fd):
            original(fd)
            # Trigger only after the actual directory fsync for pending PNG.
            if os.readlink('/proc/self/fd/'+str(fd)) != str(self.home) or self.terminal.exists():return
            state=json.loads(self.ledger.read_text())
            if state.get('pending',{}).get('index') != 1:return
            events.append(dict(event='intent-file-and-directory-fsynced',pending=state['pending'],status=state['status']))
            with self.terminal.open('w') as stream:
                json.dump(dict(reason='supervisor-ended-invocation',returncode=0,batch=4650),stream)
                stream.flush();original(stream.fileno())
            directory=os.open(self.home,os.O_RDONLY|os.O_DIRECTORY)
            try:original(directory)
            finally:os.close(directory)
            events.append(dict(event='terminal-receipt-durable-before-transport'))
        # Positive early-terminal case and its independent omission control use
        # the same assertion. Only mutation of loaded check, never disk source.
        if mode in ('early-terminal','omit-terminal-check'):
            self.terminal.write_text('{"reason":"already-ended","returncode":0,"batch":4650}')
            if mode=='omit-terminal-check':
                entry.control.Controller._check_guest=lambda self,state:None
        else:
            os.fsync=fsync
        output=io.StringIO()
        try:
            with contextlib.redirect_stdout(output):rc=entry.main(argv)
        finally:os.fsync=original
        observed=[json.loads(s) for s in sends.read_text().splitlines()] if sends.exists() else []
        ledger=json.loads(self.ledger.read_text())
        before=list(observed)
        with contextlib.redirect_stdout(io.StringIO()):restart=entry.main(argv)
        after=[json.loads(s) for s in sends.read_text().splitlines()] if sends.exists() else []
        receipt=dict(mode=mode,entry=str(ROOT/'test/alien-gameplay-sequence.py'),events=events,
            cliReturn=rc,cliOutput=output.getvalue(),sends=observed,ledger=ledger,
            restartReturn=restart,restartSentNothing=after==before,guestExecuted=False,
            expectedSends=[] if mode in ('early-terminal','omit-terminal-check') else plan[:1])
        (OPS/(mode+'-receipt.json')).write_text(json.dumps(receipt,indent=2)+'\n')
        self.assertEqual(after,before,'existing ledger must not reconnect')
        self.assertEqual(observed,receipt['expectedSends'],'command sent after known durable terminal receipt')

suite=unittest.defaultTestLoader.loadTestsFromTestCase(Challenge)
result=unittest.TextTestRunner(verbosity=2).run(suite)
# Rejection/control failures are expected and retained with original assertion.
if mode in ('dispatch-boundary','omit-terminal-check'):
    print(json.dumps(dict(mode=mode,oracleRejected=not result.wasSuccessful())))
    raise SystemExit(result.wasSuccessful())
raise SystemExit(not result.wasSuccessful())
