#!/usr/bin/env python3
"""Offline semantic oracle for the retained Oct26 canonical native corpus.

Reads JSON only; never imports donor JS or loads/instantiates a module. Identity
verification is separate from semantic verification so in-memory adversarial
controls exercise the oracle instead of merely tripping a checksum.
"""
import argparse
import hashlib
import json
from pathlib import Path

CANDIDATE = '425755ee5ee9be0734c7aca187521100f5487674'
MODULES = {
    'tail': ('wine-assembly.wasm', 'af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b'),
    'compat': ('wine-assembly.compat.wasm', 'ed7635d508f7e842afd3c6b8489ba133ac3ddea2fa305439fca60284ea5613a8'),
}
APIS = ('GetMessageA', 'GetMessageW', 'PeekMessageA', 'PeekMessageW')
GROUPS = ('core', 'hooks-thread', 'hardware', 'unrelated')
MSG = 0x405000  # Owned synthetic PE fixture address, not a production layout.
STATE_KEYS = {'eax', 'esp', 'eip', 'yieldReason', 'msg', 'queue'}


class Rejected(ValueError):
    pass


def require(ok, message):
    if not ok:
        raise Rejected(message)


def equal(actual, expected, label):
    require(actual == expected, f'{label}: expected {expected!r}, observed {actual!r}')


def filename(backend, group):
    return backend + ('' if group == 'core' else '-' + group) + '-result.json'


def identity(case, group):
    return (case.get('name'), case.get('edge'), case.get('kind'),
            case.get('nested'), case.get('chain'))


def expected_cases(group):
    out = []
    for name in APIS:
        if group == 'unrelated':
            out.append((name, None, 'unrelated-decoded-callback-return', None, None))
        elif group == 'hardware':
            out.extend((name, edge, 'keyboard', None, chain)
                       for edge in ('CALL', 'JMP') for chain in (False, True))
        elif group == 'hooks-thread':
            out.extend((name, edge, None, nested, None)
                       for edge in ('CALL', 'JMP') for nested in (False, True))
        else:
            out.extend((name, edge, kind, None, None)
                       for edge in ('CALL', 'JMP')
                       for kind in (('queued', 'park', 'empty') if name.startswith('Peek') else ('queued', 'park')))
    if group == 'hardware':
        out.extend((name, None, 'no-remove' if name.startswith('Peek') else 'WM_QUIT', None, None)
                   for name in APIS)
    return out


def replay(calls):
    """Independent small invocation automaton; returns accepted completion metadata.

    This models the retained *valid* schedules, not the production owner's full
    failure/overflow behavior. A bound completion attempt must be ignored.
    """
    tokens, serial, accepted = {}, 0, []
    for call in calls:
        require(isinstance(call, list) and call, 'malformed import event')
        op, *args = call
        if op == 'message_begin':
            equal(len(args), 8, 'begin arity')
            parked = [(t, v) for t, v in tokens.items()
                      if v['phase'] == 'parked' and v['args'][1:3] == args[1:3]]
            if parked:
                token, value = parked[0]
                equal(value['args'], args, 'retry invocation arguments')
                value['phase'] = 'active'
            else:
                serial += 1
                tokens[serial] = dict(args=args, phase='active', binding=None)
        elif op in ('message_park', 'message_bind', 'message_complete'):
            equal(len(args), {'message_park': 1, 'message_bind': 3, 'message_complete': 2}[op], op+' arity')
            token = args[0]
            require(token in tokens, 'unknown invocation owner')
            v = tokens[token]
            if op == 'message_park':
                equal(v['phase'], 'active', 'park phase'); v['phase'] = 'parked'
            elif op == 'message_bind':
                equal(v['phase'], 'active', 'bind phase')
                require(args[1] in (1, 2), 'unknown continuation kind')
                binding = args[1:]
                require(not any(x['phase'] == 'bound' and x['binding'] == binding for x in tokens.values()), 'ambiguous binding')
                v.update(phase='bound', binding=binding)
            elif v['phase'] == 'active':
                accepted.append(dict(token=token, args=v['args'], result=args[1]))
                v['phase'] = 'done'
            else:
                require(v['phase'] == 'bound', 'duplicate or parked completion in retained schedule')
        elif op == 'message_resume':
            equal(len(args), 2, 'resume arity')
            matches = [v for v in tokens.values() if v['phase'] == 'bound' and v['binding'] == args]
            equal(len(matches), 1, 'resume owner'); matches[0]['phase'] = 'active'
        else:
            raise Rejected('unknown diagnostic import '+str(op))
    require(all(v['phase'] == 'done' for v in tokens.values()), 'incomplete invocation')
    return accepted


