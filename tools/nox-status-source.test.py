"""Compile and execute the exact emitted Nox status query on finalized evidence.

No browser, transport, guest, or process signal is used. Only Path construction
is mapped from the remote run root to its finalized, hash-verified local files.
"""
import ast
import builtins
import contextlib
import hashlib
import io
import json
from pathlib import Path
import sys
import types


def emitted(wrapper, root, run):
    tree = ast.parse(wrapper.read_text())
    scope = dict(t=types.SimpleNamespace(ROOT=root), R=run,
                 mode='original', folder='original')
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(
                isinstance(t, ast.Name) and t.id == 'code' for t in node.targets):
            scope['code'] = eval(compile(ast.Expression(node.value), str(wrapper), 'eval'), scope)
    return scope['code']


def main():
    wrapper, finalized, out = map(lambda p: Path(p).resolve(), sys.argv[1:])
    out.mkdir(exist_ok=False)
    run = wrapper.parent
    root = '/home/user/nox-corrected-status-host-route-0423-runtime'
    code = emitted(wrapper, root, run)
    (out/'exact-emitted.py').write_text(code)
    broken = emitted(finalized/'status.py', root, run)
    try:
        compile(broken, 'original-broken-status.py', 'exec')
    except IndentationError as error:
        assert error.lineno == 2
    else:
        raise AssertionError('original line-2 indentation defect not reproduced')
    compiled = compile(code, 'exact-emitted.py', 'exec')
    receipt = json.loads((finalized/'retrieval-verified.json').read_text())
    assert receipt['passed'] and receipt['independentReread']
    for pin in receipt['artifacts']:
        data = (finalized/pin['local']).read_bytes()
        assert len(data) == pin['size'] and hashlib.sha256(data).hexdigest() == pin['sha256']
    prefix = str(Path(root)/run.relative_to(Path.cwd()))
    # Resolve only the exact owned run path; all /proc reads remain real reads.
    def mapped_path(*parts):
        p = Path(*parts)
        if str(p) == root:
            return MappedRoot()
        return p

    class MappedRoot:
        def __truediv__(self, relative):
            assert str(Path(root)/relative) == prefix
            return finalized/'retrieved'

    def importing(name, *args, **kwargs):
        if name == 'pathlib':
            return types.SimpleNamespace(Path=mapped_path)
        return builtins.__import__(name, *args, **kwargs)

    stdout = io.StringIO()
    with contextlib.redirect_stdout(stdout):
        exec(compiled, {'__builtins__': {**vars(builtins), '__import__': importing}})
    observed = json.loads(stdout.getvalue())
    expected_wait = json.loads((finalized/'retrieved/original-parent-wait.json').read_text())
    assert observed['parentWait'] == expected_wait
    assert observed['failure']['runtime-parent-death']['wait'] == expected_wait
    assert 'ready.json' in observed['files'] and observed['latest']['label'] == 'startup'
    (out/'observed.json').write_text(json.dumps(observed, indent=2))
    result = dict(passed=True, originalIndentationReproduced=True,
                  exactNewEmission=True, compiled=True,
                  executedAgainstFinalizedActualFiles=True, readOnly=True,
                  sha256=hashlib.sha256(code.encode()).hexdigest(),
                  parentWait=expected_wait, artifactsVerified=len(receipt['artifacts']))
    (out/'result.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result))


if __name__ == '__main__':
    main()
