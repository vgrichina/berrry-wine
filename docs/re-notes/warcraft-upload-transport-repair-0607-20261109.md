# Warcraft provider upload transport repair, 0607

Repaired the actual 0558 provisioning path offline. The tracked reusable helper
is `tools/provider_upload.py`; the retained 0558 `control.py` provision branch
now calls it instead of reading whole providers and using ordered `pool.map`.
No box, Chrome, game, runtime retry, worker or deployment was used.

## Concrete old FAIL / new PASS

The local HTTP peer exercises the original retained
`scratch/runs/20261106-alice-dialogue-qualified/transport.py` and the exact 0558
eight-worker transfer shape. Request 7 returns HTTP 503 while earlier ordered
requests are pending. The original path starts queued PUTs before its caller
observes that error: **16 requests** reached the peer from 24 providers. This
is a concrete post-failure dispatch defect. It is not attribution of the
historical HTTPS timeout to concurrency or to a particular provider.

On a synthetic sparse 32 MiB provider, the original read-bytes path peaks at
33,719,139 traced bytes. The replacement sends pinned Content-Length chunks
of at most 65,536 bytes and passes the same peer SHA-256/length check with
317,751 traced bytes in the final recorded run. No media is copied.

Eight focused controls pass: actual recovery-branch composition, queued PUT
cancellation, cancellation of seven other blocked writers on first error,
blocked-write timeout, detached HTTP/1.0 response-socket timeout, bounded exact
streaming, local pin rejection before URL requests, and redirect rejection.
Every worker and deadline thread joins before the helper returns or raises.
There is no automatic retry or redirect. Failed/cancelled remote effects stay
UNKNOWN. Sources are verified before any URL request, again on the upload
descriptor, and while sending; remote closure verification remains mandatory.

Per-request start/end/error records include provider path and time, never signed
URLs. First failure stops dispatch and shuts down active sockets. The socket
timeout remains at most 90 seconds; a per-PUT absolute watchdog also bounds
streaming and response draining to 90 seconds. Tests shorten this cap to 150 ms;
no production deadline was increased. URL authorization retains its existing
45-second bounded API call. A failure may leave partial remote bytes; these
cannot pass the existing closure barrier and must not be automatically replayed.

## Recovery and validation

Evidence lives in
`scratch/runs/20261109-warcraft-upload-transport-repair-0607/`:
`old-regression.log`, `new-regression.log`, `build.log`, `git-base.txt`,
`recovery.json`, `recovery-recipe.patch`, and `owned-source.patch`.
The 2,165-byte recipe delta is against the original control SHA recorded in
`original-helper-sha256.txt`. The original was independently reconstructed and
hash-checked from 0558's retained `small-run-inputs-and-note.patch.gz` before
creating the delta. It does not replace or rewrite the old failure logs.

To recover the changed local provision recipe, restore the original 0558 small
inputs using its existing recovery record, then apply `recovery-recipe.patch`
from the repository root with `git apply`. The shared retained `control.py`
already contains this change. Keep the tracked helper available in the local
checkout. The provision branch resolves it with `runpy.run_path`, streams all
providers and three existing metadata uploads, then runs the unchanged remote
closure barrier. Exclusive creation of `provider-upload-events.jsonl` refuses
reuse of an earlier provision generation. This recipe is for a separately
authorized fresh assignment; do not re-run provisioning against the archived
0558 box. Recovery composition was tested with only loopback URL authorization
and a stubbed remote barrier, never the real service.

Commands used:

```sh
python3 tools/provider_upload_test.py --old-helper scratch/runs/20261106-alice-dialogue-qualified/transport.py
# Expected failure: the two demonstrated old reliability defects.
python3 tools/provider_upload_test.py --recipe scratch/runs/20261109-warcraft-repaired-custody-objective-0558/control.py
flock /tmp/wine-build.lock bash tools/build.sh
```

Focused regression and locked build passed. Git is the source archive: exact
base plus small owned-file patches, with no source tree archives. Original
media remains the existing `test/binaries/candidates/warcraft3-demo/war3.mpq`,
101,868,957 bytes, SHA-256
`9e19d7ffb65054e4bdd3add7e26d70e16f063cdc20fa5b57639f3b9b7a196f9c`.
Free `/home` stayed above 1.5 GB.

Warcraft production `c4b4cd337`, custody `5ec810c4`, CPU `a320`, strict
renderer/native lifetime, pre-CPU/pre-DLL-main barriers and immutable
90s/14/16/18 caps remain unchanged. Q2/Super sources and artifacts were not
edited. Historical failed-PUT identity/time, missing waits and creators remain
UNKNOWN; the absent MPQ does not identify the failed request.

This task's box ID/state/expiry/stop receipt: null / NOT_CREATED / null / null.
Next: no further action in this assignment; separately authorized fresh
provisioning can use the repaired recipe. Single task STOP.
