"""Combined candidate local-wire lifetime regression; no mount or guest execution."""
import errno
import gc
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import selectors
import socket
import struct
import threading
import types

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / "toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py"
SHA = "75842ffafd6ebd0c29fa2889a463bfd6f5245634096f4dfef9a3fd69f703e822"
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SHA
spec = importlib.util.spec_from_file_location("exact_backend", SOURCE)
production = importlib.util.module_from_spec(spec)
spec.loader.exec_module(production)
held_errors = []
held_objects = []


def identity(fd):
    s = os.fstat(fd)
    return [s.st_dev, s.st_ino, s.st_mode, os.readlink("/proc/self/fd/" + str(fd))]


def descriptors():
    result = {}
    for name in os.listdir("/proc/self/fd"):
        try:
            result[int(name)] = identity(int(name))
        except OSError as e:
            assert e.errno == errno.EBADF
    return result


def closed(fd):
    try:
        os.fstat(fd)
    except OSError as e:
        assert e.errno == errno.EBADF
        return True
    return False


def case(kind, delayed=False, mutant=False):
    baseline = descriptors()
    ready = threading.Event()
    bound = threading.Event()
    release = threading.Event()
    errors = []
    record = {}
    owned = {}
    retained = []
    status = HERE.relative_to(Path.cwd()) / ("s-" + kind + ("-mutant" if mutant else ""))
    assert not status.exists()
    left, peer = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET)
    fd = left.detach()
    owned["transport"] = [fd, identity(fd)]
    peer_identity = identity(peer.fileno())
    backend = production.Backend(str(HERE))
    backend.fd = fd

    class Control(socket.socket):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            owned["control"] = [self.fileno(), identity(self.fileno())]
            retained.append(self)

        def listen(self, backlog):
            if delayed:
                bound.set()
                assert release.wait(2), "fixture listen release timeout"
            return super().listen(backlog)

    class Observed(selectors.DefaultSelector):
        def __init__(self):
            super().__init__()
            owned["selector"] = [self.fileno(), identity(self.fileno())]
            retained.append(self)

        def register(self, fileobj, events, data=None):
            key = super().register(fileobj, events, data)
            if fileobj == fd:
                keys = list(self.get_map().values())
                controls = [k.fileobj for k in keys if isinstance(k.fileobj, Control)]
                assert len(keys) == 2 and len(controls) == 1
                assert controls[0].getsockopt(socket.SOL_SOCKET, socket.SO_ACCEPTCONN) == 1
                record.update(registered=2, listening=True, witness="real register returned and SO_ACCEPTCONN=1")
                ready.set()
            return key

        def close(self):
            if not mutant:
                return super().close()

    production.selectors = types.SimpleNamespace(DefaultSelector=Observed, EVENT_READ=selectors.EVENT_READ)
    production.socket = types.SimpleNamespace(socket=Control, AF_UNIX=socket.AF_UNIX)

    def serve():
        try:
            backend.serve(status)
        except BaseException as e:
            errors.append(e)
            held_errors.append(e)

    thread = threading.Thread(target=serve, name="exact-production-" + kind, daemon=True)
    thread.start()
    try:
        if delayed:
            assert bound.wait(2)
            assert status.exists() and not ready.is_set()
            assert thread.is_alive()
            record["boundPathDidNotSignalReady"] = True
            release.set()
        assert ready.wait(2), "no positive readiness witness"
        with socket.socket(socket.AF_UNIX) as client:
            client.settimeout(2)
            client.connect(str(status))
            state = json.loads(client.recv(4096))
            assert state["operations"] == 0 and state["failure"] is None
        record["statusRoundTrip"] = True
        assert identity(peer.fileno()) == peer_identity
        if kind == "EOF":
            peer.close()
        else:
            peer.shutdown(socket.SHUT_RD)
            # Real GETATTR against root, exact 40-byte FUSE header.
            peer.sendall(struct.pack("<IIQQIIII", 40, 3, 71, 1, os.getuid(), os.getgid(), os.getpid(), 0))
        thread.join(2)
        assert not thread.is_alive(), "serve thread failed to join"
        assert not gc.isenabled()
        if kind == "EPIPE":
            assert len(errors) == 1 and isinstance(errors[0], BrokenPipeError)
            assert errors[0].errno == errno.EPIPE and errors[0].__traceback__ is not None
            assert identity(peer.fileno()) == peer_identity, "borrowed peer changed"
            assert backend.operations == 1
        else:
            assert not errors and backend.operations == 0
        states = {name: closed(info[0]) for name, info in owned.items()}
        identities = {name: (None if states[name] else identity(info[0])) for name, info in owned.items()}
        for name, info in owned.items():
            if not states[name]:
                assert identities[name] == info[1], "open descriptor identity changed before fixture cleanup"
        record["identitiesBeforeFixtureCleanup"] = identities
        assert states["transport"] and states["control"]
        # Capture the candidate verdict BEFORE fixture cleanup, with exceptions,
        # selector objects and tracebacks retained and cyclic collection disabled.
        if mutant:
            assert not states["selector"], "no-close control was ineffective"
            record["negativeControlRejected"] = True
        else:
            assert states["selector"], "selector descriptor leaked"
        record.update(kind=kind, owned=owned, closedBeforeFixtureCleanup=states,
                      threadJoined=True, retainedExceptions=len(errors), gcDisabled=True)
        return record
    finally:
        release.set()
        if not thread.is_alive():
            peer.close()
            for obj in retained:
                if isinstance(obj, Observed):
                    selectors.DefaultSelector.close(obj)
                else:
                    obj.close()
            status.unlink(missing_ok=True)
            held_objects.extend(retained)
            production.selectors = selectors
            production.socket = socket
            assert descriptors() == baseline, "descriptor drift or borrowed identity changed"


def main():
    was_enabled = gc.isenabled()
    gc.disable()
    result = {"source": str(SOURCE), "sha256": SHA, "cases": []}
    # Earliest relevant boundary first: exact production serve, real EOF.
    try:
        for kind, delayed in [("EOF", True), ("EPIPE", False), ("EOF", False), ("EPIPE", False)]:
            result["cases"].append(case(kind, delayed))
        result["negativeControl"] = case("EPIPE", mutant=True)
        result["retainedExceptionCount"] = len(held_errors)
        result["PASS"] = True
        (HERE / "wire-results.json").write_text(json.dumps(result, indent=2) + "\n")
        print(json.dumps({"PASS": True, "productionCases": len(result["cases"]),
                          "realEPIPE": 2, "EOF": 2, "negativeControlRejected": True,
                          "retainedExceptions": len(held_errors)}))
    finally:
        if was_enabled:
            gc.enable()


if __name__ == "__main__":
    main()
