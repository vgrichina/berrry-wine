# Retained canonical Enigma message completion

Candidate `425755ee5ee9be0734c7aca187521100f5487674`, tree
`fb1ef0832eb9e0229cd272c67b8465c4fcbf4396`, independently accepted by
`facebcb2e6d04b84e80211a7814654e528566b0f`. Build evidence parent
`c654f37bd6e3c17fd442bc38fbc189c1fb4b26bc`; base main was
`ddaff339bd7e1b10b2579a7ab7aed71d86d8edcd`. This does not qualify all current main.

**PASS: both unmodified retained canonical backends executed 60 paired OFF/ON
cases each.** There are 120 pairs, or 240 primary case executions, plus one
omitted-completion control per backend. No build or generator was rerun.

| Group per backend | Pairs | Actual coverage |
| --- | ---: | --- |
| core | 20 | GetMessageA/W, PeekMessageA/W through decoded CALL and JMP; queued returns; incoming-send park/retry; empty PeekMessage |
| hooks-thread | 16 | real WH_GETMESSAGE guest callbacks, suspended before callback execution; canonical continuation; MSG mutation; nested decoded PeekMessageW with independent token |
| hardware | 20 | real WH_KEYBOARD callback and keyboard-to-WH_GETMESSAGE continuation chain for all four APIs/CALL/JMP; WM_QUIT GetMessage; PeekMessage PM_NOREMOVE |
| unrelated | 4 | independent decoded guest callback returns while an outer WH_GETMESSAGE token remains bound; only the subsequent matching module continuation completes it |

The enabled cases observed actual module imports `message_begin`, `message_park`,
`message_bind`, `message_resume`, `message_complete`, with the accepted completion
owner and trace. Actual MSG, EAX, ESP, EIP, yield reason and queue depth were
compared between OFF and ON, including relevant parked/suspended states. OFF
made zero diagnostic import calls. Correlation was invocation-owned; parked
retry retained invocation 1; nested inner completion used a distinct token and
preceded outer completion. FALSE PeekMessage has no successful MSG; GetMessage
WM_QUIT returns zero with its real MSG. No entry-only event is counted as return.
The separate control omits the host completion observation wire, retains normal
module execution and state, and demonstrates that the unchanged completion-count
oracle rejects its missing event. Retained modules and production candidate were
never mutated.

The harness creates a small PE with real USER32 imports and loads it using the
canonical `load_pe` export. Completion installation and module enablement precede
`load_pe` and `init_dx_com_thunks`. Image, stack, staging and thunk mappings are
obtained through canonical accessors; no allocated base is copied from a layout
guess. x86 snippets push stdcall arguments and use indirect CALL/JMP into loader
thunks. A sentinel zero return ends the snippet. The canonical decoder, handlers,
message pump and hook continuation thunks run normally. Ordinary posted messages
are injected into the exported queue buffer/count. Hardware tests deliver one
deterministic host input event through the real input import. Guest hook x86 code
edits the real MSG, calls a nested API where applicable and executes RET 12.

This is **synthetic native execution of the canonical modules**. It does not run
the full production runner, original game, GUI or browser. The production runner
file was hash-verified and its exact accepted installation/qualification excerpts
are retained in `runner-wires.json`; the installation excerpt uses an instance
proxy solely for construction timing. Source-only production-boundary acceptance
is reused from the accepted source review. Synthetic callback scheduling in the
unrelated-return group is not production scheduling qualification. Generic imports
return signature-correct zero (BigInt zero for i64), with clock 123 and no drawing,
networking or input except the documented hardware event. These services do not
replace the completion wires, WAT pump, hook handlers or continuations.