def check_state(state, label):
    equal(set(state), STATE_KEYS, label+' schema')
    require(all(type(state[k]) is int for k in STATE_KEYS - {'msg'}), label+' scalar types')
    require(isinstance(state['msg'], list) and len(state['msg']) == 7 and
            all(type(x) is int for x in state['msg']), label+' MSG schema')


def expected_calls(case, group, stack):
    name, edge, kind, nested, chain = identity(case, group)
    peek = name.startswith('Peek')
    esp = stack - (24 if peek else 20)
    flags = 0 if kind == 'no-remove' or not peek else 1
    begin = ['message_begin', APIS.index(name)+1, 1, esp, MSG, 0, 0, 0, flags]
    complete = ['message_complete', 1, 0 if kind in ('empty', 'WM_QUIT') else 1]
    # Continuation context is the saved callback frame, independent of the
    # API's four/five argument entry ESP (Peek has one extra argument).
    context = stack - 20
    bind = lambda k: ['message_bind', 1, k, context]
    resume = lambda k: ['message_resume', k, context]
    if kind == 'park':
        return [begin, ['message_park', 1], begin, complete]
    if group in ('hooks-thread', 'unrelated'):
        middle = []
        if nested:
            middle = [['message_begin', 4, 1, case['on']['suspended']['esp']-24, MSG+64, 0, 0, 0, 1],
                      ['message_complete', 2, 0]]
        return [begin, bind(2), *middle, resume(2), complete]
    if kind == 'keyboard':
        return [begin, bind(1), resume(1), *([bind(2), complete, resume(2)] if chain else []), complete]
    return [begin, complete]


def check_case(case, group, stack):
    name, edge, kind, nested, chain = identity(case, group)
    require(name in APIS, 'unknown API')
    off, on = case['off'], case['on']
    equal(off['calls'], [], 'OFF diagnostic imports')
    equal(off['records'], [], 'OFF diagnostic records')
    # Compare all persisted architecture, including states the original harness
    # did not compare in every group (first.after and unrelated.suspended).
    for field in ('state', 'bound', 'suspended', 'unrelatedState'):
        equal(field in on, field in off, field+' presence')
        if field in on:
            equal(on[field], off[field], 'OFF/ON '+field)
            if on[field] is not None: check_state(on[field], field)
    equal('first' in on, 'first' in off, 'first presence')
    if 'first' in on:
        equal(on['first'], off['first'], 'OFF/ON first')
        check_state(on['first']['after'], 'first.after')
        equal(on['first']['stack'], stack, 'canonical initial stack')
    for mode, detail in [('off', off), ('on', on)]:
        for k in ('name', 'edge', 'kind', 'nested'):
            if k in detail:equal(detail[k], case.get(k), mode+' '+k)
        if 'on' in detail: equal(detail['on'], mode == 'on', mode+' enabled')
        if 'omit' in detail: equal(detail['omit'], False, 'primary observation installed')
    state = on['state']; peek = name.startswith('Peek')
    expected_result = 0 if kind in ('empty', 'WM_QUIT') else 1
    expected_msg = [0, 0x401, 0x123, 0x456, 123 if peek else 0, 0, 0]
    if kind == 'empty': expected_msg = [0]*7
    elif kind == 'WM_QUIT': expected_msg[1] = 0x12
    elif group == 'hooks-thread': expected_msg[1] = 0x402
    elif kind == 'keyboard': expected_msg = [0, 0x402 if chain else 0x100, 65, 0x1e0001, 123, 0, 0]
    equal(state, dict(eax=expected_result, esp=stack+4, eip=0, yieldReason=0,
                      msg=expected_msg, queue=1 if kind == 'no-remove' else 0), 'final architecture')
    if kind == 'park':
        equal(on['bound'], on['first']['after'], 'park snapshot')
        equal(on['bound']['yieldReason'], 17, 'park yield')
        equal(on['bound']['esp'], stack-(24 if peek else 20), 'park frame')
        equal(on['bound']['eip'], on['first']['thunk'], 'park retry thunk')
    if group in ('hooks-thread', 'unrelated'):
        require(on['suspended']['eip'] != 0, 'suspended callback EIP')
        equal(on['suspended']['esp'], stack-36, 'suspended callback ESP')
        equal(on['suspended']['msg'][1], 0x401, 'pre-hook MSG')
    if group == 'unrelated':
        equal(on['unrelatedState']['eip'], 0, 'unrelated callback returned')
        equal(on['unrelatedState']['esp'], stack-0x400+4, 'disjoint unrelated stack')
        equal(on['unrelatedState']['msg'], on['suspended']['msg'], 'unrelated MSG unchanged')
    calls = expected_calls(case, group, stack)
    equal(on['calls'], calls, 'exact invocation import schedule')
    completed = replay(on['calls'])
    equal([x['token'] for x in completed], [2, 1] if nested else [1], 'completion ownership/order')
    records = on['records']; equal(len(records), len(completed), 'completion record count')
    first_sequence = 3 if kind == 'park' or group == 'hooks-thread' else 2
    for i, (record, event) in enumerate(zip(records, completed)):
        api, thread, esp, pointer, hwnd, lo, hi, flags = event['args']
        success = event['result'] >= 0 if api <= 2 else event['result'] != 0
        message = None
        if success:
            require(pointer == MSG, 'unexpected successful nested MSG')
            message = dict(zip(('hwnd', 'message', 'wParam', 'lParam', 'time', 'pointX', 'pointY'), state['msg']))
        expected = dict(kind='message-completion', sequence=first_sequence+i, batch=0,
                        correlation='invocation-owned', invocation=event['token'], api=APIS[api-1],
                        thread=thread, entryESP=esp, msgPointer=pointer, filterHwnd=hwnd,
                        filterMin=lo, filterMax=hi, removeFlags=None if api<=2 else flags,
                        result=event['result'], pmRemove=api<=2 or bool(flags&1),
                        successfulReturn=success, msg=message,
                        scope='main-instance; canonical build/runtime qualification still required')
        equal(record, expected, 'completion record '+str(i))
    return len(records)


