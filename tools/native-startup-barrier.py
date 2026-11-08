"""Content-verified startup barrier for separately provisioned native runtimes.

Publish only after provisioning returns successfully. Require immediately before
creating a launch request, and again before its parent consumes that request.
This is host orchestration; it never starts or changes a guest.
"""
import hashlib
import json
from pathlib import Path


def fingerprint(root, manifest):
    root = Path(root).resolve()
    raw = Path(manifest).read_bytes()
    pins = json.loads(raw)
    files = pins["files"]
    if not files:
        raise ValueError("empty startup manifest")
    seen = set()
    for pin in files:
        relative = Path(pin["path"])
        target = (root / relative).resolve()
        if relative.is_absolute() or not target.is_relative_to(root):
            raise ValueError("provider outside runtime root")
        if target in seen:
            raise ValueError("duplicate startup provider")
        seen.add(target)
        data = target.read_bytes()
        if len(data) != pin["size"] or hashlib.sha256(data).hexdigest() != pin["sha256"]:
            raise ValueError("startup provider mismatch: " + pin["path"])
    return dict(version=1, root=str(root), manifestSha256=hashlib.sha256(raw).hexdigest(),
                providers=len(files), bytes=sum(pin["size"] for pin in files))


def publish(root, manifest, receipt):
    proof = fingerprint(root, manifest)
    # Exclusive creation prevents replacing an earlier generation's evidence.
    # A partial write is harmless: require() fails closed on invalid JSON.
    with Path(receipt).open("x") as stream:
        json.dump(proof, stream, sort_keys=True)
    return proof


def require(root, manifest, receipt):
    recorded = json.loads(Path(receipt).read_text())
    actual = fingerprint(root, manifest)
    if recorded != actual:
        raise ValueError("startup barrier generation changed")
    return actual


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["publish", "require"])
    parser.add_argument("root")
    parser.add_argument("manifest")
    parser.add_argument("receipt")
    args = parser.parse_args()
    print(json.dumps(globals()[args.action](args.root, args.manifest, args.receipt)))
