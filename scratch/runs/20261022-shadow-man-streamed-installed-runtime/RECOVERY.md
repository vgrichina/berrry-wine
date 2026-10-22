# Recovery and handback

Assigned box bx_rp3s5k54 remains running; coordinator owns shutdown. Expiry
2026-10-23T01:30:59.916Z. Task stopped at mutable clone PermissionError;
no retry or guest was authorized after that first blocker.

Retained root `/home/user/shadow-man-streamed-installed-runtime-oct22` contains:

- immutable/restored: all2083 retained-session files, each source/destination hashed.
- immutable/runtime: exact main158-path runtime,23 pinned PNG files, canonical Wasm.
- immutable/receipts: original installed manifest/registry, runtime/codec hashes,
  transfer-file hashes and destination checker.
- fixed: passing hash gate, preparation failure script and unused diagnostic
  guard/observer/watchdog; handback.json is outside the hard tmpfs.
- mutable: empty939524096B tmpfs mounted UID0/mode0755; worker UID1000 could not
  create vfs. It was not remounted or repaired.

Immutable files/directories are mode0444/0555. No account credentials, signed URLs,
compressed layer/archive, game output traces or installed payload were retained
on this host. Git retains receipts/scripts, not the staged runtime or binaries.

Original recovery source is snapshot3ac9827f-20cf-4e1c-98a8-40b4edcd1b2f,
selected retained-session only. transfer-files.jsonl pins every transferred byte
identity. The source and upload signed URLs lived only in local process memory;
no token was passed into API commands or guest files. Scripts enforce no redirects
and no retries. They are one-shot history, **do not rerun restore.py, stage_runtime.py
or prepare_mutable.py**. Existing targets and task first-blocker rule preclude
automatic repetition. No old snapshot CLI pull is needed.

Canonical source file remains locally in the accepted read-only recovery donor:
`/home/user/wine-assembly-shadow-man-snapshot-recovery-feasibility-oct22/scratch/runs/20261022-shadow-man-snapshot-recovery-feasibility/canonical-primary.wasm`.
It is not Git backup. Expected SHA256ccd5b0a8 and size1879387 remain unchanged.

Offline verifier: `GIT_NO_LAZY_FETCH=1 PYTHONDONTWRITEBYTECODE=1 python3
scratch/runs/20261022-shadow-man-streamed-installed-runtime/verify.py`.
It checks receipts, all1959 original payload hash associations, preserved base
paths/protected metadata, module/runtime identities and allocations. It does not
access the box, change ownership, instantiate guest Wasm or qualify playability.
Publication uses an own thin Git database with copied base commit/tree objects;
all8279base index paths remain identical. `write-tree --missing-ok` preserves
published untouched blobs without broad fetch. Only evidence paths are staged.
