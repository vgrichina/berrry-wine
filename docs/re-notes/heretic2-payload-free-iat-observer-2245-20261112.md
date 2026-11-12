# Heretic II: payload-free observation and IAT reentry

2026-11-12. Evidence: `scratch/runs/20261112-heretic2-payload-free-iat-observer-2245/`.

The [parent WriteFile decoder](heretic2-save-stage-correlation-2230-20261112.md)
violated the restriction. Its decoded output was
not inspected or reused here; prior compliance is not claimed. The archived
parent box and its historical observations remain untouched.

Before this original, both composed API hooks were replaced with metadata-only
recorders. They read API-name metadata, public stack arguments and return address,
the transferred-count DWORD and existing runtime getters. They do not dereference
file buffers, decode guest strings passed as arguments, inspect guest private
structures, call guest functions or query GetLastError/GL. The renderer observer's
additional GL queries were also removed. No runtime or guest patch was made.

The source-backed synthetic fixture executes a real x86 CALL through an IAT into
the frozen 8a834 dispatcher and lazy VFS. The old classifier produces UNKNOWN
because entry EIP is the caller while io_block sets post-handler EIP to the
reentry thunk. The new classifier reads the existing com_callback_get_thunk
getter and requires matching thunk, status997, yield12/flag1, API-call count,
thread, stack frame, public return address/arguments and filesystem import
arguments/thread. Completion retains guestReturn UNKNOWN until an independently
observed runtime-return boundary matches. Historical parks were not relabeled.

Actual composed legacy/new hooks plus full frozen owning-Worker startup pass
Node tests with payload/private-address reads forbidden; the native Chromium
Worker independently reproduces the IAT failure and fix. Synthetic COM entry,
status995 cancellation, identical throws, once-only forwarding, receiver/argument
and return identity, missing-state UNKNOWN and getter/sink isolation pass.

Both recorders use bounded 4,096-row selected rings and bounded pending/frame
state. Drawing and unnamed noise is counted and suppressed. Persistence uses
bounded snapshots rather than per-call append logs. Overflow and phase tests
pass before allocation. The driver resets and phase-tags both buffers immediately
before the authorized load Enter, preserving startup counts separately. Retained
read requests have a 30-second hard cap, with UNKNOWN and no replay on expiry.

Exact four-save closure, actual provider validation, seven negative stage cases,
and final staged imports pass. The locked build passes and produces unchanged
module `04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
The baseline is `8a834a3dc7affc8c6e53245beab56e87a32b81e8`; renderer provider is
`4235d20d7fc2404b38f6e4f7f80c92d5f94f1513b4d6d7dcf04be34162a4b087`.
Unchanged identity/freshness/independent-UP proofs are reused by their SHA.

A fresh observable independent two-hour watchdog preceded creation of
`bx_6c3vkfte` at 22:40:51Z. All 2,460 remote hashes and actual provisioning join
0/both EOFs passed. The first local original-launch check refused below the
1,500,000,000-byte floor without submitting a launch. A bounded local hold on
the designated recovery handle then observed actual free space above the floor;
no cache or other worker's files were changed. One original was then launched.

The actual original reached normal Game → Easy → upright textured docks HUD100,
then mounted and hash-read back exactly all four saves. The console blank prompt
was reviewed. Exactly `load crate0400` was typed once. Its first capture still
showed a blank prompt; a necessary read-only settled capture then showed exactly
the command. **Enter was never sent; no load or Exit8 occurred in this run.**

This exposed a new driver blocker I introduced: the phase-reset gate asserts that
the latest capture label equals `load-typed`. A newer valid `typed-settled` capture
therefore prevents reset/Enter. `test-driver-phase.cjs` executes the exact frozen
driver function with mocked host boundaries: `load-typed` permits one reset,
DOWN and UP; `typed-settled` rejects before reset or input. Its recorded source SHA
matches the frozen original helper. I should have included this actual-driver
path before freezing. The earlier phase/overflow tests covered the composed
recorders, not this label coupling. No live helper was patched, no Enter was
submitted to a known rejecting gate, and no second original was started.

The recovered original startup rings independently qualify **149 actual
caller-to-thunk parks and 149 correlated retries** in each recorder. Each holds
4,096 selected rows, with 14,957 evictions, zero observer/sink errors and no drawing
rows. The retained ReadFile posts comprise 149 internal parks and 414 completed
handler frames; all 563 guestReturn fields remain UNKNOWN. Counts explicitly
remain startup phase with zero resets. This is actual startup correlation evidence,
not validation of retention through an ordinary load. That load remains untested.
No historical observation was backfilled. No file payload was decoded by these
hooks; the mount readback was solely the authorized host-VFS hash comparison.

Ordinary browser closure was ACKed at 22:57:35Z, not a guest quit or ExitProcess.
Chrome exited 0; the actual original owner wait joined 0 with stdout/stderr EOFs,
and its confirmed-dead profile was removed. The retained observer read completed
without the parent's disposal hang. **134 unique blobs / 164 paths / 6,607,591 gzip
bytes** were recovered with remote raw SHA and complete local roundtrip checks
before delegated normal stop. `bx_6c3vkfte` was archived at 22:58:53Z, expiry null,
receipt **`stop_3af57d842f39ffab`**, completed/unforced/error null. Normal stop and
independent watchdog actual waits are 0 with both EOFs. The local exec session
for start.py ended 143; no manager-parent wait record exists, so that wait/EOF
result is UNKNOWN. No billing box remains for this task.

Only task-owned completed logs/proofs were losslessly compressed during the local
holds. The designated recovery handle and its files were untouched. No RAM,
resource arithmetic, reserve/cache change, guest RE/disassembly/private-structure
inspection, extraction, guest patch, substitute DLL, added GL/GetLastError query,
new clock/config write, child worker, other game or public deployment was introduced.
The inherited threads=1 launcher setting remains part of the unchanged route.
There is no new SW31 pair, Exit8-cause, full27, FPS, audio, parity, playability or
general crash claim.

Git plus binary diffs and owned helper patches are the recovery archive; media
remain path/size/SHA references. `RECOVERY.md` explains compressed proof segments.
The next original requires a meaningful driver regression that allows a newer
reviewed bound settled frame after the sole typing intent, retains all freshness
and identity guards, and resets both recorders exactly once before Enter. The
existing frozen helper must not be reused for that path. This task stops at the
new distinct pre-Enter driver blocker; Exit8 cause remains UNKNOWN.