def load_corpus(directory):
    return {(b, g): json.loads((Path(directory)/filename(b,g)).read_text())
            for b in MODULES for g in GROUPS}


def check(corpus):
    equal(set(corpus), {(b,g) for b in MODULES for g in GROUPS}, 'corpus group set')
    counts, records, omissions = {}, 0, []
    for backend in MODULES:
        stack_values = {c['off']['first']['stack'] for c in corpus[backend,'core']['cases']}
        equal(len(stack_values), 1, 'canonical stack consistency')
        stack = next(iter(stack_values))
        for group in GROUPS:
            j = corpus[backend,group]; module_name,module_hash = MODULES[backend]
            equal(j['candidate'], CANDIDATE, 'source candidate')
            equal(j['sha256'], module_hash, 'module SHA256')
            equal(j['backend'], module_name, 'module backend')
            equal(j['module'], '/tmp/enigma-reconciled-canonical-boat-build-oct26/source/build/'+module_name, 'executed module path')
            equal(j['scope'], 'synthetic native canonical decoded execution', 'scope')
            equal(j['productionRunnerQualified'], False, 'production scope')
            equal(j['originalGame'], False, 'game scope')
            equal(j.get('blocked', False), False, 'blocked group')
            equal(j['incidents'], [], 'successful group incidents')
            identities = [identity(c,group) for c in j['cases']]
            expected = expected_cases(group)
            equal(len(identities), len(set(identities)), 'duplicate case')
            equal(set(identities), set(expected), 'exact expected case set')
            counts[backend+':'+group] = len(identities)
            for c in j['cases']:
                try: records += check_case(c,group,stack)
                except Rejected as e:raise Rejected(f'{backend}/{group}/{identity(c,group)}: {e}') from e
            if group == 'core':
                # Treat the retained negative control as a deliberately invalid
                # positive case; do not trust its pass/rejected booleans.
                bad = j['omissionControl']['actual']
                equal(bad['records'], [], 'omitted observation records')
                equal(bad['omit'], True, 'omission wire')
                positive = next(c for c in j['cases'] if c['name']=='PeekMessageA' and c['edge']=='CALL' and c['kind']=='queued')
                for field in ('state','first','calls','bound'):
                    equal(bad[field], positive['on'][field], 'omission preserves module '+field)
                equal(len(replay(bad['calls'])), 1, 'module completed despite omission')
                omissions.append(backend)
    equal(sum(counts.values()), 120, 'pair count')
    return dict(verdict='ACCEPT_SYNTHETIC_CANONICAL_CORPUS',pairs=120,primaryExecutions=240,
                completionRecords=records,omissionControls=omissions,groups=counts,
                productionRunnerQualified=False,originalGame=False)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('remote_results', type=Path)
    p.add_argument('--pins', type=Path, help='independent input-pins JSON: relative filename -> sha256')
    args=p.parse_args()
    if args.pins:
        for name, pin in json.loads(args.pins.read_text()).items():
            equal(hashlib.sha256((args.remote_results/name).read_bytes()).hexdigest(),pin,'input hash '+name)
    try:print(json.dumps(check(load_corpus(args.remote_results)),sort_keys=True))
    except (Rejected, KeyError, TypeError, ValueError) as e:
        p.exit(1,'REJECT: '+str(e)+'\n')


if __name__ == '__main__':main()
