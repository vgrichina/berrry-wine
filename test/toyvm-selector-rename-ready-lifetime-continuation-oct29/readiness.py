"""Observe successful REAL selector registration; forward every operation unchanged."""
import selectors
import socket
import threading
import time

class RegistrationWitness:
    def __init__(self, namespace, transport):
        self.namespace = namespace
        self.original = namespace["selectors"]
        self.transport = transport
        self.ready = threading.Event()
        self.record = {}
    def install(self):
        witness = self
        original = self.original
        class Observed(original.DefaultSelector):
            def register(self, fileobj, events, data=None):
                result = super().register(fileobj, events, data)
                if fileobj == witness.transport:
                    controls = [k.fileobj for k in self.get_map().values()
                                if isinstance(k.fileobj, socket.socket)]
                    assert len(controls) == 1
                    control = controls[0]
                    listening = control.getsockopt(socket.SOL_SOCKET, socket.SO_ACCEPTCONN)
                    assert listening == 1
                    witness.record = dict(transportRegistered=True, controlRegistered=True,
                        acceptconn=listening, controlFD=control.fileno(),
                        selectorFD=self.fileno(), transportFD=witness.transport,
                        witness="real register returned; real SO_ACCEPTCONN=1")
                    witness.ready.set()
                return result
        class Proxy:
            DefaultSelector = Observed
            def __getattr__(self, key):
                return getattr(original, key)
        self.namespace["selectors"] = Proxy()
    def wait(self, thread, errors):
        deadline = time.monotonic() + 2
        while not self.ready.wait(.002):
            assert thread.is_alive(), repr(errors)
            assert time.monotonic() < deadline, "real listen/registration timeout"
    def restore(self):
        self.namespace["selectors"] = self.original
