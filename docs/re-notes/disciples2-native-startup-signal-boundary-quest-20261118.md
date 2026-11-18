# Disciples II startup and cancellation waits, 2026-11-18

Run: `scratch/runs/20261118-disciples2-native-startup-signal-boundary-quest/`.
Harness repair: `140571497`.

The prior original remains permanently UNKNOWN. Its outer supervisor received
SIGTERM at 15:46:00 UTC, 539.887 seconds before its own deadline. The sender is
unknown. Neither the receipt nor a matching elapsed interval identifies a
sender. No old endpoint was contacted and no historical input fact was promoted.

## Proved harness defects and repair

`outerwait` previously had no cancellation handler. A supervisor sweeping the
owned tree could terminate it before it reaped its detached `run` child and
drained the child's pipes. `durablewait` survived TERM but did not forward a
signal addressed only to itself. Both wait layers also returned success after
a child failed prelaunch admission.

The repaired wait owners retain their actual child wait through TERM/INT/HUP,
forward only through their own direct ChildProcess handle, remove their
temporary handlers after close, and record actual stream EOFs. Incoming signal
senders remain UNKNOWN; the process doing an owned forward is recorded
separately. A child's nonzero status now propagates through both layers.
`tools/native-supervise.cjs`, game input admission, and game code were unchanged.

The exact published old `outerwait` body was loaded from Git in memory for a
bounded control. Full-tree cancellation reproduced the missing intermediate
child-wait record. Native and watchdog wait records survived. The independent
owned sibling, outside that custody tree, exited normally with both EOFs.

Repaired controls exercised a signal addressed only to the durable parent and
a full-tree deadline cancellation. Each retained separate native, watchdog,
intermediate-parent and outer-parent waits with both EOFs, including final
native stdout/stderr bytes. Both independent siblings exited normally and were
absent from the custody target inventory. A refused sealed prelaunch propagated
exit 1 through both parents. Cancellation remained explicitly not native Quit.

The authored native x86/CPUWorker controls retained nonempty nested-cursor DOWN
refusal and ordinary drain-and-sample DOWN with independent UP. Those results
are authored controls, not an original-game consumer policy or readiness repair.
Existing lifetime, sibling, nested callback, receipt and closed-scope refusals
remain intact. The focused quest suite and four native-supervise groups passed.

Two locked builds passed. In the first, compiler atomic renames replaced output
symlinks and briefly wrote 4,843,475 bytes on /home. The exact prior build paths
were restored under the build lock. The second redirected the whole build
directory to owned tmpfs, including atomic output writes, and restored the exact
prior directory before releasing the lock. No universal all-growth-on-tmpfs
claim is made for the first build.

## Affected original

One fresh affected original was authorized by the proved, tested harness change
and launched after its strict pull/push. It uses the same module SHA-256 as the
prior original:
`cc4fb8225e07c1136c7e200484fb321827f20a756b71b599748237786fdc692a`.
Sources come from exact published Git, excluding foreign WIP. Default media,
real ticks, unchanged readiness, 3600-second native duration and a 300-second
Quit reserve remain in force. Public API logging is bounded to batches
30000–30012; aggregate API counts and preload phase timing are passive.
The launcher retains individual holder and durable-parent waits; an invoker
retains its finite native-supervise child's wait and both pipe EOFs. Browser
and display processes are not created.

The original reached a complete main menu. Personally reviewed whole frames
show Single Player, Multiplayer, Options, Intro, Credits and Quit. Enter and
Down each received an actual native-input-return receipt plus independent UP.
Their subsequent whole-frame reviews showed the same menu without an observed
selection or navigation consequence. Native delivery is not application use;
keyboard navigation support was not established.

At 16:17:05.779 UTC the invoker received SIGTERM, sender UNKNOWN. Its recorded
handler forwards to its owned native-supervise child; that supervisor recorded
its received SIGTERM at 16:17:05.781 and swept only its owned tree. Its runtime
deadline was still 3488.192 seconds away. Native execution ended after 169.132
seconds at batch 67791. No deadline, disk-floor request or ordinary Quit was
the initiating event. This documents the owned forwarding chain, not the
external sender's identity or intent.

The scope is permanently UNKNOWN/closed. A later proposed hover capture was
refused locally as `native terminal`, before any endpoint request; its dependent
local review also found no capture. There were zero hover or mouse-DOWN
intentions and no original consumer observations. No New Quest, map action,
ordinary Quit or original input-readiness repair is claimed. No second original
or replay was attempted.

The repaired chain retained all individual waits with both EOFs: native exit 0,
watchdog -15, intermediate `run` wait 0, outer-parent wait 0, durable-parent
wait 0, holder -15 and invoker's custody-child wait 0. The native-supervise
receipt separately records its direct parent-child exit 0 and no leaks.
Every tracked runtime PID was absent at the supplemental post-exit check.
Neither absence nor the zero exit codes are used as substitutes for waits or
as native Quit evidence. Browser and display waits remain null.

Aggregate public API diagnostics recorded 2,833,984 calls and 185 unique names,
including 12,162 GetCursorPos, 12,165 PeekMessageA and 1,780 DispatchMessageA
calls. The selected batch window logged worker WaitForSingleObject calls.
These are startup/execution observations; they do not locate a callback return
or establish cursor consumption after an original hover, which never occurred.
The earlier loading-to-black boundary is therefore not proof that this module
cannot load its menu. The remaining task boundary is an externally cancelled
scope before any demonstrated application navigation, with sender unknown.

## Evidence and release

Exact Git revisions, relevant binary diffs, owned patches, selected per-intent
whole frames, unique authored inputs, logs, manifests, tested module and recovery
instructions are retained in the run. Git plus patches is the source archive;
no source tree or media was copied. Failed command-vector admission controls
remain separate from the successful lifetime controls.

The affected invoker sampled /home every 500 ms; its minimum was 1,602,187,264
bytes. Earlier samples were also above 1.5 GB, but no continuous whole-task
claim is made. Selected evidence is retrieved, fsynced and SHA-verified before
owned tmpfs removal; `result.json` is written last.

No workers, Python, Wine reference, deployment or box was used. Box ID null;
state NOT_CREATED; expiry null; stop receipt null. Ownership is released after
final evidence validation and publication; this single-task worker stops.