Initial fixture incidents are preserved: an API inspection command had an escaped
newline SyntaxError; thread ID zero correctly refused global WH_GETMESSAGE
registration; ordinary posted WM_KEYDOWN did not enter the hardware-key hook path;
the collection command initially contained an embedded NUL and never executed.
Only the owned fixture/transport prerequisites were corrected. Failed receipts,
initial harness versions and raw API responses remain here. There was also an
unused staged hook supervisor pointing to the old harness; it was corrected
before execution. Two initial bounded source inspections produced truncated tool
output; no claim relies on those excerpts. No production repair or limit change
was made. Passed groups were retained and not repeated after additions.

Each admitted remote command reverified the exact 147-source manifest and BOTH
module SHA-256 pins before/after execution. Helpers and actual generated import
signature manifest were verified at Node startup. Prior complete static ABI,
2226 exports, five changed signatures and 269-layout evidence is reused rather
than rerun. `remote/final-checkpoint.json` is the consolidated execution receipt;
`remote/*-result.json` retain every observed case and call sequence. Per-group
admission/config/execution receipts contain actual argv, environment, limits,
resource samples and input identity. `versions/` retains the precise executed
harness variants; the focused test contains the final additive harness.

Node was `/home/user/.nvm/versions/node/v24.22.1/bin/node --expose-gc`, with
`NODE_OPTIONS=--max-old-space-size=1536`. Startup succeeded with unlimited DATA/AS,
CPU 90 seconds, wall 120 seconds, file 24 MiB and output 2 MiB. Whole supervisor
and descendants were physically sampled under 3 GiB, separately from virtual
reservations and the 512 MiB shared memory. Backend processes ran serially and
owned process groups were cleaned. The largest passing runtime sample was
98,791,424 bytes. The complete remote allocation includes the existing build
namespace plus all new task outputs and reserve within 1 GiB. Local light work
uses one of two permits under 128 MiB; Git uses both permits then the exclusive
lock under 256 MiB, with DATA 512 MiB applied only to Git. Full local allocation
is 64 MiB including session/events, positive WAL once, publication, growth and
8 MiB reserve. Current local admission receipts retain measured projections.

## Recovery and remaining gates

Retained modules remain at local
`/tmp/enigma-reconciled-canonical-boat-build-oct26/modules/` and remote
`/tmp/enigma-reconciled-canonical-boat-build-oct26/source/build/`:

- `wine-assembly.wasm`: 1,880,854 bytes, SHA-256 `af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b`.
- `wine-assembly.compat.wasm`: 1,883,427 bytes, SHA-256 `ed7635d508f7e842afd3c6b8489ba133ac3ddea2fa305439fca60284ea5613a8`.

Preserve these binaries through the coordinator snapshot; Git contains the harness
and receipts, not ignored modules. Runtime evidence also remains in
`/tmp/enigma-retained-canonical-native-msg-qualification-oct26/ops/` on Boat
`bx_xw8d895f`. For recovery, restore the exact retained source/manifest/modules,
verify their pins and accepted helpers, stage the focused test with its support
files, and run each group in a separately admitted backend process. Arguments are
`SOURCE MODULE SUPPORT OUTPUT [core|hooks|extra|unrelated]`; support needs the
accepted owner/trace, pins and runner-wires JSON. Use the recorded remote
supervisor/resource settings, explicit executable, finite API timeout and lifecycle.
Do not rerun passing groups merely to recover evidence or rebuild these modules.

The box is left **RUNNING** with no owned Node children. Coordinator watcher
3327410 owns snapshot-stop at 2026-10-27 00:20 UTC; expiry is
2026-10-27 00:37:17.515 UTC. Execution cutoff 00:10 and handback 00:15 are unchanged.
Remaining qualification: actual full production-runner/native-game initializers
and execution; bounded step ACK for every requested batch followed by a frozen
zero-credit snapshot before input; original-game behavior. Gameplay remains
unknown. Main/source and other owners' work are unchanged.

Publication diff-check initially rejected raw log EOF blank lines and byte-exact
recorded supervisors containing a trailing space. Their bytes are preserved in
`.raw.json` as base64 with original filename, length and SHA-256; decode for
recovery. This packaging correction does not change executed inputs or results.
