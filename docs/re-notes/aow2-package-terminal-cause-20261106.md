# AoW II: package completion discriminator remains inconclusive

Evidence: `scratch/runs/20261106-aow2-package-cause-fresh/` (ignored).
Tested main `edf9b29c96c5d9933cb541752bf296d6d5d8c823`, with relevant
binary diff and new runtime-source patches retained. No production host,
driver, collector, emulator, registry, guest or media change. No original
launch, terrain acceptance or army command occurred.

The required-package completion failure remains unresolved. The predeclared
stream-versus-existing-arrayBuffer control did not qualify a causal consumer
difference: the stream cell reproduced the selected package failure, while
the arrayBuffer cell's immutable first fault was a different, earlier seed.
Both faults remain fatal. No further launch or speculative fix followed.

This follows [the generated comctl control](aow2-comctl-terminal-control-20261106.md)
and [the registry investigation](aow2-registry-input-gameplay-20261106.md).
It establishes no common cause with the preceding original's comctl32 failure.

## Authorization, inputs and observation

Preparation stayed read-only/run-local while queued behind fresh Aranna
menu-phase2021 and legacy POINT/NONE2021. Their FINAL releases and independent
cleanup preceded the coordinator's explicit 21:02:20.187445–21:47:20.187445 UTC
runtime/source/build grant, including cleanup. The worker rechecked predecessor
cleanup and acquired the runtime locks before tests or browser execution.
There were no nested workers or boxes.

The predecessor's unexecuted `control-plan.md` and `observation-draft.cjs` were
read without editing their originals. All 12 retained evidence hashes matched.
Raw owning-session Fetch/Network events, ordinary caller metadata and
UUID-linked server/NetLog evidence were inspected first. The historical
observer logged command resolution but discarded result objects; exact old
Fetch result envelopes cannot be recovered from it. Its cancellation coverage
also omitted stream/reader cancellation and reader release.

The single hypothesis was conditional: progressive host consumption might
cause the generated package completion cancellation while the host's existing
arrayBuffer branch completes it. Direct comctl had already succeeded through
the stream path, so stream use alone was never accepted as the cause.

Both fresh cells used the retained generated native InitCommonControls PE,
ordinary full shell and unmodified shipped Worker. Current inventory refresh
retained 2,775 alias records and 31 native PE modules, original registry/system
mounts, seed order `vcl50.bpl`, `vclx50.bpl`, `Ml42ND50.bpl`, and the original
five lazy DLL/package entries. Media was hashed in place, not copied.
The collector and adapter retained their exact prior hashes:

- Collector: `0808b400aca53cd8547a1d47d6ef2c4f3c06823a1bf723a87bbe329cf240a220`.
- Adapter: `e86f182824a7818b01acbcac43ba494518fa714588d379b8846dd8313644dd7a`.

Seven retained transport proofs were hash-checked. No new optional-file policy,
alternate body transport, retry, extra body read or clone was introduced.
The sole treatment omitted `onTransfer` for the selected Ml42ND50 request,
using the existing arrayBuffer branch with the same signal and retention map.
All other package requests kept ordinary consumption.

Observation attached before collector setup and child resume, recording Fetch
command begin/result/error envelopes. Body results retain keys, encoding,
encoded length/hash; the collector retains decoded bytes/hash. Small results
are retained exactly. Normal caller reads, stream/reader cancel, reader
releaseLock, controller/signal abort and lifecycle operations were observed
without obtaining another body. Node receive order and page clock metadata
are separate; cross-clock timestamp proximity is not causal proof.

Both actual slot-0 Workers instantiated standard module
`280014368b95a768bd31397971715f5d95089c3a22d018758b5d58f3d4a1650e`
(2,180,788 bytes). The recorded compatibility build is
`7d476f1d52fdc4538de94a436df69164eb02df26285c3a50a2b0516ec4996eca`
(2,183,434 bytes); it was not instantiated in these browser cells.

## Immutable first faults

