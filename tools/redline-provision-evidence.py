"""Isolate offline and native task-driver provision evidence.

The retained provision generator owns runtime paths and transfer order. Only
its remote-command record labels and local receipt labels are namespaced here;
the supplied writers retain their exclusive-creation and failure semantics.
"""


def provision(generate, bindings, phase, *, remote, save):
    if phase not in ("offline", "native"):
        raise ValueError("explicit offline or native provision phase required")
    prefix = phase + "-provision-"
    previous_remote, previous_save = bindings.remote, bindings.save
    bindings.remote = lambda label, *args, **kwargs: remote(prefix + label, *args, **kwargs)
    bindings.save = lambda label, value: save(prefix + label, value)
    try:
        return generate()
    finally:
        bindings.remote, bindings.save = previous_remote, previous_save
