# Shadow Man fresh-selection independent acceptance — 2026-10-23

**ACCEPT SOURCE/OFFLINE** for the supported actual-runner/preload selected-send
interface in exact repair `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`.
It closes the fresh HWND/current-batch usability defect demonstrated by review
`ff5156adfe3b8708bf15f5689cd02ce928a5fc62` against exact
`aac3cf5db81fc2946f9bfc2f09a11a9c7be021ec`.
This is not full-module, handler, guest, UI, persistence or gameplay acceptance.
No production fixes were made.

Evidence is in the adjacent `shadow-man-fresh-selection-independent-accept-20261023/`
directory. The coordinator's 104 verified candidate publication seals and the
accepted unchanged Module-binding/OFF/quota/terminal/WAT/census/discovery evidence
are reused; the general suites and packaging review were not repeated.

## Exact supported contract

The intent is exactly `{mode:"selected-action",actionSequence:N,cmdId:3}`.
It does not contain a future HWND or batch. Registration rejects mixed exact/intent
keys, extra keys, unknown modes and invalid numeric values. The adapter copies
and freezes its private intent. Mutating the original selection or replacing
the environment after instantiation does not replace that state.

The real runner increments its diagnostic sequence for **every dequeue**, before
dispatching the action. It resolves the modal dialog first, otherwise the visible
renderer dialog or native slot, then climbs dialog parents for the latter route.
The exact runner branch passes current batch and resolved HWND synchronously to
the preload hook, before its native `send_message` call. There is no asynchronous
gap between resolution, validation, persistence, arm and send.

The adapter permits earlier `dlg-cmd` sends while OFF, keeps at most two returned
send receipts, and selects only the specified sequence and command. An earlier
matching command is not selected. A different action at the selected sequence,
an absent selected dialog, or a wrong selected command cannot shift selection
to a later matching command. Absence itself produces no hook call or capture;
the later sequence is rejected. An exception in a prior native send propagates
out of the actual branch before further dequeues; it is not a returned receipt.

At the selected boundary, the adapter validates PID, runner, instance, action,
sequence, command, nonzero u32 HWND, safe nonnegative current batch and supported
route. `createCapture.arm` JSON-copies, deeply freezes and seals the resolved
context, private intent, prior receipts and pre-arm state. Actual preload writes
and calls real `fsyncSync` before breakpoint/trace/diagnostic mutation or send.
The adapter consumes its one-shot before calling arm. Retention or arm failure
therefore cannot retry through the supported hook, even if a harness catches it.

The four-key exact mode remains strict: the independent known-exact control
captures, and independently stale HWND and batch controls reject before send.
No-hook/default-OFF sends return with source count zero; absent dialog remains
OFF and the missing-terminal record prevents a successful-capture claim.

## Bounded executable acceptance

From this isolated task repository:

```sh
GIT_NO_LAZY_FETCH=1 python3 docs/re-notes/shadow-man-fresh-selection-independent-accept-20261023/run-checks.py
```

Final exit **0**, ten subprocess checks, each externally bounded to 60 seconds.
`checks.json` records exact argv/cwd/environment/exits/stdout/stderr. Five syntax
checks precede the candidate fresh fixture, independent failure-unit controls,
independent actual-runner/native-sender controls, and two desired-acceptance
oracles. The repaired fresh oracle actually exits **0**; the identical desired
exit86 assertion on the old candidate actually exits **1** (expected rejection,
not mislabeled acceptance). `old-desired-fresh` fails with
`invalid final Beenden selector` before any dequeue because the old exact-only
interface cannot accept an intent without future HWND/batch.

`fresh-selection-results.json` retains the candidate fixture's ten cases:
fresh modal/parent/slot and late environment update exit86; wrong command,
stale exact selector, stale exact plus environment update and invalid mixed
intent exit1; absent dialog and no hook exit0. Its twelve wrong-context and
nine invalid-registration controls also pass, with duplicate/rearm rejection.

`independent-results.json`, per-case `.trace` and `.jsonl` add eighteen controls:

| Independent actual-boundary control | Exit | Required observation |
| --- | ---: | --- |
| Fresh modal, parent, slot, late environment replacement | 86 each | Resolved receipt matches newly acquired HWND/batch |
| Mixed dequeues, intended sequence5 | 86 | Non-dialog dequeues2/4 count; prior receipts are sequences1/3 |
| Earlier command3, selected command3 at sequence3 | 86 | Earlier matching command returns OFF; only sequence3 arms |
| Wrong selected command, selected non-dialog action | 1 each | Does not select a later matching command |
| Selected dialog absent, later command3 present | 1 | NO DIALOG then later-sequence rejection; no capture |
| Selected dialog absent, no later action | 0 | NO DIALOG, count0, missing terminal; no capture |
| Prior native send throws | 1 | Exception propagates; no selected dequeue/arm/capture |
| Real receipt fsync throws | 86 | Terminal `capture-failed: arm retention`; no mutation/send/event |
| Arm mutation throws | 1 | No selected native send or successful terminal record |
| No hook/default OFF | 0 | Native sends return, no diagnostic records |
| Exact known context | 86 | Existing exact-selection compatibility |
| Exact stale HWND / stale batch | 1 each | No selected native send or capture |
| Old exact candidate with desired fresh intent | 1 | Rejects unsupported intent before dequeue |

