"""Focused composition checks only. Never invoke the accounted adapter."""
import hashlib
import importlib.util
import json
import pathlib
import sys
import tempfile
import types

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CALLER = "test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py"
ADAPTER = "test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py"
BACKEND = "test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py"
SUPERVISOR = "test/toyvm-transient-profile-accounting-repair-oct28/pinned-supervisor.py"
OLD = "5ac463e9168b1162b47b784e919a6f71830d5581c5fbde14597f8e1e866eb3bf"
NEW = "e45f6f6d1eaf24a06e92ffe2521ee4026fcc1cdccf22a15be4c7e99911424acb"
CHILDREN = []


def audit(event, args):
    if event in ("subprocess.Popen", "os.system", "os.fork", "os.forkpty",
                 "os.posix_spawn", "os.exec", "socket.__new__"):
        CHILDREN.append(event)
        raise AssertionError("execution outside source-only composition: " + event)


sys.addaudithook(audit)


def pin(data):
    return dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())


def load_caller(path, source):
    spec = importlib.util.spec_from_file_location("composition_caller", path)
    module = importlib.util.module_from_spec(spec)
    exec(compile(source, str(path), "exec", dont_inherit=True), module.__dict__)
    return module


def call_loader(caller, root):
    """Trace actual checked filenames; reject any adapter invocation."""
    executed = []
    watched = {str(root / p) for p in (ADAPTER, BACKEND, SUPERVISOR)}
    def trace(frame, event, arg):
        if event == "call" and frame.f_code.co_filename in watched:
            assert frame.f_code.co_name == "<module>", "adapter invocation forbidden"
            executed.append(frame.f_code.co_filename)
        return trace
    sys.settrace(trace)
    try:
        function = caller.load_backend()
        return function, executed
    finally:
        sys.settrace(None)


