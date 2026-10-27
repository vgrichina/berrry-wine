# GeneRally callback census boundary review — blocked

The pinned canonical census cannot be accepted within the assigned 256 MiB aggregate physical-memory limit. No producer hash was renewed, no ownership was promoted, and no source change is proposed. This branch publishes evidence only.

## Exact semantic delta

The complete two-file diff is `evidence/semantic-diff.stdout`. Both baseline files at `4efa0599fee900a22770c40659e65c3a2e1c9a64` reproduce the existing census hashes exactly; both current files reproduce the task-supplied hashes at source `4a2bec145ef34b0d084b96b09a682a16e89703fd`. Thus the comparison covers the complete change since each existing seal.

`host.js` changes only `WineAssembly.parseFileBundle`. Fatal UTF-8 decoding, own-property/exact-descriptor validation, duplicate-name reservation and bounded lengths reject malformed byte bundles. The method remains synchronous and receives bytes, not a guest callback, continuation or invocation token. The returned Map still holds views into the response buffer. Decoder/JSON exceptions still return null through the existing catch. In its unchanged `_fetchBundles` caller, null follows the existing unsupported/fallback/transfer-completion path. Existing abort checks, awaited fetch/arrayBuffer, transfer callbacks, catch behavior and file-buffer lifetime are unchanged. No new retained callback identity, cancellation owner, guest entry or context save/restore is introduced by this delta. This is static delta review, not a claim of general callback coverage.

`lib/renderer-input.js` changes physical left/right modifier tracking, event-position side snapshots, aggregate async state and pressed-since-query publication. `_modifierOwners` belongs to the current physical-key map; replacing that map invalidates the owner sets on the next update. Numeric releases clear both sides. Queue entries retain boolean side-state snapshots rather than reading a later physical map. `asyncPressPublished` prevents dispatch from recreating a consumed press. These are keyboard state/queue ownership changes, not guest invocation identities.

The existing `_restoreKeyboardInputOwner` call still precedes key-state changes and chooses a live window/wasm identity. The existing Worker/modal/native routing, export targets, synchronous DirectInput notification, queue wake, repaint and callback/context paths remain in place. No await, timer, new closure or begin/end invocation pair is introduced. Existing exception propagation is not replaced with a swallowed exception or a new restoration guarantee. Alt tap now activates only when the last modifier side is released. Cross-instance restoration and retained callback ownership remain outside this review and remain pending.

## Canonical boundary and attempted repair

The earliest behavioral attempt used the unchanged pinned production census, not a historical or reconstructed runner. Exact Node startup passed with `/usr/local/bin/node --max-old-space-size=96`, Node v24.18.1, no inherited DATA/AS cap, CPU90/file24MiB, physical256MiB supervision, shared two-permit pool and distinct stdout/stderr from process creation. An old-space flag is not a physical-process cap. The original census was terminated at 288690176 aggregate RSS bytes. It emitted no diagnostic before termination.

A single experimental scanner change parsed each WAT file once and retained call-graph metadata plus exported-form hashes instead of every function AST. Its complete patch is retained as `evidence/attempted-repair-patch.stdout`. The full canonical path still exceeded the same cap at 277327872 aggregate RSS bytes. Both process trees cleaned up completely. The experimental tool was restored byte-for-byte; it has no passing equivalence or full-census receipt and is not proposed for integration. There was no unchanged denial retry.

The existing source-only mutation suite requires a completed real census dump and therefore was not started after these stops. No broader regressions, build, native compilation, guest execution or API operation were attempted. Prior failed compile diagnostics are retained under `evidence/prior-build`; no module exists in that prior report.

## Acceptance and handoff

`receipt.json` binds all retained evidence hashes. Report validation checks all 294 sparse input blob identities, baseline/current producer pins, successful exact Node startup, the two physical stops, complete cleanup, restoration of the experimental tool and unchanged pending census records. These checks validate the blocker evidence; they do not pass the census or authorize hash renewal.

The coordinator must choose a measured larger census-only allowance or a further bounded scanner-repair assignment with equivalence and canonical acceptance. Producer seal reconciliation and its negative controls still need that acceptance. Do not repeat the failed compile before independent acceptance. Root/donor tracked files, index and refs were read-only; the source branch and report are isolated. The coordinator retains the predecessor box lifecycle; this task owns no test box and made no lifecycle calls.
