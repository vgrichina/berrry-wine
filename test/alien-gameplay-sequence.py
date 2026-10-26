#!/usr/bin/env python3
"""Run an explicitly assigned new sequence, or collect existing offline files.

This does not start a guest or authorize one. Never point a new ledger at an
old/uncertain invocation. The exhausted fa30c996 run is permanently non-replayable.
"""
import argparse
import importlib.util
import json
from pathlib import Path

spec = importlib.util.spec_from_file_location('alien_control', Path(__file__).parent / 'helpers/alien-control-sequence.py')
control = importlib.util.module_from_spec(spec)
spec.loader.exec_module(control)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--collect', nargs='+', help='offline files; never constructs transport')
    parser.add_argument('--plan')
    parser.add_argument('--ledger')
    parser.add_argument('--run-id')
    parser.add_argument('--endpoint')
    parser.add_argument('--terminal-file')
    parser.add_argument('--allow-control', action='store_true')
    args = parser.parse_args(argv)
    if args.collect:
        if args.allow_control:
            parser.error('collection and control are separate modes')
        print(json.dumps(control.collect_retained(args.collect)))
        return 0
    if not (args.allow_control and args.plan and args.ledger and args.run_id
            and args.endpoint and args.terminal_file):
        parser.error('control requires explicit plan/ledger/new run-id/endpoint/terminal-file/allow-control')
    try:
        plan = control.read_json(args.plan, 64 * 1024)
        # Historical fixture plans are retained for offline regression only.
        if plan.get('historicalRun') or plan.get('offlineOnly'):
            raise control.ControlStopped('historical/offline plan cannot issue guest control')
        commands = plan['commands']
        controller = control.Controller(args.ledger, args.run_id,
            control.HttpTransport(args.endpoint), args.terminal_file)
        result = controller.run(commands)
        print(json.dumps({k: result[k] for k in ('status', 'next', 'lastAcknowledgedBatch',
              'lastFrozenBatch', 'terminalObserved', 'guestAcceptance')}))
        return 0
    except (Exception, KeyboardInterrupt) as error:
        print(json.dumps(dict(error=str(error)[:256], guestAcceptance='unqualified')))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