def main():
    provenance = json.loads((HERE / "provenance.json").read_text())
    pair = json.loads((HERE / "accepted-pair-receipt.json").read_text())
    transitive = json.loads((HERE / "accepted-transitive-receipt.json").read_text())
    wire = json.loads((HERE / "accepted-wire-receipt.json").read_text())
    assert pin((HERE / "accepted-pair-receipt.json").read_bytes()) == provenance["canonicalPair"]["pin"]
    assert pair["afterSourcePins"] == provenance["beforeSourcePins"]
    assert pair["retainedCoverage"] == provenance["retainedCoverage"]
    assert pin((HERE / "accepted-transitive-receipt.json").read_bytes()) == wire["priorCanonicalReceipt"]["pin"]
    assert pin((HERE / "accepted-wire-receipt.json").read_bytes()) == pair["suppliedArtifactPins"]["inputs/wire-scope-receipt.json"]
    assert transitive["commit"] == "513f22d8db9fc9b7d65d0c224b25d6439268b9e8"
    assert wire["commit"] == "c2352606f65b6d7aa51d036f524b87f378620301"
    sources = {p: (ROOT / p).read_bytes() for p in provenance["beforeSourcePins"]}
    baseline = (HERE / "baseline-caller.py").read_bytes()
    donor = (HERE / "accepted-adapter.py").read_bytes()
    assert pin(baseline) == provenance["beforeSourcePins"][CALLER]
    assert pin(donor) == transitive["sourcePinsAfter"][ADAPTER] == provenance["newAdapterPin"]
    assert len(donor) == 4241 and pin(donor)["sha256"] == NEW
    assert sources[ADAPTER] == donor, "exact accepted donor equality"
    assert baseline.count(OLD.encode()) == 1
    assert sources[CALLER] == baseline.replace(OLD.encode(), NEW.encode()), "only approved caller delta"
    for path in sources.keys() - {CALLER, ADAPTER}:
        assert pin(sources[path]) == provenance["beforeSourcePins"][path]
    assert pin(sources[BACKEND])["sha256"] == "75842ffafd6ebd0c29fa2889a463bfd6f5245634096f4dfef9a3fd69f703e822"

    # First behavioral boundary: actual final caller loading actual final five files.
    caller = load_caller(ROOT / CALLER, sources[CALLER])
    function, executed = call_loader(caller, ROOT)
    expected_code = next(c for c in compile(donor, str(ROOT / ADAPTER), "exec",
                                           dont_inherit=True).co_consts
                         if isinstance(c, types.CodeType) and c.co_name == "supervise_accounted")
    assert function.__code__ == expected_code
    assert function.__code__.co_filename == str(ROOT / ADAPTER)
    g = function.__globals__
    assert g["supervise_accounted"] is function
    assert g["__name__"] == function.__module__ == "accepted_accounted_adapter"
    assert g["__file__"] == g["__spec__"].origin == str(ROOT / ADAPTER)
    assert g["HERE"] == (ROOT / ADAPTER).parent
    assert g["PIN"] == provenance["beforeSourcePins"][SUPERVISOR]["sha256"]
    assert caller.BACKEND_PINS[ADAPTER.removeprefix("test/")] == NEW
    assert caller.BACKEND_PINS[SUPERVISOR.removeprefix("test/")] == g["PIN"]
    expected_globals = {"__name__", "__doc__", "__package__", "__loader__", "__spec__",
                        "__file__", "__cached__", "__builtins__", "HERE", "PIN",
                        "supervise_accounted", "hashlib", "importlib", "json", "os",
                        "pathlib", "socket", "subprocess", "sys", "time"}
    assert set(g) == expected_globals
    for name in ("hashlib", "importlib", "json", "os", "pathlib", "socket", "subprocess", "sys", "time"):
        assert g[name] is sys.modules[name]
    assert executed == [str(ROOT / ADAPTER)]
    cases = [dict(case="final-five-file-load", exactCode=True, exactOrigin=True,
                  exactGlobals=True, supervisorPin=g["PIN"], executed=executed)]

    # Each control starts from the same five files. A sentinel would fail if executed.
    for altered in (ADAPTER, BACKEND, SUPERVISOR, "stale-caller-pin"):
        with tempfile.TemporaryDirectory(prefix="composition-", dir=HERE) as directory:
            fixture = pathlib.Path(directory)
            for path, data in sources.items():
                dest = fixture / path
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(data)
            caller_source = sources[CALLER]
            rejected_path = altered
            if altered == "stale-caller-pin":
                caller_source = baseline
                rejected_path = ADAPTER
            else:
                (fixture / altered).write_bytes(sources[altered] + b"\nraise AssertionError('tampered source executed')\n")
            control = load_caller(fixture / CALLER, caller_source)
            executed_control = []
            def reject_trace(frame, event, arg):
                if event == "call" and frame.f_code.co_filename in {
                        str(fixture / p) for p in (ADAPTER, BACKEND, SUPERVISOR)}:
                    executed_control.append(frame.f_code.co_filename)
                return reject_trace
            sys.settrace(reject_trace)
            try:
                control.load_backend()
            except RuntimeError as error:
                assert str(error) == "accepted backend identity mismatch: " + rejected_path.removeprefix("test/")
                rejection = str(error)
            else:
                raise AssertionError("caller accepted invalid composition: " + altered)
            finally:
                sys.settrace(None)
            assert executed_control == [], "must reject before adapter/backend/supervisor execution"
            cases.append(dict(case=altered, rejection=rejection, productionExecutions=[]))
    assert CHILDREN == []
    result = dict(status="PASS_TESTED_SOURCE_COMPOSITION_CANDIDATE", cases=cases,
                  afterSourcePins={p: pin(data) for p, data in sources.items()},
                  childOrSocketAttempts=CHILDREN, adapterInvocations=0,
                  retainedComponentChecks=dict(caller=41, backend=52, replayed=False),
                  independentFinalCompositionAccepted=False, runtimeAccepted=False)
    (HERE / "results.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
