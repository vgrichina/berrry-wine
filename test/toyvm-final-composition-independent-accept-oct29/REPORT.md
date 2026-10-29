# Independent final-composition acceptance

PASS for exact five-file source composition `8f3c4ab0d9d59bf7f065a8d56ec92e7ea1ac0c93` at the source-loader and combined-backend local-wire selector lifetime boundaries. All five production files remain byte-identical. This closes the combined `75842ffa` backend local-wire gap at the specific interactions below. It does not establish mounted, kernel, CLI, guest, browser, or gameplay acceptance.

## Provenance and scope

`verify_inputs.py` verifies the canonical candidate receipt (SHA256 `e0441567fc09b88646e4d02df478628ae421f34da3c212450fb4171013956804`), eleven supplied artifacts, all five exact sources and corresponding Git blob identities, the validated owned repository/branch, and the configured flat read-only object-store list. Git object checks establish that the candidate and all five required blobs are available. Trusted SSH `ls-remote` independently resolves the source task branch to the exact candidate. No clone, fetch, alternate addition, sparse expansion, root/donor mutation, or production edit occurs. Optional sparse config absence is valid.

Accepted adapter `e45f6f6d` is byte-identical to its donor. Final caller `fd87f1a4` differs from baseline `bcc2ea9b` only by replacing its one approved adapter hash pin. Backend `75842ffa`, confine `0b10df64`, and supervisor `9d10f7c8` are unchanged. Full pins and artifact identities are in `input-verification.json`.

Retained evidence is reused at its original scope: 41 caller checks / 52 backend operations, independent transitive adapter acceptance `513f22d8db9fc9b7d65d0c224b25d6439268b9e8`, source pair `389745e7ea964cd0537d45ec376c6bb3f5e7686f`, and historical 83-wire receipt `c2352606f65b6d7aa51d036f524b87f378620301`. The historical wire backend `b8201b2c` differs from the final combined backend. None of those suites or the candidate oracle was replayed. This task adds only the independent final-composition boundaries described here.

## Exact loader boundary

The first behavioral check calls the exact final `caller.load_backend`. It returns the accepted adapter function with matching compiled code, exact filename/origin, adapter globals (`HERE`, `PIN`, module name/spec, `os`, and `subprocess`) and pinned supervisor SHA. The adapter is never invoked. Each of the four dependency files is independently tampered in a private five-source layout; the exact unchanged caller rejects it with the precise identity-mismatch RuntimeError. An execution audit hook confirms no private dependency code executes during rejection. The exact stale caller independently rejects the new adapter pin. No historical caller is substituted for the positive test.

## Actual selector / local wire boundary

The exact combined `Backend.serve` runs against real `selectors.EpollSelector`, unnamed local stream socketpairs, and bounded threads; selectors are never mocked and `handle` is never called directly. A real status-socket interaction confirms dispatch startup. The positive wire case sends INIT (7.31), verifies the 64-byte successful response, then sends MKDIR `../outside` and verifies wire error `-EINVAL`, empty body, and unchanged namespace before EOF. The serve thread returns cleanly.

A malformed 40-byte frame claiming 41 bytes raises exactly `RuntimeError('FUSE request truncated')`. A prebound live borrowed listener yields exact `OSError` / `EADDRINUSE` (98) while remaining usable through connect/accept/byte transfer. A valid open regular file reaches actual epoll registration and raises exactly `PermissionError` / `EPERM` (1); its borrowed duplicate remains usable through pread/pwrite. These synchronous exceptions are captured rather than converted into protocol responses.

Every case asserts owned transport `EBADF` before independent fixture cleanup. Borrowed transport duplicates remain usable through real byte transfer. Descriptor snapshots detect leaked control/selector descriptors; final descriptor maps match the original and all serve threads are joined. Private mutation removes only the final owned transport `os.close(self.fd)`: repeating the EOF lifecycle case fails exactly `owned transport remained open`. The harness independently reclaims that intentionally leaked mutant descriptor and verifies the original descriptor map. No behavioral subprocess children are created.

## Controls, evidence and reproduction

Run from the validated owned repository through the supplied operation supervisor:

```
/usr/bin/python3 /tmp/toyvm-final-composition-independent-accept-oct29/ops.py verify-inputs /usr/bin/python3 test/toyvm-final-composition-independent-accept-oct29/verify_inputs.py
/usr/bin/python3 /tmp/toyvm-final-composition-independent-accept-oct29/ops.py independent-acceptance /usr/bin/python3 test/toyvm-final-composition-independent-accept-oct29/accept.py
```

These two groups passed once. The operation records and original stdout/stderr are retained under the owned task `e/` directory. No acceptance groups were replayed. Source pins before/after and detailed controls are recorded in `results.json`.

The original supervisor and limit module pins are verified and unchanged. Actual executable is `/usr/bin/python3`. Existing startup receipt confirms inherited parent DATA soft128MiB / unchanged hard, child Python DATA128MiB and Git DATA256MiB only; no Git DATA limit is applied to Codex/Node. Controls retain physical parentRSS128MiB/group512MiB, MemAvailable floor2GiB, CPU90s, wall120s per operation, file12MiB, capture2MiB, terminal8192, evidence1MiB and aggregate allocation24MiB. No admission/limit/platform denial or waiver occurred. Mount argv and intended mount files are empty because no mount execution is authorized; no Node acceptance runs. No test box is assigned, and lifecycle remains coordinator-owned.

Only this task directory's new tests/report are staged, reviewed, committed and pushed to `task/toyvm-final-composition-independent-accept-oct29`. The final external completion receipt records the commit and exact remote-SHA verification; it does not overwrite the pinned canonical candidate input receipt. The bounded `coordinator-note.txt` is supplied for the coordinator to append to the oversized shared messageboard. No main integration or public deployment is performed.