| Identity | Stream cell | ArrayBuffer cell |
|---|---|---|
| First required failure | Ml42ND50.bpl | vclx50.bpl |
| Page target | 27B0D94974514835CCE0C1C9A13F52DF | 5E308F640DC1E0CCD14ED9D263550439 |
| Owning session | 0F930A4284F56E0C5747D325539CFFDA | 4CDE714D140E456A736AB8718CDEFF9B |
| Fetch | interception-job-165.0 | interception-job-164.0 |
| Network | 871990.266 | 872763.265 |
| Server request | 165 | 164 |
| Response UUID | 5ad96a40-d7da-46a6-96a8-4cd1c47952b6 | 0831b492-05cf-40e0-8933-dda687d6b7f1 |
| UUID-linked NetLog URL_REQUEST | 995 | 980 |
| Complete bytes | 468,992 | 248,832 |

The stream cell captured the expected Ml42ND50 body, SHA256
`c503b230760bfc9f3c315f91911c3b90471368115fabf227e4e95d0e34a30993`.
Fetch.getResponseBody resolved at 21:04:30.937 UTC with `base64Encoded=true`,
encoded length 625,324 and encoded SHA256
`98f496091100e358601826ad688b72b37067c36c0bab834329dba179fb747a56`.
Fetch.continueResponse began at .938 and resolved with `{}` at .940.
Network response receipt followed at .946 and fatal canceled ERR_ABORTED
at .950. The UUID-linked server finished HTTP200 at .930 with matching
bytes/hash. The ordinary stream returned 468,992 bytes and then EOF.

The arrayBuffer cell's first fatal response was vclx50, which kept ordinary
stream consumption. Its decoded SHA256 is
`0bca4d6adf70b4a01f0b6fe0e3d4d1ff08d97bdebb6ae2e836dde9d3a89cc148`.
Fetch.getResponseBody resolved at 21:05:01.472 UTC with `base64Encoded=true`,
encoded length 331,776 and encoded SHA256
`26663fcb53118766921f83c104aba6e2d7a56c75ad8209faa2c753e37d2d81c7`.
Fetch.continueResponse began at .474 and resolved with `{}` at .477.
Network response receipt was .496 and fatal canceled ERR_ABORTED at .520.
The UUID-linked server finished HTTP200 at .459 with matching bytes/hash;
the ordinary vclx50 caller read all 248,832 bytes and EOF. The selected
Ml42ND50 treatment was invoked once, but cannot qualify a cell already
faulted on another required seed.

Each UUID-linked NetLog records the matching filtered byte total and one
REQUEST_ALIVE end, without a recorded `net_error`. Neither this nor caller EOF
overrides Network.loadingFailed. The instrumented page cancellation/release/
lifecycle paths recorded no such operation in the retained observation window.
That is limited to those JavaScript paths; the actual browser cancellation
mechanism remains unidentified. Each cell retains its exact first-fault
assessment, command/Network/server records, caller receive-order ledger and
UUID-selected NetLog events.

Both screenshots were personally reviewed: ordinary generated-shell library
download dialogs, not a completed native-return control or gameplay. The
cells each exited 1 on the retained required fault; both browsers closed
normally with exit 0. No first fault was cleared or retried.

## Validation and decision

The locked full build passed. Focused suites passed: 99 synthetic collector
lifecycle cases, process-boot yield checks and classic Worker DLL registry
checks. Fourteen run-local assessment controls passed, including rejection of
complete-body-plus-Network-failure, missing/rejected command results, wrong
UUID/hash/session, missing/duplicate terminals and incomplete collection.
These validate assessment behavior, not successful native package completion.

The predeclared different-first-failing-URL stop rule applies. The consumer
hypothesis is unqualified; no specific host/driver/emulator operation explaining
cancellation was demonstrated. There is no warranted production fix or
production regression to add, and no qualified original launch prerequisite.
Further work needs a separately assigned concrete discriminator and runtime
grant. The original, terrain and two reviewed ordinary army commands remain
gated. Final cleanup and publication identities are retained in the run.
