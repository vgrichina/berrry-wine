#!/usr/bin/env python3
"""Repaired gate using byte-exact predecessor cases and oracle AST statements."""
import ast
import errno
import hashlib
import importlib.util
import json
import pathlib
import stat
import struct

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BACKEND = "test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py"

def load_contract():
    receipts = json.loads((HERE / "copy-receipt.json").read_text())
    for name in ("contract.py", "fixture.json"):
        raw = (HERE / name).read_bytes()
        assert {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()} == receipts[name]
    pins = json.loads((HERE / "source-pins.json").read_text())
    update = json.loads((HERE / "pin-update.json").read_text())
    original = dict(pins)
    original[BACKEND] = update["before"]
    raw = (json.dumps(original, indent=2) + "\n").encode()
    assert {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()} == receipts["source-pins.json"]
    assert pins[BACKEND] == update["after"]
    spec = importlib.util.spec_from_file_location("original_contract", HERE / "contract.py")
    c = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(c)
    return c

def unchanged_cases(c):
    tree = ast.parse((HERE / "contract.py").read_text())
    run = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "run")
    # The predecessor tail deliberately asserts the old bug. Retain the entire
    # original generation/rename/inspect loop; stop before its diagnostic mini.
    cut = next(i for i,n in enumerate(run.body)
               if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "mini" for t in n.targets))
    run.body = run.body[:cut] + [ast.Return(value=ast.Call(func=ast.Name(id="locals", ctx=ast.Load()), args=[], keywords=[]))]
    module = ast.fix_missing_locations(ast.Module(body=[run], type_ignores=[]))
    ns = dict(vars(c))
    exec(compile(module, str(HERE / "contract.py"), "exec"), ns)
    result = ns["run"]()
    assert result["calls"] == 870
    assert result["controls"] == 870 and not result["failures"], result["failures"]
    return {"cases": result["calls"], "passed": result["controls"], "failed": len(result["failures"])}

def unchanged_oracle_controls(c):
    tree = ast.parse((HERE / "contract.py").read_text())
    body = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "run").body
    start = next(i for i,n in enumerate(body) if isinstance(n, ast.Assign)
                 and any(isinstance(t, ast.Name) and t.id == "good" for t in n.targets))
    end = next(i for i,n in enumerate(body) if isinstance(n, ast.Assert)
               and ast.unparse(n.test) == "failures and controls")
    wanted = [[3, 1, ".", 4], [2, 2, "..", 4]]
    actual = [[3, 1, ".", 4], [1, 2, "..", 4]]
    ns = dict(vars(c), wanted=wanted, actual=actual)
    # Execute all original oracle mutation assertions verbatim, with the same
    # independently known bad observation used in the predecessor diagnostic.
    exec(compile(ast.fix_missing_locations(ast.Module(body=body[start:end], type_ignores=[])),
                 str(HERE / "contract.py"), "exec"), ns)
    return {"wrongExpectedParent": "REJECTED", "skippedRecord": "REJECTED", "incorrectAcceptance": "REJECTED"}

def adversarial(Backend, parse):
    b = Backend(HERE / "never-mounted", live_limit=65536)
    topology = {1: {}}
    # Independent parent table: never scan production nodes to derive expectations.
    parents = {1: 1}
    for parent, name, ino in [(1,"left",2),(2,"branch",3),(3,"deep",4),
                              (4,"deeper",5),(5,"leaf",6),(1,"right",7),(7,"sibling",8)]:
        reply = b.handle(9, parent, struct.pack("<II", stat.S_IFDIR | 0o700, 0) + name.encode() + b"\0")
        assert struct.unpack_from("<Q", reply)[0] == ino
        topology[parent][name] = ino
        topology[ino] = {}
        parents[ino] = parent
    checks = 0
    def inspect():
        nonlocal checks
        for ino in topology:
            entries = [(ino, "."), (parents[ino], "..")]
            entries.extend((child, name) for name,child in topology[ino].items())
            for offset in range(len(entries) + 3):
                for size in (0,1,23,24,31,32,33,63,64,65,95,96,127,128,4096):
                    wanted, used = [], 0
                    for index, (child,name) in enumerate(entries):
                        if index < offset:
                            continue
                        length = (24 + len(name.encode()) + 7) & ~7
                        if used + length > size:
                            break
                        wanted.append([child,index+1,name,4])
                        used += length
                    raw = b.handle(28,ino,struct.pack("<QQI",123,offset,size))
                    assert len(raw) <= size
                    assert parse(raw) == wanted, (ino,offset,size,parse(raw),wanted)
                    checks += 1
    inspect()
    for oldparent,old,newparent,new in [(2,"branch",7,"moved"),(5,"leaf",1,"up"),(7,"moved",2,"returned")]:
        assert b.handle(12,oldparent,struct.pack("<Q",newparent)+old.encode()+b"\0"+new.encode()+b"\0") == b""
        child = topology[oldparent].pop(old)
        topology[newparent][new] = child
        parents[child] = newparent
        inspect()
    # Undefined detached/multiple-parent state must fail closed, never invent '..'.
    b.nodes[7]["names"][b"alias"] = 3
    try:
        b.handle(28,3,struct.pack("<QQI",0,0,64))
    except OSError as e:
        assert e.errno == errno.EIO
    else:
        raise AssertionError("ambiguous parent accepted")
    del b.nodes[7]["names"][b"alias"]
    del b.nodes[2]["names"][b"returned"]
    try:
        b.handle(28,3,struct.pack("<QQI",0,0,64))
    except OSError as e:
        assert e.errno == errno.EIO
    else:
        raise AssertionError("missing parent accepted")
    return checks

def run():
    c = load_contract()
    Backend = c.load()  # Exact five current input identities checked before behavior.
    original = unchanged_cases(c)  # Earliest pinned production boundary first.
    controls = unchanged_oracle_controls(c)
    extra = adversarial(Backend,c.parse)
    source = (ROOT / BACKEND).read_text()
    mutations = {
        "rootConstant": ("(b'..',parent)", "(b'..',1)"),
        "wrongParent": ("parent=parents[0]", "parent=ino"),
        "wrongDot": ("(b'.',ino)", "(b'.',1)"),
    }
    rejected = {}
    for name,(old,new) in mutations.items():
        assert source.count(old) == 1
        ns = {"__name__": "mutant_backend"}
        exec(compile(source.replace(old,new), "<" + name + ">", "exec"),ns)
        try:
            adversarial(ns["Backend"],c.parse)
        except AssertionError:
            rejected[name] = "REJECTED"
        else:
            raise AssertionError(name + " mutation escaped")
    result = {"status": "PASS", "candidate": "82a1023a6d84b229389b53c2a9a7a46a112b7797",
              "scope": "direct Backend.handle only; no mounted/kernel/browser/gameplay claim",
              "originalContract": original, "originalOracleControls": controls,
              "adversarialCases": extra, "productionMutations": rejected,
              "undefinedParentControls": {"missing": "EIO", "ambiguous": "EIO"},
              "sourcePins": c.PINS,
              "remainingGates": ["combined repairs", "caller still pins old backend", "full CLI qualification"]}
    (HERE / "results.json").write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(result))
if __name__ == "__main__":
    run()
