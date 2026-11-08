# TR2 writer-boundary native run — 2026-11-08

The single fresh original run actually loaded the `efae2c6d3` host and renderer,
with the accepted native module and owning WebGL2 endpoint. Final accounting is
**441 raw = 0 qualified + 441 discarded**. The new boundary now has native
execution evidence, but canonical/DX joins still fail. No Up, Space, Control,
movement/weapon consequence or FPS result is claimed. **The requested done
condition was not achieved; this is a concrete integration blocker, with no
new production repair completed.**

Evidence: `scratch/runs/20261108-tr2-writer-boundary-native/`.

## Exact runtime and reused controls

Before allocation, the fail-fast closure checked all **612 pinned files,
226 retained control references and 23 existing media references**, including
correct CommonJS/module syntax checks. `exact-closure.json` precedes the
UUID-idempotent create attempt. Launch disk exceeded 10 GB. The effective
runtime keeps the preceding accepted closure, changing only `host.js` and
`lib/renderer.js` to their exact published `efae2c6d3` blobs. Source HEAD was
`31e394e55cb2abd7e0b65dac6c2d08f4256fe418`; exact published host-imports
`2666626f9`, render-worker `4003f6502`, WAT menu `f4fc82774`, queries
`9c93a0f13` and postfence `2483eec51` pins/ancestry were checked. Peer WIP was
excluded. CDP parsed-script source retrieval independently confirms both
updated host and renderer hashes (`final-audit.json`).

Actual CPU and owning-render-worker modules retrieved through CDP match
`d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`.
The owner is WebGL2 on Intel UHD 620 through ANGLE, not a substituted software
endpoint. The accepted same-WAT/nonempty-client-rectangle boundary regression,
exact baseline failure, two independent writer holds, same-source raw1 /
qualified1 / red pixel, 29 negative guards, rAF/Worker/non-DOM behavior,
placement, transient-writer/scene, source lifetime, callback census and locked
build were reused by verified hash, without standalone reruns.

One blank-page native-key preflight passed before the original launch. The
first Graphics review became stale and was refused before dispatch with zero
effects; a new capture was personally reviewed. Hardware acceleration,
Full Screen, 640x480 High Color and focused OK were visible. The admitted
Enter review was **8422 ms** old. Enter requested 500 ms with independent UP;
its retained wall-clock receipt measures **499 ms**, rather than an exact
500 ms. Both initial and final game-world images were personally reviewed.
Pre-arm raw remains null. Observation used the bounded 4096-record journal.

## New production cause after the repaired boundary

The writer hold does not establish that a completed source survives until its
owed upload and the next safe host presentation boundary. Two independent
passive traces establish the missing ordering:

* `invalidation-envelope.json` records the actual owner receiving
  `render-message / legacy-call / opcode 131076 (0x20004)`, the synchronous
  viewport clear. At sequence 1723 the latest sealed source and current host
  version are both 522; entering this route advances the host version to 523.
  The following batch sees 523. Sequences 1729 and 1735 repeat the same
  exact-version-before-clear pattern. This is the actual message identity,
  not an identity inferred from writer count.
* `invalidation-stacks.json` independently records
  `WriterEpoch.invalidateVersions -> sharedMessage -> processMessage` on the
  owning render worker. The production outer dispatch conservatively
  invalidates versions for synchronous legacy calls before executing clear.
* `decoder-reject.json` reaches the actual native decoder with epoch
  `[0,22764,0,832]`: zero active writers, no poison, and a non-null read stamp.
  Nevertheless `sourceFound=false`. The actual upload still owes descriptor
  3483180 / serial **445**, while the latest sealed record names the same
  descriptor / serial **446**, source version 409, host version **831**.
  That latest record is not superseded at this sample. Neither a safe epoch
  nor equal descriptor/front addresses authorizes borrowing its request.

The native decoder is therefore refusing both an obsolete host lifetime and
an exact owed-request mismatch. The new boundary checks alone cannot fix the
interval between owning swap completion, the next clear, and native owed-upload
delivery. The earlier no-writer-at-main-boundary assumption is no longer used.
All 441 final source seals have sole stable unpoisoned beforeSwap/sealEntry/
sealExit states, with no source-version rejection. Final dispositions are
**383 coalesced-before-publication, 56 source-version-overwritten and 2
run-normal-shutdown**. No GDI substitute was counted.

Ordinary display was **not permanently starved** in this run: passive samples
show the renderer's last-composition timestamp advancing from 79469.35 to
170184.7 ms while observation remained live, and reviewed captures show normal
world/pose changes. Active writers defer presentation and retain damage, as
intended; these samples do not establish a maximum hold duration or an FPS.

A safe next repair needs a production ordering or immutable-source handoff
that connects the owning completed flip to its **actual** owed-present request
before intervening mutation. It must retain the old-source, unsupported-call,
async-writer, host-version, page, owner and exact-request rejection controls.
Whitelisting clear, adopting the newest journal request, disabling observation
or publishing through an active writer would bypass those controls. None was
done. No second original was started. Full27, parity, audio and FPS stay open.

## Lifecycle and retained failures

An observable detached independent 25-minute watchdog was armed before create;
overall/browser/cleanup deadlines were immutable. The accepted parent startup
queue, subreaper and WNOHANG reaper held the remote runtime lock before
provisioning through descendant drain. No local heavy runtime was launched and
no local runtime lock was held during provisioning, supervision or retrieval.
Read-only CDP helper processes were synchronously parent-awaited with retained
transport exit receipts; their breakpoints were bounded and removed.

All seven queued commands ACKed, including the explicit zero-effect stale
review refusal. A malformed observation-arm request omitted `waitMs` and
failed the transport budget assertion **before queuing**; its failure is
retained. The separate correctly bounded observation request was the only arm
executed. No input/capture with UNKNOWN outcome was replayed. The inherited
truncated-response UNKNOWN remains unchanged. Broad diagnostic outputs were
stored remotely and retrieved via hash manifests; terminal display truncation
of a locally verified JSON file did not replace its retained full bytes.

The first drain assertion found the controller still alive after Chromium had
closed. It is retained. Subsequent exact process inspection found that
controller absent without a signal; the final distinct settled census passed.
All **33 PID/start identities**, including adopted descendants, were absent;
seven adopted child reaps were recorded. Bootstrap/custodian, endpoints/ports,
profile, command writer and held inputs drained, and the remote lock released.
The initial audit's lower bound of 500 ms failed on the actual 499 ms Enter
receipt; that failure is retained and the requested/measured values are both
reported explicitly.

Before normal stop, **117 artifact references / 230,524,323 bytes** were
retrieved and independently hash-reread, including six CRC-validated PNGs,
actual modules, complete journal and custody histories. Normal/watchdog
children exited zero; the supervisor ended empty. `final-audit.json` verifies
these facts separately from `taskDoneConditionMet=false`.

Box **`bx_9g3gxu95` is archived**, expiry null. Normal stop
**`stop_87d38cea39ee9af1`** completed **13:12:17.662 UTC**, forced=false,
error=null. No old box was resumed/deleted, no public deployment occurred and
no subworker was launched.

Recovery uses exact Git SHA/blob pins, `relevant.diff`, small owned-helper
patches and existing media path/hash references. Git remains the source
archive. No source/media archives were made. The next work is the concrete
publication-order repair above, followed by its focused tests and locked build;
a further unchanged-limit original run is not justified by this evidence.
