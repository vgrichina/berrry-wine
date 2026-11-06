# AoW II: native comctl demand succeeds; required package cancellation remains unresolved

Evidence: `scratch/runs/20261106-aow2-comctl-terminal-control/` (ignored).
Tested main `3772aa782530180d4bba8e8812a88c95dcd45c86`; no production
host, emulator, registry, collector or guest changes. No original launch,
army command, movement-point test or gameplay claim. This does **not** clear
the original `Network666315.271` required comctl32 failure recorded in
[the preceding investigation](aow2-registry-input-gameplay-20261106.md).

The worker waited for Forsaken and Aranna FINAL releases, independent cleanup
and the coordinator's explicit 19:00:16.343035–19:45:16.343035 UTC grant,
including cleanup. Before that grant, preparation was run-local and unexecuted.
The worker independently checked 110 predecessor PID identities, 25 ports and
four locks. No boxes or nested workers were assigned or created.

## Generated control and unchanged collection

The generated PE statically imports native `comctl32.dll!InitCommonControls`,
calls it, creates an ordinary STATIC window, then sleeps. The ordinary shell
launches its actual main Worker with the untransformed shipped Worker source.
The actual slot-0 instantiated standard module is
`2fa9f377dde5e477eb811baceb64032889fbe9b27a664b213477e84627e5eb94`;
the compatibility build is
`3dd82e987c0683b45f28860748b6a19151b6623f578f10d70d201b798baf2a6a`.

Both arms use the current DLL registry and ordinary shell system-data mounts,
including registry and fonts. The original AoW local manifest has no per-app
registry overlay. The package arm additionally uses the registered three
Borland DLL/package seeds in their original order and the original manifest's
five lazy DLL/package entries, preserving their VFS paths and load modes.
Original media was referenced, not copied, and AoW2.exe was never launched.
The generated control's refreshed input map has 1,641 pinned URLs; this is not
a replacement for the preceding original's 1,661-URL/2,776-alias inventory.

The authoritative collector remains exactly
`0808b400aca53cd8547a1d47d6ef2c4f3c06823a1bf723a87bbe329cf240a220`.
The unchanged adapter is
`e86f182824a7818b01acbcac43ba494518fa714588d379b8846dd8313644dd7a`.
Seven retained transport controls were reused after exact hashes and passing
proofs were checked. No alternative HTTP-body channel, collector relaxation,
invented optional 404, request retry or guest-state patch was used.

Run-local observation records owning-session Fetch commands and their results,
Network events, caller body-read metadata and aborts. It never adds a caller
body read or clone. A unique `X-Wine-Control-Request-ID` header explicitly links
each server response to the browser response; server, Fetch and Network IDs
remain separate namespaces. Server close/error/destroy records include the
observed byte total and an incremental hash as well as the finish record.

## Direct native demand

`comctl-direct-mounted/comctl-terminal-proof.json` passes the exact transfer
checks: one request/response, verified and continued Fetch, one Network
`loadingFinished`, no `loadingFailed`, and the UUID-linked server HTTP 200
finish with matching bytes/hash.

| Namespace | Exact direct-control identity |
|---|---|
| Page target | `D07C1C30E8DEDFFCBBC3A278A5CF86F2` |
| Owning session | `0FB4F7CA0DCB9955CAD9371DE32D7D6E` |
| Fetch | `interception-job-163.0` |
| Network | `725777.264` |
| Server request | `163` |
| Server trace UUID | `a13fb635-182a-4516-a797-d26f1a9afab5` |

The body is the original 577,808-byte comctl32, SHA256
`28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`.
The normal caller read all bytes and stream EOF. Native Worker logs show the
EXE import patched to the loaded DLL, DllMain returning EAX=1, then the
generated CreateWindow marker after InitCommonControls returned. All three
actual host font loads fulfilled. I reviewed `shell.png`: the full shell log
and generated taskbar title are visible; this is no gameplay evidence.

