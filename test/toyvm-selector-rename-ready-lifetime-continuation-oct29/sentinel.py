"""Deterministic delayed-listen local fixture prerequisite; no production execute."""
from pathlib import Path
import json
import selectors
import socket
import tempfile
import threading
from readiness import RegistrationWitness

HERE = Path(__file__).resolve().parent
def main():
    ns = dict(selectors=selectors)
    bound = threading.Event()
    allow_listen = threading.Event()
    listened = threading.Event()
    allow_register = threading.Event()
    errors = []
    left, right = socket.socketpair()
    witness = RegistrationWitness(ns, left.fileno())
    witness.install()
    with tempfile.TemporaryDirectory(prefix="sentinel-", dir=HERE) as work:
        path = str(Path(work) / "s")
        # Relative path keeps AF_UNIX pathname bounded.
        import os
        path = os.path.relpath(path)
        def target():
            try:
                with socket.socket(socket.AF_UNIX) as control:
                    control.bind(path)
                    bound.set()
                    assert allow_listen.wait(2)
                    control.listen(1)
                    listened.set()
                    assert allow_register.wait(2)
                    with ns["selectors"].DefaultSelector() as sel:
                        sel.register(control, selectors.EVENT_READ)
                        sel.register(left.fileno(), selectors.EVENT_READ)
            except BaseException as exc:
                errors.append(exc)
        thread = threading.Thread(target=target)
        thread.start()
        try:
            assert bound.wait(2)
            assert Path(path).exists()
            assert not witness.ready.is_set()
            allow_listen.set()
            assert listened.wait(2)
            assert not witness.ready.is_set()
            allow_register.set()
            assert witness.ready.wait(2)
        finally:
            allow_listen.set()
            allow_register.set()
            thread.join(2)
            witness.restore()
            left.close()
            right.close()
        assert not thread.is_alive() and not errors, repr(errors)
        Path(path).unlink()
    result = dict(PASS=True, pathBeforeListen=True, readyBeforeListen=False,
        readyBeforeRegistration=False, joined=True, witness=witness.record)
    (HERE/"sentinel-results.json").write_text(json.dumps(result, indent=2)+"\n")
    print(json.dumps(result))
if __name__ == "__main__":
    main()
