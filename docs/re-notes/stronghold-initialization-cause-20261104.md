# Stronghold initialization and block-RPC cause, 2026-11-04

Input: `ef2bb82493d7157651b4260c0b0498bdab4b85ec` and
[the named-observation handoff](stronghold-named-observation-gameplay-20261104.md).
Evidence: `scratch/runs/20261104-stronghold-initialization-cause/`.

The first fault has a tested transport repair. Quiet Worker imports omitted
`log_block` from the existing local no-op logging policy. Arming the owning
native observer therefore also made every original block perform a synchronous
Worker-to-main RPC, whose normal browser implementation is `() => {}` in
`lib/host-imports.js`. The observer already receives that block in the Worker
before forwarding the original import. The repair includes `log_block` in the
existing quiet policy; explicit `forwardGuestLogs` and legacy `forwardGlLogs`
opt-ins retain the original synchronous delivery and exception propagation.

## What the retained original establishes

The actual command began at 21:59:24.504Z. DOWN was consumed and UP was
enqueued at 21:59:37.519Z; UP remained queued at step 11,584 when the original
40-second command/review deadline stopped execution at 22:00:03.896Z. The
physical gesture was balanced. The observer retained 2,851,000 boundaries,
55 records, no observer fault, and pending callback/setup return intervals.

Setup entered at boundary 875,864. Later ACK PCs progress through original
helpers `0x46d480`, `0x4ec2a8`, `0x4d6ea7`, `0x4d7333`, `0x4d7378` and
finally `0x4ec4f9`. The last native boundary PC is `0x4ec51a`; the sampled
next EIP is `0x4ec4f9`. These are different observation points, not competing
claims about an ACK EIP, which remains zero.

Original setup calls `0x4ec480` at `0x429151`, with object `0xfb4d08`.
That initializer calls the previously sampled helpers, then executes
`0x4ec4e8`–`0x4ec526`: initialize EDI to `0x13a10` (80,400), inspect one
32-bit source entry, store one 16-bit result, advance both pointers, decrement
EDI, and loop while nonzero. Types 16 and 32 select the global base value and
base-plus-one; other types select base-plus-two. There is no input poll,
host import, wait or nested call in this loop. Thus pending UP is consistent
with synchronous setup still running, not evidence of an unbalanced mouse or
a host queue-drain defect. Historical EDI/data were not retained; static code
alone cannot establish the original loop's remaining iterations or rule out
every guest-state defect.

The fixed observer arms all block boundaries, so the omitted quiet policy
adds a synchronous no-op round trip at each of those 2,851,000 boundaries.
The measured first-fault fragment below isolates that cost without changing
the guest, observer, pacing, command deadline or any guard. This identifies
and repairs avoidable transport overhead at the timeout; it does not prove
that the entire setup and subsequent rendering will now finish within 40s.

## Discriminating original-code fixture

`node test/test-stronghold-owning-callback-observer.js --initializer-only`
uses both existing shipped modules in the actual OS Worker and real broker.
The original EXE is loaded unchanged. Only fixture data/registers are
initialized; a debugger breakpoint stops before the next helper at
`0x4ec526`. The fragment's original bytes are checked before and after.
All 80,400 elements exercise a repeating 16/32/other pattern, including
16-bit wraparound, with guards on both sides of the output.

Untraced, quiet traced, locally observed and explicitly forwarded observed
arms have identical run commands, returned block counts, PCs, remaining EDI
checkpoints and output hashes. All exit at the breakpoint with EDI zero and
the exact final source/destination pointers. The observed and forwarded
reports are identical, including all native records and limits:
294,800 observed boundaries, with 294,801 blocks retired including the
breakpoint accounting. Quiet observation sends zero block RPCs; explicit
forwarding sends exactly 294,800 synchronous block RPCs. The old quiet
implementation fails the zero-RPC assertion with `294800 !== 0`.

The final paired samples took 90ms and 129ms for local observation, versus
3,805ms and 3,398ms with synchronous forwarding, for normal and compatibility
modules respectively. These are isolated Node fixture timings, not browser
gameplay rates or a guarantee of original setup completion. The immutable
original fragment, output and observation parity are the acceptance criteria.

Default, explicit and legacy flag cases also verify argument delivery and
synchronous failure propagation. The complete owning callback fixtures pass
with all-page parity between quiet traced, observed and untraced controls;
the old diagnostic-RPC page difference is now absent. The older native
preset fixture explicitly opts into forwarding and preserves its existing
RPC-page, saved-return, trap and guard oracles. Broker caller-stack, thrown
import and nested-wait regressions pass. The full flocked build passes.

## Scope and lifecycle

No native observer source, boundary/deadline/byte/record/owner/nesting/input/
ACK guard, route cap, command/review deadline, guest code/configuration or
16ms pacing changed. The runtime authorization and release-gate helpers are
unchanged because no original is launched in this assignment. Production
broker editing waited until the actual `mdk2-medium-release-gameplay-2210`
LOCAL HEAVY RELEASE at 22:20:20Z, following its current OWN entry. During
that original, the candidate was compiled only in memory for offline tests;
the pinned disk dependency was untouched. The applied production file's SHA
exactly matches that tested candidate.

This assignment stops at the tested causal repair. Setup return, callback
return, rendered setup, preset, Start, world and gameplay remain unverified.
A later separately authorized original must preflight its complete fresh
entry and actual caller commands, bind its current dependency release, and
obey the same one-attempt and first-fault closure rules. No actual runtime
release is fabricated from these fixtures.

Zero Chrome launches, shared runtime-lock acquisitions, ports, profiles or
boxes belong to this assignment. No new original PID/start/exit record exists.
Box ID/state/expiry are NA; the coordinator retains shutdown ownership.
Evidence records Git SHA and relevant binary/new-file patches; existing EXE,
modules and retained inputs are referenced by path and SHA. Needed archived
inputs were restored with `gzip -dk` and verified against the original hashes
in `scratch/usage-watch/released-headroom-2209.jsonl`. No source snapshots,
tarballs, copied modules/media, npm operations or subworkers were used.
