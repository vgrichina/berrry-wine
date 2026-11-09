# Q2 rejected-frame return values, 1250

The existing serialized `tools/quake2-passive-attack.cjs` reader now returns
`rejectedFrame` when owner, attack/binding, motion, or damage validation rejects
a sample. It retains the already-read `motionFirst`/`motionSecond` objects
(state, slot, current240 bytes, published240 bytes) and `damageFirst`/
`damageSecond` ring3840 bytes. Early rejection leaves not-yet-read values null.
`predicates` records booleans at the existing checks; absent keys mean the
check was short-circuited or never reached. Owner/canonical/bounds guards,
motion equality/active/valid/frame/time/pmType/publication checks, attack and
binding stability, and damage equality/decode/history checks retain their
existing evaluation order. No shared-memory read, retry, acceptance change,
terminal follow-up, health waiver, or new observation layer was added.

Accepted results omit the diagnostic. The unchanged actual1205 generated
`retainHealth` already logs the whole `attackInput` before rejecting it in
`passive-health-history.jsonl`; that existing sink therefore retains the raw
values on the first UNKNOWN, even though the compact first-health-terminal
file continues to contain damage feedback only. No consumer/sink edit was
needed. These remain point samples: native cause, freshness, all-writers and
edict ABA are UNKNOWN. Actual1205 cannot be retrospectively diagnosed.

Evidence: `scratch/runs/20261109-quake2-rejected-frame-values-1250/`.
`git-base.txt` records the exact starting commit; `relevant-uncommitted.patch`
includes the small provider/test/note patch, with new files included. Git is
the source archive. No archives, media or module copies were made.

`tools/quake2-rejected-frame-values.test.cjs` loads the actual1205 pinned old
reader from Git and checks its SHA, authenticates the retained1205 health
preload, and executes old/new serialized readers against authored shared-memory
fixtures. All18 controls pass: normal100, damage98, death0, signed death-1,
current/published mismatch, between-read frame change, inactive state,
malformed time/valid/pmType/feedback, ring change, owner/memory rebind before
and during reads, unreadable memory, and expected-memory identity change.
Every pair has identical ordered owning-memory byte/u32 reads and physical
reads, and identical results after removing the diagnostic/timestamp. Raw
diagnostic bytes match the fixture's exact first/second state and ring values.
Old missing-values checks FAIL and new diagnostic checks PASS for each
rejected sample; no repair of the native1205 failure is claimed.

The complete generated1205 health consumer is compiled and its declarations
execute with inert filesystem/process/logging adapters and its startup IIFE
replaced by a test access seam. No browser startup/lifecycle is exercised.
The existing health functions and sink execute unchanged: normal stays live;
loss/death/UNKNOWN remain terminal; terminal/closing passive ticks start zero
reads. Real production `input.hold` controls prove independent UP and sticky
first health failure despite later persistence or UP failure. Initial test
attempt01 failed on cross-VM array prototypes in the trace assertion; the
harness now normalizes traces. Fresh attempts02 and03 pass, with03 validating
exact raw bytes and the final provider. All outputs use fresh paths.

Existing passive-attack and passive-damage suites pass (including sparse
translation races and zero guest-memory writes). The required
`flock /tmp/wine-build.lock bash tools/build.sh` passes. Command/hold caps,
first HP loss/death/UNKNOWN policy and native input providers are unchanged.
Free /home remained above1.5GB.

No Box, browser, guest, agents, workers, deployment or native experiment.
Prior `bx_cq8zqp74`, UUID179a8a60-1e58-4425-9a22-15f4fedc2187, remains
UNCONTACTED: inherited ARCHIVED/PHYSICAL_DRAINED, normal stop
`stop_fad5e3232932c556` completed2026-11-09T11:44:31.856Z, initial
expiry2026-11-09T12:02:52.623Z; final expiresAt was not returned.
Next: review this offline diagnostic change; any native run needs separate
authorization. Native REVOKED; all-writers/edict ABA UNKNOWN. SingleTaskSTOP.
