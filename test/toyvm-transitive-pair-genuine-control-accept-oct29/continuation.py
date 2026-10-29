#!/usr/bin/python3
"""Only missing genuine legacy caller control; original full main is never run."""
import contextlib
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch

OUT = Path(__file__).resolve().parent
OWN = OUT.parents[2]
REPO = OUT.parents[1]
assert Path.cwd() == REPO and sys.executable == "/usr/bin/python3"
verification = json.loads((OUT / "input-verification.json").read_text())
def pin(b):
    return dict(bytes=len(b), sha256=hashlib.sha256(b).hexdigest())
for path, expected in verification["sourcePins"].items():
    assert pin((REPO / path).read_bytes()) == expected
for path, expected in verification["inputs"].items():
    assert pin((OWN / "inputs" / path).read_bytes()) == expected
spec = importlib.util.spec_from_file_location("owned_independent_oracle", OUT / "oracle.py")
o = importlib.util.module_from_spec(spec)
spec.loader.exec_module(o)
cases = []
with contextlib.ExitStack() as stack:
    for obj, names in [(subprocess, ["Popen", "run"]),
                       (os, ["posix_spawn", "posix_spawnp", "fork", "system", "spawnv", "spawnve", "spawnvp", "spawnvpe"])]:
        for name in names:
            stack.enter_context(patch.object(obj, name, o.deny))
    # Pin-compatible normal controls first, then exact narrowly matched timestamp oracle.
    for variant in ("candidate", "legacy-caller"):
        o.interaction(variant, "caller", "normal")
        cases.append(dict(variant=variant, boundary="caller", mode="normal", passed=True))
    o.interaction("candidate", "caller", "timestamp")
    cases.append(dict(variant="candidate", boundary="caller", mode="timestamp", passed=True))
    try:
        o.interaction("legacy-caller", "caller", "timestamp")
    except AssertionError as e:
        assert str(e) == "hostile bytecode executed", repr(e)
        cases.append(dict(variant="legacy-caller", boundary="caller", mode="timestamp",
                          rejected=True, reason=str(e)))
    else:
        raise AssertionError("genuine legacy caller was not rejected")
assert not o.CHILDREN
for path, expected in verification["sourcePins"].items():
    assert pin((REPO / path).read_bytes()) == expected
for path, expected in verification["inputs"].items():
    assert pin((OWN / "inputs" / path).read_bytes()) == expected
prior = json.loads((OWN / "inputs/prior-independent-tests/results.json").read_text())
assert len(prior["interactions"]) == 10 and all(x["pass_"] for x in prior["interactions"])
assert prior["controls"]["legacy-caller"]["status"] == "INVALID_CONTROL_NO_REJECTION"
result = dict(candidate="92d587a897d58561fcccfcaf88eac548d8e1efc0",
              status="ACCEPT_INDEPENDENT_SOURCE_LOCAL_WIRE_ONLY",
              priorDiagnostic="3cf0e4de08d913b63339dfaccbf689aa7d48a08c",
              carriedPrior=prior,
              continuationCases=cases,
              combinedControls=dict(legacyCaller=cases[-1], legacyAdapter=prior["controls"]["legacy-adapter"],
                                    stalePin=prior["controls"]["stale-pin"]),
              sourcePinsBefore=verification["sourcePins"], sourcePinsAfter=verification["sourcePins"],
              actualChildInvocations=0, returnedAdapterInvoked=False,
              originalInvalidControl="Preserved as invalid test fixture; not a production failure.",
              remainingAcceptanceGates=["selector", "mounted/kernel", "CLI/runtime", "browser"],
              scope="exact caller load_backend and source identity; inherited source/local-wire namespace checks only")
(OUT / "results.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(dict(status=result["status"], cases=cases, childInvocations=0, productionUnchanged=True)))
