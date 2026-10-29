#!/usr/bin/env python3
"""Source-only reproducer. Never imports or executes the production launcher/fixture."""
import ast
import base64
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]


def allowed_syscalls(source):
    tree = ast.parse(source)
    restrict = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'restrict')
    assignment = next(n for n in restrict.body if isinstance(n, ast.Assign)
                      and any(isinstance(t, ast.Name) and t.id == 'allowed' for t in n.targets))
    return ast.literal_eval(assignment.value)


def program(allowed):
    # Exact instruction template in the pinned confine.py, interpreted as data.
    ins = [(0x20,0,0,4),(0x15,1,0,0xc000003e),(0x06,0,0,0x80000000),
           (0x20,0,0,0),(0x45,0,1,0x40000000),(0x06,0,0,0x80000000)]
    for number in allowed:
        ins.extend([(0x15,0,1,number),(0x06,0,0,0x7fff0000)])
    return ins + [(0x06,0,0,0x00050001)]


def interpret(ins, number, arch=0xc000003e):
    pc = 0
    value = 0
    while pc < len(ins):
        op, jt, jf, k = ins[pc]
        if op == 0x20:
            value = {0: number, 4: arch}[k]
        elif op in (0x15, 0x45):
            condition = value == k if op == 0x15 else bool(value & k)
            pc += jt if condition else jf
        elif op == 0x06:
            return k
        else:
            raise ValueError('unsupported BPF opcode')
        pc += 1
    raise ValueError('missing return')


def check_template(source):
    tree = ast.parse(source)
    restrict = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'restrict')
    initial = next(n.value for n in restrict.body if isinstance(n, ast.Assign)
                   and any(isinstance(t, ast.Name) and t.id == 'ins' for t in n.targets))
    assert ast.literal_eval(initial) == program([])[:-1]
    loop = next(n for n in restrict.body if isinstance(n, ast.For)
                and isinstance(n.iter, ast.Name) and n.iter.id == 'allowed')
    expected = ast.parse('for syscall in allowed: ins.extend([(0x15,0,1,syscall),(0x06,0,0,0x7fff0000)])').body[0]
    assert ast.dump(loop) == ast.dump(expected)
    terminal = ast.parse('ins.append((0x06,0,0,0x00050000|1))').body[0]
    assert any(ast.dump(n) == ast.dump(terminal) for n in restrict.body)


def propose(outer, fixture):
    boundary = outer.index('--')
    child = outer[boundary+1:]
    assert child[:3] == ['/usr/bin/python3', '-B', '/tmp/tvcm/fixture.py']
    compile(fixture, child[2], 'exec')  # syntax only; no execution
    return outer[:boundary+1] + child[:2] + ['-c', fixture.decode()] + child[3:]


def analyze():
    dispatch = json.loads((HERE/'dispatch.json').read_text())
    assert hashlib.sha256(Path(dispatch['pythonExecutable']).read_bytes()).hexdigest() == dispatch['pythonExecutablePin']['sha256']
    receipt = json.loads((HERE/'predecessor-completion-receipt.json').read_text())
    for relative, pin in dispatch['sourcePins'].items():
        data = (REPO/relative).read_bytes()
        assert len(data) == pin['bytes'] and hashlib.sha256(data).hexdigest() == pin['sha256']
    canonical = (HERE/'predecessor-completion-receipt.json').read_bytes()
    assert hashlib.sha256(canonical).hexdigest() == dispatch['canonicalReceiptPin']['sha256']
    fixture = (HERE/'fixture.py.txt').read_bytes()
    assert hashlib.sha256(fixture).hexdigest() == receipt['fixture']['sha256']
    original = (HERE/'predecessor-cancellation-receipt.json').read_bytes()
    assert hashlib.sha256(original).hexdigest() == receipt['originalReceipt']['sha256']
    source = (REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/confine.py').read_text()
    check_template(source)
    allowed = allowed_syscalls(source)
    assert interpret(program(allowed),16) == 0x50001
    case = json.loads((HERE/'predecessor-case1-result.json').read_text())
    backend = case['report']['backendReceipt']
    output = base64.b64decode(backend['output']['data']).decode()
    assert backend['exit'] == 2 and 'Operation not permitted' in output
    assert backend['filesystem']['written'] == 0 and backend['filesystem']['failure'] is None
    return dict(status='UNRESOLVED_RUNTIME_CAUSAL_ATTRIBUTION',
                staticMechanism='filename fopen -> descriptor CLOEXEC ioctl FIOCLEX -> own seccomp EPERM',
                observedFailingSyscall=None, childArgv=case['argv'][case['argv'].index('--')+1:],
                confineArgv=['/usr/bin/python3','-B',
                    '/tmp/tvcm/repo/test/toyvm-kernel-profile-accounting-backend-oct28/confine.py',
                    '/tmp/tvcm/work/domain']+case['argv'][case['argv'].index('--')+1:],
                allowedSyscalls=allowed, ioctlPolicyResult=interpret(program(allowed),16),
                output=output, proposedProductionCLI=propose(case['argv'],fixture),
                proposalRuntimeTested=False, accountingBugEstablished=False,
                platformRestrictionEstablished=False, runtimeExecuted=False)


if __name__ == '__main__':
    print(json.dumps(analyze(), indent=2))
