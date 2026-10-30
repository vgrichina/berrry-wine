#!/usr/bin/env python3
"""Source-pinned direct callback contract. No mount/kernel/browser claims."""
import hashlib, importlib.util, json, pathlib, stat, struct
ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = pathlib.Path(__file__).resolve().parent
PINS = json.loads((HERE / "source-pins.json").read_text())
CANDIDATE = "3eebad217b2784af8e74e3f919cb9b122532ac64"

def load():
    for name, pin in PINS.items():
        raw = (ROOT / name).read_bytes()
        assert len(raw) == pin["bytes"]
        assert hashlib.sha256(raw).hexdigest() == pin["sha256"]
    path = ROOT / "test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py"
    spec = importlib.util.spec_from_file_location("pinned_backend", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.Backend

def parse(raw):
    result, pos = [], 0
    while pos < len(raw):
        assert len(raw) - pos >= 24, "short header"
        ino, off, count, kind = struct.unpack_from("<QQII", raw, pos)
        end = pos + ((24 + count + 7) // 8) * 8
        assert end <= len(raw), "short name/padding"
        name = raw[pos + 24:pos + 24 + count].decode("ascii")
        assert raw[pos + 24 + count:end] == bytes(end - pos - 24 - count)
        result.append([ino, off, name, kind])
        pos = end
    return result

def expected(topology, ino, offset, size):
    # The namespace model is built only from the declared fixture operations.
    # A directory's parent is its unique containing directory; root contains itself.
    parents = [p for p, names in topology.items() if ino in names.values()]
    parent = 1 if ino == 1 else parents[0]
    assert ino == 1 or len(parents) == 1
    rows = [(ino, "."), (parent, "..")]
    rows += [(child, name) for name, child in topology[ino].items()]
    result, used = [], 0
    for index, (child, name) in enumerate(rows):
        if index < offset:
            continue
        length = ((24 + len(name.encode("ascii")) + 7) // 8) * 8
        if used + length > size:
            break
        result.append([child, index + 1, name, 4])
        used += length
    return result

def classify(actual, wanted):
    if actual == wanted:
        return "PASS"
    if len(actual) == len(wanted) and all(
        a[1:] == w[1:] and (a[2] == ".." or a[0] == w[0])
        for a, w in zip(actual, wanted)
    ):
        return "WRONG_PARENT"
    return "OTHER_FAILURE"

def run():
    Backend = load()
    fixture = json.loads((HERE / "fixture.json").read_text())
    backend = Backend(HERE / "unmounted-placeholder")
    topology = {1: {}}
    calls = 0
    def mkdir(parent, name, assigned):
        payload = struct.pack("<II", stat.S_IFDIR | 0o700, 0) + name.encode() + b"\0"
        reply = backend.handle(9, parent, payload)
        assert struct.unpack_from("<Q", reply)[0] == assigned
        topology[parent][name] = assigned
        topology[assigned] = {}
    for parent, name, assigned in fixture["mkdir"]:
        mkdir(parent, name, assigned)
    failures, controls, observations = [], 0, []
    def inspect(stage):
        nonlocal calls, controls
        for ino in topology:
            for offset in range(len(topology[ino]) + 4):
                for size in fixture["buffers"]:
                    raw = backend.handle(28, ino, struct.pack("<QQI", 0, offset, size))
                    calls += 1
                    actual = parse(raw)
                    wanted = expected(topology, ino, offset, size)
                    assert len(raw) <= size
                    status = classify(actual, wanted)
                    detail = dict(stage=stage, inode=ino, offset=offset, size=size,
                                  actual=actual, expected=wanted, status=status)
                    if status != "PASS":
                        assert status == "WRONG_PARENT", detail
                        assert any(row[2] == ".." and row[0] != 1 for row in wanted)
                        failures.append(detail)
                    else:
                        controls += 1
                    if offset == 0 and size == 4096:
                        observations.append(detail)
    inspect("initial")
    for oldparent, oldname, newparent, newname in fixture["rename"]:
        assert backend.handle(12, oldparent, struct.pack("<Q", newparent) +
                              oldname.encode() + b"\0" + newname.encode() + b"\0") == b""
        child = topology[oldparent].pop(oldname)
        topology[newparent][newname] = child
        inspect("rename-" + newname)

    # Minimal independent fixture: root/a/b, with inode b=3 and parent a=2.
    mini = Backend(HERE / "minimal-unmounted-placeholder")
    for parent, name in [(1, b"a"), (2, b"b")]:
        mini.handle(9, parent, struct.pack("<II", stat.S_IFDIR | 0o700, 0) + name + b"\0")
    raw = mini.handle(28, 3, struct.pack("<QQI", 0, 0, 64))
    wanted = [[3, 1, ".", 4], [2, 2, "..", 4]]
    actual = parse(raw)
    assert actual == [[3, 1, ".", 4], [1, 2, "..", 4]]
    assert classify(actual, wanted) == "WRONG_PARENT"

    # Mutate the independent oracle/records, never the production source.
    good = expected({1: {"a": 2}, 2: {"b": 3}, 3: {}}, 3, 0, 64)
    wrong_parent = [row[:] for row in good]
    wrong_parent[1][0] = 99
    assert classify(good, wrong_parent) != "PASS"
    assert classify(good[:1], good) == "OTHER_FAILURE"
    assert classify(actual, wanted) != "PASS"  # Reject incorrect acceptance.
    def validate_claim(claimed_pass, observed, oracle):
        assert claimed_pass == (observed == oracle), "incorrect acceptance"
    try:
        validate_claim(True, actual, wanted)
    except AssertionError:
        pass
    else:
        raise AssertionError("incorrect acceptance mutation escaped")
    assert failures and controls
    result = dict(candidate=CANDIDATE, status="EXPECTED_FAIL", scope="Backend.handle direct op28; no mount or kernel observation",
                  sourcePins=PINS, fixtureSha256=hashlib.sha256((HERE / "fixture.json").read_bytes()).hexdigest(),
                  calls=calls, passingControls=controls, wrongParentCases=len(failures),
                  observations=observations,
                  minimalCounterexample=dict(namespace={"/": 1, "/a": 2, "/a/b": 3},
                      operation=28, inode=3, requestHex=struct.pack("<QQI", 0, 0, 64).hex(),
                      responseHex=raw.hex(), expected=wanted, actual=actual),
                  oracleControls={"wrongExpectedParent": "REJECTED", "skippedRecord": "REJECTED",
                                  "incorrectAcceptance": "REJECTED"},
                  remainingGates=["Production parent-inode repair", "Mounted kernel-mediated acceptance (kernel may reject before callback)"])
    (HERE / "results.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({k: result[k] for k in ("status", "calls", "passingControls", "wrongParentCases", "minimalCounterexample", "oracleControls")}))
if __name__ == "__main__":
    run()