This arm is **not a clean driver pass**. A later driver assertion incorrectly
expected a `wine.moduleBases` entry, despite the native load/return evidence.
Its exit 1 and error are retained. `direct-assessment.json` separately hashes
and assesses the successful terminal/native-demand evidence; the control was
not repeated. The next arm's check uses the actual native load/import and
post-call window markers instead of that map oracle.

An earlier `comctl-direct/` setup failure is also retained: the working
directory was not mounted, so no comctl request occurred. The only correction
was a normal generated-EXE VFS file entry establishing `c:\aow2demo`; the
driver now asserts that mount. Neither setup error was a collector fault.

## Package graph: immutable first fault before comctl

The discriminating package arm fails on a different required native seed,
`Ml42ND50.bpl`, before it reaches comctl32 demand. The first fault remains fatal
and was neither cleared nor retried.

| Namespace | Exact package-control failing identity |
|---|---|
| Page target | `82955721C24B5AA6137FB3C3EFC0BD80` |
| Owning session | `EA10693C9A901BCF4BE156AD97E85983` |
| Fetch | `interception-job-165.0` |
| Network | `726905.266` |
| Server request | `165` |
| Server trace UUID | `de6d6d27-ddb2-4231-a27c-d5516bb2880e` |
| UUID-linked NetLog URL_REQUEST | `989` |

Fetch captured, verified and continued 468,992 bytes, SHA256
`c503b230760bfc9f3c315f91911c3b90471368115fabf227e4e95d0e34a30993`.
Its continuation resolved at 19:03:30.162 UTC; Network response receipt was
19:03:30.165 and `loadingFailed`, canceled true / `net::ERR_ABORTED`, was
19:03:30.167. The UUID-linked server finished HTTP 200 at 19:03:30.148 with
the same complete body and no abort. The ordinary caller separately records
468,992 bytes followed by stream EOF, with no observed controller/signal abort.
These caller and Node/CDP timestamps use distinct clock bases; their precise
cross-clock ordering is not asserted.

The response UUID also links the NetLog HTTP transaction. URL_REQUEST 989
records exactly 468,992 filtered bytes and a REQUEST_ALIVE end without a
recorded `net_error`. That transport observation does not override the CDP
required-request failure. `package-fault-assessment.json` retains the joined
identities, original events, caller metadata and actual main Worker identity.

This demonstrates that native comctl demand alone can complete, and that the
failure signature can occur in a generated shell without the original game
executing. It does **not** prove that the package failure and the preceding
original's comctl failure have the same cause. No cancellation cause or
production host/driver/emulator mismatch is established. In particular,
successful caller EOF and server completion are insufficient reasons to
ignore a required Network failure.

## Validation and remaining prerequisite

The locked full build passed and reproduced both module hashes above.
Focused tests passed: 99 synthetic collector lifecycle cases, process-boot
yield cases, and classic Worker DLL registry cases. `test/test-static-server.js`
failed its existing repository-wide server-owner census before its HTTP tests:
it additionally finds `test-d3dim-palette-gpu-web.js`,
`test-dos-recovery-safety.js`, `test-file-bundle.js`, and
`test-gl-native-render-load-web.js`. That failure is retained; those files were
not changed. No production repair or new production regression was justified.
The run-local terminal assertion distinguishes the successful direct request
from the package arm's required failure.

Exact source commit, relevant binary diffs, untracked runtime-source patches,
module identities, helper identities, captures and original failures are
retained in the run. Git remains the source archive. All browsers closed
normally; runtime holder and final cleanup evidence are retained. Box
ID/state/expiry are null.

The prerequisite remains: explain the required intercepted-response completion
failure, or demonstrate and repair a specific host/driver/emulator mismatch
with a generated discriminating control while keeping the strict collector.
The failing package arm cannot qualify the complete AoW DLL graph. Further
original gameplay work remains gated; there is no army-command acceptance.
