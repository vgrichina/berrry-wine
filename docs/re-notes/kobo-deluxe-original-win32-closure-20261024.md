# Kobo Deluxe 0.5.1 original Win32 acquisition: blocked

The first upstream operation, `HEAD https://olofson.net/kobodl/`, returned
`urllib.error.HTTPError: HTTP Error 403: Forbidden` on 2026-10-24 UTC.
The acquisition command exited 1. Its shell `&&` sequence consequently never
requested the assigned ZIP. There was one network attempt and no retry.
This does not establish that the ZIP itself returns 403: it was not requested.
The response alone does not identify whether the upstream or an intermediary
generated the denial.

The task stops at the first actual denied operation as instructed. Original
game bytes, ZIP SHA-256, archive inventory, license verification, PE machine and
entry/import analysis, recursive DLL/export closure, required asset inventory,
and a validated launch/data recipe are **unavailable**. No closure or gameplay
claim is made. No registry entry was added. No alternative game, port, stub,
source build, browser, guest, or test box was used.

## Identity and retained evidence

The read-only donor's HEAD and actual strict-SSH remote `refs/heads/main` both
equaled `f6571101e38985b3fa34d328f2ccadd9735a7573` before work. Neither exact-main
`lib/apps.js` nor `TODOS.md` contained case-insensitive `kobo`. The private
checkout uses explicit non-cone sparse paths and read-only object alternates;
root tracked files/index/refs and donor remain unchanged.

Evidence beside this report in
`kobo-deluxe-original-win32-closure-20261024/` includes:

- `blocker.json` and `upstream-first-denial.txt`: actual failed request and
  captured tool output, including propagated exit 1.
- `sequence-negative-before-network.json`: before-network local rejecting
  metadata/byte guard receipt, recovered from retained tool output. Both
  exceptions propagated through the same `sequence()` wrapper and neither
  sentinel was created.
- `sequence-negative-process.json`: subsequent stronger local subprocess
  probes, recording actual nonzero child exits and absent sentinel downloads.
- `local-tests.txt`: six local-only tests passed: actual child exit/sentinel,
  HTTP 403 stopping before GET, oversized metadata stopping before GET,
  streamed overflow without Content-Length, digest mismatch, and bounded
  success with a fixture digest. The fixture is not a game archive.
- `admission.json`, `remote-main-initial.txt`, `main-absence.txt`, and
  `capture-accounting.json`: measured admission, source revision and scope.

External recovery/evidence root:
`/tmp/kobo-deluxe-original-win32-closure-oct24/`.
Its private `original/` directory is empty. No ignored original bytes are
represented as Git-backed. The original failure remains in the worker session
and launcher events as well as the committed receipt. Resource/publication and
cleanup receipts remain external to avoid self-referential commit hashes.

## Recovery boundary

The assigned upstream page is <https://olofson.net/kobodl/> and assigned original
release URL is
<https://olofson.net/kobodl/download/KoboDeluxe-0.5.1-Win32-bin.zip>.
These are task-provided source locations, not verified license/provenance claims.
A new coordinator-authorized acquisition assignment requires a resolved access
condition or independently supplied authentic retained bytes; this worker did
not retry or change the network path/credentials after the denial.

The reusable helper `tools/kobo-deluxe-acquire.py` performs HEAD, metadata
guard, bounded streaming GET and final digest check in an exception-propagating
sequence. It defaults to certificate-verified HTTPS, restricts accepted source
locations to the assigned upstream, refuses destination overwrite, retains
partial inputs on failure, and records failure receipts. When a trusted archive
digest becomes available, `--sha256` makes recovery fail on changed bytes.
No digest can be pinned without acquiring and authenticating the original.
No extraction command or asset mapping is asserted for an unseen archive.

Local checks, without network:

```sh
PYTHONDONTWRITEBYTECODE=1 timeout 60s python3 test/test-kobo-deluxe-acquire.py
# Use a fresh output directory for each receipt; preserve previous receipts.
PYTHONDONTWRITEBYTECODE=1 python3 tools/kobo-deluxe-acquire.py --self-test RECEIPT_DIRECTORY
```

For any future authorized acquisition, rerun local sequencing probes, refresh
resource admission and bound the compressed plus extracted overlap before any
extraction. This task reserved 6 MiB archive and 18 MiB extracted data, inside a
60 MiB projected peak including 18 MiB external history/SQLite growth allowance,
6 MiB future growth and the mandatory 8 MiB reserve. Per-file ceiling is 24 MiB;
capture ceiling is 1 MiB. These allocations are not measurements of the unseen
archive.

Runtime lifecycle: **N/A**, no box assigned or operated. Coordinator retains
all runtime and shared integration ownership. Task branch only; no main merge.