Fresh-mode HWNDs are drawn from `[65536,2147483646)` and batches from `[40,80)`
only at the selected action, after earlier synthetic sends return. They are
absent from preload input. The synthetic exact-mode positive uses a separately
identified fixed driver and is never presented as fresh discovery. Per-case
input IDs, actual random values, PIDs, runner and module pins are retained.
Config/OK returned sends establish ordering only, not real UI success.

The new driver extracts the exact runner queue/dequeue prefix and exact whole
`dlg-cmd` branch. Native WAT starts from the pinned prior sender fixture, whose
entire sender form is independently verified against exact candidate source.
Four explicit observer calls instrument entry to breakpoint/trace/diagnostic
mutation and sender; their substitutions are recorded. In every positive, the
receipt seal verifies, real fsync completion precedes all three mutations and
selected native sender entry, pre-arm count is0 and first source event is1.
The injected fsync failure does not get mistaken for successful persistence.

`failure-unit-results.json` independently retries the same selected-send adapter
after retention, breakpoint, trace and diagnostic-arm failures: every retry
rejects with `duplicate or late arm`, without any further operations or send.
The resolved context is copied and deeply frozen and survives subsequent caller
mutation; the private intent survives mutation of the registration object.

Scope of this failure guarantee matters: the lower-level exported
`createCapture.arm` method, called directly outside preload, does not itself
latch terminal state if a diagnostic mutation export throws. Its body is
unchanged from aac3cf5. The actual preload keeps that capture object private and
exposes only the consumed selected-send closure. This acceptance establishes
failure safety for that supported boundary, not exception safety of arbitrary
direct raw-helper calls. `exploration.json` records an initial test assumption
about that separate API and the resulting harness TypeError; no candidate source
was altered or failing supported-boundary control suppressed.

## Source, limits and next prerequisite

`source-checks.json` records exact Git blob and SHA256 pins. Only the diagnostic
CJS adapter, discoverable test entry and new fresh fixture change among code
paths. Runner, preload, three WAT fragments, scanner, entire408-entry census,
tier registration and timeout metadata are byte-identical to aac3cf5.
The prior4 reviewed/404 unrelated entries remain unchanged with pending ownership.
The CJS adapter is outside the pinned scanner; this is **not** full transitive
census coverage or an ownership upgrade.

Candidate fresh native fragment:3526bytes,
SHA256 `103b6e04fc7b5a30a820eba0d76c171fa8f4db5967860849ad9fb89c4a44a00e`.
Independent observed fragment:3558bytes,
SHA256 `13ce243432102561af6f058ef6f86e288eed33370f13b028ba86fe845f34d0d6`.
Both have fixed initial=maximum128pages, **8MiB**. Child processes have5second
external timeouts, VM evaluations1second, independent subprocess output256KiB.
Arena size is not a Node/compiler RSS limit. Resolution, translator, allocation,
callback/run dependencies remain scripted; no full handler/module/guest claim.
WAT and exact compile recipe preserve recovery for ignored wasm outputs.

Next **one** prerequisite: complete/admit the already pending exact source
closure/provenance/manifest/transitive census and canonical gates, followed by
separately authorized canonical compilation and actual imports/exports/start
qualification. The subsequent execution must use the fresh module/runner/PID/
single instance, complete game inputs, an explicitly counted action intent,
observable fresh UI route, exclusive output, block policy and external watchdog.
No historical HWND/batch, returned Config/OK receipt or exit86 alone proves UI
success, persistence, Play, gameplay or a zero writer. Ordinary CACA0005 remains
`ordinary-or-unknown; zero-writer unproven`.

## Resources and handoff

`admission.json` measured BEFORE checkout: projected30,644,176bytes, including
Git/source/metadata/output/temp growth and8MiB reserve, below67,108,864bytes.
Free5,592,887,296bytes minus projected growth exceeds floor2,982,150,144bytes.
Installed tools/compiler execute in place with identities/standing footprint;
read-only donor footprints are separate. No installs, links, broad/lazy fetch,
archive, full/default/canonical compile, runtime/recovery/media/Boat/guest/
browser/GPU were used. Final accounting and verified publication are retained
under this task's `scratch/runs/20261023-shadow-man-fresh-selection-independent-accept/`.

StrictSSH current remote main reconciles read-only to
`bb9c496ed13095cc832fdf607f0937fb9c14b7de`; exact candidate remote is b41a7c5.
Task branch `task/shadow-man-fresh-selection-independent-accept-oct23` contains
review/tests/report/evidence only. Parent tree preservation and actual published
SHA are recorded in the final receipt and append-only shared messageboard.
No merge, force push, deploy, donor metadata/shared-index/main mutation, workers
or refill. POSITIONT build-readiness, RichEdit hold, Claude B&W2 and laptop
HeroesII/Warcraft ownership remain untouched.

No box assigned or contacted. `bx_fn7pn7yg` is coordinator-reported snapshot
STOPPED, historical expiry `2026-10-23T03:46:00.580Z`, unprobed here. Coordinator
retains lifecycle/shutdown ownership. One bounded task complete; stop.
